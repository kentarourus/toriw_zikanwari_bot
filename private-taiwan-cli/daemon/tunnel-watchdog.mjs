import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {setTimeout as wait} from 'node:timers/promises';

const unit = 'taiwan-chat-connection.service';
const control = (...args) => execFileSync('/usr/bin/systemctl', ['--user', ...args, unit], {
  encoding: 'utf8',
  timeout: 100_000,
}).trim();

async function providerStatus(url, headers) {
  const response = await fetch(url, {headers, signal: AbortSignal.timeout(10_000)});
  if (response.status === 503) return null;
  if (!response.ok) throw new Error(`unexpected status ${response.status}`);
  const status = await response.json();
  return typeof status.mode === 'string' && status.mode !== 'legacy' ? status.mode : null;
}

const state = control('show', '--property=ActiveState', '--value');
if (state === 'inactive' || state === 'failed') {
  console.log('Chat tunnel is stopped. Starting it.');
  control('start');
} else if (state === 'active') {
  const config = JSON.parse(await readFile('runtime.json', 'utf8'));
  const local = new URL('/provider-status', 'http://127.0.0.1:8793');
  const publicStatus = new URL('/chat/provider-status', config.bridge);

  async function tunnelUnreachable() {
    try {
      if (!await providerStatus(local, {Authorization: `Bearer ${config.token}`})) return false;
    } catch {
      console.log('Local chat service is not ready. Leaving the tunnel running.');
      return false;
    }
    try {
      return !await providerStatus(publicStatus, {Origin: 'https://kentarourus.github.io'});
    } catch {
      console.log('Public status check could not complete. Waiting for the next check.');
      return false;
    }
  }

  if (await tunnelUnreachable()) {
    await wait(12_000);
    if (await tunnelUnreachable() && control('show', '--property=ActiveState', '--value') === 'active') {
      console.log('Chat tunnel failed two public checks while the local service was healthy. Restarting it.');
      control('restart');
    }
  }
}
