/**
 * Timeframe boundaries for the dashboard, computed in the configured timezone
 * (default Australia/Sydney). Each timeframe resolves to an inclusive
 * { start, end } pair of JS Dates (UTC instants) that we test item dates against.
 *
 * Timeframes from the manual:
 *   Today, This Week, This Month, This Quarter, This Six Month, This Year.
 *   "Customer Date" is exposed as a custom { from, to } range.
 *   "All Time" is added as a convenience default.
 */
import { runtime } from './config.js';

export const TIMEFRAME_IDS = [
  'today',
  'this_week',
  'this_month',
  'this_quarter',
  'this_six_month',
  'this_year',
  'all_time',
  'custom',
];

export const TIMEFRAME_LABELS = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  this_quarter: 'This Quarter',
  this_six_month: 'This Six Months',
  this_year: 'This Year',
  all_time: 'All Time',
  custom: 'Custom Range',
};

/** Calendar parts (year, month 0-11, day, weekday 0=Sun) of `date` in `timeZone`. */
function partsInTz(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(p.year),
    month: Number(p.month) - 1,
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: weekdayMap[p.weekday],
  };
}

/** Milliseconds the wall clock in `timeZone` is ahead of UTC at `date`. */
function tzOffsetMs(timeZone, date) {
  const p = partsInTz(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/** Convert a wall-clock time in `timeZone` to the corresponding UTC instant. */
function zonedToUtc(year, month, day, timeZone, endOfDay = false) {
  const [h, mi, s, ms] = endOfDay ? [23, 59, 59, 999] : [0, 0, 0, 0];
  const utcGuess = Date.UTC(year, month, day, h, mi, s, ms);
  const offset = tzOffsetMs(timeZone, new Date(utcGuess));
  return new Date(utcGuess - offset);
}

/**
 * Resolve a timeframe id (+ optional custom range) into { start, end } UTC Dates.
 * `now` is injectable for testing.
 */
export function resolveTimeframe(timeframeId, custom = {}, now = new Date()) {
  const tz = runtime.timezone;
  const t = partsInTz(now, tz);
  const startOfDay = (y, m, d) => zonedToUtc(y, m, d, tz, false);
  const endOfDay = (y, m, d) => zonedToUtc(y, m, d, tz, true);

  switch (timeframeId) {
    case 'today':
      return { start: startOfDay(t.year, t.month, t.day), end: endOfDay(t.year, t.month, t.day) };

    case 'this_week': {
      // Week starts Monday.
      const daysFromMonday = (t.weekday + 6) % 7;
      const monday = new Date(Date.UTC(t.year, t.month, t.day - daysFromMonday));
      const sunday = new Date(Date.UTC(t.year, t.month, t.day - daysFromMonday + 6));
      return {
        start: startOfDay(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()),
        end: endOfDay(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate()),
      };
    }

    case 'this_month':
      return { start: startOfDay(t.year, t.month, 1), end: endOfDay(t.year, t.month + 1, 0) };

    case 'this_quarter': {
      const qStartMonth = Math.floor(t.month / 3) * 3;
      return { start: startOfDay(t.year, qStartMonth, 1), end: endOfDay(t.year, qStartMonth + 3, 0) };
    }

    case 'this_six_month': {
      const hStartMonth = t.month < 6 ? 0 : 6;
      return { start: startOfDay(t.year, hStartMonth, 1), end: endOfDay(t.year, hStartMonth + 6, 0) };
    }

    case 'this_year':
      return { start: startOfDay(t.year, 0, 1), end: endOfDay(t.year, 11, 31) };

    case 'all_time':
      return { start: new Date(0), end: new Date('2999-12-31T23:59:59Z') };

    case 'custom': {
      if (!custom.from || !custom.to) {
        throw new Error('Custom timeframe requires `from` and `to` (YYYY-MM-DD).');
      }
      const [fy, fm, fd] = custom.from.split('-').map(Number);
      const [ty, tm, td] = custom.to.split('-').map(Number);
      return { start: startOfDay(fy, fm - 1, fd), end: endOfDay(ty, tm - 1, td) };
    }

    default:
      throw new Error(`Unknown timeframe: ${timeframeId}`);
  }
}

export function isWithin(date, range) {
  if (!date) return false;
  const t = date.getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

/**
 * Resolve the *previous* equivalent period for a timeframe (for deltas):
 *   - calendar timeframes -> the prior calendar period (last week/month/etc.)
 *   - custom -> the equal-length window immediately before it
 *   - all_time -> null (no comparison)
 */
export function previousRange(timeframeId, custom = {}, now = new Date()) {
  if (timeframeId === 'all_time') return null;
  if (timeframeId === 'custom') {
    const cur = resolveTimeframe('custom', custom, now);
    const len = cur.end.getTime() - cur.start.getTime();
    const end = new Date(cur.start.getTime() - 1);
    return { start: new Date(end.getTime() - len), end };
  }
  // A reference instant one day before the current period's start falls inside
  // the previous period; resolving the same timeframe there yields it.
  const cur = resolveTimeframe(timeframeId, {}, now);
  const ref = new Date(cur.start.getTime() - 24 * 60 * 60 * 1000);
  return resolveTimeframe(timeframeId, {}, ref);
}
