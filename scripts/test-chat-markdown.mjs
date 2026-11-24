import {test} from 'node:test';import assert from 'node:assert/strict';import {renderMarkdown} from '../dist/taiwan-chat/markdown.js';
test('answers format emphasis, headings, lists, tables and code',()=>{
 const result=renderMarkdown('# 見出し\n\n**太字**\n\n- 持ち物\n- 傘\n\n|日|天気|\n|---|---|\n|月|晴れ|\n\n```js\nconst x = 1;\n```');
 for(const part of ['<h1>見出し</h1>','<strong>太字</strong>','<ul>','<table>','<pre><code'])assert.ok(result.includes(part),part);
});
test('Markdown and plain URLs become safe links',()=>{
 const result=renderMarkdown('[公式](https://www.cwa.gov.tw/) と https://open-meteo.com/');
 assert.equal((result.match(/<a /g)||[]).length,2);assert.match(result,/target="_blank"/);assert.match(result,/rel="noopener noreferrer"/);
});
test('HTML, script links and remote images never execute or load',()=>{
 const result=renderMarkdown('<script>alert(1)</script>\n[x](javascript:alert(1))\n![image](https://example.com/tracker.png)');
 assert.ok(!result.includes('<script>'));assert.ok(!result.includes('href="javascript:'));assert.ok(!result.includes('<img'));assert.match(result,/&lt;script&gt;/);
});
test('inline and block TeX render as MathML alongside Markdown',()=>{
 const result=renderMarkdown(String.raw`**斜辺**は $a^2+b^2=c^2$。\(\sqrt{2}\) も表示する。

\[
\frac{1}{2}
\]

$$
\sum_{i=1}^{3}i
$$`);
 assert.match(result,/<strong>斜辺<\/strong>/);
 assert.match(result,/<msqrt>/);
 assert.match(result,/<mfrac>/);
 assert.equal((result.match(/display="block"/g)||[]).length,2);
});
test('code and prices stay literal, and math cannot add links or load images',()=>{
 const result=renderMarkdown('料金は $10 または $20。 `$x$`\n\n'+
  String.raw`$\href{javascript:alert(1)}{x}$ $\includegraphics{https://example.com/pixel.png}$`);
 assert.match(result,/料金は \$10 または \$20/);
 assert.match(result,/<code>\$x\$<\/code>/);
 assert.doesNotMatch(result,/<a\b|<img\b|\shref=|\ssrc=/);
});
