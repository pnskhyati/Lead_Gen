/**
 * Timezone helpers (IANA zones via Intl; no dependencies).
 * Posts are stored as UTC instants; the owner thinks in local dates and times, so every conversion
 * goes through here and daylight-saving shifts are handled by the platform's tz database.
 */

function isValidTimeZone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Offset (ms) of `tz` from UTC at the given instant: positive east of Greenwich. */
function offsetMs(instantMs, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const v = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Convert a wall-clock date and time in `tz` to a UTC ISO string.
 * @param {string} date YYYY-MM-DD
 * @param {string} time HH:MM
 */
function zonedToUtc(date, time, tz) {
  const [y, m, d] = String(date).split('-').map(Number);
  const [hh, mm] = String(time).split(':').map(Number);
  if (![y, m, d, hh, mm].every(Number.isInteger)) throw new Error(`Invalid date/time: ${date} ${time}`);
  // Date.UTC silently rolls impossible values over (month 13 -> next January), so check the calendar ourselves.
  const check = new Date(Date.UTC(y, m - 1, d));
  if (m < 1 || m > 12 || hh < 0 || hh > 23 || mm < 0 || mm > 59 || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid date/time: ${date} ${time}`);
  }
  const wall = Date.UTC(y, m - 1, d, hh, mm, 0);
  // Two passes settle the offset across a daylight-saving boundary.
  let guess = wall - offsetMs(wall, tz);
  guess = wall - offsetMs(guess, tz);
  return new Date(guess).toISOString();
}

/** Local calendar day (YYYY-MM-DD) of a UTC instant in `tz`. */
function localDayKey(iso, tz) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}

/** Local wall-clock time (HH:MM) of a UTC instant in `tz`. */
function localTime(iso, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.hour}:${v.minute}`;
}

/** Day of week (0 = Sunday) of a YYYY-MM-DD calendar date (timezone independent). */
function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Add whole days to a YYYY-MM-DD calendar date. */
function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

module.exports = { isValidTimeZone, zonedToUtc, localDayKey, localTime, weekdayOf, addDays };
