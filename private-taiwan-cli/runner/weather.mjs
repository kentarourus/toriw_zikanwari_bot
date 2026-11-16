export async function weatherContext(messages,fetcher=fetch){
 const recent=messages.slice(-3).map(m=>m.content).join('\n');
 if(!/天気|気温|予報|降水|雨|台風|傘|服装|暑|寒|weather|temperature/i.test(recent))return '';
 const places=[[/九份/,'九份',25.109,121.845],[/高雄/,'高雄',22.6273,120.3014],[/台南/,'台南',22.9999,120.2269],[/台中/,'台中',24.1477,120.6736],[/花蓮/,'花蓮',23.9872,121.6015],[/基隆/,'基隆',25.1276,121.7392]];
 // Only explicit locations in the latest user request override the Taipei trip base.
 const latest=messages.filter(m=>m.role==='user').at(-1)?.content||'';
 const place=places.find(([pattern])=>pattern.test(latest))||[null,'台北',25.033,121.5654];
 const [,name,latitude,longitude]=place;
 const url=new URL('https://api.open-meteo.com/v1/forecast');url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'temperature_2m,apparent_temperature,precipitation,weather_code',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',timezone:'Asia/Taipei',forecast_days:'16'}).toString();
 try{
  const response=await fetcher(url,{signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('weather unavailable');const data=await response.json();
  if(!Array.isArray(data.daily?.time)||!data.daily.time.length)throw Error('weather data missing');
  const days=data.daily.time.map((date,i)=>({date,maxC:data.daily.temperature_2m_max?.[i],minC:data.daily.temperature_2m_min?.[i],rainPercent:data.daily.precipitation_probability_max?.[i],weatherCode:data.daily.weather_code?.[i]}));
  return `最新の天気資料（${name}、台湾現地時間）。Open-Meteoの数値予報であり、実測値と混同しない。現在: ${JSON.stringify(data.current||{})}。日別予報: ${JSON.stringify(days)}。単位は気温°C、降水確率%。nullは欠測。指定日がこの期間外なら予報未取得と明記し、平年の傾向を当日の予報にしない。台風・警報は台湾中央気象署をWeb検索で確認。参照先: [Open-Meteo](${url.href}) / [台湾中央気象署](https://www.cwa.gov.tw/)。`;
 }catch{return `最新の${name}の天気データは取得できませんでした。天気を尋ねられたらWeb検索で台湾中央気象署等を確認し、確認できなければ未確認と答えてください。`;}
}
