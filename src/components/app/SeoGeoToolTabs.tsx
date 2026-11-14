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
  rollbackSeoGeoFix,
  runSeoGeoCitationTests,
  startSeoGeoCrawl,
  syncSeoGeoRankings,
  type SeoGeoCrawlJob,
  type SeoGeoFix,
  type SeoGeoGeoPrompt,
  type SeoGeoKeyword,
  type SeoGeoSuggestion,
  type SeoGeoRankSnapshot,
  type SeoGeoPage,
  type SeoGeoCitationRun,
  suggestSeoGeo,
} from '../../legacy/services/seoGeoService';

import { PageDraftCard, SavedPages, WritePageButton } from './SeoGeoPages';

type TabId ='rank' | 'citations' | 'advanced';

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
      <div className="flex flex-wrap items-end gap-2">
        <label className={`text-[11px] ${muted}`}>
          Most pages to check
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
          {busy ? 'Starting…' : 'Scan whole site'}
        </button>
        <button type="button" onClick={() => void refresh()} className={btnSecondary(isLight)}>
          Refresh
        </button>
      </div>
      {active && (
        <div className={`text-xs rounded-lg border px-3 py-2 space-y-1 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'}`}>
          <p>
            Scan {active.status === 'completed' ? 'finished' : active.status === 'running' || active.status === 'queued' ? 'in progress' : active.status}
          </p>
          <p>
            {active.urlsCrawled ?? 0} of {active.urlsDiscovered ?? '?'} pages checked
          </p>
          {active.error && <p className="text-rose-600">{active.error}</p>}
          {active.completedAt && <p className={muted}>Completed {new Date(active.completedAt).toLocaleString()}</p>}
        </div>
      )}
      {jobs.length > 1 && (
        <ul className={`text-[11px] space-y-1 ${muted}`}>
          {jobs.slice(1, 4).map((j) => (
            <li key={j.id}>
              Earlier scan · {new Date(j.startedAt).toLocaleString()} · {j.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const INTENT_LABEL: Record<SeoGeoSuggestion['intent'], string> = {
  buy: 'Ready to buy',
  compare: 'Comparing options',
  learn: 'Researching',
};

/** AI-suggested phrases or questions, each added with one click. */
function Suggestions({
  kind,
  isLight,
  onError,
  onAdd,
}: {
  kind: 'keywords' | 'questions';
  isLight: boolean;
  onError: (msg: string | null) => void;
  onAdd: (text: string) => Promise<void>;
}) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const [items, setItems] = useState<SeoGeoSuggestion[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const ask = async () => {
    setBusy(true);
    onError(null);
    try {
      setItems(await suggestSeoGeo(kind));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not get suggestions');
    } finally {
      setBusy(false);
    }
  };

  const add = async (text: string) => {
    setAdding(text);
    try {
      await onAdd(text);
      setItems((cur) => (cur ? cur.filter((s) => s.text !== text) : cur));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add');
    } finally {
      setAdding(null);
    }
  };

  const addAll = async () => {
    if (!items?.length) return;
    setAdding('*');
    let failed = 0;
    for (const s of items) {
      try {
        await onAdd(s.text);
        setItems((cur) => (cur ? cur.filter((x) => x.text !== s.text) : cur));
      } catch {
        failed += 1;
      }
    }
    if (failed) onError(`${failed} could not be added. Try them again.`);
    setAdding(null);
  };

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${isLight ? 'border-teal-200 bg-teal-50/60' : 'border-teal-500/30 bg-teal-500/5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-xs ${isLight ? 'text-slate-700' : 'text-[#E8E9D8]'}`}>
          {kind === 'keywords'
            ? 'Not sure what to track? We suggest searches that bring in people ready to buy from you.'
            : 'Not sure what to ask? We suggest questions your future customers would ask an AI.'}
        </p>
        <button type="button" disabled={busy} onClick={() => void ask()} className={btnPrimary(isLight)}>
          {busy ? 'Thinking…' : items ? 'Suggest more' : 'Suggest for my business'}
        </button>
      </div>
      {items && items.length === 0 && <p className={`text-xs ${muted}`}>Nothing new to suggest right now.</p>}
      {items && items.length > 1 && (
        <button type="button" disabled={adding !== null} onClick={() => void addAll()} className={btnPrimary(isLight)}>
          {adding === '*' ? 'Adding…' : `Track all ${items.length}`}
        </button>
      )}
      {items && items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s.text} className="flex items-start justify-between gap-3 text-xs">
              <span className="min-w-0">
                <span className="font-semibold">{s.text}</span>
                <span className={`block text-[11px] ${muted}`}>
                  {INTENT_LABEL[s.intent]} · {s.why}
                </span>
              </span>
              <button type="button" disabled={adding !== null} onClick={() => void add(s.text)} className={`shrink-0 ${btnSecondary(isLight)}`}>
                {adding === s.text ? 'Adding…' : 'Track this'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={`text-[10px] ${muted}`}>These are ideas based on what your business sells, not search volumes. Tracking them shows where you stand.</p>
    </div>
  );
}

function RankTab({ isLight, onError }: Omit<Props, 'tab'>) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const [keywords, setKeywords] = useState<SeoGeoKeyword[]>([]);
  const [rows, setRows] = useState<{ keyword: SeoGeoKeyword; latest: SeoGeoRankSnapshot | null }[]>([]);
  const [serp, setSerp] = useState(false);
  const [draft, setDraft] = useState<SeoGeoPage | null>(null);
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
      {draft && <PageDraftCard page={draft} isLight={isLight} onClose={() => setDraft(null)} />}
      <Suggestions
        kind="keywords"
        isLight={isLight}
        onError={onError}
        onAdd={async (text) => {
          await addSeoGeoKeyword({ keyword: text });
          await load();
        }}
      />
      <div className="flex flex-wrap gap-2">
        <input
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          placeholder="A search your customers would type, e.g. AI marketing tools"
          className={inputClass(isLight)}
        />
        <button type="button" disabled={busy} onClick={() => void onAdd()} className={btnPrimary(isLight)}>
          Add
        </button>
        <button type="button" disabled={busy} onClick={() => void onSync()} className={btnSecondary(isLight)}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Update positions'}
        </button>
      </div>
      {(() => {
        const checked = rows.filter((r) => r.latest);
        const found = checked.filter((r) => r.latest!.currentPosition != null);
        if (!checked.length) return null;
        if (!found.length) return <p className={`text-sm font-semibold`}>0 of {checked.length} tracked searches have shown up on Google yet</p>;
        const top10 = found.filter((r) => Number(r.latest!.currentPosition) <= 10).length;
        return (
          <p className="text-sm font-semibold">
            {top10} of {checked.length} tracked searches on page 1 of Google
            <span className={`block text-[11px] font-normal ${muted}`}>{found.length} show up at all. Page 1 means position 10 or better.</span>
          </p>
        );
      })()}
      <p className={`text-[10px] ${muted}`}>
        Positions come from Google Search Console (connect Google on the "What to fix" tab). They are averages, so treat them as a guide.
        {serp ? '' : ' Live position checks are not switched on.'}
      </p>
      {rows.length === 0 ? (
        <p className={`text-xs ${muted}`}>Nothing tracked yet. Add a search above.</p>
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
              <span className={`text-right ${latest?.error ? 'text-rose-500' : muted}`}>
                {latest ? (
                  latest.currentPosition != null ? (
                    <>
                      Google position about {Math.round(latest.currentPosition)}
                      {latest.change ? ` (${latest.change > 0 ? 'up' : 'down'} ${Math.abs(Math.round(latest.change))})` : ''}
                      <span className="block text-[10px]">
                        {latest.impressions ?? 0} views · {latest.clicks ?? 0} clicks in the last 28 days
                      </span>
                    </>
                  ) : (
                    latest.note || 'Not found yet'
                  )
                ) : (
                  'Click "Update positions"'
                )}
              </span>
              <span className="flex items-center gap-3">
                <WritePageButton topic={keyword.keyword} kind="keyword" isLight={isLight} onError={onError} onDone={setDraft} />
                <button
                  type="button"
                  className={`text-[10px] underline ${muted}`}
                  onClick={() => void deleteSeoGeoKeyword(keyword.id).then(load)}
                >
                  Remove
                </button>
              </span>
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
  const [draft, setDraft] = useState<SeoGeoPage | null>(null);

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
      {draft && <PageDraftCard page={draft} isLight={isLight} onClose={() => setDraft(null)} />}
      {vertexStatus && !vertexStatus.configured && (
        <p className={`text-[11px] rounded-lg border px-3 py-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'}`}>
          The AI checker is not set up on this server yet{vertexStatus.authHint ? ` (${vertexStatus.authHint})` : ''}.
        </p>
      )}
      <Suggestions
        kind="questions"
        isLight={isLight}
        onError={onError}
        onAdd={async (text) => {
          await addSeoGeoCitationPrompt(text);
          await load();
        }}
      />
      {dash && dash.totalRuns > 0 ? (
        <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
          The AI named your business in {dash.promptsMentioned} of {dash.totalRuns} answers
          <span className={`block text-[11px] font-normal ${muted}`}>
            {dash.promptsCitingSite} of them used your website as a source. Latest answer for each question, from Gemini with Google Search.
          </span>
        </p>
      ) : (
        <p className={`text-xs ${muted}`}>No checks run yet. Add a question below, then click "Check now".</p>
      )}
      <p className={`text-[10px] ${muted}`}>Each result is one live answer. Other AI tools and other days can give different answers.</p>
      {dash && dash.topSources.length > 0 && (
        <div className={`text-xs rounded-lg border px-3 py-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'}`}>
          <p className="font-semibold">Websites the AI relied on for your questions</p>
          <p className={`text-[11px] ${muted}`}>To be named, be on these. Get listed or mentioned there, with the same facts as your own site.</p>
          <p className="mt-1">{dash.topSources.map((s) => `${s.site} (${s.questions})`).join(' · ')}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A question a customer might ask, e.g. best AI marketing tool for small business"
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
          Add question
        </button>
        <button type="button" disabled={busy} onClick={() => void onRun()} className={btnPrimary(isLight)}>
          {busy ? 'Checking…' : 'Check now'}
        </button>
      </div>
      <ul className={`text-xs space-y-2 ${muted}`}>
        {prompts.map((p) => {
          const run: SeoGeoCitationRun | undefined = dash?.prompts.find((d) => d.prompt.id === p.id)?.recentRuns[0];
          const named = run && !run.error && (run.brandMentioned || run.domainCited);
          return (
            <li key={p.id} className={`rounded-lg border px-3 py-2 space-y-1 ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.15)]'}`}>
              <div className="flex justify-between gap-2">
                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{p.prompt}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <WritePageButton topic={p.prompt} kind="question" isLight={isLight} onError={onError} onDone={setDraft} />
                  <button type="button" className="underline" onClick={() => void deleteSeoGeoCitationPrompt(p.id).then(load)}>
                    Remove
                  </button>
                </span>
              </div>
              {!run && <p>Not checked yet.</p>}
              {run?.error && <p className="text-rose-500">Check failed: {run.error}</p>}
              {run && !run.error && (
                <>
                  <p className={named ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>
                    {run.domainCited ? 'Named, and your website was a source' : run.brandMentioned ? 'Named in the answer' : 'Your business was not mentioned'}
                  </p>
                  {run.answerExcerpt && <p className="line-clamp-3">{run.answerExcerpt}</p>}
                  {!!run.sources?.length && (
                    <p className="text-[10px]">Sources used: {[...new Set(run.sources.map((s) => s.site).filter(Boolean))].slice(0, 6).join(', ')}</p>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FixesTab({ isLight, onError }: Omit<Props, 'tab'>) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const [fixes, setFixes] = useState<SeoGeoFix[]>([]);
  const [wp, setWp] = useState(false);
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

  return (
    <div className="space-y-3">
      <p className={`text-xs ${muted}`}>
        Nothing changes on your website until you approve it.{' '}
        {wp ? '' : 'Your website is not linked for automatic changes yet, so approved fixes are only recorded here.'}
      </p>
      <ul className="space-y-2">
        {fixes.map((f) => (
          <li
            key={f.id}
            className={`text-xs rounded-lg border px-3 py-2 space-y-2 ${
              isLight ? 'border-slate-200 bg-slate-50' : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'
            }`}
          >
            <p className="font-semibold">Proposed new {f.draft.field}</p>
            <p className={muted}>Status: {f.status}</p>
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
                Approve
              </button>
              <button
                type="button"
                onClick={() => void rollbackSeoGeoFix(f.recommendationId).then(load).catch((e) => onError(e.message))}
                className={btnSecondary(isLight)}
              >
                Undo
              </button>
            </div>
          </li>
        ))}
      </ul>
      {fixes.length === 0 && <p className={`text-xs ${muted}`}>No drafts yet. On the "What to fix" tab, click "Draft a fix" on any item.</p>}
    </div>
  );
}

export type SeoGeoPlatformTab = 'audit' | TabId;

export function SeoGeoToolTabPanel({ tab, isLight, onError }: Props) {
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  switch (tab) {
    case 'rank':
      return <RankTab isLight={isLight} onError={onError} />;
    case 'citations':
      return <CitationsTab isLight={isLight} onError={onError} />;
    case 'advanced':
      return (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-bold">Pages written for you</h3>
            <SavedPages isLight={isLight} onError={onError} />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-bold">Scan the whole website</h3>
            <p className={`text-xs ${muted}`}>The to-do list checks your main pages. A full scan visits every page it can find, so it takes longer.</p>
            <CrawlTab isLight={isLight} onError={onError} />
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-bold">Drafted fixes</h3>
            <FixesTab isLight={isLight} onError={onError} />
          </section>
        </div>
      );
    default:
      return null;
  }
}

/** What each tab is for, shown above it so nobody has to guess. */
export const TAB_HELP: Record<SeoGeoPlatformTab, string> = {
  audit: 'We check your website and list what to fix so more people find you. The most important ones come first.',
  rank: 'Add the words your customers search for, and see where your website shows up on Google for them.',
  citations: 'People now ask ChatGPT, Gemini and similar tools for recommendations. Add a question a customer might ask, and we check whether the AI mentions your business.',
  advanced: 'Pages we wrote for you, a deeper website scan, and fixes for your website.',
};

export const PLATFORM_TABS: { id: SeoGeoPlatformTab; label: string }[] = [
  { id: 'audit', label: 'What to fix' },
  { id: 'rank', label: 'Google ranking' },
  { id: 'citations', label: 'AI answers' },
  { id: 'advanced', label: 'More tools' },
];
