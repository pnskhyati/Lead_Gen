import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { NavCategory, SubCategory } from '../../types';
import {
  addCompetitor,
  approveAction,
  confirmAppointment,
  declineAppointment,
  dismissAction,
  getActions,
  getAppointments,
  getAutopilot,
  getCompetitors,
  getPerformance,
  getSignals,
  markCompetitorChangeSeen,
  refreshActions,
  removeCompetitor,
  runAutopilot,
  saveAppointmentSettings,
  saveAutopilot,
  scanCompetitors,
  type Appointments,
  type AutopilotSettings,
  type CompetitorChange,
  type CompetitorWatch,
  type GrowthAction,
  type GrowthSignal,
  type Performance,
} from '../../legacy/services/growthService';
import { usePlannerStyles } from './planner/plannerUi';

const TABS: { id: SubCategory; label: string }[] = [
  { id: 'overview', label: 'Action center' },
  { id: 'performance', label: 'Performance' },
  { id: 'competitors', label: 'Competitors' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'autopilot', label: 'Autopilot' },
];
const DOT: Record<string, string> = { red: 'bg-rose-500', yellow: 'bg-amber-400', green: 'bg-emerald-500' };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ago(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function useAsync<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setError };
}

function ErrorBar({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="p-3 rounded bg-rose-500/10 text-rose-200 border border-rose-500/30 text-xs normal-case">{message}</p>;
}

/* ------------------------------ Action center ------------------------------ */

function ActionCard({ a, onChanged, onError }: React.Attributes & { a: GrowthAction; onChanged: () => void; onError: (m: string) => void }) {
  const s = usePlannerStyles();
  const [text, setText] = useState(a.payload.text || '');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`${s.card} p-4 space-y-3`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT[a.priority]}`} />
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${s.title}`}>{a.title}</p>
          <p className={`text-xs mt-0.5 normal-case ${s.muted}`}>Why: {a.why}</p>
        </div>
      </div>
      {a.type === 'follow_up_lead' && (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={`${s.input} resize-y`} aria-label="Message to send" />
      )}
      {a.type === 'track_phrases' && (
        <ul className={`text-xs list-disc pl-5 normal-case ${s.muted}`}>{(a.payload.phrases || []).map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      {a.status === 'failed' && a.error && <p className="text-xs text-rose-300 normal-case">Last try failed: {a.error}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void run(() => approveAction(a.id, a.type === 'follow_up_lead' ? text : undefined))} className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 ${s.primary}`}>
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}
          {a.actionLabel}
        </button>
        <button type="button" disabled={busy} onClick={() => void run(() => dismissAction(a.id))} className={`px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 ${s.ghost}`}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function ActionCenterTab({ onNavigate }: { onNavigate: (c: NavCategory, s?: SubCategory) => void }) {
  const s = usePlannerStyles();
  const signals = useAsync<GrowthSignal[]>(getSignals);
  const actions = useAsync<GrowthAction[]>(() => getActions());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await refreshActions();
      setNote(r.added ? `${r.added} new suggestion${r.added === 1 ? '' : 's'} added.` : 'Nothing new to suggest right now.');
      await Promise.all([actions.reload(), signals.reload()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <ErrorBar message={err || signals.error || actions.error} />
      <section className={`${s.card} p-4 space-y-2`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider ${s.muted}`}>What needs attention right now</h3>
        {signals.loading ? (
          <p className={`text-xs ${s.muted}`}>Looking…</p>
        ) : signals.data && signals.data.length > 0 ? (
          <ul className="divide-y divide-[rgba(169,191,165,0.12)]">
            {signals.data.map((sig) => (
              <li key={sig.id}>
                <button type="button" onClick={() => onNavigate(sig.link.category as NavCategory, sig.link.sub as SubCategory)} className="w-full flex items-center gap-2.5 py-2 text-left hover:opacity-80">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[sig.level]}`} />
                  <span className={`text-sm normal-case ${s.title}`}>{sig.text}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`text-xs normal-case ${s.muted}`}>Nothing needs you right now. New leads, replies and follow-ups will show here as they happen.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className={`text-xs font-bold uppercase tracking-wider ${s.muted}`}>Suggested actions (you approve each one)</h3>
          <button type="button" disabled={busy} onClick={() => void refresh()} className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 ${s.ghost}`}>
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}
            Look for suggestions
          </button>
        </div>
        {note && <p className={`text-xs normal-case ${s.muted}`}>{note}</p>}
        {actions.loading ? (
          <p className={`text-xs ${s.muted}`}>Loading…</p>
        ) : actions.data && actions.data.length > 0 ? (
          actions.data.map((a) => (
            <ActionCard key={a.id} a={a} onChanged={() => void Promise.all([actions.reload(), signals.reload()])} onError={setErr} />
          ))
        ) : (
          <p className={`${s.card} p-4 text-xs normal-case ${s.muted}`}>No suggestions waiting. Click "Look for suggestions", or turn on Autopilot to have them prepared for you on a schedule. Nothing is ever sent without your approval.</p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------ Performance ------------------------------ */

function PerformanceTab() {
  const s = usePlannerStyles();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Performance | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null);
    getPerformance(days).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [days]);
  return (
    <div className="space-y-4">
      <ErrorBar message={error} />
      <div className="flex items-center gap-2 text-xs">
        <span className={s.muted}>Period</span>
        {[7, 30, 90].map((d) => (
          <button key={d} type="button" onClick={() => setDays(d)} className={`px-2.5 py-1 rounded font-semibold ${days === d ? s.primary : s.ghost}`}>{d} days</button>
        ))}
      </div>
      {!data ? (
        <p className={`text-xs ${s.muted}`}>Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['Enquiries', data.total], ['Qualified', data.qualified], ['Booked', data.booked], ['Won', data.won]].map(([k, v]) => (
              <div key={String(k)} className={`${s.card} p-4`}>
                <p className={`text-[11px] uppercase font-bold tracking-wider ${s.muted}`}>{k}</p>
                <p className={`text-2xl font-bold tabular-nums ${s.title}`}>{v}</p>
              </div>
            ))}
          </div>
          {data.insights.map((i) => (
            <div key={i.id} className={`${s.card} p-4 space-y-1`}>
              <p className={`text-sm normal-case ${s.title}`}>{i.text}</p>
              {i.suggestion && <p className={`text-xs normal-case ${s.muted}`}>{i.suggestion}</p>}
            </div>
          ))}
          <div className={`${s.card} overflow-x-auto`}>
            <table className="w-full text-xs">
              <thead className={s.muted}>
                <tr className="text-left"><th className="p-3">Source</th><th>Enquiries</th><th>Qualified</th><th>Qualified %</th><th>Booked</th><th>Won</th></tr>
              </thead>
              <tbody className={s.title}>
                {data.rows.map((r) => (
                  <tr key={r.key} className={`border-t ${s.border}`}>
                    <td className="p-3 font-semibold">{r.label}</td><td>{r.enquiries}</td><td>{r.qualified}</td><td>{r.qualifiedRate}%</td><td>{r.booked}</td><td>{r.won}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && <tr><td colSpan={6} className={`p-4 normal-case ${s.muted}`}>No leads in this period.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className={`text-xs normal-case ${s.muted}`}>{data.note}</p>
        </>
      )}
    </div>
  );
}

/* ------------------------------ Competitors ------------------------------ */

function CompetitorsTab() {
  const s = usePlannerStyles();
  const { data, error, reload, setError } = useAsync(getCompetitors);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };
  const list: CompetitorWatch[] = data?.list || [];
  const changes: CompetitorChange[] = data?.changes || [];
  return (
    <div className="space-y-4">
      <ErrorBar message={error} />
      <p className={`text-xs normal-case max-w-2xl ${s.muted}`}>Add pages of competitors that are public, such as their pricing or offers page. We read each page, remember it, and tell you when something real changes. The first read only sets the starting point.</p>
      <div className={`${s.card} p-4 grid md:grid-cols-[2fr_1fr_auto] gap-2 items-end`}>
        <label className={`text-xs font-semibold ${s.muted}`}>Page address<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://competitor.com/pricing" className={s.input} /></label>
        <label className={`text-xs font-semibold ${s.muted}`}>Name<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Competitor" className={s.input} /></label>
        <button type="button" disabled={busy || !url} onClick={() => void act(async () => { await addCompetitor(url, label); setUrl(''); setLabel(''); })} className={`px-4 py-2 rounded text-xs font-semibold disabled:opacity-50 ${s.primary}`}>Watch this page</button>
      </div>
      {list.length > 0 && (
        <div className={`${s.card} divide-y ${s.border}`}>
          {list.map((c) => (
            <div key={c.id} className="p-3 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className={`font-semibold ${s.title}`}>{c.label}</p>
                <p className={`truncate ${s.muted}`}>{c.url}</p>
                <p className={`normal-case ${c.lastError ? 'text-amber-300' : s.muted}`}>{c.lastError ? `Could not read it: ${c.lastError}` : `Checked ${ago(c.lastCheckedAt)}`}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => void act(() => removeCompetitor(c.id))} className={`px-2.5 py-1 rounded font-semibold ${s.danger}`}>Remove</button>
            </div>
          ))}
        </div>
      )}
      {list.length > 0 && (
        <button type="button" disabled={busy} onClick={() => void act(async () => { const r = await scanCompetitors(); setNote(r.changes.length ? `${r.changes.length} page${r.changes.length === 1 ? '' : 's'} changed.` : 'No real changes since the last check.'); })} className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 ${s.ghost}`}>
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}Check now
        </button>
      )}
      {note && <p className={`text-xs normal-case ${s.muted}`}>{note}</p>}
      {changes.map((c) => (
        <div key={c.id} className={`${s.card} p-4 space-y-1.5`} onMouseEnter={() => { if (!c.seen) void markCompetitorChangeSeen(c.id); }}>
          <p className={`text-sm font-semibold ${s.title}`}>{c.label} <span className={`text-xs font-normal ${s.muted}`}>· {ago(c.detectedAt)}</span></p>
          <p className={`text-xs normal-case ${s.title}`}>{c.summary}</p>
          {c.priceChanges.added.length > 0 && <p className={`text-xs normal-case ${s.muted}`}>Prices now shown: {c.priceChanges.added.join(', ')}</p>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Appointments ------------------------------ */

function AppointmentsTab() {
  const s = usePlannerStyles();
  const { data, error, reload, setError } = useAsync<Appointments>(getAppointments);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };
  if (!data) return <div><ErrorBar message={error} /><p className={`text-xs ${s.muted}`}>Loading…</p></div>;
  const st = data.settings;
  const save = (patch: Partial<typeof st>) => void act(() => saveAppointmentSettings({ ...patch, utcOffsetMinutes: -new Date().getTimezoneOffset() }));
  const pending = data.requests.filter((r) => r.status === 'pending');
  const past = data.requests.filter((r) => r.status !== 'pending');
  return (
    <div className="space-y-5">
      <ErrorBar message={error} />
      <p className={`text-xs normal-case max-w-2xl ${s.muted}`}>When someone asks to book a call, the agent offers the free times below and opens a request. It never says a time is booked. You confirm one, and only then is the customer told.</p>
      <section className={`${s.card} p-4 space-y-3`}>
        <label className={`flex items-center gap-2 text-sm font-semibold ${s.title}`}>
          <input type="checkbox" checked={st.enabled} onChange={(e) => save({ enabled: e.target.checked })} /> Offer appointments
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DAY_NAMES.map((d, i) => (
            <button key={d} type="button" onClick={() => save({ days: st.days.includes(i) ? st.days.filter((x) => x !== i) : [...st.days, i] })} className={`px-2.5 py-1 rounded text-xs font-semibold ${st.days.includes(i) ? s.primary : s.ghost}`}>{d}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className={`text-xs font-semibold ${s.muted}`}>Opens<input type="time" defaultValue={st.start} onBlur={(e) => e.target.value !== st.start && save({ start: e.target.value })} className={s.input} /></label>
          <label className={`text-xs font-semibold ${s.muted}`}>Closes<input type="time" defaultValue={st.end} onBlur={(e) => e.target.value !== st.end && save({ end: e.target.value })} className={s.input} /></label>
          <label className={`text-xs font-semibold ${s.muted}`}>Length (minutes)<input type="number" min={10} step={5} defaultValue={st.slotMinutes} onBlur={(e) => Number(e.target.value) !== st.slotMinutes && save({ slotMinutes: Number(e.target.value) })} className={s.input} /></label>
          <label className={`text-xs font-semibold ${s.muted}`}>Minimum notice (hours)<input type="number" min={0} defaultValue={st.minNoticeHours} onBlur={(e) => Number(e.target.value) !== st.minNoticeHours && save({ minNoticeHours: Number(e.target.value) })} className={s.input} /></label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className={`text-xs font-bold uppercase tracking-wider ${s.muted}`}>Requests waiting for you</h3>
        {note && <p className={`text-xs normal-case ${s.muted}`}>{note}</p>}
        {pending.length === 0 && <p className={`${s.card} p-4 text-xs normal-case ${s.muted}`}>No requests yet. They appear when someone asks to book in a chat.</p>}
        {pending.map((r) => (
          <div key={r.id} className={`${s.card} p-4 space-y-2`}>
            <p className={`text-sm font-semibold ${s.title}`}>{r.name} <span className={`text-xs font-normal ${s.muted}`}>· {r.channel || 'chat'} · {ago(r.createdAt)}</span></p>
            <p className={`text-xs normal-case ${s.muted}`}>They said: "{r.preferredText}"</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={picked[r.id] || ''} onChange={(e) => setPicked((p) => ({ ...p, [r.id]: e.target.value }))} className={`${s.input} !mt-0 !w-auto`}>
                <option value="">Choose a free time</option>
                {data.slots.slice(0, 40).map((sl) => <option key={sl.iso} value={sl.iso}>{sl.label}</option>)}
              </select>
              <button type="button" disabled={!picked[r.id]} onClick={() => void act(async () => { const c = await confirmAppointment(r.id, picked[r.id]); setNote(`Confirmed for ${c.label}. ${c.delivered ? 'The customer was told.' : 'We could not message them automatically on this channel, so tell them yourself.'}`); })} className={`px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 ${s.primary}`}>Confirm</button>
              <button type="button" onClick={() => void act(() => declineAppointment(r.id))} className={`px-3 py-1.5 rounded text-xs font-semibold ${s.ghost}`}>Decline</button>
            </div>
          </div>
        ))}
        {past.length > 0 && (
          <div className={`${s.card} divide-y ${s.border}`}>
            {past.slice(0, 10).map((r) => (
              <p key={r.id} className={`p-3 text-xs normal-case ${s.muted}`}>{r.name}: {r.status}{r.confirmedSlot ? ` for ${data.slots.find((x) => x.iso === r.confirmedSlot)?.label || new Date(r.confirmedSlot).toLocaleString()}` : ''}</p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------ Autopilot ------------------------------ */

function AutopilotTab() {
  const s = usePlannerStyles();
  const { data, error, reload, setError } = useAsync<AutopilotSettings>(getAutopilot);
  const [goal, setGoal] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return <div><ErrorBar message={error} /><p className={`text-xs ${s.muted}`}>Loading…</p></div>;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <ErrorBar message={error} />
      <p className={`text-xs normal-case max-w-2xl ${s.muted}`}>Give the autopilot a goal. On a schedule it reads your leads, replies, competitors and search visibility, then prepares suggestions and a short brief. It only proposes. Nothing is sent, posted or changed until you approve it in the Action center.</p>
      <section className={`${s.card} p-4 space-y-3`}>
        <label className={`flex items-center gap-2 text-sm font-semibold ${s.title}`}>
          <input type="checkbox" checked={data.enabled} onChange={(e) => void act(() => saveAutopilot({ enabled: e.target.checked }))} /> Autopilot is {data.enabled ? 'on' : 'off'}
        </label>
        <div className="grid md:grid-cols-[2fr_1fr] gap-3">
          <label className={`text-xs font-semibold ${s.muted}`}>Goal<input value={goal ?? data.goal} onChange={(e) => setGoal(e.target.value)} placeholder="Get more qualified leads from social media" className={s.input} /></label>
          <label className={`text-xs font-semibold ${s.muted}`}>Qualified leads wanted per month<input type="number" min={0} value={target ?? String(data.targetQualified)} onChange={(e) => setTarget(e.target.value)} className={s.input} /></label>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" disabled={busy} onClick={() => void act(async () => { await saveAutopilot({ goal: goal ?? data.goal, targetQualified: Number(target ?? data.targetQualified) }); setGoal(null); setTarget(null); })} className={`px-3 py-1.5 rounded text-xs font-semibold ${s.primary}`}>Save goal</button>
          <button type="button" disabled={busy} onClick={() => void act(() => runAutopilot())} className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${s.ghost}`}>
            {busy && <Loader2 className="w-3 h-3 animate-spin" />}Run it now
          </button>
          <span className={`text-xs ${s.muted}`}>Last run: {ago(data.lastRunAt)} · runs every {data.cadenceHours} h while on</span>
        </div>
      </section>
      {data.brief && (
        <section className={`${s.card} p-4 space-y-2`}>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${s.muted}`}>Latest brief · {ago(data.brief.generatedAt)}</h3>
          {data.brief.goalProgress && <p className={`text-sm font-semibold ${s.title}`}>{data.brief.goalProgress.text}</p>}
          <ul className={`text-sm list-disc pl-5 space-y-1 normal-case ${s.title}`}>{data.brief.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          {data.brief.notes.length > 0 && <p className="text-xs text-amber-300 normal-case">{data.brief.notes.join(' ')}</p>}
        </section>
      )}
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function ActionCenterView({ sub, onNavigate }: { sub: SubCategory; onNavigate: (c: NavCategory, s?: SubCategory) => void }) {
  const s = usePlannerStyles();
  const tab = TABS.some((t) => t.id === sub) ? sub : 'overview';
  return (
    <div className="space-y-5 text-xs">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => onNavigate('actions', t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === t.id ? s.primary : s.ghost}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'overview' && <ActionCenterTab onNavigate={onNavigate} />}
      {tab === 'performance' && <PerformanceTab />}
      {tab === 'competitors' && <CompetitorsTab />}
      {tab === 'appointments' && <AppointmentsTab />}
      {tab === 'autopilot' && <AutopilotTab />}
    </div>
  );
}

/** A compact "what needs attention" list for the top of the Overview. */
export function SignalsStrip({ onNavigate }: { onNavigate: (c: NavCategory, s?: SubCategory) => void }) {
  const s = usePlannerStyles();
  const [signals, setSignals] = useState<GrowthSignal[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => getSignals().then((x) => alive && setSignals(x)).catch(() => alive && setSignals([]));
    void load();
    const t = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);
  if (!signals || signals.length === 0) return null;
  return (
    <section className={`${s.card} p-4 space-y-1.5`}>
      <h3 className={`text-xs font-bold uppercase tracking-wider ${s.muted}`}>What requires attention right now</h3>
      <ul>
        {signals.slice(0, 6).map((sig) => (
          <li key={sig.id}>
            <button type="button" onClick={() => onNavigate(sig.link.category as NavCategory, sig.link.sub as SubCategory)} className="w-full flex items-center gap-2.5 py-1.5 text-left hover:opacity-80">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[sig.level]}`} />
              <span className={`text-sm normal-case ${s.title}`}>{sig.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onNavigate('actions', 'overview')} className="text-xs font-semibold text-teal-500 hover:underline">Open the Action center →</button>
    </section>
  );
}
