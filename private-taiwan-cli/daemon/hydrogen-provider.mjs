import {execFile} from 'node:child_process';
import {mkdtemp, rmdir} from 'node:fs/promises';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';
import {createInterface} from 'node:readline';

export const hydrogenExecutable = path.join(homedir(), '.local', 'bin', 'agy');
const model = 'gemini-4-hydrogen-low';
const settings = {
  toolPermission: 'strict',
  allowNonWorkspaceAccess: false,
  permissions: {
    allow: [],
    deny: ['command(*)', 'read_file(*)', 'write_file(*)', 'mcp(*)', 'execute_url(*)']
  }
};
const environmentKeys = ['HOME', 'PATH', 'LANG', 'LC_ALL', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME',
  'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'DBUS_SESSION_BUS_ADDRESS'];

export async function runHydrogen(job, prepared, {signal}) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'taiwan-hydrogen-'));
  const env = Object.fromEntries(environmentKeys.filter(key => process.env[key]).map(key => [key, process.env[key]]));
  job.model = model;
  job.stage = 'answering';
  try {
    return await new Promise((resolve, reject) => {
      let result;
      const child = execFile(hydrogenExecutable, [
        '--disable-slash-commands',
        '--settings', JSON.stringify(settings),
        '--model', model,
        '--input-format', 'stream-json',
        '--output-format', 'stream-json'
      ], {cwd, env, signal, maxBuffer: 2 * 1024 * 1024}, error => {
        if (error || result?.status !== 'SUCCESS' || !result.response?.trim()) {
          reject(new Error('Hydrogen did not return an answer'));
          return;
        }
        const raw = result.usage;
        const usage = Number.isInteger(raw?.input_tokens) && Number.isInteger(raw?.output_tokens) ? {
          input_tokens: raw.input_tokens,
          output_tokens: raw.output_tokens,
          cached_input_tokens: raw.cache_read_tokens ?? null,
          provider: 'hydrogen'
        } : null;
        resolve({answer: result.response, usage, provider: 'hydrogen', model});
      });
      const output = createInterface({input: child.stdout});
      output.on('line', line => {
        let event;
        try { event = JSON.parse(line); } catch { return; }
        if (event.event === 'result') result = event.result;
        const step = event.step_update;
        if (step?.step_type === 'agent_response' && step.text_delta) {
          job.firstTokenAt ??= Date.now();
          job.partial += step.text_delta;
        }
      });
      child.stdin.on('error', () => {});
      const content = [prepared.instructions, prepared.prompt].join('\n\n');
      child.stdin.end(JSON.stringify({event: 'user', message: {content}}) + '\n');
    });
  } finally {
    await rmdir(cwd).catch(() => {});
  }
}
