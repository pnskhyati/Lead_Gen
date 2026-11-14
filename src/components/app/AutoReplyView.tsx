import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  approveAutoReply,
  dismissAutoReply,
  getAutoReplyStatus,
  listAutoReplyItems,
  runAutoReplyNow,
  saveAutoReplySettings,
  type AutoReplyChannel,
  type AutoReplyItem,
  type AutoReplyMode,
  type AutoReplyStatus,
} from '../../legacy/services/autoReplyService';
import { usePlannerStyles } from './planner/plannerUi';

const MODE_LABEL: Record<AutoReplyMode, string> = { off: 'Off', review: 'I approve first', auto: 'Automatic' };
const MODE_HINT: Record<AutoReplyMode, string> = {
  off: 'Nothing is read or sent.',
  review: 'We write each reply and wait for your OK before posting.',
  auto: 'Replies are posted for you, within the daily limit.',
};
const PLATFORM_BADGE: Record<string, string> = { instagram: 'bg-fuchsia-600 text-white', facebook: 'bg-blue-600 text-white', x: 'bg-slate-800 text-white' };
const PLATFORM_NAME: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', x: 'X' };

function ago(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function ChannelCard({ ch, onMode, busy }: React.Attributes & { ch: AutoReplyChannel; onMode: (m: AutoReplyMode) => void; busy: boolean }) {
  const s = usePlannerStyles();
  const run = ch.lastRun;
  return (
    <div className={`${s.card} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${PLATFORM_BADGE[ch.platform]}`}>{PLATFORM_NAME[ch.platform]}</span>
          <span className={`text-sm font-semibold ${s.title}`}>{ch.label}</span>
        </div>
        <span className={`text-[11px] font-semibold ${ch.connected ? 'text-emerald-500' : 'text-amber-500'}`}>{ch.connected ? 'Connected' : 'Not connected'}</span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${ch.label} mode`}>
        {ch.modes.map((m) => (
          <button
            key={m}
            type="button"
            disabled={busy}
            aria-pressed={ch.mode === m}
            onClick={() => onMode(m)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50 ${ch.mode === m ? s.selected : s.idle} ${s.title}`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <p className={`text-[11px] ${s.muted}`}>{MODE_HINT[ch.mode]}</p>

      {!ch.connected && ch.mode !== 'off' && <p className="text-[11px] text-amber-500">Connect this account in Connections for it to work.</p>}
      {ch.mode !== 'off' && ch.connected && (
        <p className={`text-[11px] ${run?.error ? 'text-rose-500' : s.muted}`}>
          {run
            ? run.error
              ? `Last check ${ago(run.at)} failed: ${run.error}`
              : `Last check ${ago(run.at)}: ${run.fetched} new, ${run.sent} replied${run.drafted && ch.mode === 'review' ? `, ${run.drafted} waiting for you` : ''}${run.needsHuman ? `, ${run.needsHuman} for a person` : ''}`
            : 'Waiting for the first check (every 2 minutes).'}
        </p>
      )}
      {ch.mode !== 'off' && ch.since && <p className={`text-[10px] ${s.muted}`}>Only answers messages that arrive after {new Date(ch.since).toLocaleString()}.</p>}
    </div>
  );
}

function QueueCard({ item, onDone, onError }: React.Attributes & { item: AutoReplyItem; onDone: () => void; onError: (m: string | null) => void }) {
  const s = usePlannerStyles();
  const [text, setText] = useState(item.draft || item.finalText);
  const [busy, setBusy] = useState(false);
  const act = (fn: () => Promise<unknown>) => {
    setBusy(true);
    onError(null);
    fn()
      .then(onDone)
      .catch((e) => {
        onError(e instanceof Error ? e.message : 'Could not complete that');
        onDone();
      })
      .finally(() => setBusy(false));
  };
  return (
    <li className={`${s.card} p-3 space-y-2`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`font-bold px-2 py-0.5 rounded ${PLATFORM_BADGE[item.platform]}`}>{PLATFORM_NAME[item.platform]}</span>
        <span className={`font-semibold ${s.title}`}>{item.author || 'Someone'}</span>
        <span className={s.muted}>{ago(item.receivedAt)}</span>
        {item.permalink && (
          <a href={item.permalink} target="_blank" rel="noreferrer" className="underline text-teal-500">
            View post
          </a>
        )}
      </div>
      <p className={`text-sm ${s.title}`}>"{item.text}"</p>
      {item.reason && <p className={`text-[11px] ${s.muted}`}>{item.reason}</p>}
      {item.status === 'failed' && <p className="text-[11px] text-rose-500">It could not be sent: {item.error}</p>}
      <label className={`block text-[11px] font-semibold ${s.muted}`}>
        Reply
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={s.input} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || text.trim().length < 2} onClick={() => act(() => approveAutoReply(item.id, text))} className={`text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-50 ${s.primary}`}>
          {busy ? 'Sending…' : item.status === 'failed' ? 'Try again' : 'Send reply'}
        </button>
        <button type="button" disabled={busy} onClick={() => act(() => dismissAutoReply(item.id))} className={`text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 ${s.ghost}`}>
          Don't reply
        </button>
      </div>
    </li>
  );
}

export default function AutoReplyView() {
  const s = usePlannerStyles();
  const [status, setStatus] = useState<AutoReplyStatus | null>(null);
  const [items, setItems] = useState<AutoReplyItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cap, setCap] = useState('');

  const load = useCallback(async () => {
    try {
      const [st, list] = await Promise.all([getAutoReplyStatus(), listAutoReplyItems()]);
      setStatus(st);
      setItems(list);
      setCap((c) => c || String(st.dailyCap));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load auto-reply');
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  const setMode = async (id: string, mode: AutoReplyMode) => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await saveAutoReplySettings({ channels: { [id]: { mode } } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const saveCap = async () => {
    setBusy(true);
    try {
      setStatus(await saveAutoReplySettings({ dailyCap: Number(cap) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const checkNow = async () => {
    setChecking(true);
    setError(null);
    try {
      const r = await runAutoReplyNow();
      setStatus(r.status);
      setItems(await listAutoReplyItems());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check failed');
    } finally {
      setChecking(false);
    }
  };

  const waiting = items.filter((i) => i.status === 'pending_review' || i.status === 'failed');
  const people = items.filter((i) => i.status === 'needs_human');
  const recent = items.filter((i) => ['sent', 'skipped'].includes(i.status)).slice(0, 15);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className={`text-sm max-w-2xl ${s.muted}`}>
          We check your connected accounts every 2 minutes and reply to new comments and messages for you. Spam is ignored, and anything sensitive is left for a person. Nothing old is ever answered.
        </p>
        <button type="button" disabled={checking} onClick={() => void checkNow()} className={`text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 ${s.secondary}`}>
          {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Check now
        </button>
      </div>

      {error && <p className={`text-xs rounded-lg px-3 py-2 ${s.isLight ? 'bg-rose-50 text-rose-800' : 'bg-rose-500/10 text-rose-200'}`}>{error}</p>}
      {!status && !error && <p className={`text-xs ${s.muted}`}>Loading…</p>}

      {status && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {status.channels.map((ch) => (
              <ChannelCard key={ch.id} ch={ch} busy={busy} onMode={(m) => void setMode(ch.id, m)} />
            ))}
          </div>

          <div className={`${s.card} p-3 flex flex-wrap items-end gap-3`}>
            <label className={`text-xs font-semibold ${s.muted}`}>
              Most automatic replies per day
              <input type="number" min={1} max={500} value={cap} onChange={(e) => setCap(e.target.value)} className={`${s.input} max-w-[120px]`} />
            </label>
            <button type="button" disabled={busy} onClick={() => void saveCap()} className={`text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-50 ${s.ghost}`}>
              Save
            </button>
            <p className={`text-[11px] ${s.muted}`}>Sent in the last 24 hours: {status.sentToday} of {status.dailyCap}. Replies past the limit wait for your OK.</p>
          </div>

          <section className="space-y-2">
            <h3 className={`text-sm font-bold ${s.title}`}>Waiting for your OK {waiting.length ? `(${waiting.length})` : ''}</h3>
            {waiting.length === 0 ? (
              <p className={`text-xs ${s.muted}`}>Nothing waiting. New replies for channels set to "I approve first" will appear here.</p>
            ) : (
              <ul className="space-y-2">
                {waiting.map((i) => (
                  <QueueCard key={i.id} item={i} onDone={() => void load()} onError={setError} />
                ))}
              </ul>
            )}
          </section>

          {people.length > 0 && (
            <section className="space-y-2">
              <h3 className={`text-sm font-bold ${s.title}`}>Needs a person ({people.length})</h3>
              <p className={`text-[11px] ${s.muted}`}>Complaints and sensitive messages are never answered automatically. They are also in Leads.</p>
              <ul className="space-y-2">
                {people.slice(0, 10).map((i) => (
                  <li key={i.id} className={`${s.card} p-3 text-xs`}>
                    <span className={`font-semibold ${s.title}`}>{i.author || 'Someone'}</span> on {PLATFORM_NAME[i.platform]} · {ago(i.receivedAt)}
                    <p className={`mt-1 ${s.title}`}>"{i.text}"</p>
                    <p className={s.muted}>{i.reason}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <h3 className={`text-sm font-bold ${s.title}`}>Recent activity</h3>
            {recent.length === 0 ? (
              <p className={`text-xs ${s.muted}`}>Nothing yet. Replies and skipped messages show here.</p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((i) => (
                  <li key={i.id} className={`${s.card} px-3 py-2 text-xs`}>
                    <span className={`font-semibold ${s.title}`}>{i.status === 'sent' ? (i.auto ? 'Replied automatically' : 'Replied') : 'Not answered'}</span>
                    <span className={s.muted}>
                      {' '}
                      · {PLATFORM_NAME[i.platform]} {i.kind === 'dm' ? 'message' : 'comment'} from {i.author || 'someone'} · {ago(i.sentAt || i.receivedAt)}
                    </span>
                    <p className={s.muted}>"{i.text.slice(0, 120)}"</p>
                    {i.status === 'sent' && i.finalText && <p className={s.title}>Reply: {i.finalText}</p>}
                    {i.status === 'skipped' && i.reason && <p className={s.muted}>{i.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${s.card} p-4 space-y-2`}>
            <h3 className={`text-sm font-bold ${s.title}`}>Not automatic, and why</h3>
            <ul className={`text-xs space-y-1.5 ${s.muted}`}>
              {status.unsupported.map((u) => (
                <li key={u.id}>
                  <span className={`font-semibold ${s.title}`}>{u.label}:</span> {u.reason}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
