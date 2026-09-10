const isColor=c=>/^#[\da-f]{6}$/i.test(c??'');
const neutral=c=>!c||['#000000','#ffffff'].includes(c.toLowerCase());
export function legendFrom(data){const rows=data.sheets?.['時間割']??[],formats=data.formats?.['時間割']??{};return ['C','D','E','F','G'].map((column,i)=>({label:String(rows[14]?.[i+2]??''),...formats[`${column}15`]})).filter(x=>x.label);}
export function labelsFor(style,legend){if(!style)return [];return legend.filter(item=>
 (!neutral(item.background)&&item.background===style.background)||
 (!neutral(item.foreground)&&(item.foreground===style.foreground||style.richColors?.includes(item.foreground)))
 );}
export function applyColor(node,style){if(!style)return;if(isColor(style.background))node.style.backgroundColor=style.background;if(isColor(style.foreground))node.style.color=style.foreground;}
