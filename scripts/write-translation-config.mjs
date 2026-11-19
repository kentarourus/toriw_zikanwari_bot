import {writeFileSync} from 'node:fs';

const endpoint = process.env.TAIWAN_TRANSLATION_ENDPOINT?.trim() || '';
if (endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/translate' || url.search || url.hash) {
    throw new Error('TAIWAN_TRANSLATION_ENDPOINT must be an HTTPS /translate URL');
  }
  writeFileSync('dist/taiwan/translate/config.js', 'export const translationEndpoint = ' + JSON.stringify(endpoint) + ';\n');
}
