const endpoint = 'https://taiwan-private-cli-bridge.ai-news-webhook-relay.workers.dev/admin/usage';
const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('ja-JP');
const timestamp = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short'
});
const models = {
  'gpt-6-luna': 'GPT-6 Luna',
  'gemini-4-hydrogen-low': 'Gemini 4 Hydrogen',
  'claude-sonnet-5-5-low': 'Claude Sonnet 5.5'
};
let key = '';
let data;
let request;
const empty = () => ({completed: 0, failed: 0, measured: 0, input: 0, output: 0, cached: null});

function add(target, row) {
  for (const field of ['completed', 'failed', 'measured', 'input', 'output']) target[field] += row[field];
  if (row.cached !== null) target.cached = (target.cached ?? 0) + row.cached;
}
function notice(message) {
  $('status').textContent = message;
  $('status').hidden = !message;
}
function locked(message = '') {
  request?.abort();
  key = '';
  data = undefined;
  $('key').value = '';
  $('dashboard').hidden = $('lock').hidden = true;
  $('unlock').hidden = false;
  for (const id of ['summary', 'chart', 'chart-dates', 'by-model', 'by-day', 'coverage', 'updated', 'chart-empty']) $(id).replaceChildren();
  notice(message);
  $('key').focus();
}
function node(tag, value) {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}
function modelLabel(row) {
  if (row.provider === 'copilot') return row.model === 'auto' ? 'GitHub Copilot' : 'GitHub Copilot · ' + row.model;
  if (row.provider === 'chatgpt-plan') return 'ChatGPT · ' + row.model;
  return Object.hasOwn(models, row.model) ? models[row.model] : row.model;
}
function table(id, rows, columns) {
  const body = $(id);
  if (!rows.length) {
    const row = node('tr', '');
    const cell = node('td', 'この期間の記録はありません。');
    cell.colSpan = columns;
    row.append(cell);
    body.replaceChildren(row);
    return;
  }
  body.replaceChildren(...rows.map(([label, row]) => {
    const element = node('tr', '');
    const heading = node('th', label);
    heading.scope = 'row';
    element.append(heading);
    const values = [row.completed, row.failed, row.measured ? row.input : null, row.measured ? row.output : null];
    if (columns === 7) values.push(row.cached);
    values.push(row.completed + row.failed - row.measured);
    element.append(...values.map(value => node('td', value == null ? '—' : number.format(value))));
    return element;
  }));
}
function render() {
  const total = empty();
  const byDay = new Map();
  const byModel = new Map();
  const firstDay = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Tokyo'}).format(new Date(data.startedAt));
  for (let t = Date.parse(data.start); t <= Date.parse(data.end); t += 86400000) {
    const day = new Date(t).toISOString().slice(0, 10);
    if (day >= firstDay) byDay.set(day, empty());
  }
  for (const row of data.rows) {
    add(total, row);
    add(byDay.get(row.day), row);
    const label = modelLabel(row);
    if (!byModel.has(label)) byModel.set(label, empty());
    add(byModel.get(label), row);
  }
  const jobs = total.completed + total.failed;
  const stats = [
    ['リクエスト', jobs, `完了 ${number.format(total.completed)} · 失敗 ${number.format(total.failed)}`],
    ['入力トークン', total.measured ? total.input : null, total.cached === null ? 'キャッシュ計測なし' : `キャッシュ報告値 ${number.format(total.cached)}`],
    ['出力トークン', total.measured ? total.output : null, `使用量取得 ${number.format(total.measured)} 件`],
    ['使用量未取得', jobs - total.measured, `処理中 ${number.format(data.active)} 件`]
  ];
  $('summary').replaceChildren(...stats.map(([label, amount, detail]) => {
    const card = document.createElement('article');
    card.append(node('p', label), node('strong', amount === null ? '—' : number.format(amount)), node('small', detail));
    return card;
  }));
  const tokens = $('metric').value === 'tokens';
  const valueFor = row => tokens ? row.measured ? row.input + row.output : null : row.completed + row.failed;
  const max = Math.max(0, ...[...byDay.values()].map(valueFor));
  $('chart-empty').hidden = !!max;
  $('chart-empty').textContent = tokens ? '計測済みトークンはまだありません。' : 'この期間に完了・失敗したリクエストはありません。';
  $('chart').replaceChildren(...(max ? [...byDay].map(([day, row]) => {
    const amount = valueFor(row);
    const cell = node('div', '');
    cell.className = 'chart-day';
    cell.title = day + '  ' + (amount === null ? '未取得' : number.format(amount));
    const bar = node('div', '');
    bar.className = 'chart-bar';
    bar.style.height = (amount ? Math.max(2, amount / max * 100) : 0) + '%';
    cell.append(bar);
    return cell;
  }) : []));
  const dates = [...byDay.keys()];
  const ticks = new Set([dates[0], dates[Math.floor(dates.length / 2)], dates.at(-1)]);
  $('chart-dates').replaceChildren(...(max ? [...ticks].map(date => node('span', date.slice(5).replace('-', '/'))) : []));
  table('by-day', [...byDay].reverse(), 6);
  table('by-model', [...byModel].sort((a, b) => b[1].input + b[1].output - a[1].input - a[1].output), 7);
  $('updated').textContent = '更新 ' + timestamp.format(new Date(data.updatedAt)) + '（日本時間）';
  $('coverage').textContent = `記録開始 ${timestamp.format(new Date(data.startedAt))}。常駐サーバーで完了・失敗したリクエストを終了日で集計します。料金・残り利用枠や、GitHub Actions経由の実行は集計対象外です。`;
}
async function load() {
  request?.abort();
  const current = request = new AbortController();
  const submit = $('unlock').querySelector('button');
  submit.disabled = $('refresh').disabled = true;
  notice('集計を取得しています…');
  try {
    const response = await fetch(endpoint + '?days=' + $('period').value, {
      headers: {Authorization: 'Bearer ' + key},
      cache: 'no-store',
      signal: AbortSignal.any([current.signal, AbortSignal.timeout(12000)])
    });
    if (response.status === 401) { locked('管理キーを確認してください。'); return; }
    const result = await response.json();
    if (!response.ok) throw Error(result.error || '集計を取得できませんでした。');
    if (current.signal.aborted) return;
    data = result;
    render();
    $('key').value = '';
    $('unlock').hidden = true;
    $('dashboard').hidden = $('lock').hidden = false;
    notice(data.usageWriteFailed ? '使用量の一部を保存できませんでした。' : '');
  } catch (error) {
    if (!current.signal.aborted) notice(error.name === 'TimeoutError' ? '取得がタイムアウトしました。' : error.message);
  } finally {
    if (request === current) submit.disabled = $('refresh').disabled = false;
  }
}
$('unlock').onsubmit = event => {
  event.preventDefault();
  key = $('key').value.trim();
  void load();
};
$('refresh').onclick = () => void load();
$('period').onchange = () => void load();
$('metric').onchange = () => { if (data) render(); };
$('lock').onclick = () => locked();
window.addEventListener('pagehide', () => { if (key) locked(); });
