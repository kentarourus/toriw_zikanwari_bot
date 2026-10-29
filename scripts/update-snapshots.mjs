import fs from 'node:fs/promises';
import {readWorkbook} from '../src/workbook.js';

const classes=JSON.parse(await fs.readFile(new URL('../config/classes.json',import.meta.url),'utf8'));
const results=await Promise.allSettled(classes.map(async item=>{
  const response=await fetch(`https://docs.google.com/spreadsheets/d/${item.sheetId}/export?format=xlsx`,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error(`${item.id}: ${response.status}`);
  const data=readWorkbook(await response.arrayBuffer());
  await fs.writeFile(new URL(`../${item.snapshot}`,import.meta.url),JSON.stringify(data));
  console.log(`${item.id}: snapshot updated`);
}));
if(results.some(result=>result.status==='rejected'))throw new Error('Some class snapshots could not be refreshed; their previous files were preserved.');
