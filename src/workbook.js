import {unzipSync, strFromU8} from 'fflate';
import {XMLParser} from 'fast-xml-parser';

const list=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@',removeNSPrefix:true,parseTagValue:false});
const value=v=>typeof v==='object'?v?.['#text']??'':v??'';
const text=v=>v?.r?list(v.r).map(r=>value(r.t)).join(''):String(value(v?.t));
const hex=v=>/^[\da-f]{6}$/i.test(v??'')?'#'+v.toLowerCase():null;
function color(c,theme){if(!c)return null;if(c['@rgb'])return hex(c['@rgb'].slice(-6));if(c['@theme']!==undefined)return theme[Number(c['@theme'])]??null;return null;}
export function readWorkbook(bytes){
 const files=unzipSync(new Uint8Array(bytes));
 const xml=path=>files[path]?parser.parse(strFromU8(files[path])):{};
 const themeXml=xml('xl/theme/theme1.xml').theme?.themeElements?.clrScheme??{};
 const theme=['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'].map(k=>hex(themeXml[k]?.srgbClr?.['@val']??themeXml[k]?.sysClr?.['@lastClr']));
 const styles=xml('xl/styles.xml').styleSheet??{};
 const fonts=list(styles.fonts?.font),fills=list(styles.fills?.fill),xfs=list(styles.cellXfs?.xf);
 const shared=list(xml('xl/sharedStrings.xml').sst?.si);
 const relationships=list(xml('xl/_rels/workbook.xml.rels').Relationships?.Relationship);
 const sheets={},formats={},links={};
 for(const sheet of list(xml('xl/workbook.xml').workbook?.sheets?.sheet)){
  const name=sheet['@name'];if(!['時間割','連絡'].includes(name))continue;
  const target=relationships.find(r=>r['@Id']===sheet['@id'])?.['@Target'];if(!target)throw new Error('Missing worksheet');
  const path=target.startsWith('/')?target.slice(1):'xl/'+target;
  const rows=[],cells={},worksheet=xml(path).worksheet;
  for(const row of list(worksheet?.sheetData?.row))for(const c of list(row.c)){
   const address=c['@r'],match=address?.match(/^([A-Z]+)(\d+)$/);if(!match)continue;
   let column=0;for(const ch of match[1])column=column*26+ch.charCodeAt(0)-64;
   const r=Number(match[2])-1;rows[r]??=[];
   const string=c['@t']==='s'?shared[Number(value(c.v))]:c.is;
   rows[r][column-1]=c['@t']==='s'||c['@t']==='inlineStr'?text(string):String(value(c.v));
   const xf=xfs[Number(c['@s']??0)]??{},font=fonts[Number(xf['@fontId']??0)],fill=fills[Number(xf['@fillId']??0)]?.patternFill;
   const rich=list(string?.r).map(run=>color(run.rPr?.color,theme)).filter(Boolean);
   cells[address]={background:fill?.['@patternType']==='solid'?color(fill.fgColor,theme):null,foreground:color(font?.color,theme),richColors:[...new Set(rich)]};
  }
  applyConditions(rows,cells,list(worksheet?.conditionalFormatting),list(styles.dxfs?.dxf),theme);
  const relPath=path.replace(/\/([^/]+)$/, '/_rels/$1.rels');
  const sheetRelations=list(xml(relPath).Relationships?.Relationship);
  links[name]={};
  for(const hyperlink of list(worksheet?.hyperlinks?.hyperlink)){
   const target=hyperlink['@location']??sheetRelations.find(relation=>relation['@Id']===hyperlink['@id'])?.['@Target'];
   if(target)links[name][hyperlink['@ref']]=target;
  }
  sheets[name]=rows;formats[name]=cells;
 }
 if(!sheets['時間割']||!sheets['連絡'])throw new Error('Missing required sheets');
 return {sheets,formats,links,capturedAt:new Date().toISOString()};
}
function coordinates(address){const m=address.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/);if(!m)return null;let c=0;for(const ch of m[2])c=c*26+ch.charCodeAt(0)-64;return {c:c-1,r:Number(m[4])-1,fixC:!!m[1],fixR:!!m[3]};}
function addressOf(r,c){let name='';for(let n=c+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name+(r+1);}
export function applyConditions(rows,cells,conditions,dxfs,theme=[]){
 const rules=conditions.flatMap(group=>list(group.cfRule).map(rule=>({rule,ranges:String(group['@sqref']??'').split(/\s+/)}))).sort((a,b)=>Number(b.rule['@priority'])-Number(a.rule['@priority']));
 for(const {rule,ranges} of rules){
  // Evaluate only the numeric cell-equality rules used by this timetable. Never execute spreadsheet formulas as JavaScript.
  const match=String(rule.formula??'').match(/^\s*(\$?[A-Z]+\$?\d+)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/);
  if(rule['@type']!=='expression'||!match)continue;
  const reference=coordinates(match[1]),anchor=coordinates(ranges[0].split(':')[0]),dxf=dxfs[Number(rule['@dxfId'])];if(!anchor||!reference||!dxf)continue;
  for(const range of ranges){const [from,to=from]=range.split(':'),start=coordinates(from),end=coordinates(to);if(!start||!end)continue;
   for(let r=start.r;r<=end.r;r++)for(let c=start.c;c<=end.c;c++){
    const rr=reference.r+(reference.fixR?0:r-anchor.r),cc=reference.c+(reference.fixC?0:c-anchor.c);
    const actual=rows[rr]?.[cc];if(actual===undefined||String(actual).trim()===''||Number(actual)!==Number(match[2]))continue;
    const style=cells[addressOf(r,c)]??={background:null,foreground:null,richColors:[]};
    const foreground=color(dxf.font?.color,theme),fill=dxf.fill?.patternFill;
    if(foreground)style.foreground=foreground;
    if(fill?.['@patternType']==='solid')style.background=color(fill.fgColor??fill.bgColor,theme);
   }
  }
 }
}
