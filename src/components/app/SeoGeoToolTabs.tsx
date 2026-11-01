import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  addSeoGeoCitationPrompt,
  addSeoGeoKeyword,
  approveSeoGeoFix,
  deleteSeoGeoCitationPrompt,
  deleteSeoGeoKeyword,
  getSeoGeoCitationDashboard,
  getSeoGeoCitationPrompts,
  getSeoGeoVertexStatus,
  getSeoGeoCrawlJob,
  getSeoGeoRankDashboard,
  getSeoGeoKeywords,
  listSeoGeoCrawlJobs,
  listSeoGeoFixes,
  proposeSeoGeoFix,
  rollbackSeoGeoFix,
  runSeoGeoCitationTests,
  startSeoGeoCrawl,
  syncSeoGeoRankings,
  type SeoGeoCrawlJob,
  type SeoGeoFix,
  type SeoGeoGeoPrompt,
  type SeoGeoKeyword,
} from '../../legacy/services/seoGeoService';

type TabId = 'crawl' | 'rank' | 'citations' | 'fixes';

interface Props {
  tab: TabId;
  isLight: boolean;
  onError: (msg: string | null) => void;
}

function inputClass(isLight: boolean) {
  return `text-xs rounded-lg border px-2 py-1.5 w-full max-w-md ${
    isLight ? 'border-slate-200 bg-white' : 'border-[rgba(169,191,165,0.2)] bg-[#061816] text-[#E8E9D8]'
  }`;
}

function btnPrimary(isLight: boolean) {
  return `text-[11px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 ${
    isLight ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-teal-500/30 text-teal-100'
  }`;
}

function btnSecondary(isLight: boolean) {
  return `text-[11px] font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50 ${
    isLight ? 'border-slate-200 text-slate-700' : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]'
  }`;
}

function CrawlTab({ isLight, onError }: Omit<Props, 'tab'>) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const [jobs, setJobs] = useState<SeoGeoCrawlJob[]>([]);
  const [active, setActive] = useState<SeoGeoCrawlJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [maxUrls, setMaxUrls] = useState('500');

  const refresh = useCallback(async () => {
    try {
      const list = await listSeoGeoCrawlJobs();
      setJobs(list);
      const running = list.find((j) => j.status === 'running' || j.status === 'queued');
      if (running?.id) {
        const full = await getSeoGeoCrawlJob(running.id);
        setActive(full);
      } else if (list[0]?.id) {
        const full = await getSeoGeoCrawlJob(list[0].id);
        setActive(full);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Crawl load failed');
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      if (active?.status === 'running' || active?.status === 'queued') void refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [refresh, active?.status]);

  const onStart = async () => {
    setBusy(true);
    onError(null);
    try {
      const job = await startSeoGeoCrawl(Number(maxUrls) || undefined);
      setActive(job);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not start crawl');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className={`text-xs ${muted}`}>
        Full-site crawl respects robots.txt, SSRF guards, and URL budgets. Re-audit uses the latest completed crawl.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className={`text-[11px] ${muted}`}>
          Max URLs
          <input
            type="number"
            min={10}
            max={2000}
            value={maxUrls}
            onChange={(e) => setMaxUrls(e.target.value)}
            className={`block mt-1 ${inputClass(isLight)} max-w-[120px]`}
          />
        </label>
        <button type="button" disabled={busy} onClick={() => void onStart()} className={btnPrimary(isLight)}>
          {busy ? 'Starting…' : 'Start full crawl'}
        </button>
        <button type="button" onClick={() => void refresh()} className={btnSecondary(isLight)}>
          Refresh
        </button>
      </div>
      {active && (
        <div className={`text-xs rounded-lg border px-3 py-2 space-y-1 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'}`}>
          <p>
            Job <span className="font-mono">{active.id.slice(0, 16)}…</span> · {active.status}
          </p>
          <p>
            {active.urlsCrawled ?? 0} / {active.urlsDiscovered ?? '?'} URLs · budget {active.maxUrls}
          </p>
          {active.error && <p className="text-rose-600">{active.error}</p>}
          {active.completedAt && <p className={muted}>Completed {new Date(active.completedAt).toLocaleString()}</p>}
        </div>
      )}
      {jobs.length > 0 && (
        <ul className={`text-[11px] space-y-1 ${muted}`}>
          {jobs.slice(0, 8).map((j) => (
            <li key={j.id}>
              {j.status} · {j.id.slice(0, 12)}… · {new Date(j.startedAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RankTab({ isLight, onError }: Omit<Props, 'tab'>) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const [keywords, setKeywords] = useState<SeoGeoKeyword[]>([]);
  const [rows, setRows] = useState<{ keyword: SeoGeoKeyword; latest: { position: number | null; source: string; note?: string } | null }[]>([]);
  const [serp, setSerp] = useState(false);
  const [newKw, setNewKw] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [kws, dash] = await Promise.all([getSeoGeoKeywords(), getSeoGeoRankDashboard()]);
      setKeywords(kws);
      setRows(dash.rows);
      setSerp(dash.serpApiConfigured);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Rank load failed');
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const onAdd = async () => {
    if (!newKw.trim()) return;
    setBusy(true);
    onError(null);
    try {
      await addSeoGeoKeyword({ keyword: newKw.trim() });
      setNewKw('');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Add keyword failed');
    } finally {
      setBusy(false);
    }
  };

  const onSync = async () => {
    setBusy(true);
    onError(null);
    try {
      await syncSeoGeoRankings();
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Sync failed — connect Google for GSC averages');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className={`text-xs ${muted}`}>
        GSC positions are query averages (not guaranteed rank). Optional SerpAPI adds sampled SERP checks when{' '}
        <code className="text-[10px]">SERPAPI_KEY</code> is set on the server.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          placeholder="Target keyword"
          className={inputClass(isLight)}
        />
        <button type="button" disabled={busy} onClick={() => void onAdd()} className={btnPrimary(isLight)}>
          Add keyword
        </button>
        <button type="button" disabled={busy} onClick={() => void onSync()} className={btnSecondary(isLight)}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Sync rankings'}
        </button>
      </div>
      <p className={`text-[10px] ${muted}`}>SerpAPI: {serp ? 'configured' : 'not configured'}</p>
      {rows.length === 0 ? (
        <p className={`text-xs ${muted}`}>No keywords yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ keyword, latest }) => (
            <li
              key={keyword.id}
              className={`text-xs rounded-lg border px-3 py-2 flex flex-wrap justify-between gap-2 ${
                isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'
              }`}
            >
              <span className="font-semibold">{keyword.keyword}</span>
              <span className={muted}>
                {latest
                  ? `Pos ${latest.position ?? '—'} (${latest.source})${latest.note ? ` · ${latest.note}` : ''}`
                  : 'No snapshot — sync'}
              </span>
              <button
                type="button"
                className={`text-[10px] underline ${muted}`}
                onClick={() => void deleteSeoGeoKeyword(keyword.id).then(load)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CitationsTab({ isLight, onError }: Omit<Props, 'tab'>) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const [prompts, setPrompts] = useState<SeoGeoGeoPrompt[]>([]);
  const [dash, setDash] = useState<Awaited<ReturnType<typeof getSeoGeoCitationDashboard>> | null>(null);
  const [vertexStatus, setVertexStatus] = useState<Awaited<ReturnType<typeof getSeoGeoVertexStatus>> | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, d, vs] = await Promise.all([
        getSeoGeoCitationPrompts(),
        getSeoGeoCitationDashboard(),
        getSeoGeoVertexStatus(),
      ]);
      setPrompts(p);
      setDash(d);
      setVertexStatus(vs);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Citation load failed');
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRun = async () => {
    setBusy(true);
    onError(null);
    try {
      await runSeoGeoCitationTests();
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Citation run failed (Vertex required)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {vertexStatus && (
        <p className={`text-[11px] rounded-lg border px-3 py-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'}`}>
          Vertex: {vertexStatus.configured ? `${vertexStatus.mode} · ${vertexStatus.project} · ${vertexStatus.textModel}` : 'not configured'}
          {vertexStatus.authHint ? ` — ${vertexStatus.authHint}` : ''}
        </p>
      )}
      <p className={`text-xs ${muted}`}>
        {dash?.disclaimer ||
          'Sampled AI visibility checks — citation rate is illustrative, not a ranking or traffic guarantee.'}
      </p>
      {dash && (
        <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          Citation rate: {dash.citationRate}% · {dash.promptsCitingSite}/{dash.totalRuns} runs cited your site
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="GEO prompt to test (e.g. best plumber in …)"
          className={inputClass(isLight)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void (async () => {
              if (!text.trim()) return;
              await addSeoGeoCitationPrompt(text.trim());
              setText('');
              await load();
            })()
          }
          className={btnSecondary(isLight)}
        >
          Add prompt
        </button>
        <button type="button" disabled={busy} onClick={() => void onRun()} className={btnPrimary(isLight)}>
          Run citation tests
        </button>
      </div>
      <ul className={`text-xs space-y-2 ${muted}`}>
        {prompts.map((p) => (
          <li key={p.id} className="flex justify-between gap-2">
            <span>{p.prompt}</span>
            <button type="button" className="underline shrink-0" onClick={() => void deleteSeoGeoCitationPrompt(p.id).then(load)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FixesTab({ isLight, onError }: Omit<Props, 'tab'>) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const [fixes, setFixes] = useState<SeoGeoFix[]>([]);
  const [wp, setWp] = useState(false);
  const [recId, setRecId] = useState('');
  const [pageId, setPageId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listSeoGeoFixes();
      setFixes(data.fixes);
      setWp(data.wordpress);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Fixes load failed');
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const onPropose = async () => {
    if (!recId.trim()) return;
    setBusy(true);
    onError(null);
    try {
      await proposeSeoGeoFix({ recommendationId: recId.trim(), issueType: 'generic' });
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Propose failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className={`text-xs ${muted}`}>
        Approve-then-apply only. WordPress REST applies title/excerpt when{' '}
        <code className="text-[10px]">WORDPRESS_*</code> env vars are set ({wp ? 'configured' : 'not configured'}).
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className={`text-[11px] ${muted}`}>
          Recommendation ID
          <input value={recId} onChange={(e) => setRecId(e.target.value)} className={`block mt-1 ${inputClass(isLight)}`} />
        </label>
        <button type="button" disabled={busy} onClick={() => void onPropose()} className={btnSecondary(isLight)}>
          Propose fix draft
        </button>
      </div>
      <ul className="space-y-2">
        {fixes.map((f) => (
          <li
            key={f.id}
            className={`text-xs rounded-lg border px-3 py-2 space-y-2 ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'
            }`}
          >
            <p className="font-semibold">{f.recommendationId}</p>
            <p className={muted}>
              {f.draft.field}: {f.status}
            </p>
            <pre className={`text-[10px] whitespace-pre-wrap max-h-24 overflow-auto ${muted}`}>{f.draft.after}</pre>
            <div className="flex flex-wrap gap-2">
              {wp && (
                <input
                  placeholder="WP page ID"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  className={`max-w-[100px] ${inputClass(isLight)}`}
                />
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void approveSeoGeoFix(f.recommendationId, {
                    approved: true,
                    pageId: pageId ? Number(pageId) : undefined,
                  })
                    .then(load)
                    .catch((e) => onError(e.message))
                }
                className={btnPrimary(isLight)}
              >
                Approve & apply
              </button>
              <button
                type="button"
                onClick={() => void rollbackSeoGeoFix(f.recommendationId).then(load).catch((e) => onError(e.message))}
                className={btnSecondary(isLight)}
              >
                Rollback record
              </button>
            </div>
          </li>
        ))}
      </ul>
      {fixes.length === 0 && <p className={`text-xs ${muted}`}>No fix drafts — propose from a recommendation ID from the Audit tab.</p>}
    </div>
  );
}

export type SeoGeoPlatformTab = 'audit' | TabId;

export function SeoGeoToolTabPanel({ tab, isLight, onError }: Props) {
  switch (tab) {
    case 'crawl':
      return <CrawlTab isLight={isLight} onError={onError} />;
    case 'rank':
      return <RankTab isLight={isLight} onError={onError} />;
    case 'citations':
      return <CitationsTab isLight={isLight} onError={onError} />;
    case 'fixes':
      return <FixesTab isLight={isLight} onError={onError} />;
    default:
      return null;
  }
}

export const PLATFORM_TABS: { id: SeoGeoPlatformTab; label: string }[] = [
  { id: 'audit', label: 'Audit' },
  { id: 'crawl', label: 'Crawl health' },
  { id: 'rank', label: 'Rank tracking' },
  { id: 'citations', label: 'AI visibility' },
  { id: 'fixes', label: 'Auto-fix' },
];
