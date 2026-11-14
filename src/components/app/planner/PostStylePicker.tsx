import React, { useEffect, useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import {
  PLATFORM_LABEL,
  getPostStyle,
  suggestPostStyle,
  type PlannerPlatform,
  type PostPref,
  type PostPrefs,
  type PostStyleState,
} from '../../../legacy/services/plannerService';
import { usePlannerStyles } from './plannerUi';

interface Props {
  platforms: PlannerPlatform[];
  /** the owner's current choices, reported up so the plan can use them */
  onChange: (prefs: PostPrefs | null) => void;
}

const LENGTHS: { id: PostPref['length']; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'standard', label: 'Medium' },
  { id: 'long', label: 'Long' },
];
const GOALS: { id: PostPref['goal']; label: string; hint: string }[] = [
  { id: 'comments', label: 'Comments', hint: 'ends with a question people want to answer' },
  { id: 'saves', label: 'Saves and shares', hint: 'useful enough to keep or send on' },
  { id: 'leads', label: 'Enquiries', hint: 'makes the next step obvious' },
  { id: 'clicks', label: 'Website visits', hint: 'gives a reason to open the link' },
];

/** Choose how posts read on each platform, with a recommendation for this business. */
export default function PostStylePicker({ platforms, onChange }: Props) {
  const s = usePlannerStyles();
  const [state, setState] = useState<PostStyleState | null>(null);
  const [prefs, setPrefs] = useState<PostPrefs | null>(null);
  const [open, setOpen] = useState<PlannerPlatform | null>(null);
  const [why, setWhy] = useState<Partial<Record<PlannerPlatform, string>>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getPostStyle()
      .then((r) => {
        if (!live) return;
        setState(r);
        setPrefs(r.prefs);
        onChange(r.prefs);
      })
      .catch(() => undefined); // the defaults on the server still apply
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state || !prefs) return null;

  const update = (p: PlannerPlatform, patch: Partial<PostPref>) => {
    const next = { ...prefs, [p]: { ...prefs[p], ...patch } };
    setPrefs(next);
    onChange(next);
  };

  async function suggest() {
    setBusy(true);
    setNote(null);
    try {
      const r = await suggestPostStyle(platforms);
      const next = { ...prefs! };
      const reasons: Partial<Record<PlannerPlatform, string>> = {};
      for (const sg of r.suggestions) {
        const { platform, why: w, ...choice } = sg;
        next[platform] = { ...next[platform], ...Object.fromEntries(Object.entries(choice).filter(([, v]) => v !== undefined)) } as PostPref;
        reasons[platform] = w;
      }
      setPrefs(next);
      onChange(next);
      setWhy(reasons);
      setNote(r.ai ? 'Suggested for your business. Change anything you like.' : 'The assistant is unavailable right now, so these are the standard recommendations.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not get suggestions');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className={`text-xs font-semibold ${s.muted}`}>How should the posts read?</p>
          <p className={`text-[11px] ${s.muted}`}>Pick a structure for each platform, or let the assistant suggest one for your business.</p>
        </div>
        <button type="button" onClick={() => void suggest()} disabled={busy || !platforms.length} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50 ${s.secondary}`}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          Suggest for my business
        </button>
      </div>
      {note && <p className="text-[11px] mt-1 text-emerald-500">{note}</p>}

      <div className="mt-2 space-y-2">
        {platforms.map((p) => {
          const pref = prefs[p];
          const formats = state.catalog[p] || [];
          const current = formats.find((f) => f.id === pref.format);
          const expanded = open === p;
          return (
            <div key={p} className={`rounded-lg border ${s.border}`}>
              <button type="button" onClick={() => setOpen(expanded ? null : p)} aria-expanded={expanded} className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-3">
                <span>
                  <span className={`text-sm font-semibold ${s.title}`}>{PLATFORM_LABEL[p]}</span>
                  <span className={`block text-[11px] ${s.muted}`}>{current?.label}</span>
                </span>
                <span className={`text-[11px] ${s.muted}`}>{expanded ? 'Close' : 'Change'}</span>
              </button>
              {why[p] && <p className="px-3 pb-2 -mt-1 text-[11px] text-emerald-500">{why[p]}</p>}
              {expanded && (
                <div className="px-3 pb-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {formats.map((f) => (
                      <button key={f.id} type="button" onClick={() => update(p, { format: f.id })} aria-pressed={pref.format === f.id} className={`text-left rounded-lg border px-3 py-2 ${pref.format === f.id ? s.selected : s.idle}`}>
                        <span className={`block text-xs font-bold ${s.title}`}>{f.label}</span>
                        <span className={`block text-[11px] ${s.muted}`}>{f.blurb}</span>
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className={`block text-xs font-semibold ${s.muted}`}>
                      Length
                      <select value={pref.length} onChange={(e) => update(p, { length: e.target.value as PostPref['length'] })} className={s.input}>
                        {LENGTHS.map((l) => (
                          <option key={l.id} value={l.id}>{l.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={`block text-xs font-semibold ${s.muted}`}>
                      Main goal
                      <select value={pref.goal} onChange={(e) => update(p, { goal: e.target.value as PostPref['goal'] })} className={s.input}>
                        {GOALS.map((g) => (
                          <option key={g.id} value={g.id}>{g.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={`block text-xs font-semibold ${s.muted}`}>
                      Emoji
                      <select value={pref.emoji} onChange={(e) => update(p, { emoji: e.target.value as PostPref['emoji'] })} className={s.input}>
                        <option value="none">None</option>
                        <option value="few">A few</option>
                      </select>
                    </label>
                  </div>
                  <p className={`text-[10px] ${s.muted}`}>{GOALS.find((g) => g.id === pref.goal)?.hint}</p>
                  <label className={`block text-xs font-semibold ${s.muted}`}>
                    Anything else about the style? (optional)
                    <input value={pref.notes} maxLength={300} onChange={(e) => update(p, { notes: e.target.value })} placeholder="e.g. sound like a friendly founder, use simple words" className={s.input} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
