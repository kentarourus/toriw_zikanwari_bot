export async function weatherContext(messages,fetcher=fetch){
 const requests=messages.filter(message=>message.role==='user');
 const latest=requests.at(-1)?.content??'';
 const weatherTerms=/天気|気温|予報|降水|雨|台風|傘|暑|寒|weather|temperature/i;
 const weatherQuestion=text=>weatherTerms.test(text)||/服装/.test(text)&&!/しおり|学校|規則|指定|注意/.test(text);
 const followUp=/^(?:(?:じゃあ|では|それなら)[、, ]*)?(?:明日|明後日|その日|翌日|週末|[１２３４1-4]日(?:目)?|台北|九份|高雄|台南|台中|花蓮|基隆)(?:の方|だと)?(?:は|なら)[？?。 ]*$/;
 if(!weatherQuestion(latest)&&!(followUp.test(latest)&&weatherQuestion(requests.at(-2)?.content??'')))return '';
 const places=[[/台北/,'台北',25.033,121.5654],[/九份/,'九份',25.109,121.845],[/高雄/,'高雄',22.6273,120.3014],[/台南/,'台南',22.9999,120.2269],[/台中/,'台中',24.1477,120.6736],[/花蓮/,'花蓮',23.9872,121.6015],[/基隆/,'基隆',25.1276,121.7392]];
 // Only explicit locations in the latest user request override the Taipei trip base.
 const match=[...messages.filter(m=>m.role==='user').map(m=>m.content).join('\n').matchAll(/共有した現在地: 緯度 (-?\d+(?:\.\d+)?), 経度 (-?\d+(?:\.\d+)?)/g)].at(-1);
 const useLocation=match&&Math.abs(Number(match[1]))<=90&&Math.abs(Number(match[2]))<=180&&/共有した現在地|現在地|ここ|この辺|近く|周辺/.test(latest);
 const place=places.find(([pattern])=>pattern.test(latest))||(useLocation?[null,'共有した現在地',Number(match[1]),Number(match[2])]:[null,'台北',25.033,121.5654]);
 const timezone=place[1]==='共有した現在地'?'auto':'Asia/Taipei';
 const [,name,latitude,longitude]=place;
 const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'temperature_2m,apparent_temperature,precipitation,weather_code',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',timezone,forecast_days:'16'}).toString();
 try{
  const response=await fetcher(url,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('weather unavailable');const data=await response.json();
  if(!Array.isArray(data.daily?.time)||!data.daily.time.length)throw Error('weather data missing');
  const row=(...cells)=>cells.map(value=>value??'null').join(',');
  const current=data.current;
  const observations=current?row(current.time,current.temperature_2m,current.apparent_temperature,current.precipitation,current.weather_code):null;
  const days=data.daily.time.map((date,i)=>row(date,data.daily.temperature_2m_max?.[i],data.daily.temperature_2m_min?.[i],data.daily.precipitation_probability_max?.[i],data.daily.weather_code?.[i]));
  return [
   `Open-Meteoの数値予報（${name}、${data.timezone||timezone}、気温°C・降水量mm・確率%・WMO天気コード）。nullは欠測。期間外は未取得。台風・警報は台湾中央気象署で確認。`,
   ...(observations?['現在（日時,気温,体感,降水,天気）: '+observations]:[]),
   '日別（日付,最高,最低,降水確率,天気）:\n'+days.join('\n'),
   `参照: [Open-Meteo](${url.href}) / [台湾中央気象署](https://www.cwa.gov.tw/)`
  ].join('\n');

 }catch{return `最新の${name}の天気データは取得できませんでした。天気を尋ねられたらWeb検索で台湾中央気象署等を確認し、確認できなければ未確認と答えてください。`;}
}
