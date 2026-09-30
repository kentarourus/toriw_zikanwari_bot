import fs from 'node:fs';

const site=process.env.GOATCOUNTER_SITE||JSON.parse(fs.readFileSync('dist/stats/config.json','utf8')).site;
const token=process.env.GOATCOUNTER_API_KEY;
if(!site||!/^[a-z0-9-]+$/.test(site)||!token)throw new Error('GOATCOUNTER_SITE and GOATCOUNTER_API_KEY are required.');

const file='dist/stats/data.json';
const current=JSON.parse(fs.readFileSync(file,'utf8'));
const classInfo=JSON.parse(fs.readFileSync('config/classes.json','utf8'));
const classes=classInfo.map(item=>item.id);
const trackedAt=current.firstTrackedDate||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const start=new Date(`${trackedAt}T00:00:00+09:00`);
const end=new Date();
end.setUTCDate(end.getUTCDate()+1);
const query=new URLSearchParams({start:start.toISOString(),end:end.toISOString(),limit:'100',group:'day'});
const response=await fetch(`https://${site}.goatcounter.com/api/v0/stats/hits?${query}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
if(!response.ok)throw new Error(`GoatCounter returned ${response.status}`);
const result=await response.json();
if(!Array.isArray(result.hits))throw new Error('GoatCounter returned an invalid response.');
if(result.more)throw new Error('GoatCounter returned more than 100 paths; pagination is required.');

const days=new Map((current.days||[]).map(row=>[row.date,{...row}]));
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const cursor=new Date(`${trackedAt}T12:00:00Z`);
while(cursor.toISOString().slice(0,10)<=today){
  const date=cursor.toISOString().slice(0,10);
  days.set(date,{date,...Object.fromEntries(classes.map(id=>[id,0]))});
  cursor.setUTCDate(cursor.getUTCDate()+1);
}
for(const hit of result.hits){
  const match=/^\/toriw_zikanwari_bot\/classes\/([1-3]-[1-7])\/?$/.exec(hit.path);
  if(!match||!classes.includes(match[1])||!Array.isArray(hit.stats))continue;
  for(const stat of hit.stats){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(stat.day)||!Number.isSafeInteger(stat.daily)||stat.daily<0)continue;
    const row=days.get(stat.day)||{date:stat.day};
    row[match[1]]=stat.daily;
    days.set(stat.day,row);
  }
}
for(const date of days.keys()){
  if(date<trackedAt||date>today)days.delete(date);
}
const sorted=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
if(current.firstTrackedDate===trackedAt&&JSON.stringify(sorted)===JSON.stringify(current.days)){
  console.log('Class visit counts are unchanged.');
  process.exit(0);
}
const next={timezone:'Asia/Tokyo',updatedAt:new Date().toISOString(),firstTrackedDate:trackedAt,classes:classInfo.map(({id,label})=>({id,label})),days:sorted};
fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
console.log(`Saved ${sorted.length} days of class visit data.`);
