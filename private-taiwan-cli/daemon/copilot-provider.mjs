import os from 'node:os';
import path from 'node:path';
import {handle, readGuide} from '../runner/guide-mcp.mjs';

const denied = {kind: 'denied-by-rules'};
export function copilotPermission(request) {
  if (request.managedApprovalRequired) return denied;
  if (request.kind === 'custom-tool' && request.toolName === 'read_trip_guide') return {kind: 'approved'};
  // Web search is the only built-in exposed. Shell, filesystem and generic fetch are absent.
  if (request.kind === 'url') {
    try {
      const url = new URL(request.url);
      if (url.protocol === 'https:' && ['api.githubcopilot.com', 'api.github.com', 'github.com'].includes(url.hostname)) return {kind: 'approved'};
    } catch {}
  }
  return denied;
}

export class CopilotProvider {
  constructor({root, sdkLoader = () => import('@github/copilot-sdk')}) {
    this.root = root;
    this.sdkLoader = sdkLoader;
    this.authenticated = false;
  }

  async start() {
    if (!this.ready) {
      this.ready = (async () => {
        const sdk = await this.sdkLoader();
        this.defineTool = sdk.defineTool;
        this.client = new sdk.CopilotClient({
          mode: 'empty',
          baseDirectory: path.join(os.homedir(), '.copilot'),
          workingDirectory: path.join(this.root, 'workspace'),
          logLevel: 'error',
          env: Object.fromEntries(['PATH','HOME','USER','LANG','DBUS_SESSION_BUS_ADDRESS','XDG_RUNTIME_DIR'].filter(key=>process.env[key]!=null).map(key=>[key,process.env[key]]).concat([['COPILOT_TELEMETRY_DISABLED','true']])),
        });
        await this.client.start();
        const auth = await this.client.getAuthStatus();
        this.authenticated = auth.isAuthenticated === true;
        if (!this.authenticated) throw Object.assign(new Error('Copilotへのログインが必要です。'), {code: 'COPILOT_AUTH_REQUIRED'});
      })().catch(async error => {
        this.ready = null;
        await this.client?.stop().catch(() => {});
        throw error;
      });
    }
    await this.ready;
  }

  async run(job, prepared, {signal} = {}) {
    await this.start();
    job.provider = 'copilot';
    job.model = 'auto';
    const spec = handle({id: 1, method: 'tools/list'}).result.tools[0];
    const tool = this.defineTool('read_trip_guide', {
      description: spec.description,
      parameters: spec.inputSchema,
      handler: ({topic}) => {
        job.stage = 'reading';
        const result = readGuide(topic);
        job.guideReads++;
        job.stage = 'answering';
        return JSON.stringify(result);
      },
    });
    const session = await this.client.createSession({
      sessionId: 'taiwan-chat-' + job.id,
      model: 'auto',
      streaming: true,
      workingDirectory: path.join(this.root, 'workspace'),
      enableConfigDiscovery: false,
      includedBuiltinAgents: [],
      includedBuiltinSkills: [],
      infiniteSessions: {enabled: false},
      tools: [tool],
      availableTools: [
        ...(prepared.needGuideTool ? ['custom:read_trip_guide'] : []),
        ...(prepared.webMode === 'live' ? ['web_search'] : []),
      ],
      onPermissionRequest: copilotPermission,
      systemMessage: {mode: 'append', content: prepared.instructions},
    });
    let messageId, usage = null;
    const usageEvents = new Set(), tools = new Map(), hostedSearches = new Set();
    const abort = () => { session.abort().catch(() => {}); };
    signal?.addEventListener('abort', abort, {once: true});
    const unsubscribe = session.on(event => {
      const data = event.data || {};
      if (event.type === 'assistant.message_delta') {
        if (messageId && messageId !== data.messageId) job.partial = '';
        messageId = data.messageId;
        job.partial = (job.partial || '') + data.deltaContent;
        if (!job.firstTokenAt) job.firstTokenAt = Date.now();
      }
      if (event.type === 'assistant.message') job.answer = data.content;
      if (event.type === 'assistant.server_tool_progress' && data.kind === 'web_search') {
        job.stage = data.status === 'completed' ? 'answering' : 'searching';
        if (data.status === 'completed' && !hostedSearches.has(data.outputIndex)) {hostedSearches.add(data.outputIndex);job.webSearches++;}
      }
      if (event.type === 'tool.execution_start') {
        tools.set(data.toolCallId, data.toolName);
        if (data.toolName === 'web_search') job.stage = 'searching';
      }
      if (event.type === 'tool.execution_complete') {
        if (tools.get(data.toolCallId) === 'web_search') job.webSearches++;
        job.stage = 'answering';
      }
      if (event.type === 'assistant.usage' && !usageEvents.has(event.id)) {
        usageEvents.add(event.id);
        job.model = data.model || job.model;
        if (Number.isSafeInteger(data.inputTokens) && Number.isSafeInteger(data.outputTokens)) {
          usage ||= {input_tokens: 0, output_tokens: 0, cached_input_tokens: null, provider: 'copilot'};
          usage.input_tokens += data.inputTokens;
          usage.output_tokens += data.outputTokens;
          if (Number.isSafeInteger(data.cacheReadTokens)) usage.cached_input_tokens = (usage.cached_input_tokens || 0) + data.cacheReadTokens;
          job.usage = usage;
        }
      }
    });
    try {
      job.stage = 'answering';
      const result = await session.sendAndWait({prompt: prepared.prompt}, 180000);
      const answer = result?.data?.content || job.answer || job.partial;
      if (!answer?.trim()) throw new Error('Copilotから回答を取得できませんでした。');
      return {answer, usage, provider: 'copilot', model: job.model};
    } finally {
      unsubscribe();
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) await session.abort().catch(() => {});
      await session.disconnect().catch(() => {});
      // Delete only the session created for this request, never unrelated CLI history.
      await this.client.deleteSession(session.sessionId).catch(() => {});
    }
  }

  async stop() { await this.client?.stop(); }
}
