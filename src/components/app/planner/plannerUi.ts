import { useMemo } from 'react';
import { useTheme } from '../../../context/ThemeContext';
import type { PlannerPlatform, PostStatus } from '../../../legacy/services/plannerService';

/** The same visual tokens the rest of the app uses (see AdminView), in one place for the planner. */
export function usePlannerStyles() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return useMemo(
    () => ({
      isLight,
      input: isLight
        ? 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/25 disabled:opacity-60'
        : 'mt-1 w-full rounded-lg border border-[rgba(169,191,165,0.25)] bg-[#061816] px-3 py-2 text-sm text-[#E8E9D8] focus:outline-none focus:border-teal-500/40 disabled:opacity-60',
      primary: isLight ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-[#E8E9D8] hover:bg-white text-[#071C1A]',
      secondary: isLight
        ? 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
        : 'bg-[#0D2D2A] hover:bg-[#133F3B] text-teal-200 border border-teal-500/30',
      ghost: isLight
        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
        : 'bg-[#0D2D2A]/80 hover:bg-[#133F3B] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)]',
      danger: isLight ? 'text-rose-600 hover:bg-rose-50' : 'text-rose-300 hover:bg-rose-950/30',
      card: isLight ? 'rounded-lg border border-slate-200 bg-white shadow-2xs' : 'rounded-lg border border-[rgba(169,191,165,0.18)] bg-[#071C1A]',
      soft: isLight ? 'bg-slate-50' : 'bg-[#061816]',
      muted: isLight ? 'text-slate-500' : 'text-[#A9BFA5]',
      title: isLight ? 'text-slate-900' : 'text-white',
      border: isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.18)]',
      selected: isLight ? 'border-teal-500 bg-teal-50' : 'border-teal-400/60 bg-[#0D2D2A]',
      idle: isLight ? 'border-slate-200 hover:border-slate-300 bg-white' : 'border-[rgba(169,191,165,0.2)] hover:border-[rgba(169,191,165,0.4)] bg-[#061816]',
    }),
    [isLight]
  );
}

export const PLATFORM_COLOR: Record<PlannerPlatform, string> = {
  linkedin: 'bg-sky-600 text-white',
  instagram: 'bg-fuchsia-600 text-white',
  facebook: 'bg-blue-600 text-white',
  x: 'bg-slate-800 text-white',
};

export const PLATFORM_SHORT: Record<PlannerPlatform, string> = { linkedin: 'in', instagram: 'IG', facebook: 'fb', x: 'X' };

export const STATUS_LABEL: Record<PostStatus, string> = {
  draft: 'Needs review',
  approved: 'Scheduled',
  publishing: 'Publishing…',
  published: 'Published',
  failed: 'Failed',
  missed: 'Missed',
  cancelled: 'Cancelled',
};

export const STATUS_CHIP: Record<PostStatus, { light: string; dark: string; dot: string }> = {
  draft: { light: 'bg-amber-50 text-amber-800 border-amber-200', dark: 'bg-amber-950/40 text-amber-200 border-amber-800/40', dot: 'bg-amber-400' },
  approved: { light: 'bg-sky-50 text-sky-800 border-sky-200', dark: 'bg-sky-950/40 text-sky-200 border-sky-800/40', dot: 'bg-sky-500' },
  publishing: { light: 'bg-violet-50 text-violet-800 border-violet-200', dark: 'bg-violet-950/40 text-violet-200 border-violet-800/40', dot: 'bg-violet-500' },
  published: { light: 'bg-emerald-50 text-emerald-800 border-emerald-200', dark: 'bg-emerald-950/40 text-emerald-200 border-emerald-800/40', dot: 'bg-emerald-500' },
  failed: { light: 'bg-rose-50 text-rose-800 border-rose-200', dark: 'bg-rose-950/40 text-rose-200 border-rose-800/40', dot: 'bg-rose-500' },
  missed: { light: 'bg-orange-50 text-orange-800 border-orange-200', dark: 'bg-orange-950/40 text-orange-200 border-orange-800/40', dot: 'bg-orange-500' },
  cancelled: { light: 'bg-slate-100 text-slate-600 border-slate-200', dark: 'bg-slate-800 text-slate-300 border-slate-700', dot: 'bg-slate-400' },
};

// ---- time helpers (everything is shown in the campaign's time zone)

export const localDay = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

export const localTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const prettyTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export const prettyDay = (dayKey: string) => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
};

export function timeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const all = intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : ['UTC', 'Asia/Kolkata', 'America/New_York', 'Europe/London'];
  return all.includes('UTC') ? all : ['UTC', ...all];
}

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function countdown(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'now';
  const mins = Math.floor(ms / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}
