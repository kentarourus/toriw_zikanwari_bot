export function locationAttachment(position){
 const {latitude,longitude,accuracy}=position.coords||{};
 if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw Error('位置情報を確認できませんでした。');
 const lat=latitude.toFixed(5),lon=longitude.toFixed(5);const time=new Date(Number.isFinite(position.timestamp)?position.timestamp:Date.now()).toISOString();
 const precision=Number.isFinite(accuracy)&&accuracy>=0?`（精度の目安：約${Math.round(accuracy)}m）`:'';
 return {label:`現在地 ${lat}, ${lon}${precision}`,url:`https://www.google.com/maps?q=${lat},${lon}`,content:`共有した現在地: 緯度 ${lat}, 経度 ${lon}${precision}\n取得日時: ${time}\n[地図を開く](https://www.google.com/maps?q=${lat},${lon})`};
}
