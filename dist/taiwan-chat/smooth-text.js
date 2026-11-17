export function createSmoothText({write,reducedMotion=()=>false,schedule=fn=>setTimeout(fn,32),cancel=clearTimeout,now=()=>Date.now()}){
 let target='',shown='',timer=null,deadline=null,resolve=null;
 const settle=()=>{const done=resolve;resolve=null;done?.();};
 function tick(){timer=null;const rest=Array.from(target.slice(shown.length));if(reducedMotion()||(deadline!==null&&now()>=deadline))shown=target;else shown+=rest.slice(0,Math.max(2,Math.ceil(rest.length/8))).join('');write(shown);if(shown!==target)timer=schedule(tick);else{deadline=null;settle();}}
 function update(value){if(value===target)return;if(!value.startsWith(target)){if(timer!==null)cancel(timer);timer=null;shown='';settle();}target=value;if(reducedMotion()){if(timer!==null)cancel(timer);timer=null;shown=target;write(shown);settle();}else if(timer===null)timer=schedule(tick);}
 function reset(){if(timer!==null)cancel(timer);timer=null;deadline=null;target='';shown='';settle();}
 function finish(value){update(value);if(shown===target)return Promise.resolve();deadline=now()+240;return new Promise(done=>{settle();resolve=done;if(timer===null)timer=schedule(tick);});}
 return {update,finish,reset};
}
