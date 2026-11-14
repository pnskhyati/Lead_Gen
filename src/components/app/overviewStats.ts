/**
 * Overview numbers and the recent-activity feed, worked out from the real leads and events. Nothing here is invented:
 * a figure that cannot be known (for example money won) is left out rather than guessed.
 */
import type { Lead } from '../../legacy/types';
import type { NavCategory, SubCategory } from '../../types';

export interface ActivityItem {
  id: string;
  ts: number;
  isoDate: string; // YYYY-MM-DD, local
  timeStr: string;
  icon: string;
  iconColor: string;
  description: string;
  relativeTime: string;
  score: number;
  category: NavCategory;
  subCategory?: SubCategory;
}

export interface ExtraEvent {
  id: string;
  ts: number;
  description: string;
  icon: string;
  iconColor: string;
  category: NavCategory;
  subCategory?: SubCategory;
}

export interface Range {
  start: number;
  end: number;
}

export const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
  linkedin: 'LinkedIn',
  web: 'Website',
  email: 'Email',
  google_ads: 'Google Ads',
  manual: 'Manual',
};

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "YYYY-MM-DD" as a local date. */
export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toDayString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function rangeFor(kind: string, custom: { startDate: string; endDate: string }, now = Date.now()): Range {
  const today = startOfDay(new Date(now));
  if (kind === 'Today') return { start: today, end: now };
  if (kind === 'Last 7 days') return { start: today - 6 * DAY, end: now };
  if (kind === 'Last 30 days') return { start: today - 29 * DAY, end: now };
  return { start: parseDay(custom.startDate).getTime(), end: parseDay(custom.endDate).getTime() + DAY - 1 };
}

const time = (l: Lead) => new Date(l.createdAt).getTime();
const inRange = (t: number, r: Range) => Number.isFinite(t) && t >= r.start && t <= r.end;
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');

export interface OverviewStats {
  newLeads: number;
  growth: string | null;
  qualified: number;
  qualRate: string;
  followUps: number;
  dueText: string;
  won: number;
  contacted: number;
  channels: { label: string; leads: number; qualified: number; qualRate: string }[];
}

export function computeStats(leads: Lead[], range: Range, now = Date.now()): OverviewStats {
  const mine = leads.filter((l) => inRange(time(l), range));
  const len = range.end - range.start + 1;
  const before = leads.filter((l) => inRange(time(l), { start: range.start - len, end: range.start - 1 })).length;
  const isQualified = (l: Lead) => l.status === 'qualified' || l.status === 'closed';

  let growth: string | null = null;
  if (before > 0) {
    const change = Math.round(((mine.length - before) / before) * 100);
    growth = `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}%`;
  } else if (mine.length > 0) growth = 'new';

  const pending = leads.flatMap((l) => (l.followUps || []).filter((f) => f.status === 'pending'));
  const due = pending.filter((f) => new Date(f.dueAt).getTime() <= now).length;

  const by = new Map<string, Lead[]>();
  for (const l of mine) {
    const key = String(l.channel || l.source || 'manual').toLowerCase();
    by.set(key, [...(by.get(key) || []), l]);
  }
  const channels = [...by.entries()]
    .map(([key, list]) => {
      const q = list.filter(isQualified).length;
      return { label: CHANNEL_LABEL[key] || key, leads: list.length, qualified: q, qualRate: pct(q, list.length) };
    })
    .sort((a, b) => b.leads - a.leads);

  const qualified = mine.filter(isQualified).length;
  return {
    newLeads: mine.length,
    growth,
    qualified,
    qualRate: pct(qualified, mine.length),
    followUps: pending.length,
    dueText: due > 0 ? `${due} due` : 'none due',
    won: mine.filter((l) => l.status === 'closed').length,
    contacted: mine.filter((l) => l.status !== 'new').length,
    channels,
  };
}

function relative(ts: number, now: number): string {
  const mins = Math.max(0, Math.round((now - ts) / 60_000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 31 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

function item(base: { id: string; ts: number; description: string; icon: string; iconColor: string; category: NavCategory; subCategory?: SubCategory; score: number }, now: number): ActivityItem {
  const d = new Date(base.ts);
  return {
    ...base,
    isoDate: toDayString(d),
    timeStr: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    relativeTime: relative(base.ts, now),
  };
}

/** What really happened: leads arriving and moving on, plus replies sent and posts published. Newest first. */
export function buildActivities(leads: Lead[], extras: ExtraEvent[], now = Date.now()): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const l of leads) {
    const who = l.author?.trim() || l.phone || 'Unknown';
    const where = l.platform || CHANNEL_LABEL[String(l.channel)] || 'Inbound';
    const created = time(l);
    if (Number.isFinite(created)) {
      out.push(item({ id: `${l.id}-new`, ts: created, description: `New ${where} lead · ${who}`, icon: '＋', iconColor: 'text-emerald-400', category: 'leads', subCategory: 'all-leads', score: l.score || 0 }, now));
    }
    const moved = new Date(l.lastMessageAt || l.createdAt).getTime();
    if (Number.isFinite(moved) && moved > created) {
      if (l.status === 'qualified') out.push(item({ id: `${l.id}-q`, ts: moved, description: `Qualified · ${who} · score ${l.score || 0}`, icon: '✦', iconColor: 'text-emerald-400', category: 'leads', subCategory: 'all-leads', score: l.score || 0 }, now));
      else if (l.status === 'handed_off') out.push(item({ id: `${l.id}-h`, ts: moved, description: `Needs a person · ${who} · ${where}`, icon: '👤', iconColor: 'text-amber-400', category: 'inbox', subCategory: 'inbox', score: l.score || 0 }, now));
      else if (l.status === 'closed') out.push(item({ id: `${l.id}-c`, ts: moved, description: `Won · ${who}`, icon: '🏆', iconColor: 'text-emerald-400', category: 'leads', subCategory: 'pipeline', score: l.score || 0 }, now));
    }
  }
  for (const e of extras) out.push(item({ ...e, score: 0 }, now));
  return out.filter((a) => Number.isFinite(a.ts)).sort((a, b) => b.ts - a.ts);
}
