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
