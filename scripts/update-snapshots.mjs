import fs from 'node:fs/promises';
import {readWorkbook} from '../src/workbook.js';

const classes=JSON.parse(await fs.readFile(new URL('../config/classes.json',import.meta.url),'utf8'));
for(const item of classes){
  const response=await fetch(`https://docs.google.com/spreadsheets/d/${item.sheetId}/export?format=xlsx`);
  if(!response.ok)throw new Error(`${item.id}: ${response.status}`);
  const data=readWorkbook(await response.arrayBuffer());
  await fs.writeFile(new URL(`../${item.snapshot}`,import.meta.url),JSON.stringify(data));
  console.log(`${item.id}: snapshot updated`);
}
