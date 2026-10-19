import React, { useCallback, useEffect, useState, FormEvent } from 'react';
import Card from './common/Card';
import Spinner from './common/Spinner';
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
} from '../services/companyService';

interface AdminConsoleProps {
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
  voiceTone: '',
  writingStyle: '',
  vocabulary: [],
  avoid: [],
  audience: '',
  productsFocus: '',
  extraGuidelines: '',
};

const AdminConsole: React.FC<AdminConsoleProps> = ({ isAdmin = false }) => {
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
      flash(`Uploaded ${count} document${count === 1 ? '' : 's'}. Lead Agent & Catalyst will use them.`);
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
        vocabulary: vocabStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        avoid: avoidStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
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
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-ink tracking-tight">Admin Console</h1>
          <p className="text-ink-muted mt-1 font-medium max-w-2xl">
            Upload company docs so Lead Agent, Catalyst, and content tools write in your brand voice.
          </p>
        </div>
        {!isAdmin && (
          <p className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-2 rounded-full">
            View only — ask an admin to upload or edit voice
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Documents', value: String(status?.documentCount ?? 0) },
          { label: 'Knowledge chunks', value: String(status?.chunkCount ?? 0) },
          { label: 'Company', value: status?.companyName || 'Not set' },
          { label: 'Voice', value: status?.hasVoice ? (status.derivedFromDocs ? 'Derived' : 'Custom') : 'Default' },
        ].map((k) => (
          <Card key={k.label} className="!p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">{k.label}</p>
            <p className="text-lg font-extrabold text-ink mt-1 truncate">{k.value}</p>
          </Card>
        ))}
      </div>

      {(message || error) && (
        <p
          className={`text-sm font-medium px-4 py-3 rounded-2xl ${
            error ? 'bg-soft-coral/15 text-soft-coral' : 'bg-soft-mint/70 text-soft-deep'
          }`}
        >
          {error || message}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Upload */}
        <Card>
          <h2 className="text-lg font-bold text-ink mb-1">Company documents</h2>
          <p className="text-xs text-ink-muted mb-4">
            Brand books, FAQs, product sheets, tone guides. Formats: .txt .md .csv .json .html
          </p>

          {isAdmin && (
            <>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-soft-sky rounded-3xl px-4 py-8 cursor-pointer hover:bg-soft-bg/60 transition-colors mb-4">
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
                <span className="text-sm font-bold text-soft-deep">
                  {busy ? 'Uploading…' : 'Drop or click to upload files'}
                </span>
                <span className="text-[11px] text-ink-muted">We chunk them into searchable knowledge</span>
              </label>

              <form onSubmit={onPasteUpload} className="space-y-3 mb-5">
                <p className="text-xs font-bold text-ink-soft">Or paste text</p>
                <input
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="Document title"
                  className="nexora-input w-full text-sm py-2.5 px-3"
                />
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={5}
                  placeholder="Paste brand guidelines, FAQ, product copy…"
                  className="nexora-input w-full text-sm py-2.5 px-3 resize-y min-h-[120px]"
                />
                <button
                  type="submit"
                  disabled={busy || !pasteText.trim()}
                  className="nexora-btn-primary px-4 py-2.5 text-xs disabled:opacity-50"
                >
                  Save pasted document
                </button>
              </form>
            </>
          )}

          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {docs.length === 0 ? (
              <li className="text-sm text-ink-muted py-6 text-center">No company documents yet.</li>
            ) : (
              docs.map((d) => (
                <li
                  key={d.id}
                  className="flex items-start justify-between gap-3 bg-soft-bg/70 rounded-2xl px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{d.title}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5">
                      {d.fileName} · {d.chunkCount} chunks · {d.charCount.toLocaleString()} chars
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => void onDelete(d.id)}
                      className="text-[11px] font-bold text-soft-coral shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </Card>

        {/* Voice */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Set your brand voice</h2>
              <p className="text-xs text-ink-muted mt-1">
                Companies set this once — every post and reply follows it (or pick Custom per generation).
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                disabled={busy || docs.length === 0}
                onClick={() => void onDerive()}
                className="px-3 py-2 rounded-full text-[11px] font-bold bg-soft-mint text-soft-deep disabled:opacity-40"
              >
                {busy ? 'Working…' : 'Derive from documents'}
              </button>
            )}
          </div>

          {isAdmin && (
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-2">
                Quick start presets
              </p>
              <div className="flex flex-wrap gap-2">
                {VOICE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        voiceTone: preset.voiceTone,
                        writingStyle: preset.writingStyle,
                      }))
                    }
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-soft-bg text-soft-deep hover:bg-white border border-soft-sky/50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={onSaveProfile} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-ink-soft">
                Company name
                <input
                  value={profile.companyName}
                  disabled={!isAdmin}
                  onChange={(e) => setProfile((p) => ({ ...p, companyName: e.target.value }))}
                  className="nexora-input mt-1 w-full text-sm py-2 px-3"
                />
              </label>
              <label className="block text-xs font-semibold text-ink-soft">
                Industry
                <input
                  value={profile.industry}
                  disabled={!isAdmin}
                  onChange={(e) => setProfile((p) => ({ ...p, industry: e.target.value }))}
                  className="nexora-input mt-1 w-full text-sm py-2 px-3"
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-ink-soft">
              Bot / agent name
              <input
                value={profile.botName || 'Alex'}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, botName: e.target.value }))}
                className="nexora-input mt-1 w-full text-sm py-2 px-3"
                placeholder="e.g. Alex, Maya, Nova"
              />
              <span className="text-[11px] text-ink-muted mt-1 block">
                Shown in web chat and Instagram / WhatsApp auto-replies
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-ink-soft bg-soft-bg/70 rounded-2xl px-3 py-3">
                <input
                  type="checkbox"
                  checked={profile.instagramAutoReply !== false}
                  disabled={!isAdmin}
                  onChange={(e) => setProfile((p) => ({ ...p, instagramAutoReply: e.target.checked }))}
                  className="rounded"
                />
                Auto-chat on Instagram DMs
              </label>
              <label className="flex items-center gap-2.5 text-xs font-semibold text-ink-soft bg-soft-bg/70 rounded-2xl px-3 py-3">
                <input
                  type="checkbox"
                  checked={profile.whatsappAutoReply !== false}
                  disabled={!isAdmin}
                  onChange={(e) => setProfile((p) => ({ ...p, whatsappAutoReply: e.target.checked }))}
                  className="rounded"
                />
                Auto-chat on WhatsApp
              </label>
            </div>

            <label className="block text-xs font-semibold text-ink-soft">
              Tagline
              <input
                value={profile.tagline}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, tagline: e.target.value }))}
                className="nexora-input mt-1 w-full text-sm py-2 px-3"
              />
            </label>

            <label className="block text-xs font-semibold text-ink-soft">
              Voice & tone
              <textarea
                value={profile.voiceTone}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, voiceTone: e.target.value }))}
                rows={3}
                className="nexora-input mt-1 w-full text-sm py-2 px-3 resize-y"
                placeholder="Warm, premium, clear…"
              />
            </label>

            <label className="block text-xs font-semibold text-ink-soft">
              Writing style
              <textarea
                value={profile.writingStyle}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, writingStyle: e.target.value }))}
                rows={2}
                className="nexora-input mt-1 w-full text-sm py-2 px-3 resize-y"
              />
            </label>

            <label className="block text-xs font-semibold text-ink-soft">
              Audience
              <input
                value={profile.audience}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, audience: e.target.value }))}
                className="nexora-input mt-1 w-full text-sm py-2 px-3"
              />
            </label>

            <label className="block text-xs font-semibold text-ink-soft">
              Products / focus
              <input
                value={profile.productsFocus}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, productsFocus: e.target.value }))}
                className="nexora-input mt-1 w-full text-sm py-2 px-3"
              />
            </label>

            <label className="block text-xs font-semibold text-ink-soft">
              Preferred vocabulary (comma-separated)
              <input
                value={vocabStr}
                disabled={!isAdmin}
                onChange={(e) => setVocabStr(e.target.value)}
                className="nexora-input mt-1 w-full text-sm py-2 px-3"
              />
            </label>

            <label className="block text-xs font-semibold text-ink-soft">
              Words / phrases to avoid (comma-separated)
              <input
                value={avoidStr}
                disabled={!isAdmin}
                onChange={(e) => setAvoidStr(e.target.value)}
                className="nexora-input mt-1 w-full text-sm py-2 px-3"
              />
            </label>

            <label className="block text-xs font-semibold text-ink-soft">
              Extra guidelines
              <textarea
                value={profile.extraGuidelines}
                disabled={!isAdmin}
                onChange={(e) => setProfile((p) => ({ ...p, extraGuidelines: e.target.value }))}
                rows={3}
                className="nexora-input mt-1 w-full text-sm py-2 px-3 resize-y"
              />
            </label>

            {isAdmin && (
              <button
                type="submit"
                disabled={busy}
                className="nexora-btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save brand voice'}
              </button>
            )}
          </form>
        </Card>
      </div>

      <Card className="bg-soft-foam/60">
        <h3 className="text-sm font-bold text-ink mb-2">Where this applies</h3>
        <ul className="grid sm:grid-cols-2 gap-2 text-xs text-ink-muted font-medium">
          <li>Lead Agent ({status?.botName || 'Alex'}) — answers from your docs + voice</li>
          <li>Instagram DMs — auto-replies in the chat when enabled</li>
          <li>Catalyst AI — strategy & copy in brand tone</li>
          <li>Campaigns & Social Hub — generated posts</li>
        </ul>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-lg font-bold text-ink">Agent audit trail</h3>
            <p className="text-xs text-ink-muted">
              OBS-001 — every run is reconstructable (no private chain-of-thought)
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="text-xs font-bold px-3 py-1.5 rounded-full bg-soft-mint text-soft-deep"
          >
            Refresh
          </button>
        </div>
        {audit.length === 0 ? (
          <p className="text-sm text-ink-muted py-6 text-center">
            No runs yet. Chat with the Lead Agent to populate the audit log.
          </p>
        ) : (
          <ul className="divide-y divide-soft-sky/40 max-h-80 overflow-y-auto">
            {audit.map((row) => (
              <li key={row.event_id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink">
                    {row.action || 'run'} · {row.policy_decision || row.status || '—'}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5 truncate">
                    {row.result?.intent || '—'}
                    {row.result?.score != null ? ` · score ${row.result.score}` : ''}
                    {row.result?.handoff ? ' · HANDOFF' : ''}
                    {row.meta?.next_best_action ? ` · ${row.meta.next_best_action}` : ''}
                  </p>
                </div>
                <div className="text-[10px] text-ink-muted whitespace-nowrap shrink-0">
                  {row.timestamp ? new Date(row.timestamp).toLocaleString() : ''}
                  <br />
                  {row.agent_version || row.prompt_version || ''}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default AdminConsole;
