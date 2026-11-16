import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

export class CodexProvider {
  constructor({root}) {
    this.root = root;
    this.sequence = 0;
    this.pending = new Map();
    this.threads = new Map();
    this.stopping = false;
  }

  rpc(method, params) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CLI応答が時間切れになりました。'));
      }, 30000);
      this.pending.set(id, {resolve, reject, timer});
      this.child.stdin.write(JSON.stringify({id, method, params}) + '\n');
    });
  }

  onEvent(message) {
    const reply = this.pending.get(message.id);
    if (reply) {
      this.pending.delete(message.id);
      clearTimeout(reply.timer);
      if (message.error) reply.reject(Object.assign(new Error('CLIの準備に失敗しました。'), {data: message.error.data}));
      else reply.resolve(message.result);
      return;
    }
    if (message.id != null && message.method) {
      this.child.stdin.write(JSON.stringify({id: message.id, error: {code: -32601, message: 'Tools and approval requests are not available'}}) + '\n');
      return;
    }
    const p = message.params || {}, entry = this.threads.get(p.threadId);
    if (!entry) return;
    const job = entry.job;
    if (message.method === 'item/agentMessage/delta') {
      job.partial = (job.partial || '') + p.delta;
      if (!job.firstTokenAt) job.firstTokenAt = Date.now();
    }
    if (message.method === 'item/completed' && p.item?.type === 'agentMessage') job.answer = p.item.text;
    if (message.method === 'item/started' && p.item?.type === 'mcpToolCall' && p.item.tool === 'read_trip_guide') job.stage = 'reading';
    if (message.method === 'item/completed' && p.item?.type === 'mcpToolCall' && p.item.tool === 'read_trip_guide') { job.guideReads++; job.stage = 'answering'; }
    if (message.method === 'item/started' && p.item?.type === 'webSearch') job.stage = 'searching';
    if (message.method === 'item/completed' && p.item?.type === 'webSearch') { job.webSearches++; job.stage = 'answering'; }
    if (message.method === 'thread/tokenUsage/updated' && p.tokenUsage?.total) {
      const u = p.tokenUsage.total;
      job.usage = {input_tokens: u.inputTokens, output_tokens: u.outputTokens, cached_input_tokens: u.cachedInputTokens, reasoning_output_tokens: u.reasoningOutputTokens};
    }
    if (message.method === 'turn/completed') {
      setTimeout(() => {
        if (p.turn.status !== 'completed') {
          entry.reject(Object.assign(new Error('回答を作成できませんでした。'), {codexErrorInfo: p.turn.error?.codexErrorInfo}));
        } else {
          const answer = job.answer || job.partial;
          if (!answer?.trim()) entry.reject(new Error('回答を取得できませんでした。'));
          else entry.resolve({answer, usage: job.usage, provider: 'codex', model: 'gpt-6-luna'});
        }
      }, 100);
    }
  }

  async start() {
    if (!this.ready) {
      const args = ['app-server', '-c', 'mcp_servers.trip_guide.command="/usr/bin/node"', '-c', 'mcp_servers.trip_guide.args=' + JSON.stringify([path.join(this.root, 'runner/guide-mcp.mjs')]), '--listen', 'stdio://', '-c', 'web_search="live"', '--disable', 'apps', '--disable', 'plugins', '--disable', 'shell_tool', '--disable', 'unified_exec', '--disable', 'multi_agent', '--disable', 'multi_agent_v2'];
      const env = {PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', CODEX_HOME: path.join(this.root, 'auth')};
      this.child = spawn(path.join(this.root, 'node_modules/.bin/codex'), args, {cwd: path.join(this.root, 'workspace'), env, stdio: ['pipe', 'pipe', 'ignore']});
      createInterface({input: this.child.stdout}).on('line', line => { try { this.onEvent(JSON.parse(line)); } catch {} });
      this.child.on('exit', () => {
        this.ready = null;
        for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error('CLIが終了しました。')); }
        this.pending.clear();
        for (const thread of this.threads.values()) thread.reject(new Error('処理が中断されました。もう一度送信してください。'));
        this.threads.clear();
      });
      this.child.on('error', () => {});
      this.ready = this.rpc('initialize', {clientInfo: {name: 'taiwan_chat', title: 'Taiwan chat', version: '2.0.0'}, capabilities: {experimentalApi: true}}).then(() => {
        this.child.stdin.write(JSON.stringify({method: 'initialized'}) + '\n');
      }).catch(error => { this.ready = null; throw error; });
    }
    await this.ready;
  }

  async run(job, prepared, {signal} = {}) {
    await this.start();
    job.provider = 'codex';
    job.model = 'gpt-6-luna';
    const result = await this.rpc('thread/start', {model: 'gpt-6-luna', cwd: path.join(this.root, 'workspace'), approvalPolicy: 'never', sandbox: 'read-only', ephemeral: true, baseInstructions: prepared.instructions, config: {web_search: prepared.webMode, 'mcp_servers.trip_guide.enabled': prepared.needGuideTool}});
    const threadId = result.thread.id;
    let rejectRun;
    const done = new Promise((resolve, reject) => { rejectRun = reject; this.threads.set(threadId, {job, resolve, reject}); });
    // Attach a rejection observer before starting the request (it may fail immediately).
    done.catch(() => {});
    const abort = () => rejectRun(new Error('回答の作成が時間切れになりました。'));
    signal?.addEventListener('abort', abort, {once: true});
    try {
      job.stage = 'answering';
      await this.rpc('turn/start', {threadId, effort: 'medium', input: [{type: 'text', text: prepared.prompt, text_elements: []}]});
      return await done;
    } finally {
      signal?.removeEventListener('abort', abort);
      this.threads.delete(threadId);
      await this.rpc('thread/unsubscribe', {threadId}).catch(() => {});
    }
  }

  async stop() { this.stopping = true; this.child?.kill(); }
}
