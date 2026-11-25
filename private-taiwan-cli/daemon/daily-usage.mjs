import fs from 'node:fs/promises';

const DAY = 86400000;
const tokyoDate = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'});
const modelFallbacks = {
  codex: 'gpt-6-luna',
  hydrogen: 'gemini-4-hydrogen-low',
  sonnet: 'claude-sonnet-5-5-low',
  copilot: 'auto',
  'chatgpt-plan': 'auto'
};
const isCount = value => Number.isSafeInteger(value) && value >= 0;

export async function openUsage(file, now = () => Date.now()) {
  let state;
  try {
    state = JSON.parse(await fs.readFile(file, 'utf8'));
    if (typeof state.startedAt !== 'string' || !Array.isArray(state.rows)) throw Error('Invalid usage store');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = {startedAt: new Date(now()).toISOString(), rows: []};
  }

  const save = async next => {
    const temporary = file + '.tmp';
    await fs.writeFile(temporary, JSON.stringify(next), {mode: 0o600});
    await fs.rename(temporary, file);
    state = next;
  };
  await save(state);
  let queue = Promise.resolve();

  return {
    record(job) {
      const day = tokyoDate.format(job.completedAt);
      const provider = Object.hasOwn(modelFallbacks, job.provider) ? job.provider : 'unknown';
      const model = typeof job.model === 'string' && /^[\w.:-]{1,80}$/.test(job.model) ? job.model : modelFallbacks[provider] ?? 'unknown';
      const update = queue.then(async () => {
        const cutoff = tokyoDate.format(now() - 89 * DAY);
        const rows = state.rows.filter(row => row.day >= cutoff);
        if (day < cutoff) return;
        const index = rows.findIndex(row => row.day === day && row.model === model && row.provider === provider);
        const row = index < 0
          ? {day, provider, model, completed: 0, failed: 0, measured: 0, input: 0, output: 0, cached: null}
          : {...rows[index]};
        row[job.status === 'completed' ? 'completed' : 'failed']++;
        const usage = job.usage;
        if (isCount(usage?.input_tokens) && isCount(usage?.output_tokens)) {
          row.measured++;
          row.input += usage.input_tokens;
          row.output += usage.output_tokens;
          if (isCount(usage.cached_input_tokens)) row.cached = (row.cached ?? 0) + usage.cached_input_tokens;
        }
        if (index < 0) rows.push(row);
        else rows[index] = row;
        await save({...state, rows});
      });
      queue = update.catch(() => {});
      return update;
    },
    async report(days) {
      await queue;
      const timestamp = now();
      const end = tokyoDate.format(timestamp);
      const start = tokyoDate.format(timestamp - (days - 1) * DAY);
      return {
        startedAt: state.startedAt,
        updatedAt: new Date(timestamp).toISOString(),
        start, end,
        rows: state.rows.filter(row => row.day >= start && row.day <= end)
      };
    },
    flush() { return queue; }
  };
}
