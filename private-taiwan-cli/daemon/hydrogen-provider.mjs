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

let standby;

async function startHydrogen() {
  const cwd = await mkdtemp(path.join(tmpdir(), 'taiwan-hydrogen-'));
  const env = Object.fromEntries(environmentKeys.filter(key => process.env[key]).map(key => [key, process.env[key]]));
  let closed = false;
  let onEvent;
  let onError;
  const child = execFile(hydrogenExecutable, [
    '--disable-slash-commands',
    '--settings', JSON.stringify(settings),
    '--model', model,
    '--input-format', 'stream-json',
    '--output-format', 'stream-json'
  ], {cwd, env, maxBuffer: 2 * 1024 * 1024}, () => {
    closed = true;
    onError?.();
    void rmdir(cwd).catch(() => {});
  });
  child.stdin.on('error', () => onError?.());
  const output = createInterface({input: child.stdout});
  output.on('line', line => {
    let event;
    try { event = JSON.parse(line); } catch { return; }
    onEvent?.(event);
  });
  return {
    get available() { return !closed && !child.killed; },
    stop() { child.kill(); },
    ask(content, job, signal) {
      return new Promise((resolve, reject) => {
        const streamedSteps = new Set();
        function finish(error, result) {
          signal.removeEventListener('abort', abort);
          onEvent = undefined;
          onError = undefined;
          if (error) reject(error);
          else resolve(result);
        }
        function abort() {
          child.kill();
          finish(signal.reason);
        }
        onError = () => finish(new Error('Hydrogen did not return an answer'));
        if (signal.aborted) { abort(); return; }
        signal.addEventListener('abort', abort, {once: true});
        onEvent = event => {
          if (event.event === 'result') {
            const result = event.result;
            if (result?.status !== 'SUCCESS' || typeof result.response !== 'string' || !result.response.trim()) {
              onError();
              return;
            }
            const raw = result.usage;
            const usage = Number.isInteger(raw?.input_tokens) && Number.isInteger(raw?.output_tokens) ? {
              input_tokens: raw.input_tokens,
              output_tokens: raw.output_tokens,
              cached_input_tokens: raw.cache_read_tokens ?? null,
              provider: 'hydrogen'
            } : null;
            finish(null, {answer: result.response, usage, provider: 'hydrogen', model});
            return;
          }
          const step = event.step_update;
          if (step?.step_type !== 'agent_response' || !step.text_delta) return;
          if (step.state === 'DONE' && streamedSteps.has(step.step_index)) return;
          if (step.state === 'ACTIVE') streamedSteps.add(step.step_index);
          job.firstTokenAt ??= Date.now();
          job.partial += step.text_delta;
        };
        child.stdin.end(JSON.stringify({event: 'user', message: {content}}) + '\n');
      });
    }
  };
}

export function warmHydrogen() {
  standby ??= startHydrogen().catch(() => null);
}

export function stopHydrogen() {
  const idle = standby;
  standby = undefined;
  void idle?.then(worker => worker?.stop());
}

export async function runHydrogen(job, prepared, {signal}) {
  job.model = model;
  job.stage = 'answering';
  const idle = standby;
  standby = undefined;
  warmHydrogen();
  const warmed = await idle;
  const worker = warmed?.available ? warmed : await startHydrogen();
  return worker.ask([prepared.instructions, prepared.prompt].join('\n\n'), job, signal);
}
