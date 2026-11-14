import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import {
  PLATFORM_LABEL,
  type Connections,
  type PlanRequest,
  type PlannerPlatform,
  type PostPrefs,
} from '../../../legacy/services/plannerService';
import PostStylePicker from './PostStylePicker';
import { PLATFORM_COLOR, PLATFORM_SHORT, browserTimeZone, timeZones, usePlannerStyles } from './plannerUi';

const PLATFORMS: PlannerPlatform[] = ['linkedin', 'instagram', 'facebook', 'x'];
const DURATIONS = [7, 15, 30];
const INTENSITIES: { id: PlanRequest['intensity']; label: string; hint: string }[] = [
  { id: 'light', label: 'Light', hint: 'about 60% of the usual volume' },
  { id: 'standard', label: 'Standard', hint: 'LinkedIn 3, Instagram 4, Facebook 3, X 5 per week' },
  { id: 'heavy', label: 'Busy', hint: 'about 50% more than standard' },
];
const EXAMPLES = [
  'Promote our Diwali offer: first class free until 15 Nov, and get people to book',
  'Build trust before our new batch starts: show our teachers, the studio and what a first class feels like',
  'Launch our weekend workshop and fill the 20 seats',
];

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

interface Props {
  connections: Connections | null;
  defaultTimezone: string;
  busy: boolean;
  error: string | null;
  onSubmit: (req: PlanRequest) => void;
  onOpenChannels: () => void;
}

export default function PlanForm({ connections, defaultTimezone, busy, error, onSubmit, onOpenChannels }: Props) {
  const s = usePlannerStyles();
  const [prompt, setPrompt] = useState('');
  const [days, setDays] = useState(7);
  const [startDate, setStartDate] = useState(tomorrow());
  const [platforms, setPlatforms] = useState<PlannerPlatform[]>(['linkedin', 'instagram', 'facebook', 'x']);
  const [intensity, setIntensity] = useState<PlanRequest['intensity']>('standard');
  const [timezone, setTimezone] = useState(defaultTimezone || browserTimeZone());
  const [postStyle, setPostStyle] = useState<PostPrefs | null>(null);
  const zones = useMemo(() => timeZones(), []);

  const toggle = (p: PlannerPlatform) => setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  const unconnected = platforms.filter((p) => connections && !connections[p].connected);
  const canSubmit = prompt.trim().length >= 8 && platforms.length > 0 && !busy;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="text-center space-y-1">
        <h2 className={`text-2xl font-bold ${s.title}`}>What should we promote?</h2>
        <p className={`text-sm ${s.muted}`}>
          One prompt. We write a separate post for each platform in your brand voice, learn from your competitors, pick the times and make the images. You review everything before anything is posted.
        </p>
      </div>

      <div className={`${s.card} p-4 sm:p-5 space-y-4`}>
        <label className={`block text-xs font-semibold ${s.muted}`}>
          Your prompt
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="e.g. Promote our Diwali offer: first class free until 15 Nov. Get people to book a slot."
            className={`${s.input} resize-y min-h-[110px]`}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setPrompt(ex)} className={`text-left text-[11px] px-2.5 py-1.5 rounded-full border ${s.idle} ${s.muted}`}>
              {ex.length > 62 ? `${ex.slice(0, 60)}…` : ex}
            </button>
          ))}
        </div>
        <p className={`text-[11px] ${s.muted}`}>Include any offer, price or date exactly as customers should see it. Anything you don't mention, we won't make up.</p>
      </div>

      <div className={`${s.card} p-4 sm:p-5 space-y-5`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className={`text-xs font-semibold ${s.muted}`}>How long?</p>
            <div className="mt-1 flex gap-2">
              {DURATIONS.map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)} className={`flex-1 py-2 rounded-lg border text-sm font-semibold ${days === d ? s.selected : s.idle} ${s.title}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <label className={`block text-xs font-semibold ${s.muted}`}>
            Start date
            <input type="date" value={startDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartDate(e.target.value)} className={s.input} />
          </label>
        </div>

        <div>
          <p className={`text-xs font-semibold ${s.muted}`}>Where should we post?</p>
          <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              const c = connections?.[p];
              return (
                <button key={p} type="button" onClick={() => toggle(p)} className={`rounded-lg border px-3 py-2.5 text-left ${on ? s.selected : s.idle}`}>
                  <span className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${PLATFORM_COLOR[p]}`}>{PLATFORM_SHORT[p]}</span>
                    <span className={`text-sm font-semibold ${s.title}`}>{PLATFORM_LABEL[p]}</span>
                  </span>
                  <span className={`block text-[10px] mt-1 ${c?.connected ? 'text-emerald-500' : 'text-amber-500'}`}>{c ? (c.connected ? 'Connected' : 'Not connected') : '…'}</span>
                </button>
              );
            })}
          </div>
          {unconnected.length > 0 && (
            <p className="text-[11px] mt-2 text-amber-500">
              {unconnected.map((p) => PLATFORM_LABEL[p]).join(', ')} {unconnected.length === 1 ? 'is' : 'are'} not connected. You can still plan, but those posts can't be approved until you{' '}
              <button type="button" onClick={onOpenChannels} className="underline font-semibold">
                connect them
              </button>
              .
            </p>
          )}
        </div>

        {platforms.length > 0 && <PostStylePicker platforms={platforms} onChange={setPostStyle} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className={`text-xs font-semibold ${s.muted}`}>How often?</p>
            <div className="mt-1 flex gap-2">
              {INTENSITIES.map((i) => (
                <button key={i.id} type="button" title={i.hint} onClick={() => setIntensity(i.id)} className={`flex-1 py-2 rounded-lg border text-sm font-semibold ${intensity === i.id ? s.selected : s.idle} ${s.title}`}>
                  {i.label}
                </button>
              ))}
            </div>
            <p className={`text-[10px] mt-1 ${s.muted}`}>{INTENSITIES.find((i) => i.id === intensity)?.hint}</p>
          </div>
          <label className={`block text-xs font-semibold ${s.muted}`}>
            Your time zone
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={s.input}>
              {(zones.includes(timezone) ? zones : [timezone, ...zones]).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && <div className={`rounded-lg border px-4 py-3 text-xs font-medium ${s.isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/30 border-rose-800/40 text-rose-300'}`}>{error}</div>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => onSubmit({ prompt: prompt.trim(), days, startDate, platforms, intensity, timezone, ...(postStyle ? { postStyle } : {}) })}
        className={`w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${s.primary}`}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy ? 'Starting…' : 'Generate my calendar'}
      </button>
    </div>
  );
}
