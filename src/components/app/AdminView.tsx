import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Loader2, Shield, UploadCloud, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  deleteCompanyDocument,
  deriveCompanyVoice,
  getAgentAudit,
  getCompanyProfile,
  getCompanyStatus,
  listCompanyDocuments,
  readFileAsText,
  saveCompanyProfile,
  uploadCompanyDocument,
  type CompanyDocumentMeta,
  type CompanyProfile,
  type CompanyStatus,
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
    const [s, p, d, a] = await Promise.all([
      getCompanyStatus(),
      getCompanyProfile(),
      listCompanyDocuments(),
      getAgentAudit(25).catch(() => []),
    ]);
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
      let count = 0;
      for (const file of Array.from(files)) {
        const text = await readFileAsText(file);
        await uploadCompanyDocument({
          title: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          mimeType: file.type,
          text,
        });
        count += 1;
      }
      await refresh();
      flash(`Uploaded ${count} document${count === 1 ? '' : 's'}.`);
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Documents */}
        <div className={`${card} p-4 sm:p-5 space-y-4`}>
          <div>
            <h2 className={`text-base font-bold ${title}`}>Company documents</h2>
            <p className={`text-xs mt-0.5 ${muted}`}>Brand books, FAQs, product sheets · .txt .md .csv .json .html</p>
          </div>

          {isAdmin && (
            <>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg px-4 py-8 cursor-pointer transition-colors ${
                isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-[rgba(169,191,165,0.25)] hover:bg-[#061816]'
              }`}>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".txt,.md,.csv,.json,.html,text/plain,text/markdown,application/json"
                  disabled={busy}
                  onChange={(e) => {
                    void onUploadFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <UploadCloud className={`w-5 h-5 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
                <span className={`text-sm font-semibold ${title}`}>{busy ? 'Uploading…' : 'Drop or click to upload'}</span>
                <span className={`text-[11px] ${muted}`}>Chunked into searchable knowledge</span>
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
                  <div className="min-w-0">
                    <p className={`text-sm font-bold truncate ${title}`}>{d.title}</p>
                    <p className={`text-[11px] mt-0.5 ${muted}`}>
                      {d.fileName} · {d.chunkCount} chunks · {d.charCount.toLocaleString()} chars
                    </p>
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => void onDelete(d.id)} className="text-[11px] font-bold text-rose-500 shrink-0">
                      Remove
                    </button>
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
