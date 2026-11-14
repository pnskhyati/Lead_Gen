/**
 * Decide WHEN each post goes out. Dates and times are chosen by code (not by the model) so a calendar is
 * always valid: right cadence per platform, sensible local-time windows, no same-platform doubles,
 * nothing in the past, daylight-saving safe.
 */
const { zonedToUtc, weekdayOf, addDays } = require('./timeUtil');

// Posts per platform per week at "standard" intensity.
const CADENCE = { linkedin: 3, instagram: 4, facebook: 3, x: 5 };
const INTENSITY = { light: 0.6, standard: 1, heavy: 1.5 };

// Days of the week (0 = Sunday) each platform should use, and typical local-time windows.
const WEEKDAYS = {
  linkedin: [1, 2, 3, 4, 5],
  instagram: [0, 1, 2, 3, 4, 5, 6],
  facebook: [1, 2, 3, 4, 5, 6],
  x: [1, 2, 3, 4, 5, 6, 0],
};
const WINDOWS = {
  linkedin: ['08:30', '12:15', '17:30'],
  instagram: ['11:30', '19:00', '09:00'],
  facebook: ['13:00', '19:30', '10:00'],
  x: ['09:00', '13:00', '18:00'],
};

const MIN_LEAD_MS = 30 * 60_000;
const MAX_POSTS = 60;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Shift a HH:MM by up to +/-12 minutes (5-minute grid), deterministic per seed, so posts do not all land on :00. */
function jitter(time, seed) {
  const [h, m] = time.split(':').map(Number);
  const offset = ((hash(seed) % 5) - 2) * 5;
  const total = Math.min(23 * 60 + 55, Math.max(0, h * 60 + m + offset));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * @param {{ startDate: string, days: number, platforms: string[], timezone: string,
 *           intensity?: 'light'|'standard'|'heavy', bestTimes?: Record<string,string[]>, now?: number }} opts
 * @returns {{ platform: string, date: string, time: string, scheduledAt: string }[]}
 */
function planSlots({ startDate, days, platforms, timezone, intensity = 'standard', bestTimes = {}, now = Date.now() }) {
  const factor = INTENSITY[intensity] || 1;
  const slots = [];

  for (const platform of platforms) {
    if (!CADENCE[platform]) continue;
    const allowed = new Set(WEEKDAYS[platform]);
    const windows = bestTimes[platform]?.length ? bestTimes[platform] : WINDOWS[platform];
    const total = Math.max(days >= 3 ? 1 : 1, Math.round((CADENCE[platform] * factor * days) / 7));

    // Evenly spread target days across the window, then snap each to the nearest allowed, unused day.
    const used = new Set();
    for (let k = 0; k < total; k += 1) {
      const target = Math.min(days - 1, Math.max(0, Math.round(((k + 0.5) * days) / total - 0.5)));
      let chosen = null;
      for (let delta = 0; delta < days && chosen === null; delta += 1) {
        for (const idx of delta === 0 ? [target] : [target + delta, target - delta]) {
          if (idx < 0 || idx >= days || used.has(idx)) continue;
          const date = addDays(startDate, idx);
          if (!allowed.has(weekdayOf(date))) continue;
          const time = jitter(windows[k % windows.length], `${platform}:${date}`);
          const at = zonedToUtc(date, time, timezone);
          if (new Date(at).getTime() < now + MIN_LEAD_MS) continue; // today's window already passed
          chosen = { idx, date, time, at };
          break;
        }
      }
      if (!chosen) continue; // nowhere valid left in this window for this post
      used.add(chosen.idx);
      slots.push({ platform, date: chosen.date, time: chosen.time, scheduledAt: chosen.at });
    }
  }

  return slots
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.platform.localeCompare(b.platform))
    .slice(0, MAX_POSTS);
}

const DAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/** Selected platforms that ended up with no post, each with a plain reason the owner can act on. */
function explainSkipped({ startDate, days, platforms, slots }) {
  const out = [];
  for (const platform of platforms) {
    if (slots.some((s) => s.platform === platform)) continue;
    const allowed = WEEKDAYS[platform] || [];
    const windowDays = Array.from({ length: days }, (_, k) => weekdayOf(addDays(startDate, k)));
    const usable = windowDays.some((d) => allowed.includes(d));
    const reason = usable
      ? 'every posting time in this window has already passed. Start later or choose more days.'
      : `it only posts on ${allowed.map((d) => DAY_NAMES[d]).join(', ').replace(/, ([^,]*)$/, ' and $1')}, and none fall in these dates. Choose more days.`;
    out.push({ platform, reason });
  }
  return out;
}

module.exports = { planSlots, explainSkipped, CADENCE, WINDOWS, WEEKDAYS, MAX_POSTS };
