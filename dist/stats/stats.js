const colors={'1-5':'#2a64a3','2-1':'#b56828','2-3':'#368064','2-5':'#8563ae'};
const classes=['1-5','2-1','2-3','2-5'];
const labels={'1-5':'1–5','2-1':'2–1','2-3':'2–3','2-5':'2–5'};
const number=new Intl.NumberFormat('ja-JP');
const status=document.getElementById('status');
const period=document.getElementById('period');
let data;

function dateLabel(day){const [year,month,date]=day.split('-').map(Number);return `${month}/${date}`;}
function dayBefore(day,amount){const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-amount);return date.toISOString().slice(0,10);}
function todayJst(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function datesBack(count){const end=todayJst();return Array.from({length:count},(_,i)=>dayBefore(end,count-1-i));}
function safeCount(value){return Number.isSafeInteger(value)&&value>=0?value:null;}
function rowsFor(count){const byDay=new Map(data.days.map(row=>[row.date,row]));return datesBack(count).map(date=>({date,counts:classes.map(id=>safeCount(byDay.get(date)?.[id]))}));}
function drawSummary(rows){
  const summary=document.getElementById('summary');summary.replaceChildren();
  classes.forEach((id,index)=>{
    const known=rows.map(row=>row.counts[index]).filter(value=>value!==null);
    const card=document.createElement('article');card.className='card';card.style.setProperty('--class-color',colors[id]);
    const title=document.createElement('h2');title.textContent=`${labels[id]} の閲覧`;
    const value=document.createElement('strong');value.textContent=known.length?number.format(known.reduce((sum,item)=>sum+item,0)):'—';
    const detail=document.createElement('small');detail.textContent=known.length?`${known.length}日分の合計`:'計測データなし';
    card.append(title,value,detail);summary.append(card);
  });
}
function drawChart(rows){
  const holder=document.getElementById('chart');holder.replaceChildren();
  const valid=rows.flatMap(row=>row.counts).filter(value=>value!==null);
  if(!valid.length){holder.textContent='計測データが届くと、ここに推移が表示されます。';return;}
  const max=Math.max(1,...valid);const width=900,height=260,left=38,right=16,top=12,bottom=31;
  const x=index=>left+(width-left-right)*(rows.length===1?0:index/(rows.length-1));
  const y=value=>top+(height-top-bottom)*(1-value/max);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('aria-hidden','true');
  const add=(tag,attrs,text)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,String(value)));if(text!==undefined)node.textContent=text;svg.append(node);return node;};
  for(let step=0;step<=4;step++){const value=Math.round(max*step/4),yy=y(value);add('line',{x1:left,y1:yy,x2:width-right,y2:yy,class:'grid'});add('text',{x:left-8,y:yy+4,'text-anchor':'end',class:'axis'},number.format(value));}
  [0,Math.floor((rows.length-1)/2),rows.length-1].forEach(index=>add('text',{x:x(index),y:height-7,'text-anchor':index===0?'start':index===rows.length-1?'end':'middle',class:'axis'},dateLabel(rows[index].date)));
  classes.forEach((id,classIndex)=>{
    let points=[];
    const flush=()=>{if(points.length>1)add('polyline',{points:points.map(([xx,yy])=>`${xx},${yy}`).join(' '),stroke:colors[id],class:'line'});else if(points.length===1)add('circle',{cx:points[0][0],cy:points[0][1],r:3,fill:colors[id],class:'point'});points=[];};
    rows.forEach((row,index)=>{const value=row.counts[classIndex];if(value===null){flush();return;}points.push([x(index),y(value)]);});flush();
  });
  holder.append(svg);
}
function drawTable(rows){
  const body=document.getElementById('daily');body.replaceChildren();
  if(!rows.some(row=>row.counts.some(value=>value!==null))){
    const tr=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=6;cell.className='empty';cell.textContent='まだ記録はありません。';tr.append(cell);body.append(tr);return;
  }
  rows.slice().reverse().forEach(row=>{
    const tr=document.createElement('tr');const values=row.counts;
    const cells=[row.date,...values.map(value=>value===null?'—':number.format(value)),values.every(value=>value!==null)?number.format(values.reduce((sum,value)=>sum+value,0)):'—'];
    cells.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});body.append(tr);
  });
}
function render(){
  const rows=rowsFor(Number(period.value));
  drawSummary(rows);drawChart(rows);drawTable(rows);
  document.getElementById('updated').textContent=data.updatedAt?`最終更新：${new Date(data.updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}`:'計測開始前';
  status.textContent=data.days.length?'':'まだ閲覧数の記録はありません。';
}
period.addEventListener('change',render);
try{
  const response=await fetch(`./data.json?ts=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw new Error('data unavailable');
  data=await response.json();
  if(!Array.isArray(data.days))throw new Error('invalid data');
  render();
}catch{status.textContent='閲覧数を取得できませんでした。時間をおいて再読み込みしてください。';}
