const place=value=>{
 if(typeof value!=='string'||!value.trim()||value.length>250||/[\u0000-\u001f]/.test(value))throw Error('目的地・出発地を確認してください。');
 return value.trim();
};
export const directionsSpec={name:'get_map_directions',description:'徒歩・公共交通のGoogleマップ経路リンクを作成する。経路計算や現在地の取得は行わない。originType=currentは地図を開く端末の現在地（未取得なら入力画面）、hotelはしおりの宿泊先、placeは利用者が指定・共有した地名/住所/座標。目的地が曖昧なら先に確認。架空の座標を使わない。',annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},inputSchema:{type:'object',properties:{destination:{type:'string',maxLength:250},originType:{type:'string',enum:['current','hotel','place']},origin:{type:'string',maxLength:250},mode:{type:'string',enum:['walking','transit']}},required:['destination','originType','mode'],additionalProperties:false}};
export function mapDirections({destination,originType,origin,mode},hotelAddress){
 if(!['current','hotel','place'].includes(originType)||!['walking','transit'].includes(mode))throw Error('出発地・移動手段を確認してください。');
 const target=place(destination),url=new URL('https://www.google.com/maps/dir/');
 url.searchParams.set('api','1');url.searchParams.set('destination',target);url.searchParams.set('travelmode',mode);url.searchParams.set('hl','ja');
 let originLabel='地図を開く端末の現在地（取得できなければ地図で指定）';
 if(originType!=='current'){
  originLabel=place(originType==='hotel'?hotelAddress:origin);
  url.searchParams.set('origin',originLabel);
 }
 return {url:url.href,origin:originLabel,destination:target,mode,routeComputed:false,notice:'経路リンクを作成しました。実際の道順・乗換・所要時間・運賃・運行状況はGoogleマップを開いて確認してください。現在地を自動取得・送信する機能ではありません。'};
}
export function useGeneratedMapLinks(answer,links){
 if(!links.length)return answer;
 let result=answer.replace(/https:\/\/www\.google\.com\/maps\/dir\/\?[^\s<>"）)]+/g,raw=>{
  try{const url=new URL(raw),match=links.find(link=>new URL(link.url).searchParams.get('destination')===url.searchParams.get('destination')&&link.mode===url.searchParams.get('travelmode'));return match?.url??raw;}catch{return raw;}
 });
 for(const link of links)if(!result.includes(link.url))result+=`\n\n[${link.mode==='walking'?'徒歩':'公共交通'}の経路をGoogleマップで確認](${link.url})`;
 return result;
}
