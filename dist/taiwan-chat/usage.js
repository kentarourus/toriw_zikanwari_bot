export function normaliseUsage(usage){
 if(!usage||!Number.isSafeInteger(usage.input_tokens)||usage.input_tokens<0||!Number.isSafeInteger(usage.output_tokens)||usage.output_tokens<0)return null;
 const optional=key=>Number.isSafeInteger(usage[key])&&usage[key]>=0?usage[key]:null;
 return {input_tokens:usage.input_tokens,output_tokens:usage.output_tokens,cached_input_tokens:optional('cached_input_tokens'),reasoning_output_tokens:optional('reasoning_output_tokens')};
}
export function sumUsage(messages){const known=messages.filter(m=>m.role==='assistant').map(m=>normaliseUsage(m.usage)).filter(Boolean);const sum=key=>known.reduce((n,u)=>n+(u[key]||0),0);return {count:known.length,unknown:messages.filter(m=>m.role==='assistant'&&!normaliseUsage(m.usage)).length,input:sum('input_tokens'),output:sum('output_tokens'),cached:known.some(u=>u.cached_input_tokens!==null)?sum('cached_input_tokens'):null,total:sum('input_tokens')+sum('output_tokens')};}
