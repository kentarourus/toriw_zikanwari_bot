import {readSavedData, saveData} from './offline-data.js';

const endpoint = 'https://api.frankfurter.dev/v2/rate/TWD/JPY';
const formatters = {
  jpy: new Intl.NumberFormat('ja-JP', {maximumFractionDigits: 0}),
  twd: new Intl.NumberFormat('ja-JP', {maximumFractionDigits: 2})
};
const validRate = data => data?.base === 'TWD' && data.quote === 'JPY' &&
  Number.isFinite(data.rate) && data.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data.date);

export function initCurrencyTool(panel) {
  const amount = panel.querySelector('#currency-amount');
  const from = panel.querySelector('#currency-from');
  const to = panel.querySelector('#currency-to');
  const rate = panel.querySelector('#currency-rate');
  const refresh = panel.querySelector('#currency-refresh');
  const result = panel.querySelector('#currency-result');
  const status = panel.querySelector('#currency-status');
  let manual = false;
  let edits = 0;
  let saved = readSavedData('currency');
  let toYen = true;
  let replaceAmount = true;

  function convert() {
    const value = amount.value === '' ? NaN : Number(amount.value);
    const exchangeRate = rate.valueAsNumber;
    const converted = toYen ? value * exchangeRate : value / exchangeRate;
    result.value = value >= 0 && exchangeRate > 0 && Number.isFinite(converted)
      ? `約 ${formatters[toYen ? 'jpy' : 'twd'].format(converted)}`
      : '—';
  }

  function setAmount(next) {
    const text = next.normalize('NFKC').trim();
    const [integer, ...fraction] = (text.startsWith('-') ? '' : text.replace(/[^0-9.]/g, '')).split('.');
    const numeric = fraction.length ? (integer || '0') + '.' + fraction.join('') : integer;
    const clean = numeric.replace(/^0+(?=\d)/, '').slice(0, amount.maxLength);
    if (amount.value !== clean) amount.value = clean;
    replaceAmount = false;
    convert();
  }

  function displayRate(data, label) {
    rate.value = data.rate;
    status.textContent = `${data.date.replaceAll('-', '/')} の参考レート${label}`;
    convert();
  }

  async function fetchRate() {
    if (refresh.disabled) return;
    const revision = edits;
    refresh.disabled = true;
    status.textContent = '参考レートを取得中…';
    try {
      const response = await fetch(endpoint, {cache: 'no-store', signal: AbortSignal.timeout(8000)});
      if (!response.ok) throw new Error('Rate request failed');
      const data = await response.json();
      if (!validRate(data)) throw new Error('Invalid rate');
      saved = data;
      saveData('currency', data);
      if (revision !== edits) return;
      manual = false;
      displayRate(data, '');
    } catch {
      if (revision === edits) {
        if (!manual && validRate(saved)) {
          displayRate(saved, '（取得できないため保存済みの値を使用）');
        } else {
          status.textContent = rate.valueAsNumber > 0
            ? '取得できませんでした。入力欄のレートで換算しています。'
            : '取得できませんでした。レートを手入力できます。';
        }
      }
    } finally {
      refresh.disabled = false;
    }
  }

  amount.addEventListener('input', () => setAmount(amount.value));
  panel.querySelector('#currency-swap').addEventListener('click', () => {
    toYen = !toYen;
    from.textContent = toYen ? '台湾ドル' : '日本円';
    to.textContent = toYen ? '日本円' : '台湾ドル';
    convert();
  });
  panel.querySelector('#currency-clear').addEventListener('click', () => setAmount(''));
  panel.querySelector('.currency-keypad').addEventListener('click', event => {
    const key = event.target.closest('[data-currency-key]')?.dataset.currencyKey;
    if (!key) return;
    if (key === 'backspace') {
      setAmount(amount.value.slice(0, -1));
      return;
    }
    const current = replaceAmount ? '' : amount.value;
    if (key !== '.' || !current.includes('.')) setAmount(current + key);
  });
  rate.addEventListener('input', () => {
    edits++;
    manual = true;
    status.textContent = rate.valueAsNumber > 0 ? '手入力レート' : '0より大きいレートを入力してください。';
    convert();
  });
  refresh.addEventListener('click', fetchRate);
  return () => {
    if (manual) return;
    if (validRate(saved)) displayRate(saved, '（保存済み）');
    if (navigator.onLine) fetchRate();
    else if (!validRate(saved)) status.textContent = 'オフラインです。レートを手入力できます。';
  };
}
