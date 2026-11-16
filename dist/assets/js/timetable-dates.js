const DAY = 86400000;
const weekdays = '日月火水木金土';
const cell = (rows, r, c) => String(rows[r]?.[c] ?? '').trim();

function calendarDate(year, month, day) {
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? date : null;
}

function dateParts(raw) {
  const match = raw.match(/^(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日(?:[（(][日月火水木金土](?:曜日)?[）)])?$/)
    || raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) return {year: match[1] == null ? null : Number(match[1]), month: match[2] == null ? null : Number(match[2]), day: Number(match[3])};
  if (/^\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial >= 61 && serial < 2958466) return {date: new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * DAY)};
  }
  return null;
}

function resolveDate(parts, previous, reference) {
  if (parts.date) return parts.date;
  let year = parts.year ?? previous?.getUTCFullYear();
  let month = parts.month ?? (previous && previous.getUTCMonth() + 1);
  if (!month) return null; // A day alone cannot identify a calendar date.
  if (!parts.month && previous && parts.day < previous.getUTCDate()) {
    month++;
    if (month > 12) {month = 1; year++;}
  } else if (!parts.year && previous?.getUTCMonth() === 11 && month === 1) year++;
  if (year != null) return calendarDate(year, month, parts.day);
  // Resolve yearless dates against the data's capture date, including New Year.
  const candidates = [-1, 0, 1].map(offset => calendarDate(reference.getUTCFullYear() + offset, month, parts.day)).filter(Boolean);
  return candidates.sort((a, b) => Math.abs(a - reference) - Math.abs(b - reference))[0] ?? null;
}

export function tokyoDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(value);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

export function parseDays(rows, {referenceDate = new Date()} = {}) {
  // Calendar arithmetic is UTC; only the choice of reference day uses Japan time.
  const stamp = new Date(referenceDate);
  const reference = new Date(tokyoDateKey(Number.isNaN(stamp.getTime()) ? new Date() : stamp) + 'T00:00:00Z');
  const out = [];
  let previous = null, previousColumn = null;
  for (let c = 3; c < (rows[2]?.length ?? 0); c++) {
    const raw = cell(rows, 2, c), parts = dateParts(raw);
    if (!parts) continue;
    const suppliedWeekday = cell(rows, 4, c).replace(/曜日$|曜$/, '');
    const weekday = weekdays.includes(suppliedWeekday) && suppliedWeekday.length === 1 ? suppliedWeekday : null;
    let date = resolveDate(parts, previous, reference);
    if (previous) {
      const expected = new Date(previous.getTime() + (c - previousColumn) * DAY);
      // Repair stale rolling headers only with both chronological and weekday evidence.
      // A valid forward date is preserved, even if the timetable skips several days.
      if (weekday === weekdays[expected.getUTCDay()] && (!date || date <= previous || weekday !== weekdays[date.getUTCDay()])) date = expected;
    }
    if (!date || (previous && date <= previous) || (weekday && weekday !== weekdays[date.getUTCDay()])) continue;
    previous = date;
    previousColumn = c;
    const month = date.getUTCMonth() + 1, day = String(date.getUTCDate());
    out.push({key: date.toISOString().slice(0, 10), date: `${month}月${day}日`, day, weekday: weekdays[date.getUTCDay()], week: cell(rows, 3, c), columnIndex: c,
      lessons: Array.from({length: 8}, (_, i) => ({period: i + 1, subject: cell(rows, 5 + i, c)}))});
  }
  return out;
}
