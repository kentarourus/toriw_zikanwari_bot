import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatChatPrompt} from '../private-taiwan-cli/runner/prompt-context.mjs';

test('cacheable guide and prior turns precede volatile context while the current message stays last', () => {
 const guide = {pages:[{pdf:11, url:'https://example.org/#source-page-11', text:'宿舎の規則'}]};
 const history = [{role:'user',content:'以前の質問'}, {role:'assistant',content:'以前の回答'}];
 const build = (now, weather, content) => formatChatPrompt({guide, now, weather, messages:[...history, {role:'user', content}]});
 const first = build('12:00','くもり','質問 A');
 const second = build('12:01','雨','質問 B');
 assert.equal(first.split('台湾時間:')[0], second.split('台湾時間:')[0]);
 assert.ok(first.indexOf('source-page-11') < first.indexOf('以前の質問'));
 assert.ok(first.indexOf('以前の質問') < first.indexOf('以前の回答'));
 assert.ok(first.endsWith('["user","質問 A"]'));
 assert.ok(second.includes('天気資料:\n雨'));
});

test('normal questions without reference or history add no filler blocks', () => {
 const prompt = formatChatPrompt({messages:[{role:'user',content:'こんにちは'}],now:'12:00'});
 assert.doesNotMatch(prompt,/しおり|過去の会話|天気資料/);
 assert.ok(prompt.endsWith('["user","こんにちは"]'));
});
