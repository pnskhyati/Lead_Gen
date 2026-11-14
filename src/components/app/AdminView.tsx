import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Circle, Loader2, MessageCircleQuestion, Plus, Search, Shield, Trash2, UploadCloud, RefreshCw, Undo2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  answerUnansweredQuestion,
  deleteCompanyDocument,
  dismissUnansweredQuestion,
  getKnowledgeConflicts,
  getUnansweredQuestions,
  refreshWebsite,
  resolveKnowledgeConflict,
  setCompanyDocumentStatus,
  type KnowledgeConflict,
  type UnansweredQuestion,
  deriveCompanyVoice,
  getAgentAudit,
  getCompanyProfile,
  getCompanyStatus,
  getKnowledgeHealth,
  listCompanyDocuments,
  saveCompanyProfile,
  searchKnowledge,
  uploadCompanyDocument,
  uploadCompanyFiles,
  type CompanyDocumentMeta,
  type CompanyProfile,
  type CompanyStatus,
  type KnowledgeHealth,
  type KnowledgeSearchResult,
} from '../../legacy/services/companyService';

interface AdminViewProps {
  isAdmin?: boolean;
}

const VOICE_PRESETS = [
  {
    label: 'Premium & warm',
    voiceTone: 'Warm, premium, and inviting — confident without being pushy.',
    writingStyle: 'Short paragraphs, sensory language, clear calls to explore — never hypey.',
  },
  {
    label: 'Crisp & technical',
    voiceTone: 'Clear, precise, and expert. Friendly but never fluffy.',
    writingStyle: 'Short sentences. Lead with the benefit. Prefer concrete nouns over adjectives.',
  },
  {
    label: 'Playful & bold',
    voiceTone: 'Energetic, witty, and memorable — still respectful of the brand.',
    writingStyle: 'Punchy hooks, light humor, strong verbs. Avoid corporate jargon.',
  },
  {
    label: 'Professional B2B',
    voiceTone: 'Authoritative, helpful, and trustworthy for business decision-makers.',
    writingStyle: 'Structured points, outcome-focused language, minimal slang.',
  },
];

const emptyProfile: CompanyProfile = {
  companyName: '',
  industry: '',
  tagline: '',
  botName: '',
  instagramAutoReply: true,
  whatsappAutoReply: true,
  emailAutoReply: true,
  voiceTone: '',
  writingStyle: '',
  vocabulary: [],
  avoid: [],
  audience: '',
  productsFocus: '',
  extraGuidelines: '',
  websiteUrl: '',
  businessPhone: '',
  businessAddress: '',
  googleBusinessProfileUrl: '',
};

export default function AdminView({ isAdmin = false }: AdminViewProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [status, setStatus] = useState<CompanyStatus | null>(null);
  const [profile, setProfile] = useState<CompanyProfile>(emptyProfile);
  const [docs, setDocs] = useState<CompanyDocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [vocabStr, setVocabStr] = useState('');
  const [avoidStr, setAvoidStr] = useState('');
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof getAgentAudit>>>([]);
  const [health, setHealth] = useState<KnowledgeHealth | null>(null);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<KnowledgeSearchResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [gaps, setGaps] = useState<UnansweredQuestion[]>([]);
  const [conflicts, setConflicts] = useState<KnowledgeConflict[]>([]);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [versionNotice, setVersionNotice] = useState<{ newId: string; newTitle: string; oldId: string; oldTitle: string } | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const inputClass = isLight
    ? 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/25 disabled:opacity-60'
    : 'mt-1 w-full rounded-lg border border-[rgba(169,191,165,0.25)] bg-[#061816] px-3 py-2 text-sm text-[#E8E9D8] focus:outline-none focus:border-teal-500/40 disabled:opacity-60';
  const btnPrimary = isLight
    ? 'bg-teal-600 hover:bg-teal-700 text-white'
    : 'bg-[#E8E9D8] hover:bg-white text-[#071C1A]';
  const btnSecondary = isLight
    ? 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
    : 'bg-[#0D2D2A] hover:bg-[#133F3B] text-teal-200 border border-teal-500/30';
  const btnGhost = isLight
    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
    : 'bg-[#0D2D2A]/80 hover:bg-[#133F3B] text-[#A9BFA5] border border-[rgba(169,191,165,0.2)]';
  const card = isLight
    ? 'rounded-lg border border-slate-200 bg-white shadow-2xs'
    : 'rounded-lg border border-[rgba(169,191,165,0.18)] bg-[#071C1A]';
  const muted = isLight ? 'text-slate-500' : 'text-[#A9BFA5]';
  const title = isLight ? 'text-slate-900' : 'text-white';

  const refresh = useCallback(async () => {
    const [s, p, d, a, h, g, c] = await Promise.all([
      getCompanyStatus(),
      getCompanyProfile(),
      listCompanyDocuments(),
      getAgentAudit(25).catch(() => []),
      getKnowledgeHealth().catch(() => null),
      getUnansweredQuestions().catch(() => null),
      getKnowledgeConflicts().catch(() => []),
    ]);
    setGaps(g?.open ?? []);
    setConflicts(c);
    setHealth(h);
    setStatus(s);
    setProfile({ ...emptyProfile, ...p });
    setVocabStr((p.vocabulary || []).join(', '));
    setAvoidStr((p.avoid || []).join(', '));
    setDocs(d);
    setAudit(a);
  }, []);

  useEffect(() => {
    void refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const flash = (msg: string) => {
    setMessage(msg);
    setError(null);
    setTimeout(() => setMessage(null), 4000);
  };

  const onUploadFiles = async (files: FileList | null) => {
    if (!files?.length || !isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      const results = await uploadCompanyFiles(Array.from(files));
      const ok = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      const versioned = ok.find((r) => r.document?.similarTo?.length);
      if (versioned?.document?.similarTo?.length) {
        const old = versioned.document.similarTo[0];
        setVersionNotice({ newId: versioned.document.id, newTitle: versioned.fileName, oldId: old.id, oldTitle: old.title });
      }
      await refresh();
      if (failed.length) {
        setError(`${failed.map((f) => `${f.fileName}: ${f.error}`).join(' · ')}${ok.length ? ` (${ok.length} uploaded)` : ''}`);
      } else {
        flash(`Uploaded ${ok.length} document${ok.length === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onPasteUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !pasteText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await uploadCompanyDocument({
        title: pasteTitle.trim() || 'Pasted company notes',
        fileName: 'paste.txt',
        mimeType: 'text/plain',
        text: pasteText,
      });
      setPasteText('');
      setPasteTitle('');
      await refresh();
      flash('Document saved into company knowledge.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onTestQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;
    setTesting(true);
    setError(null);
    try {
      setTestResult(await searchKnowledge(testQuery.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setTesting(false);
    }
  };

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) =>
    setProfile((p) => ({
      ...p,
      faqs: (p.faqs || []).map((f, i) => (i === index ? { ...f, [field]: value } : f)),
    }));

  const onAnswerGap = async (gap: UnansweredQuestion) => {
    if (!answerText.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await answerUnansweredQuestion(gap.id, { answer: answerText.trim() });
      setAnswering(null);
      setAnswerText('');
      await refresh();
      flash(r.nowCovered ? 'Saved as an FAQ — your assistant can now answer this.' : 'Saved as an FAQ. It may take a moment to be matched.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the answer');
    } finally {
      setBusy(false);
    }
  };

  const onDismissGap = async (id: string) => {
    setBusy(true);
    try {
      await dismissUnansweredQuestion(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not dismiss');
    } finally {
      setBusy(false);
    }
  };

  const onResolveConflict = async (id: string, keep: 'a' | 'b' | 'both') => {
    setBusy(true);
    setError(null);
    try {
      await resolveKnowledgeConflict(id, keep);
      await refresh();
      flash(keep === 'both' ? 'Marked as both valid.' : 'Done — the other statement is no longer used.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve');
    } finally {
      setBusy(false);
    }
  };

  const onToggleArchive = async (id: string, archive: boolean) => {
    setBusy(true);
    try {
      await setCompanyDocumentStatus(id, archive ? 'archived' : 'active');
      setVersionNotice(null);
      await refresh();
      flash(archive ? 'Document archived — the assistant no longer uses it.' : 'Document restored.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the document');
    } finally {
      setBusy(false);
    }
  };

  const onRefreshWebsite = async () => {
    setRefreshing('Starting…');
    setError(null);
    try {
      const r = await refreshWebsite((stage, detail) =>
        setRefreshing(stage === 'reading' && detail?.pages ? `Reading ${detail.pages} pages…` : stage === 'fetching' ? 'Opening your website…' : 'Working…')
      );
      await refresh();
      flash(r.unchanged ? 'Website re-read — nothing has changed.' : `Website refreshed (${r.sources.pages.length} pages).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh the website');
    } finally {
      setRefreshing(null);
    }
  };

  const QUALITY_LABEL: Record<string, string> = {
    very_short: 'Very short',
    boilerplate_heavy: 'Mostly menus / legal text',
    stale: 'Over 30 days old',
    few_pages: 'Few pages read',
    scanned_ocr: 'Read by OCR — check accuracy',
    archived: 'Archived',
  };
  const WARN_FLAGS = new Set(['very_short', 'boilerplate_heavy', 'stale', 'few_pages']);

  const onDelete = async (id: string) => {
    if (!isAdmin || !confirm('Remove this document from company knowledge?')) return;
    setBusy(true);
    try {
      await deleteCompanyDocument(id);
      await refresh();
      flash('Document removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveCompanyProfile({
        ...profile,
        vocabulary: vocabStr.split(',').map((s) => s.trim()).filter(Boolean),
        avoid: avoidStr.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setProfile(saved);
      flash('Brand voice saved. AI replies will adapt.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const onDerive = async () => {
    if (!isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await deriveCompanyVoice();
      setProfile(saved);
      setVocabStr((saved.vocabulary || []).join(', '));
      setAvoidStr((saved.avoid || []).join(', '));
      await refresh();
      flash('Voice derived from your documents — review and tweak if needed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Derive failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center gap-2 py-20 text-sm ${muted}`}>
        <Loader2 className="w-4 h-4 animate-spin" /> Loading admin…
      </div>
    );
  }

  return (
    <div className={`space-y-6 pb-12 animate-fadeIn select-text ${isLight ? 'text-slate-900 font-sans' : 'text-[#E8E9D8] font-sans'}`}>
      <div className={`border-b pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3 ${
        isLight ? 'border-slate-200/90' : 'border-[rgba(169,191,165,0.18)]'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className={`w-4 h-4 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
            <p className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-teal-700' : 'text-teal-400'}`}>
              Admin
            </p>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${title}`}>Admin console</h1>
          <p className={`text-xs mt-1 max-w-2xl ${muted}`}>
            Brand knowledge, voice, channel auto-reply, and agent audit — used by Lead Agent, Inbox, and content tools.
          </p>
        </div>
        {!isAdmin && (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${
            isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-950/40 text-amber-200 border-amber-800/40'
          }`}>
            View only
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Documents', value: String(status?.documentCount ?? 0) },
          { label: 'Knowledge chunks', value: String(status?.chunkCount ?? 0) },
          { label: 'Company', value: status?.companyName || 'Not set' },
          { label: 'Voice', value: status?.hasVoice ? (status.derivedFromDocs ? 'Derived' : 'Custom') : 'Default' },
        ].map((k) => (
          <div key={k.label} className={`${card} px-4 py-3`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>{k.label}</p>
            <p className={`text-lg font-bold mt-1 truncate ${title}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {(message || error) && (
        <div className={`rounded-lg border px-4 py-3 text-xs font-medium ${
          error
            ? isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-950/30 border-rose-800/40 text-rose-300'
            : isLight ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-teal-950/30 border-teal-800/40 text-teal-200'
        }`}>
          {error || message}
        </div>
      )}

      {conflicts.length > 0 && (
        <div id="admin-conflicts" className={`${card} p-4 sm:p-5 space-y-3 border-amber-500/40`}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            <div>
              <h2 className={`text-base font-bold ${title}`}>Conflicting information ({conflicts.length})</h2>
              <p className={`text-xs mt-0.5 ${muted}`}>Two of your sources disagree. Until you choose, the assistant will not quote either one — it will say it will confirm with your team.</p>
            </div>
          </div>
          <ul className="space-y-3">
            {conflicts.map((c) => {
              const newer = c.a.uploadedAt && c.b.uploadedAt ? (new Date(c.a.uploadedAt) > new Date(c.b.uploadedAt) ? 'a' : 'b') : null;
              return (
                <li key={c.id} className={`rounded-lg p-3 space-y-2 ${isLight ? 'bg-slate-50' : 'bg-[#061816]'}`}>
                  <p className={`text-sm font-bold ${title}`}>{c.topic}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(['a', 'b'] as const).map((side) => (
                      <div key={side} className={`rounded-md p-2.5 text-[11px] space-y-1 ${isLight ? 'bg-white border border-slate-200' : 'bg-[#071C1A] border border-[rgba(169,191,165,0.18)]'}`}>
                        <p className={`font-semibold ${title}`}>
                          {c[side].title}
                          {newer === side && <span className="ml-1.5 text-[10px] font-bold text-emerald-500">NEWER</span>}
                        </p>
                        <p className={muted}>{side === 'a' ? c.statementA : c.statementB}</p>
                        <p className={`italic line-clamp-3 ${muted}`}>“{c[side].excerpt}”</p>
                        {isAdmin && (
                          <button type="button" disabled={busy} onClick={() => void onResolveConflict(c.id, side)} className={`mt-1 px-2.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-45 ${btnSecondary}`}>
                            This one is correct
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {isAdmin && (
                    <button type="button" disabled={busy} onClick={() => void onResolveConflict(c.id, 'both')} className={`text-[11px] font-semibold underline ${muted}`}>
                      Both are correct (different branches, plans, etc.)
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div id="admin-gaps" className={`${card} p-4 sm:p-5 space-y-3`}>
        <div className="flex items-start gap-2">
          <MessageCircleQuestion className={`w-4 h-4 mt-0.5 shrink-0 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
          <div>
            <h2 className={`text-base font-bold ${title}`}>Unanswered customer questions</h2>
            <p className={`text-xs mt-0.5 ${muted}`}>Questions customers asked that your knowledge could not answer, grouped and sorted by how often they came up. Answer one and it becomes an FAQ immediately.</p>
          </div>
        </div>
        {gaps.length === 0 ? (
          <p className={`text-sm py-3 ${muted}`}>Nothing unanswered. As customers chat, the questions your assistant could not answer will appear here.</p>
        ) : (
          <ul className="space-y-2 max-h-[28rem] overflow-y-auto">
            {gaps.map((g) => (
              <li key={g.id} className={`rounded-lg p-3 space-y-2 ${isLight ? 'bg-slate-50' : 'bg-[#061816]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${title}`}>
                      {g.kind === 'conflict' && <span className="mr-1.5 text-[10px] font-bold text-amber-500">CONFLICT</span>}
                      “{g.question}”
                    </p>
                    <p className={`text-[11px] mt-0.5 ${muted}`}>
                      Asked {g.count} time{g.count === 1 ? '' : 's'} · {Object.entries(g.channels).map(([ch, n]) => `${ch} ${n}`).join(', ')} · last {new Date(g.lastSeen).toLocaleDateString()}
                    </p>
                    {g.variants.length > 0 && <p className={`text-[11px] mt-0.5 italic truncate ${muted}`}>Also: {g.variants.slice(0, 2).join(' · ')}</p>}
                    {g.detail && <p className={`text-[11px] mt-0.5 ${muted}`}>{g.detail}</p>}
                  </div>
                  {isAdmin && answering !== g.id && g.kind === 'missing' && (
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => { setAnswering(g.id); setAnswerText(''); }} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${btnSecondary}`}>Add answer</button>
                      <button type="button" disabled={busy} onClick={() => void onDismissGap(g.id)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${btnGhost}`}>Dismiss</button>
                    </div>
                  )}
                  {isAdmin && g.kind === 'conflict' && (
                    <a href="#admin-conflicts" className="text-[11px] font-bold text-teal-500 hover:underline shrink-0">Resolve above</a>
                  )}
                </div>
                {answering === g.id && (
                  <div className="space-y-2">
                    <textarea autoFocus value={answerText} onChange={(e) => setAnswerText(e.target.value)} rows={3} placeholder="Write the answer exactly as customers should hear it (prices, hours and policies must be accurate)…" className={`${inputClass} resize-y`} />
                    <div className="flex gap-2">
                      <button type="button" disabled={busy || !answerText.trim()} onClick={() => void onAnswerGap(g)} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold disabled:opacity-45 ${btnPrimary}`}>Save as FAQ</button>
                      <button type="button" onClick={() => setAnswering(null)} className={`px-3 py-1.5 rounded-md text-[11px] font-semibold ${btnGhost}`}>Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Knowledge health */}
        <div className={`${card} p-4 sm:p-5 space-y-3`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className={`text-base font-bold ${title}`}>Knowledge health</h2>
              <p className={`text-xs mt-0.5 ${muted}`}>What your assistant can and cannot answer today.</p>
            </div>
            {health && (
              <span className={`text-2xl font-bold tabular-nums ${health.score >= 80 ? 'text-emerald-500' : health.score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                {health.score}%
              </span>
            )}
          </div>
          {health ? (
            <>
              <ul className="space-y-1.5">
                {health.checks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2 text-xs">
                    {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" /> : <Circle className="w-3.5 h-3.5 mt-0.5 text-amber-500 shrink-0" />}
                    <span className={c.ok ? title : muted}>
                      <span className="font-semibold">{c.label}</span>
                      {!c.ok && <span className={`block text-[11px] ${muted}`}>{c.hint}</span>}
                      {!c.ok && c.action === 'refresh_website' && isAdmin && (
                        <button type="button" disabled={Boolean(refreshing)} onClick={() => void onRefreshWebsite()} className="mt-1 text-[11px] font-bold text-teal-500 hover:underline disabled:opacity-50">
                          {refreshing || 'Refresh website now'}
                        </button>
                      )}
                      {!c.ok && c.action && c.action !== 'refresh_website' && (
                        <a href={`#admin-${c.action}`} className="mt-1 inline-block text-[11px] font-bold text-teal-500 hover:underline">
                          {c.action === 'gaps' ? 'See the questions' : 'Resolve now'}
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={`text-[11px] ${muted}`}>
                {health.stats.chunks} searchable passages · {health.stats.semanticSearch ? 'meaning-based search on' : health.stats.indexing ? 'building meaning-based search…' : 'keyword search only'}
              </p>
            </>
          ) : (
            <p className={`text-sm py-4 ${muted}`}>Health report unavailable.</p>
          )}
        </div>

        {/* Test a question */}
        <div className={`${card} p-4 sm:p-5 space-y-3`}>
          <div>
            <h2 className={`text-base font-bold ${title}`}>Test a customer question</h2>
            <p className={`text-xs mt-0.5 ${muted}`}>See what your assistant would find — and whether it would have to hand off.</p>
          </div>
          <form onSubmit={onTestQuestion} className="flex gap-2">
            <input value={testQuery} onChange={(e) => setTestQuery(e.target.value)} placeholder="e.g. How much does teeth whitening cost?" className={inputClass} />
            <button type="submit" disabled={testing || !testQuery.trim()} className={`px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 flex items-center gap-1.5 ${btnPrimary}`}>
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Test
            </button>
          </form>
          {testResult && (
            <div className="space-y-2">
              <p className={`text-xs font-semibold ${testResult.grounded ? 'text-emerald-500' : 'text-amber-500'}`}>
                {testResult.grounded
                  ? `Covered (${testResult.confidence} confidence) — the assistant can answer this.`
                  : 'Not covered — the assistant would say it will check with your team and hand off.'}
              </p>
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {testResult.grounded && testResult.sources.map((src) => (
                  <li key={src.id} className={`rounded-lg px-3 py-2 text-[11px] ${isLight ? 'bg-slate-50' : 'bg-[#061816]'}`}>
                    <p className={`font-semibold ${title}`}>{src.title}</p>
                    <p className={`mt-0.5 line-clamp-3 ${muted}`}>{src.excerpt}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Documents */}
        <div className={`${card} p-4 sm:p-5 space-y-4`}>
          <div>
            <h2 className={`text-base font-bold ${title}`}>Company documents</h2>
            <p className={`text-xs mt-0.5 ${muted}`}>Brand books, price lists, FAQs · PDF, DOCX, TXT, MD, CSV, JSON, HTML, or photos of scanned pages</p>
            {isAdmin && profile.websiteUrl && (
              <button type="button" disabled={Boolean(refreshing)} onClick={() => void onRefreshWebsite()} className={`mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-60 ${btnSecondary}`}>
                {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {refreshing || 'Re-read my website now'}
              </button>
            )}
          </div>

          {versionNotice && isAdmin && (
            <div className={`rounded-lg border px-3 py-2.5 text-xs space-y-2 ${isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800/40 text-amber-100'}`}>
              <p><span className="font-semibold">{versionNotice.newTitle}</span> looks like an updated version of <span className="font-semibold">{versionNotice.oldTitle}</span>. Keeping both can make the assistant quote old prices.</p>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => void onToggleArchive(versionNotice.oldId, true)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${btnPrimary}`}>Archive the old one</button>
                <button type="button" onClick={() => setVersionNotice(null)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${btnGhost}`}>Keep both</button>
              </div>
            </div>
          )}

          {isAdmin && (
            <>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg px-4 py-8 cursor-pointer transition-colors ${
                isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-[rgba(169,191,165,0.25)] hover:bg-[#061816]'
              }`}>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.png,.jpg,.jpeg,.webp"
                  disabled={busy}
                  onChange={(e) => {
                    void onUploadFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <UploadCloud className={`w-5 h-5 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
                <span className={`text-sm font-semibold ${title}`}>{busy ? 'Uploading…' : 'Drop or click to upload'}</span>
                <span className={`text-[11px] ${muted}`}>Scanned PDFs and images are read with OCR · up to 10MB each</span>
              </label>

              <form onSubmit={onPasteUpload} className="space-y-3">
                <p className={`text-[11px] font-bold uppercase tracking-wide ${muted}`}>Or paste text</p>
                <input value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} placeholder="Document title" className={inputClass} />
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5} placeholder="Paste brand guidelines, FAQ, product copy…" className={`${inputClass} resize-y min-h-[120px]`} />
                <button type="submit" disabled={busy || !pasteText.trim()} className={`px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-45 ${btnPrimary}`}>
                  Save pasted document
                </button>
              </form>
            </>
          )}

          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {docs.length === 0 ? (
              <li className={`text-sm py-6 text-center ${muted}`}>No company documents yet.</li>
            ) : (
              docs.map((d) => (
                <li key={d.id} className={`flex items-start justify-between gap-3 rounded-lg px-3.5 py-3 ${
                  isLight ? 'bg-slate-50' : 'bg-[#061816]'
                }`}>
                  <div className={`min-w-0 ${d.status === 'archived' ? 'opacity-60' : ''}`}>
                    <p className={`text-sm font-bold truncate ${title}`}>{d.title}</p>
                    <p className={`text-[11px] mt-0.5 ${muted}`}>
                      {d.fileName} · {d.chunkCount} chunks · {d.charCount.toLocaleString()} chars
                    </p>
                    {(d.quality || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(d.quality || []).map((f) => (
                          <span key={f} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${WARN_FLAGS.has(f) ? (isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/50 text-amber-200') : (isLight ? 'bg-slate-200 text-slate-600' : 'bg-[#0D2D2A] text-[#A9BFA5]')}`}>
                            {QUALITY_LABEL[f] || f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 shrink-0 items-center">
                      <button type="button" disabled={busy} title={d.status === 'archived' ? 'Use this document again' : 'Stop using this document without deleting it'} onClick={() => void onToggleArchive(d.id, d.status !== 'archived')} className="text-[11px] font-bold text-teal-500 flex items-center gap-1 disabled:opacity-50">
                        {d.status === 'archived' ? <><Undo2 className="w-3 h-3" />Restore</> : <><Archive className="w-3 h-3" />Archive</>}
                      </button>
                      <button type="button" onClick={() => void onDelete(d.id)} className="text-[11px] font-bold text-rose-500">
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Voice */}
        <div className={`${card} p-4 sm:p-5 space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={`text-base font-bold ${title}`}>Brand voice</h2>
              <p className={`text-xs mt-0.5 ${muted}`}>Every post and reply follows this voice.</p>
            </div>
            {isAdmin && (
              <button type="button" disabled={busy || docs.length === 0} onClick={() => void onDerive()} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold disabled:opacity-40 ${btnSecondary}`}>
                {busy ? 'Working…' : 'Derive from documents'}
              </button>
            )}
          </div>

          {isAdmin && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${muted}`}>Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {VOICE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, voiceTone: preset.voiceTone, writingStyle: preset.writingStyle }))}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold ${btnGhost}`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={onSaveProfile} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`block text-xs font-semibold ${muted}`}>
                Company name
                <input value={profile.companyName} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))} className={inputClass} />
              </label>
              <label className={`block text-xs font-semibold ${muted}`}>
                Industry
                <input value={profile.industry} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, industry: e.target.value }))} className={inputClass} />
              </label>
            </div>

            <p className={`text-[10px] font-bold uppercase tracking-wider pt-1 ${muted}`}>Public & local SEO facts</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`block text-xs font-semibold ${muted}`}>
                Website URL
                <input
                  value={profile.websiteUrl || ''}
                  disabled={!isAdmin}
                  onChange={(e) => setProfile((p) => ({ ...p, websiteUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://yoursite.com"
                />
              </label>
              <label className={`block text-xs font-semibold ${muted}`}>
                Business phone
                <input
                  value={profile.businessPhone || ''}
                  disabled={!isAdmin}
                  onChange={(e) => setProfile((p) => ({ ...p, businessPhone: e.target.value }))}
                  className={inputClass}
                  placeholder="+1 …"
                />
              </label>
            </div>
            <label className={`block text-xs font-semibold ${muted}`}>
              Business address
              <input
                value={profile.businessAddress || ''}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, businessAddress: e.target.value }))}
                className={inputClass}
                placeholder="Street, city, region"
              />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>
              Google Business Profile URL
              <input
                value={profile.googleBusinessProfileUrl || ''}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, googleBusinessProfileUrl: e.target.value }))}
                className={inputClass}
                placeholder="https://maps.google.com/…"
              />
            </label>

            <label className={`block text-xs font-semibold ${muted}`}>
              Send human handoffs to (email)
              <input type="email" value={profile.handoffEmail || ''} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, handoffEmail: e.target.value }))} className={inputClass} placeholder="sales@yourbusiness.com" />
            </label>

            <label className={`block text-xs font-semibold ${muted}`}>
              Opening hours
              <input value={profile.businessHours || ''} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, businessHours: e.target.value }))} className={inputClass} placeholder="Mon–Sat, 9am–7pm" />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className={`text-xs font-semibold ${muted}`}>FAQs the assistant answers exactly</p>
                {isAdmin && (
                  <button type="button" onClick={() => setProfile((p) => ({ ...p, faqs: [...(p.faqs || []), { id: `faq-${Date.now()}`, question: '', answer: '' }] }))} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${btnSecondary}`}>
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              {(profile.faqs || []).length === 0 && <p className={`text-[11px] ${muted}`}>No FAQs yet.</p>}
              {(profile.faqs || []).map((faq, i) => (
                <div key={faq.id} className={`rounded-lg p-2.5 space-y-1.5 ${isLight ? 'bg-slate-50' : 'bg-[#061816]'}`}>
                  <div className="flex items-center gap-2">
                    <input value={faq.question} disabled={!isAdmin} onChange={(e) => updateFaq(i, 'question', e.target.value)} className={inputClass} placeholder="Question" />
                    {isAdmin && (
                      <button type="button" aria-label="Remove FAQ" onClick={() => setProfile((p) => ({ ...p, faqs: (p.faqs || []).filter((_, j) => j !== i) }))} className={`p-1.5 rounded ${btnGhost}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <textarea value={faq.answer} disabled={!isAdmin} onChange={(e) => updateFaq(i, 'answer', e.target.value)} rows={2} className={`${inputClass} resize-y`} placeholder="Answer" />
                </div>
              ))}
            </div>

            <label className={`block text-xs font-semibold ${muted}`}>
              Bot / agent name
              <input value={profile.botName || 'Alex'} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, botName: e.target.value }))} className={inputClass} placeholder="e.g. Alex" />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={`flex items-center gap-2.5 text-xs font-semibold rounded-lg px-3 py-3 ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#061816] text-[#E8E9D8]'}`}>
                <input type="checkbox" checked={profile.instagramAutoReply !== false} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, instagramAutoReply: e.target.checked }))} />
                Auto-chat on Instagram DMs
              </label>
              <label className={`flex items-center gap-2.5 text-xs font-semibold rounded-lg px-3 py-3 ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#061816] text-[#E8E9D8]'}`}>
                <input type="checkbox" checked={profile.whatsappAutoReply !== false} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, whatsappAutoReply: e.target.checked }))} />
                Auto-chat on WhatsApp
              </label>
              <label className={`flex items-center gap-2.5 text-xs font-semibold rounded-lg px-3 py-3 ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-[#061816] text-[#E8E9D8]'}`}>
                <input type="checkbox" checked={profile.emailAutoReply !== false} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, emailAutoReply: e.target.checked }))} />
                Auto-reply on Email
              </label>
            </div>

            <label className={`block text-xs font-semibold ${muted}`}>
              Tagline
              <input value={profile.tagline} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, tagline: e.target.value }))} className={inputClass} />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>
              Voice & tone
              <textarea value={profile.voiceTone} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, voiceTone: e.target.value }))} rows={3} className={`${inputClass} resize-y`} />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>
              Writing style
              <textarea value={profile.writingStyle} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, writingStyle: e.target.value }))} rows={2} className={`${inputClass} resize-y`} />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>
              Audience
              <input value={profile.audience} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, audience: e.target.value }))} className={inputClass} />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>
              Products / focus
              <input value={profile.productsFocus} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, productsFocus: e.target.value }))} className={inputClass} />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>
              Preferred vocabulary
              <input value={vocabStr} disabled={!isAdmin} onChange={(e) => setVocabStr(e.target.value)} className={inputClass} placeholder="comma-separated" />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>
              Words / phrases to avoid
              <input value={avoidStr} disabled={!isAdmin} onChange={(e) => setAvoidStr(e.target.value)} className={inputClass} placeholder="comma-separated" />
            </label>
            <label className={`block text-xs font-semibold ${muted}`}>
              Extra guidelines
              <textarea value={profile.extraGuidelines} disabled={!isAdmin} onChange={(e) => setProfile((p) => ({ ...p, extraGuidelines: e.target.value }))} rows={3} className={`${inputClass} resize-y`} />
            </label>

            {isAdmin && (
              <button type="submit" disabled={busy} className={`px-5 py-2.5 text-xs font-semibold rounded-lg disabled:opacity-45 ${btnPrimary}`}>
                {busy ? 'Saving…' : 'Save brand voice'}
              </button>
            )}
          </form>
        </div>
      </div>

      <div className={`${card} p-4 sm:p-5`}>
        <h3 className={`text-sm font-bold mb-2 ${title}`}>Where this applies</h3>
        <ul className={`grid sm:grid-cols-2 gap-2 text-xs ${muted}`}>
          <li>Lead Agent ({status?.botName || 'Alex'}) — answers from your docs + voice</li>
          <li>Instagram / WhatsApp DMs — auto-replies when enabled</li>
          <li>Creative Lab & Campaigns — generated posts</li>
          <li>Agents — competitor content stays on-brand</li>
        </ul>
      </div>

      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className={`text-base font-bold ${title}`}>Agent audit trail</h3>
            <p className={`text-xs ${muted}`}>Every run is reconstructable (no private chain-of-thought)</p>
          </div>
          <button type="button" disabled={busy} onClick={() => void refresh()} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg ${btnSecondary}`}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
        {audit.length === 0 ? (
          <p className={`text-sm py-6 text-center ${muted}`}>No runs yet. Chat with the Lead Agent to populate the audit log.</p>
        ) : (
          <ul className={`divide-y max-h-80 overflow-y-auto ${isLight ? 'divide-slate-100' : 'divide-[rgba(169,191,165,0.12)]'}`}>
            {audit.map((row) => (
              <li key={row.event_id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${title}`}>
                    {row.action || 'run'} · {row.policy_decision || row.status || '—'}
                  </p>
                  <p className={`text-xs mt-0.5 truncate ${muted}`}>
                    {row.result?.intent || '—'}
                    {row.result?.score != null ? ` · score ${row.result.score}` : ''}
                    {row.result?.handoff ? ' · HANDOFF' : ''}
                    {row.meta?.next_best_action ? ` · ${row.meta.next_best_action}` : ''}
                  </p>
                </div>
                <div className={`text-[10px] whitespace-nowrap shrink-0 ${muted}`}>
                  {row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}
                  <br />
                  {row.agent_version || row.prompt_version || ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
