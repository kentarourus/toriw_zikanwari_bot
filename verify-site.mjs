import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const classPages=JSON.parse(fs.readFileSync('config/classes.json','utf8')).map(({id})=>`dist/classes/${id}/index.html`);
const pages=['dist/index.html','dist/classes/index.html',...classPages];
assert.match(fs.readFileSync('dist/index.html','utf8'),/<h1>クラスを選択<\/h1>/,'Class list is missing from the root');
assert.doesNotMatch(fs.readFileSync('dist/index.html','utf8'),/2–3を開く|公開準備ができたクラスから/,'Removed class-list copy is still visible');
assert.match(fs.readFileSync('dist/index.html','utf8'),/manifest\.webmanifest/,'PWA manifest is missing from the portal');
const manifest=JSON.parse(fs.readFileSync('dist/manifest.webmanifest','utf8'));
assert.equal(manifest.display,'standalone','PWA must open as a standalone app');
assert.deepEqual(manifest.icons.map(icon=>icon.sizes),['192x192','512x512'],'PWA icon sizes are incomplete');
assert.match(fs.readFileSync('dist/sw.js','utf8'),/serviceWorker|addEventListener\('fetch'/,'Service worker is incomplete');
for(const page of classPages)assert.doesNotMatch(fs.readFileSync(page,'utf8'),/hostname\.endsWith/,'Class page contains an obsolete redirect');
for(const page of classPages)assert.match(fs.readFileSync(page,'utf8'),/manifest\.webmanifest/,'PWA manifest is missing from a class page');
for(const page of classPages)assert.match(fs.readFileSync(page,'utf8'),/id="source-link"/,'Class page is missing the source spreadsheet in related links');
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
