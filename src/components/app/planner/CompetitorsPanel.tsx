import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import {
  getCompetitorJob,
  getCompetitors,
  pollJob,
  saveCompetitors,
  startCompetitorAnalysis,
  type Competitor,
  type CompetitorInsights,
} from '../../../legacy/services/plannerService';
import { usePlannerStyles } from './plannerUi';

interface Props {
  isAdmin: boolean;
  onNotify: (msg: string, kind?: 'ok' | 'error') => void;
}

const blank = (): Competitor => ({ name: '', website: '', instagram: '', linkedin: '', facebook: '', x: '' });
const FIELDS: { key: keyof Competitor; label: string; placeholder: string }[] = [
  { key: 'website', label: 'Website', placeholder: 'rival.com' },
  { key: 'instagram', label: 'Instagram', placeholder: '@rival' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/company/rival' },
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/rival' },
  { key: 'x', label: 'X', placeholder: '@rival' },
];

export default function CompetitorsPanel({ isAdmin, onNotify }: Props) {
  const s = usePlannerStyles();
  const [list, setList] = useState<Competitor[]>([]);
  const [insights, setInsights] = useState<CompetitorInsights | null>(null);
  const [max, setMax] = useState(8);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studying, setStudying] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await getCompetitors();
      setList(d.competitors.length ? d.competitors : [blank()]);
      setInsights(d.insights);
      setMax(d.max);
      setDirty(false);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not load competitors', 'error');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (i: number, patch: Partial<Competitor>) => {
    setList((cur) => cur.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setDirty(true);
  };

  async function save(): Promise<boolean> {
    setSaving(true);
    try {
      const saved = await saveCompetitors(list.filter((c) => c.name.trim()));
      setList(saved.length ? saved : [blank()]);
      setDirty(false);
      return true;
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not save', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function study() {
    if (dirty && !(await save())) return;
    setStudying(true);
    try {
      const first = await startCompetitorAnalysis();
      await pollJob(first, getCompetitorJob);
      await load();
      onNotify('Competitors studied. Your next plan will use what we learned.', 'ok');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not study competitors', 'error');
    } finally {
      setStudying(false);
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-16 text-sm ${s.muted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  const named = list.filter((c) => c.name.trim()).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className={`${s.card} p-4 sm:p-5 space-y-4`}>
        <div>
          <h3 className={`text-base font-bold ${s.title}`}>Your competitors</h3>
          <p className={`text-xs mt-0.5 ${s.muted}`}>Add up to {max}. We study what works for them and use it to shape your posts. We never copy their wording or mention them by name.</p>
        </div>
        <div className="space-y-3">
          {list.map((c, i) => (
            <div key={i} className={`rounded-lg p-3 space-y-2 ${s.soft}`}>
              <div className="flex items-center gap-2">
                <input value={c.name} disabled={!isAdmin} onChange={(e) => update(i, { name: e.target.value })} placeholder="Competitor name" className={s.input} aria-label="Competitor name" />
                {isAdmin && (
                  <button
                    type="button"
                    aria-label="Remove competitor"
                    onClick={() => {
                      setList((cur) => (cur.length > 1 ? cur.filter((_, idx) => idx !== i) : [blank()]));
                      setDirty(true);
                    }}
                    className={`mt-1 p-2 rounded-md ${s.danger}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FIELDS.map((f) => (
                  <input key={f.key} value={(c[f.key] as string) || ''} disabled={!isAdmin} onChange={(e) => update(i, { [f.key]: e.target.value })} placeholder={`${f.label}: ${f.placeholder}`} className={`${s.input} !mt-0 text-xs`} aria-label={f.label} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {list.length < max && (
              <button type="button" onClick={() => { setList((cur) => [...cur, blank()]); setDirty(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${s.ghost}`}>
                <Plus className="w-3.5 h-3.5" /> Add competitor
              </button>
            )}
            <button type="button" disabled={!dirty || saving} onClick={() => void save()} className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${s.secondary}`}>
              {saving ? 'Saving…' : 'Save list'}
            </button>
            <button type="button" disabled={!named || studying} onClick={() => void study()} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 ${s.primary}`}>
              {studying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} {studying ? 'Studying… this takes a minute' : insights ? 'Study again' : 'Study my competitors'}
            </button>
          </div>
        )}
      </div>

      <div className={`${s.card} p-4 sm:p-5 space-y-3`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className={`text-base font-bold ${s.title}`}>What we learned</h3>
            <p className={`text-xs mt-0.5 ${s.muted}`}>Refreshed automatically every week once you have a list.</p>
          </div>
          {insights && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${insights.confidence === 'high' ? 'bg-emerald-500/15 text-emerald-500' : insights.confidence === 'medium' ? 'bg-amber-500/15 text-amber-500' : 'bg-rose-500/15 text-rose-500'}`}>
              {insights.confidence} confidence
            </span>
          )}
        </div>
        {!insights ? (
          <p className={`text-sm py-6 ${s.muted}`}>Nothing yet. Add your competitors and choose "Study my competitors". Plans work without this, but they get sharper with it.</p>
        ) : (
          <div className="space-y-4 text-sm">
            {insights.outdated && <p className="text-xs text-amber-500">Your list changed since this was studied. Study again to refresh it.</p>}
            <p className={s.title}>{insights.summary}</p>
            {insights.winningPatterns.length > 0 && (
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${s.muted}`}>What works for them</p>
                <ul className="space-y-2">
                  {insights.winningPatterns.slice(0, 5).map((p, i) => (
                    <li key={i} className={`rounded-md px-3 py-2 text-xs ${s.soft}`}>
                      <p className={`font-semibold ${s.title}`}>{p.pattern}</p>
                      <p className={s.muted}>{p.why}</p>
                      {p.adapt && <p className="text-teal-500 mt-0.5">For you: {p.adapt}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insights.marketGaps.length > 0 && (
              <div>
                <p className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${s.muted}`}>Gaps you can own</p>
                <ul className={`list-disc pl-5 text-xs space-y-0.5 ${s.title}`}>
                  {insights.marketGaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className={`text-[11px] ${s.muted}`}>
              Studied {insights.competitorsAnalyzed.join(', ')} on {new Date(insights.analyzedAt).toLocaleDateString()}
              {insights.usedSearch ? ' using live web search' : ' without live web search, so treat this as general guidance'}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
