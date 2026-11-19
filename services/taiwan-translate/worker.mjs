import {createHash, timingSafeEqual} from 'node:crypto';

const maxBodyBytes = 8192;
const languages = {
  ja: {source: 'JA', target: 'JA'},
  'zh-TW': {source: 'ZH', target: 'ZH-HANT'},
};
const hash = value => createHash('sha256').update(value).digest();

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing request body');
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let size = 0;
  let text = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) return JSON.parse(text + decoder.decode());
      size += value.byteLength;
      if (size > maxBodyBytes) {
        void reader.cancel().catch(() => {});
        throw new RangeError('Request body too large');
      }
      text += decoder.decode(value, {stream: true});
    }
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request, env) {
    const headers = new Headers({'Cache-Control': 'no-store', Vary: 'Origin'});
    const json = (status, value) => Response.json(value, {status, headers});
    if (new URL(request.url).pathname !== '/translate') return json(404, {error: 'not_found'});

    const origin = request.headers.get('Origin');
    if (!origin || origin !== env.ALLOWED_ORIGIN) return json(403, {error: 'origin_forbidden'});
    headers.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'POST');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      headers.set('Access-Control-Max-Age', '600');
      return new Response(null, {status: 204, headers});
    }
    if (request.method !== 'POST') return json(405, {error: 'method_not_allowed'});

    const key = env.DEEPL_AUTH_KEY?.trim();
    const code = env.TRANSLATION_ACCESS_CODE;
    if (!key || !/^\S{16,}$/.test(code || '')) return json(503, {error: 'translation_not_configured'});
    if (!timingSafeEqual(hash(request.headers.get('Authorization') || ''), hash('Bearer ' + code))) {
      return json(401, {error: 'invalid_access_code'});
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
      return json(415, {error: 'expected_json'});
    }
    if (Number(request.headers.get('Content-Length')) > maxBodyBytes) {
      return json(413, {error: 'body_too_large'});
    }

    let input;
    try {
      input = await readBody(request);
    } catch (error) {
      return error instanceof RangeError ? json(413, {error: 'body_too_large'}) : json(400, {error: 'invalid_json'});
    }
    const {text: raw, source, target} = input ?? {};
    const text = typeof raw === 'string' ? raw.trim() : '';
    const supported = (source === 'ja' && target === 'zh-TW') || (source === 'zh-TW' && target === 'ja');
    if (!supported || !text || text.length > 1000) return json(400, {error: 'invalid_translation_input'});

    const site = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    try {
      const response = await fetch(site + '/v2/translate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Authorization: 'DeepL-Auth-Key ' + key},
        body: JSON.stringify({text: [text], source_lang: languages[source].source, target_lang: languages[target].target}),
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
      if (response.status === 456) return json(456, {error: 'translation_quota_exceeded'});
      if (response.status === 429) return json(429, {error: 'translation_rate_limited'});
      if (!response.ok) return json(502, {error: 'translation_unavailable'});
      const result = await response.json();
      const translation = result.translations?.[0]?.text;
      if (typeof translation !== 'string' || !translation.trim()) {
        return json(502, {error: 'translation_unavailable'});
      }
      return json(200, {translation});
    } catch {
      return json(502, {error: 'translation_unavailable'});
    }
  },
};
