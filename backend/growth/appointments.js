/**
 * Appointments. The agent may offer free times, but it never confirms one: a person confirms every booking here,
 * and only then does the customer hear that it is booked.
 */
const crypto = require('crypto');
const { store, DEFAULT_APPOINTMENT_SETTINGS } = require('./store');

const DAY = 86_400_000;
const MIN = 60_000;
const BOOKING_WORDS = /\b(book|booking|appointment|schedule|reschedule|demo|call me|a call|meeting|meet|slot|available (on|at|tomorrow|today)|free (on|at|tomorrow))\b/i;

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

function getSettings(ws) {
  const saved = store.read(ws).appointments.settings;
  return { ...DEFAULT_APPOINTMENT_SETTINGS(), ...(saved || {}) };
}

function saveSettings(patch, ws) {
  const cur = getSettings(ws);
  const next = { ...cur };
  if (patch.enabled !== undefined) next.enabled = Boolean(patch.enabled);
  if (Array.isArray(patch.days)) next.days = [...new Set(patch.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort();
  for (const k of ['start', 'end']) if (patch[k] !== undefined && toMinutes(patch[k]) != null) next[k] = String(patch[k]);
  if (patch.slotMinutes !== undefined) next.slotMinutes = Math.min(240, Math.max(10, Number(patch.slotMinutes) || cur.slotMinutes));
  if (patch.daysAhead !== undefined) next.daysAhead = Math.min(30, Math.max(1, Number(patch.daysAhead) || cur.daysAhead));
  if (patch.minNoticeHours !== undefined) next.minNoticeHours = Math.min(168, Math.max(0, Number(patch.minNoticeHours) || 0));
  if (patch.utcOffsetMinutes !== undefined && Number.isFinite(Number(patch.utcOffsetMinutes))) next.utcOffsetMinutes = Number(patch.utcOffsetMinutes);
  if ((toMinutes(next.end) ?? 0) <= (toMinutes(next.start) ?? 0)) throw new Error('The closing time must be after the opening time.');
  store.update((s) => {
    s.appointments.settings = next;
  }, ws);
  return next;
}

/** Free start times (ISO, UTC) inside business hours, from now until daysAhead, minus times already confirmed. */
function getSlots({ settings, requests = [], now = Date.now() }) {
  if (!settings?.enabled) return [];
  const offset = settings.utcOffsetMinutes * MIN;
  const startMin = toMinutes(settings.start);
  const endMin = toMinutes(settings.end);
  const taken = new Set(requests.filter((r) => r.status === 'confirmed' && r.confirmedSlot).map((r) => r.confirmedSlot));
  const earliest = now + settings.minNoticeHours * 60 * MIN;
  const firstLocalDay = Math.floor((now + offset) / DAY) * DAY;
  const out = [];
  for (let i = 0; i <= settings.daysAhead; i += 1) {
    const dayStart = firstLocalDay + i * DAY;
    if (!settings.days.includes(new Date(dayStart).getUTCDay())) continue;
    for (let m = startMin; m + settings.slotMinutes <= endMin; m += settings.slotMinutes) {
      const iso = new Date(dayStart + m * MIN - offset).toISOString();
      if (new Date(iso).getTime() >= earliest && !taken.has(iso)) out.push(iso);
    }
  }
  return out;
}

/** "Tue 18 Nov, 3:00 PM" in the business's own time. */
function formatSlot(iso, offsetMinutes) {
  const d = new Date(new Date(iso).getTime() + offsetMinutes * MIN);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getUTCHours();
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}, ${((h + 11) % 12) + 1}:${min} ${h < 12 ? 'AM' : 'PM'}`;
}

function listRequests(ws) {
  return store.read(ws).appointments.requests.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function detectBookingIntent(text) {
  return BOOKING_WORDS.test(String(text || ''));
}

/** One open request per person. Returns the request, or null if booking is off or one is already open. */
function createRequest({ leadId, name, contact, preferredText, channel }, ws) {
  if (!getSettings(ws).enabled) return null;
  let created = null;
  store.update((s) => {
    const open = s.appointments.requests.find((r) => r.status === 'pending' && leadId && r.leadId === leadId);
    if (open) {
      open.preferredText = clip(preferredText, 300) || open.preferredText;
      return;
    }
    created = {
      id: `ap-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      leadId: leadId || null,
      name: clip(name, 80) || 'Unknown',
      contact: clip(contact, 120),
      channel: clip(channel, 30),
      preferredText: clip(preferredText, 300),
      status: 'pending',
      createdAt: new Date().toISOString(),
      confirmedSlot: null,
    };
    s.appointments.requests.unshift(created);
    s.appointments.requests = s.appointments.requests.slice(0, 300);
  }, ws);
  return created;
}

function ics({ id, slot, minutes, title, who }) {
  const f = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(new Date(slot).getTime() + minutes * MIN).toISOString();
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tecavy//Appointments//EN', 'BEGIN:VEVENT', `UID:${id}@tecavy`, `DTSTAMP:${f(new Date().toISOString())}`, `DTSTART:${f(slot)}`, `DTEND:${f(end)}`, `SUMMARY:${title}`, `DESCRIPTION:${who}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

/** A person confirms a time. Only a free time inside business hours is accepted. */
function confirm(id, slot, { now = Date.now(), companyName = 'us' } = {}, ws) {
  const state = store.read(ws).appointments;
  const settings = { ...DEFAULT_APPOINTMENT_SETTINGS(), ...(state.settings || {}) };
  const req = state.requests.find((r) => r.id === id);
  if (!req) throw new Error('Appointment request not found');
  if (req.status !== 'pending') throw new Error(`This request is already ${req.status}`);
  const iso = new Date(slot).toISOString();
  if (!getSlots({ settings, requests: state.requests, now }).includes(iso)) throw new Error('That time is not free or is outside business hours.');
  const label = formatSlot(iso, settings.utcOffsetMinutes);
  store.update((s) => {
    const r = s.appointments.requests.find((x) => x.id === id);
    r.status = 'confirmed';
    r.confirmedSlot = iso;
    r.confirmedAt = new Date().toISOString();
  }, ws);
  return {
    request: { ...req, status: 'confirmed', confirmedSlot: iso },
    label,
    message: `Your appointment with ${companyName} is confirmed for ${label}. Reply here if you need to change it.`,
    ics: ics({ id, slot: iso, minutes: settings.slotMinutes, title: `Appointment with ${companyName}`, who: req.name }),
  };
}

function decline(id, ws) {
  let found = null;
  store.update((s) => {
    const r = s.appointments.requests.find((x) => x.id === id && x.status === 'pending');
    if (r) {
      r.status = 'declined';
      found = r;
    }
  }, ws);
  if (!found) throw new Error('No open request with that id');
  return found;
}

/** A short line for the agent: which times it may offer. It must never say a time is booked. */
function promptSlots(ws, now = Date.now()) {
  const state = store.read(ws).appointments;
  const settings = { ...DEFAULT_APPOINTMENT_SETTINGS(), ...(state.settings || {}) };
  const slots = getSlots({ settings, requests: state.requests, now });
  if (!slots.length) return '';
  // Spread the offer over different days rather than listing one morning.
  const picked = [];
  const days = new Set();
  for (const s of slots) {
    const day = s.slice(0, 10);
    if (days.has(day)) continue;
    days.add(day);
    picked.push(formatSlot(s, settings.utcOffsetMinutes));
    if (picked.length === 3) break;
  }
  return picked.join('; ');
}

/** Called from chats after a message: opens a request when the person wants to book. */
function noteBookingIntent({ lead, text, ws }) {
  if (!detectBookingIntent(text)) return null;
  return createRequest({ leadId: lead?.id, name: lead?.author || lead?.phone, contact: lead?.email || lead?.phone || '', preferredText: text, channel: lead?.channel }, ws);
}

module.exports = { getSettings, saveSettings, getSlots, formatSlot, listRequests, createRequest, confirm, decline, detectBookingIntent, promptSlots, noteBookingIntent };
