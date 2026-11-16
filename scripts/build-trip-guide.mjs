import fs from 'node:fs/promises';import MarkdownIt from 'markdown-it';
const source=await fs.readFile('dist/taiwan/guide.md','utf8');
const md=new MarkdownIt({html:false,linkify:true,breaks:false});
md.renderer.rules.image=(tokens,i)=>{const t=tokens[i],src=t.attrGet('src');if(!/^guide-assets\/[a-z0-9-]+\.png$/.test(src))return '';const alt=md.utils.escapeHtml(t.content),url='../'+src;return `<a class="figure-link" href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="${alt}" loading="lazy"></a>`;};
const sections=source.split(/<!-- source-page:(\d+) -->/);let body=md.render(sections[0]);
body=body.replace(/<h2>ページ別の参照先<\/h2>\s*(<ul>[\s\S]*?<\/ul>)/,'<details class="contents"><summary>ページ別の目次（全34ページ）</summary>$1</details>');
for(let i=1;i<sections.length;i+=2)body+=md.render(sections[i+1].replace(/<a id="source-page-\d+"><\/a>\s*/g,'')).replace('<h2>',`<h2 id="source-page-${sections[i]}">`);
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>研修旅行のしおり・詳細版</title><link rel="stylesheet" href="style.css?v=1"></head><body><header><a href="../">← 台湾研修旅行</a><nav><a href="../../taiwan-chat/">丹陽さんに聞く</a><a href="../guide.md" download>Markdownを保存</a></nav></header><main>${body}</main><footer><a href="#">先頭へ戻る ↑</a></footer></body></html>`;
await fs.mkdir('dist/taiwan/guide',{recursive:true});await fs.writeFile('dist/taiwan/guide/index.html',html);console.log('Detailed guide HTML generated with 34 source-page anchors.');
