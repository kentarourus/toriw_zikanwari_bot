import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const pages=['dist/index.html','dist/classes/index.html','dist/classes/1-5/index.html','dist/classes/2-3/index.html','dist/classes/2-5/index.html'];
assert.match(fs.readFileSync('dist/index.html','utf8'),/<h1>クラスを選択<\/h1>/,'Class list is missing from the root');
assert.doesNotMatch(fs.readFileSync('dist/index.html','utf8'),/2–3を開く|公開準備ができたクラスから/,'Removed class-list copy is still visible');
for(const page of ['dist/classes/1-5/index.html','dist/classes/2-3/index.html','dist/classes/2-5/index.html'])assert.doesNotMatch(fs.readFileSync(page,'utf8'),/hostname\.endsWith/,'Class page contains an obsolete redirect');
for(const page of pages){
  const html=fs.readFileSync(page,'utf8');
  for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){
    const ref=match[1].split('?')[0];
    if(/^(?:https?:|mailto:)/.test(ref))continue;
    let target=path.resolve(path.dirname(page),ref);
    if(ref.endsWith('/'))target=path.join(target,'index.html');
    assert.ok(fs.existsSync(target),`${page}: missing ${ref}`);
  }
}
for(const classInfo of JSON.parse(fs.readFileSync('config/classes.json','utf8'))){
  const data=JSON.parse(fs.readFileSync(classInfo.snapshot,'utf8'));
  assert.ok(data.sheets?.['時間割'],`${classInfo.id}: timetable snapshot missing`);
  assert.ok(data.sheets?.['連絡'],`${classInfo.id}: notices snapshot missing`);
}
console.log('GitHub Pages routes, local assets and class snapshots passed.');
