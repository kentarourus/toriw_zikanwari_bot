import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openUsage} from '../private-taiwan-cli/daemon/daily-usage.mjs';

test('usage keeps aggregate-only totals across concurrent writes and restart, with Japan dates', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-usage-'));
  t.after(() => fs.rm(folder, {recursive: true, force: true}));
  const file = path.join(folder, 'usage.json');
  const beforeMidnight = Date.parse('2026-11-24T14:59:59Z');
  let now = beforeMidnight;
  const clock = () => now;
  const store = await openUsage(file, clock);
  now += 1000;
  await Promise.all([
    store.record({status: 'completed', provider: 'codex', completedAt: beforeMidnight, answer: 'private-answer',
      usage: {input_tokens: 25, output_tokens: 9, cached_input_tokens: 18}}),
    store.record({status: 'completed', provider: 'codex', completedAt: beforeMidnight,
      usage: {input_tokens: 2, output_tokens: 1}}),
    store.record({status: 'failed', provider: 'sonnet', completedAt: now, error: 'private-error'})
  ]);
  const next = await openUsage(file, clock);
  const report = await next.report(7);
  assert.equal(report.end, '2026-11-25');
  assert.equal(report.startedAt, '2026-11-24T14:59:59.000Z');
  assert.deepEqual(report.rows, [
    {day:'2026-11-24',provider:'codex',model:'gpt-6-luna',completed:2,failed:0,measured:2,input:27,output:10,cached:18},
    {day:'2026-11-25',provider:'sonnet',model:'claude-sonnet-5-5-low',completed:0,failed:1,measured:0,input:0,output:0,cached:null}
  ]);
  assert.doesNotMatch(await fs.readFile(file, 'utf8'), /private-answer|private-error/);
  now += 90 * 86400000;
  assert.deepEqual((await next.report(90)).rows, []);
});
