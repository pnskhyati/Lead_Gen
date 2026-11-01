import React, { useMemo, useState } from 'react';
import Card from './common/Card';
import Spinner from './common/Spinner';
import {
  analyzeCompetitors,
  chatLeadGrowth,
  generateCompetitorContent,
  rewriteWithCompetitors,
  type CompetitorIntel,
  type ContentPack,
  type LeadGrowthMessage,
  type LeadGrowthReply,
  type RewrittenPost,
} from '../services/agentsService';

type Tab = 'competitor' | 'leadGrowth';

const AgentsHub: React.FC = () => {
  const [tab, setTab] = useState<Tab>('competitor');

  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [competitorsText, setCompetitorsText] = useState('');
  const [socialProfilesText, setSocialProfilesText] = useState('');
  const [samplePosts, setSamplePosts] = useState('');
  const [draft, setDraft] = useState('');
  const [platform, setPlatform] = useState('LinkedIn');
  const [intel, setIntel] = useState<CompetitorIntel | null>(null);
  const [pack, setPack] = useState<ContentPack | null>(null);
  const [rewritten, setRewritten] = useState<RewrittenPost | null>(null);
  const [compBusy, setCompBusy] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);

  const [sessionId] = useState(() => `growth-${Date.now()}`);
  const [visitorName, setVisitorName] = useState('');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<LeadGrowthMessage[]>([]);
  const [lastMeta, setLastMeta] = useState<LeadGrowthReply | null>(null);
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  const baseInput = () => ({
    industry,
    region,
    competitorsText,
    socialProfilesText,
    samplePosts,
    competitorIntel: intel || undefined,
  });

  const fullPost = useMemo(() => {
    if (!rewritten) return '';
    const tags = (rewritten.hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    return [rewritten.headline, rewritten.body, rewritten.cta, tags].filter(Boolean).join('\n\n');
  }, [rewritten]);

  const runAnalyze = async () => {
    setCompBusy(true);
    setCompError(null);
    try {
      const data = await analyzeCompetitors(baseInput());
      setIntel(data);
      setPack(null);
    } catch (err) {
      setCompError(err instanceof Error ? err.message : 'Analyze failed');
    } finally {
      setCompBusy(false);
    }
  };

  const runGenerate = async () => {
    setCompBusy(true);
    setCompError(null);
    try {
      const data = await generateCompetitorContent({
        ...baseInput(),
        platforms: ['Instagram', 'LinkedIn', 'Facebook', 'X'],
      });
      setPack(data);
      if (data.competitorIntel?.summary) {
        setIntel((prev) => prev || (data.competitorIntel as CompetitorIntel));
      }
    } catch (err) {
      setCompError(err instanceof Error ? err.message : 'Generate failed');
    } finally {
      setCompBusy(false);
    }
  };

  const runRewrite = async () => {
    if (!draft.trim()) {
      setCompError('Paste a draft post first');
      return;
    }
    setCompBusy(true);
    setCompError(null);
    try {
      const data = await rewriteWithCompetitors({
        ...baseInput(),
        draft,
        platform,
        goal: 'Match patterns audiences like on competitor socials, stay on-brand',
      });
      setRewritten(data);
    } catch (err) {
      setCompError(err instanceof Error ? err.message : 'Rewrite failed');
    } finally {
      setCompBusy(false);
    }
  };

  const sendLeadChat = async () => {
    const text = input.trim();
    if (!text) return;
    setLeadBusy(true);
    setLeadError(null);
    setInput('');
    const nextHistory = [...history, { role: 'user' as const, text }];
    setHistory(nextHistory);
    try {
      const data = await chatLeadGrowth({
        message: text,
        history,
        visitorName: visitorName || 'Prospect',
        channel: 'web',
        persist: true,
        sessionId,
      });
      setHistory([...nextHistory, { role: 'model', text: data.reply }]);
      setLastMeta(data);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setLeadBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-soft-azure">Agents</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink mt-1">Dual-agent workspace</h1>
        <p className="text-sm text-ink-muted mt-1 max-w-3xl">
          Competitor agent studies rivals&apos; Instagram / LinkedIn / X / Facebook style content and what audiences engage with — then generates your branding posts. Lead agent maximizes client conversations into leads.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['competitor', 'Competitor social → content'],
            ['leadGrowth', 'Lead growth chat'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-xs font-semibold rounded-full transition-all ${
              tab === id
                ? 'bg-gradient-to-r from-soft-deep to-soft-azure text-white shadow-aqua'
                : 'bg-soft-bg text-ink-muted hover:bg-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'competitor' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-bold text-ink">Social competitive research</h2>
            <p className="text-sm text-ink-muted mt-1 mb-4">
              Not just a name list — we look for public post themes on IG / LinkedIn / X / FB and patterns people engage with. Paste handles + sample posts for best accuracy.
            </p>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-ink-muted">
                Industry
                <input
                  className="mt-1 w-full rounded-xl border border-soft-sky/50 bg-white px-3 py-2 text-sm text-ink"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g. Dental clinic"
                />
              </label>
              <label className="block text-xs font-semibold text-ink-muted">
                Region
                <input
                  className="mt-1 w-full rounded-xl border border-soft-sky/50 bg-white px-3 py-2 text-sm text-ink"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Pune / Baner"
                />
              </label>
              <label className="block text-xs font-semibold text-ink-muted">
                Competitor names
                <textarea
                  className="mt-1 w-full rounded-xl border border-soft-sky/50 bg-white px-3 py-2 text-sm text-ink min-h-[64px]"
                  value={competitorsText}
                  onChange={(e) => setCompetitorsText(e.target.value)}
                  placeholder="Clove Dental, Local Baner clinic…"
                />
              </label>
              <label className="block text-xs font-semibold text-ink-muted">
                Social profiles (one competitor per line)
                <textarea
                  className="mt-1 w-full rounded-xl border border-soft-sky/50 bg-white px-3 py-2 text-sm text-ink min-h-[88px] font-mono text-[11px]"
                  value={socialProfilesText}
                  onChange={(e) => setSocialProfilesText(e.target.value)}
                  placeholder={'Clove Dental | ig:@clovedental | li:linkedin.com/company/clove-dental | x:@clovedental'}
                />
              </label>
              <label className="block text-xs font-semibold text-ink-muted">
                Paste competitor posts that get likes/comments (best signal)
                <textarea
                  className="mt-1 w-full rounded-xl border border-soft-sky/50 bg-white px-3 py-2 text-sm text-ink min-h-[140px]"
                  value={samplePosts}
                  onChange={(e) => setSamplePosts(e.target.value)}
                  placeholder={`Example:\n[Instagram @rival] Before/after whitening reel — 2.4k likes\nCaption: ...\n\n[LinkedIn Rival Clinic] Patient story post — high comments\n...`}
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={compBusy}
                  onClick={runAnalyze}
                  className="nexora-btn-primary px-4 py-2.5 text-xs disabled:opacity-50"
                >
                  {compBusy ? 'Researching…' : 'Analyze social posts'}
                </button>
                <button
                  type="button"
                  disabled={compBusy}
                  onClick={runGenerate}
                  className="px-4 py-2.5 text-xs font-semibold rounded-full bg-soft-mint text-soft-deep disabled:opacity-50"
                >
                  {compBusy ? 'Generating…' : 'Generate content from patterns'}
                </button>
              </div>

              <label className="block text-xs font-semibold text-ink-muted pt-2">
                Optional: rewrite your draft using those patterns
                <textarea
                  className="mt-1 w-full rounded-xl border border-soft-sky/50 bg-white px-3 py-2 text-sm text-ink min-h-[100px]"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Paste your draft…"
                />
              </label>
              <div className="flex flex-wrap gap-2 items-end">
                <label className="block text-xs font-semibold text-ink-muted">
                  Platform
                  <select
                    className="mt-1 rounded-xl border border-soft-sky/50 bg-white px-3 py-2 text-sm text-ink"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                  >
                    {['LinkedIn', 'Instagram', 'Facebook', 'X'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={compBusy}
                  onClick={runRewrite}
                  className="nexora-btn-primary px-4 py-2.5 text-xs disabled:opacity-50"
                >
                  Rewrite draft
                </button>
              </div>
              {compBusy && (
                <p className="text-xs text-ink-muted flex items-center gap-2">
                  <Spinner /> Searching public social signals + structuring insights…
                </p>
              )}
              {compError && <p className="text-sm text-soft-coral font-medium">{compError}</p>}
            </div>
          </Card>

          <div className="space-y-4">
            {intel && (
              <Card>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-ink">What audiences engage with</h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    {intel.usedSearch ? 'web-researched' : 'samples/model'} · {intel.dataConfidence || 'n/a'} conf.
                  </span>
                </div>
                <p className="text-sm text-ink-muted mt-1">{intel.summary}</p>

                {!!intel.winningPatterns?.length && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Winning patterns</p>
                    {intel.winningPatterns.map((w) => (
                      <div key={w.pattern} className="rounded-xl bg-soft-bg/80 px-3 py-2">
                        <p className="text-sm font-bold text-ink">{w.pattern}</p>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {(w.platforms || []).join(', ')} — {w.whyAudienceLikesIt}
                        </p>
                        <p className="text-[11px] text-soft-deep mt-1">Adapt: {w.howWeAdapt}</p>
                      </div>
                    ))}
                  </div>
                )}

                <ul className="mt-4 space-y-3">
                  {(intel.competitors || []).map((c) => (
                    <li key={c.name} className="rounded-2xl bg-soft-bg/70 px-3 py-2">
                      <p className="text-sm font-bold text-ink">{c.name}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{c.whyTheyCompete}</p>
                      {!!c.highEngagementPatterns?.length && (
                        <p className="text-[11px] text-soft-deep mt-1">
                          Engaged content: {c.highEngagementPatterns.slice(0, 4).join(' · ')}
                        </p>
                      )}
                      {!!c.postsPeopleLike?.length && (
                        <ul className="mt-2 space-y-1">
                          {c.postsPeopleLike.slice(0, 3).map((p, idx) => (
                            <li key={`${c.name}-${idx}`} className="text-[11px] text-ink">
                              <span className="font-semibold">{p.platform}:</span> {p.summary}{' '}
                              <span className="text-ink-muted">({p.whyItWorks})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>

                {!!intel.brandingRecommendations?.length && (
                  <p className="text-xs text-ink mt-3">
                    <span className="font-semibold">Branding:</span> {intel.brandingRecommendations.join(' · ')}
                  </p>
                )}
                {!!intel.contentPillars?.length && (
                  <p className="text-xs text-ink mt-1">
                    <span className="font-semibold">Pillars:</span> {intel.contentPillars.join(' · ')}
                  </p>
                )}
              </Card>
            )}

            {pack && (
              <Card>
                <h3 className="font-bold text-ink">Generated from competitor engagement</h3>
                <p className="text-sm text-soft-deep mt-1 font-medium">{pack.brandingAngle}</p>
                <div className="mt-3 space-y-3">
                  {(pack.heroPosts || []).map((h, i) => (
                    <div key={`${h.platform}-${i}`} className="rounded-xl border border-soft-sky/40 bg-white px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-soft-azure">{h.platform}</p>
                      <p className="text-sm font-semibold text-ink mt-1">{h.headline}</p>
                      <p className="text-xs text-ink-muted mt-1 whitespace-pre-wrap">{h.body}</p>
                      <p className="text-xs text-soft-deep mt-1">{h.cta}</p>
                      <p className="text-[11px] text-ink-muted mt-1">Why it should work: {h.whyItShouldPerform}</p>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-soft-azure mt-1"
                        onClick={() =>
                          navigator.clipboard.writeText(
                            [h.headline, h.body, h.cta, (h.hashtags || []).join(' ')].filter(Boolean).join('\n\n')
                          )
                        }
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
                {!!pack.weeklyPlan?.length && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">7-day plan</p>
                    <ul className="space-y-2">
                      {pack.weeklyPlan.map((d) => (
                        <li key={`${d.day}-${d.platform}`} className="text-xs text-ink rounded-lg bg-soft-bg/70 px-2 py-1.5">
                          <span className="font-bold">{d.day}</span> · {d.platform} — {d.hook}
                          <span className="text-ink-muted"> (from: {d.inspiredByPattern})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            {rewritten && (
              <Card>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-ink">Rewritten draft</h3>
                  <button
                    type="button"
                    className="text-xs font-semibold text-soft-azure"
                    onClick={() => navigator.clipboard.writeText(fullPost)}
                  >
                    Copy
                  </button>
                </div>
                {rewritten.inspiredByPattern && (
                  <p className="text-[11px] text-soft-azure mt-1">Pattern: {rewritten.inspiredByPattern}</p>
                )}
                <p className="text-sm font-semibold text-ink mt-2">{rewritten.headline}</p>
                <p className="text-sm text-ink-muted mt-2 whitespace-pre-wrap">{rewritten.body}</p>
                <p className="text-sm text-soft-deep mt-2 font-medium">{rewritten.cta}</p>
              </Card>
            )}

            {!intel && !pack && !rewritten && (
              <Card>
                <p className="text-sm text-ink-muted">
                  Add competitor social handles and paste a few of their high-engagement posts, then run analysis. Content generation uses those patterns for your brand.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'leadGrowth' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 flex flex-col min-h-[420px]">
            <h2 className="text-lg font-bold text-ink">Lead Growth Agent</h2>
            <p className="text-sm text-ink-muted mt-1 mb-3">
              Chat like a prospect. Qualifies, CTAs, and saves leads to the inbox.
            </p>
            <label className="block text-xs font-semibold text-ink-muted mb-3 max-w-xs">
              Prospect name
              <input
                className="mt-1 w-full rounded-xl border border-soft-sky/50 bg-white px-3 py-2 text-sm text-ink"
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                placeholder="Optional"
              />
            </label>
            <div className="flex-1 overflow-y-auto space-y-3 rounded-2xl bg-soft-bg/50 p-3 mb-3">
              {history.length === 0 && (
                <p className="text-sm text-ink-muted">Try: “How much for a cleaning next week in Baner?”</p>
              )}
              {history.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'ml-auto bg-soft-deep text-white'
                      : 'bg-white text-ink border border-soft-sky/40'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {leadBusy && (
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <Spinner /> Thinking…
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-full border border-soft-sky/50 bg-white px-4 py-2.5 text-sm text-ink"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendLeadChat();
                  }
                }}
                placeholder="Type as the client…"
                disabled={leadBusy}
              />
              <button
                type="button"
                disabled={leadBusy || !input.trim()}
                onClick={() => void sendLeadChat()}
                className="nexora-btn-primary px-5 py-2.5 text-xs disabled:opacity-50"
              >
                Send
              </button>
            </div>
            {leadError && <p className="text-sm text-soft-coral font-medium mt-2">{leadError}</p>}
          </Card>
          <Card>
            <h3 className="font-bold text-ink">Lead signal</h3>
            {!lastMeta ? (
              <p className="text-sm text-ink-muted mt-2">Scores appear after the first reply.</p>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  <span className="text-ink-muted">Temperature:</span>{' '}
                  <span className="font-bold capitalize text-ink">{lastMeta.leadTemperature}</span>
                </p>
                <p>
                  <span className="text-ink-muted">Score:</span>{' '}
                  <span className="font-bold text-ink">{lastMeta.leadScore}</span>
                </p>
                <p>
                  <span className="text-ink-muted">Capture lead:</span>{' '}
                  <span className="font-bold text-ink">{lastMeta.captureLead ? 'Yes' : 'Not yet'}</span>
                </p>
                <p className="text-xs text-ink-muted">{lastMeta.intentSummary}</p>
                <p className="text-xs text-soft-deep font-medium">Next: {lastMeta.nextBestAction}</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default AgentsHub;
