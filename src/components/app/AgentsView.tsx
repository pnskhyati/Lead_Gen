import React, { useMemo, useState } from 'react';
import { Bot, Sparkles, MessageSquare, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
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
} from '../../legacy/services/agentsService';

type Tab = 'competitor' | 'leadGrowth';

function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return (
    <div
      className={`rounded-lg border p-4 sm:p-5 ${
        isLight
          ? 'bg-white border-slate-200 shadow-2xs text-slate-900'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)] text-[#E8E9D8]'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <label
      className={`block text-xs font-semibold ${
        theme === 'light' ? 'text-slate-600' : 'text-[#A9BFA5]'
      }`}
    >
      {children}
    </label>
  );
}

function fieldClass(isLight: boolean) {
  return `mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
    isLight
      ? 'bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/30'
      : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:outline-none focus:border-teal-500/50'
  }`;
}

interface AgentsViewProps {
  initialTab?: Tab;
}

export default function AgentsView({ initialTab = 'competitor' }: AgentsViewProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [tab, setTab] = useState<Tab>(initialTab);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

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
      setIntel(await analyzeCompetitors(baseInput()));
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
      setRewritten(await rewriteWithCompetitors({ ...baseInput(), draft, platform }));
    } catch (err) {
      setCompError(err instanceof Error ? err.message : 'Rewrite failed');
    } finally {
      setCompBusy(false);
    }
  };

  const sendLeadChat = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setHistory((h) => [...h, { role: 'user', text: userMsg }]);
    setLeadBusy(true);
    setLeadError(null);
    try {
      const data = await chatLeadGrowth({
        sessionId,
        message: userMsg,
        visitorName: visitorName || undefined,
        history,
      });
      setHistory((h) => [...h, { role: 'model', text: data.reply }]);
      setLastMeta(data);
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setLeadBusy(false);
    }
  };

  const btnPrimary = isLight
    ? 'bg-slate-900 hover:bg-slate-800 text-white'
    : 'bg-[#E8E9D8] hover:bg-white text-[#071C1A]';
  const btnSecondary = isLight
    ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
    : 'bg-[#0D2D2A] text-teal-200 border border-teal-500/30 hover:bg-[#133F3B]';

  return (
    <div className={`space-y-6 pb-10 animate-fadeIn ${isLight ? 'text-slate-900' : 'text-[#E8E9D8]'}`}>
      <div className={`border-b pb-4 ${isLight ? 'border-slate-200' : 'border-[rgba(169,191,165,0.18)]'}`}>
        <div className="flex items-center gap-2 mb-1">
          <Bot className={`w-4 h-4 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
          <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-teal-700' : 'text-teal-400'}`}>
            Agents
          </p>
        </div>
        <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
          Dual-agent workspace
        </h1>
        <p className={`text-xs mt-1 max-w-3xl ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
          Competitor social intelligence turns rival engagement patterns into on-brand posts. Lead growth chat qualifies
          prospects into your inbox.
        </p>
      </div>

      <div className={`inline-flex p-0.5 rounded-lg border text-xs font-medium ${
        isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#041210] border-[rgba(169,191,165,0.16)]'
      }`}>
        {(
          [
            ['competitor', 'Competitor social → content', Sparkles],
            ['leadGrowth', 'Lead growth chat', MessageSquare],
          ] as [Tab, string, typeof Sparkles][]
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              tab === id
                ? isLight
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-[#A9BFA5] hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'competitor' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel>
            <h2 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Social competitive research</h2>
            <p className={`text-xs mt-1 mb-4 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
              Analyze public IG / LinkedIn / X / FB engagement patterns, then generate your content pack.
            </p>
            <div className="space-y-3">
              <FieldLabel>
                Industry
                <input className={fieldClass(isLight)} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Dental clinic" />
              </FieldLabel>
              <FieldLabel>
                Region
                <input className={fieldClass(isLight)} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Pune / Baner" />
              </FieldLabel>
              <FieldLabel>
                Competitor names
                <textarea className={`${fieldClass(isLight)} min-h-[64px]`} value={competitorsText} onChange={(e) => setCompetitorsText(e.target.value)} placeholder="Clove Dental, Local Baner clinic…" />
              </FieldLabel>
              <FieldLabel>
                Social profiles (one per line)
                <textarea className={`${fieldClass(isLight)} min-h-[88px] font-mono text-[11px]`} value={socialProfilesText} onChange={(e) => setSocialProfilesText(e.target.value)} placeholder={'Clove Dental | ig:@clovedental | li:linkedin.com/company/clove-dental'} />
              </FieldLabel>
              <FieldLabel>
                Paste high-engagement competitor posts
                <textarea className={`${fieldClass(isLight)} min-h-[140px]`} value={samplePosts} onChange={(e) => setSamplePosts(e.target.value)} placeholder="[Instagram @rival] Before/after reel — 2.4k likes…" />
              </FieldLabel>
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" disabled={compBusy} onClick={() => void runAnalyze()} className={`px-4 py-2.5 text-xs font-semibold rounded-lg disabled:opacity-50 ${btnPrimary}`}>
                  {compBusy ? 'Researching…' : 'Analyze social posts'}
                </button>
                <button type="button" disabled={compBusy} onClick={() => void runGenerate()} className={`px-4 py-2.5 text-xs font-semibold rounded-lg disabled:opacity-50 ${btnSecondary}`}>
                  {compBusy ? 'Generating…' : 'Generate content from patterns'}
                </button>
              </div>
              <FieldLabel>
                Optional: rewrite your draft
                <textarea className={`${fieldClass(isLight)} min-h-[100px]`} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Paste your draft…" />
              </FieldLabel>
              <div className="flex flex-wrap gap-2 items-end">
                <FieldLabel>
                  Platform
                  <select className={fieldClass(isLight)} value={platform} onChange={(e) => setPlatform(e.target.value)}>
                    {['LinkedIn', 'Instagram', 'Facebook', 'X'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </FieldLabel>
                <button type="button" disabled={compBusy} onClick={() => void runRewrite()} className={`px-4 py-2.5 text-xs font-semibold rounded-lg disabled:opacity-50 ${btnPrimary}`}>
                  Rewrite draft
                </button>
              </div>
              {compBusy && (
                <p className={`text-xs flex items-center gap-2 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching public social signals…
                </p>
              )}
              {compError && <p className="text-sm text-rose-400 font-medium">{compError}</p>}
            </div>
          </Panel>

          <div className="space-y-4">
            {intel && (
              <Panel>
                <div className="flex items-start justify-between gap-2">
                  <h3 className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>What audiences engage with</h3>
                  <span className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                    {intel.usedSearch ? 'web-researched' : 'samples'} · {intel.dataConfidence || 'n/a'}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>{intel.summary}</p>
                {!!intel.winningPatterns?.length && (
                  <div className="mt-3 space-y-2">
                    {intel.winningPatterns.map((w) => (
                      <div key={w.pattern} className={`rounded-lg px-3 py-2 ${isLight ? 'bg-slate-50' : 'bg-[#061816]'}`}>
                        <p className="text-sm font-bold">{w.pattern}</p>
                        <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                          {(w.platforms || []).join(', ')} — {w.whyAudienceLikesIt}
                        </p>
                        <p className={`text-[11px] mt-1 ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>Adapt: {w.howWeAdapt}</p>
                      </div>
                    ))}
                  </div>
                )}
                <ul className="mt-4 space-y-2">
                  {(intel.competitors || []).map((c) => (
                    <li key={c.name} className={`rounded-lg px-3 py-2 ${isLight ? 'bg-slate-50' : 'bg-[#061816]'}`}>
                      <p className="text-sm font-bold">{c.name}</p>
                      <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>{c.whyTheyCompete}</p>
                      {!!c.postsPeopleLike?.length && (
                        <ul className="mt-2 space-y-1">
                          {c.postsPeopleLike.slice(0, 3).map((p, idx) => (
                            <li key={`${c.name}-${idx}`} className="text-[11px]">
                              <span className="font-semibold">{p.platform}:</span> {p.summary}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {pack && (
              <Panel>
                <h3 className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Generated content</h3>
                <p className={`text-sm mt-1 font-medium ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>{pack.brandingAngle}</p>
                <div className="mt-3 space-y-3">
                  {(pack.heroPosts || []).map((h, i) => (
                    <div key={`${h.platform}-${i}`} className={`rounded-lg border px-3 py-2 ${isLight ? 'border-slate-200 bg-white' : 'border-[rgba(169,191,165,0.2)] bg-[#061816]'}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${isLight ? 'text-teal-700' : 'text-teal-400'}`}>{h.platform}</p>
                      <p className="text-sm font-semibold mt-1">{h.headline}</p>
                      <p className={`text-xs mt-1 whitespace-pre-wrap ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>{h.body}</p>
                      <p className={`text-xs mt-1 ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>{h.cta}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {rewritten && (
              <Panel>
                <div className="flex items-center justify-between">
                  <h3 className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Rewritten draft</h3>
                  <button type="button" className={`text-xs font-semibold ${isLight ? 'text-teal-700' : 'text-teal-400'}`} onClick={() => navigator.clipboard.writeText(fullPost)}>
                    Copy
                  </button>
                </div>
                <p className="text-sm font-semibold mt-2">{rewritten.headline}</p>
                <p className={`text-sm mt-2 whitespace-pre-wrap ${isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}`}>{rewritten.body}</p>
              </Panel>
            )}

            {!intel && !pack && !rewritten && (
              <Panel>
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                  Paste competitor handles and high-engagement posts, then run analysis to generate on-brand content.
                </p>
              </Panel>
            )}
          </div>
        </div>
      )}

      {tab === 'leadGrowth' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Panel className="lg:col-span-2 flex flex-col min-h-[420px]">
            <h2 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Lead Growth Agent</h2>
            <p className={`text-xs mt-1 mb-3 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
              Chat like a prospect. Qualifies, CTAs, and saves leads to the inbox.
            </p>
            <FieldLabel>
              Prospect name
              <input className={`${fieldClass(isLight)} max-w-xs`} value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="Optional" />
            </FieldLabel>
            <div className={`flex-1 overflow-y-auto space-y-3 rounded-lg p-3 my-3 ${isLight ? 'bg-slate-50' : 'bg-[#061816]'}`}>
              {history.length === 0 && (
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>Try: “How much for a cleaning next week in Baner?”</p>
              )}
              {history.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? isLight
                        ? 'ml-auto bg-slate-900 text-white'
                        : 'ml-auto bg-[#E8E9D8] text-[#071C1A]'
                      : isLight
                        ? 'bg-white border border-slate-200 text-slate-800'
                        : 'bg-[#0D2D2A] border border-[rgba(169,191,165,0.2)]'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {leadBusy && (
                <p className={`text-xs flex items-center gap-2 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                className={`flex-1 rounded-full ${fieldClass(isLight)} mt-0`}
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
              <button type="button" disabled={leadBusy || !input.trim()} onClick={() => void sendLeadChat()} className={`px-5 py-2.5 text-xs font-semibold rounded-full disabled:opacity-50 ${btnPrimary}`}>
                Send
              </button>
            </div>
            {leadError && <p className="text-sm text-rose-400 font-medium mt-2">{leadError}</p>}
          </Panel>
          <Panel>
            <h3 className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Lead signal</h3>
            {!lastMeta ? (
              <p className={`text-sm mt-2 ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>Scores appear after the first reply.</p>
            ) : (
              <div className="mt-3 space-y-2 text-sm">
                <p>Temperature: <span className="font-bold capitalize">{lastMeta.leadTemperature}</span></p>
                <p>Score: <span className="font-bold">{lastMeta.leadScore}</span></p>
                <p>Capture lead: <span className="font-bold">{lastMeta.captureLead ? 'Yes' : 'Not yet'}</span></p>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-[#A9BFA5]'}`}>{lastMeta.intentSummary}</p>
                <p className={`text-xs font-medium ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>Next: {lastMeta.nextBestAction}</p>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
