import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseDays, tokyoDateKey} from '../dist/assets/js/timetable-dates.js';

const referenceDate = '2026-11-16T03:00:00Z';
function rows(dates, weekdays) {
  const result = Array.from({length: 13}, () => []);
  result[2] = ['', '', '日付', ...dates];
  result[3] = ['', '', '週種', 'A週'];
  result[4] = ['', '', '曜日', ...weekdays];
  result[5] = ['', '', '1限', '国語', '数学', '英語', '理科'];
  return result;
}
const datesOf = (data, reference = referenceDate) => parseDays(data, {referenceDate: reference}).map(day => day.key);

test('actual 1-1/1-5 stale month headers cannot jump backwards even when weekdays coincide', () => {
  for (const stale of ['10月1日', '46296.0']) {
    const data = rows(['11月17日', '30日', stale, '2日'], ['火', '水', '木', '金']);
    const days = parseDays(data, {referenceDate});
    assert.deepEqual(days.map(day => day.key), ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
    assert.deepEqual(days.map(day => day.columnIndex), [3, 4, 5, 6]);
    assert.deepEqual(days.map(day => day.lessons[0].subject), ['国語', '数学', '英語', '理科']);
  }
});

test('valid gaps, weekends and explicit dates keep their original dates', () => {
  assert.deepEqual(datesOf(rows(['11月17日', '25日', '12月3日'], ['火', '水', '木'])), ['2026-11-17', '2026-11-25', '2026-12-03']);
  assert.deepEqual(datesOf(rows(['11月20日', '23日'], ['金', '月'])), ['2026-11-20', '2026-11-23']);
  assert.deepEqual(datesOf(rows(['2027年1月1日'], ['金'])), ['2027-01-01']);
});

test('New Year, yearless dates and leap days use the capture date, not the viewing device year', () => {
  assert.deepEqual(datesOf(rows(['12月31日', '1日', '2日'], ['木', '金', '土']), '2026-12-31'), ['2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(datesOf(rows(['12月31日', '1月1日'], ['木', '金']), '2027-01-01'), ['2026-12-31', '2027-01-01']);
  assert.deepEqual(datesOf(rows(['1月1日'], ['金']), '2026-12-31'), ['2027-01-01']);
  assert.deepEqual(datesOf(rows(['2月28日', '29日', '3月1日'], ['水', '木', '金']), '2024-02-28'), ['2024-02-28', '2024-02-29', '2024-03-01']);
});

test('invalid or ambiguous first dates are not normalized into invented dates', () => {
  for (const value of ['13月1日', '0000年11月17日', '0月17日', '2026年2月29日', '2月30日', '4月31日', '0月0日', '18日', 'NaN', '', '日付なし']) {
    assert.deepEqual(datesOf(rows([value], [''])), [], value);
  }
  assert.deepEqual(datesOf(rows(['11月17日', '10月1日'], ['火', '金'])), []);
  assert.deepEqual(datesOf(rows(['11月17日', '未定'], ['火', '水'])), []);
});

test('calendar arithmetic preserves every month boundary in leap and non-leap years', () => {
  for (let year = 2024; year <= 2028; year++) for (let month = 0; month < 12; month++) {
    const days = Array.from({length: 5}, (_, index) => new Date(Date.UTC(year, month + 1, index - 1)));
    const labels = days.map((day, index) => index === 0 || day.getUTCDate() === 1 ? `${day.getUTCMonth() + 1}月${day.getUTCDate()}日` : `${day.getUTCDate()}日`);
    const fixture = rows(labels, days.map(day => '日月火水木金土'[day.getUTCDay()]));
    assert.deepEqual(datesOf(fixture, days[0]), days.map(day => day.toISOString().slice(0, 10)));
  }
});

test('today uses Japan time and year-bearing keys distinguish old timetables', () => {
  assert.equal(tokyoDateKey(new Date('2026-11-16T14:59:59Z')), '2026-11-16');
  assert.equal(tokyoDateKey(new Date('2026-11-16T15:00:00Z')), '2026-11-17');
  assert.equal(tokyoDateKey(new Date('2026-12-31T15:00:00Z')), '2027-01-01');
  assert.notEqual(datesOf(rows(['2025年11月17日'], ['月']))[0], '2026-11-17');
});

test('all configured class snapshots have unique, chronological dates with calendar-correct weekdays', () => {
  for (const item of JSON.parse(fs.readFileSync('config/classes.json', 'utf8'))) {
    const snapshot = JSON.parse(fs.readFileSync(item.snapshot, 'utf8'));
    const days = parseDays(snapshot.sheets['時間割'], {referenceDate: snapshot.capturedAt});
    const populatedHeaders = snapshot.sheets['時間割'][2].slice(3).filter(value => String(value ?? '').trim()).length;
    assert.equal(days.length, populatedHeaders, item.id);
    assert.equal(new Set(days.map(day => day.key)).size, days.length, item.id);
    for (let i = 0; i < days.length; i++) {
      assert.equal(days[i].weekday, '日月火水木金土'[new Date(days[i].key + 'T00:00:00Z').getUTCDay()], item.id);
      if (i) assert.ok(days[i].key > days[i - 1].key, item.id);
    }
  }
});
