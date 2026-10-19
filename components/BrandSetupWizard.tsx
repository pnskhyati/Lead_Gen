import React, { FormEvent, useMemo, useState } from 'react';
import { completeCompanySetup } from '../services/companyService';
import { APP_INITIAL, APP_NAME, APP_PROMISE, APP_TAGLINE } from '../constants/branding';

interface BrandSetupWizardProps {
  onComplete: () => void;
  onLogout?: () => void;
}

const VOICE_PRESETS = [
  {
    label: 'Tecavy OS (recommended)',
    voiceTone:
      'Action-oriented, intelligent, and trustworthy — like a business operating system, not a generic chatbot. Confident, helpful, and operational.',
    writingStyle:
      'Short, outcome-focused sentences. Lead with intent, lead score, and next best action. Ask qualification questions naturally (budget, location, timeline). Never invent pricing — use approved knowledge. Escalate to humans when needed.',
  },
  {
    label: 'Premium & warm',
    voiceTone: 'Warm, premium, and inviting — confident without being pushy.',
    writingStyle: 'Short paragraphs, sensory language, clear calls to explore — never hypey.',
  },
  {
    label: 'Professional B2B',
    voiceTone: 'Authoritative, helpful, and trustworthy for business decision-makers.',
    writingStyle: 'Structured points, outcome-focused language, minimal slang.',
  },
];

const BrandSetupWizard: React.FC<BrandSetupWizardProps> = ({ onComplete, onLogout }) => {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [botName, setBotName] = useState('');
  const [industry, setIndustry] = useState('');
  const [tagline, setTagline] = useState('');
  const [audience, setAudience] = useState('');
  const [voiceTone, setVoiceTone] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [productsFocus, setProductsFocus] = useState('');

  const canContinueIdentity = useMemo(
    () => Boolean(companyName.trim() && botName.trim()),
    [companyName, botName]
  );
  const canSubmit = useMemo(
    () => Boolean(canContinueIdentity && voiceTone.trim() && writingStyle.trim()),
    [canContinueIdentity, voiceTone, writingStyle]
  );

  const applyPreset = (preset: (typeof VOICE_PRESETS)[number]) => {
    setVoiceTone(preset.voiceTone);
    setWritingStyle(preset.writingStyle);
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await completeCompanySetup({
        companyName: companyName.trim(),
        botName: botName.trim(),
        industry: industry.trim(),
        tagline: tagline.trim(),
        audience: audience.trim(),
        voiceTone: voiceTone.trim(),
        writingStyle: writingStyle.trim(),
        productsFocus: productsFocus.trim(),
        vocabulary: [],
        avoid: [],
        extraGuidelines: '',
        instagramAutoReply: true,
        whatsappAutoReply: true,
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 animate-fade-in relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full bg-soft-lilac/25 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-soft-mint/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-soft-azure/20 blur-3xl" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-soft-deep via-soft-azure to-soft-lilac text-white flex items-center justify-center font-extrabold text-xl shadow-aqua">
            {APP_INITIAL}
          </div>
          <h1 className="font-display font-semibold text-3xl sm:text-4xl text-ink tracking-tight">
            Set up {APP_NAME}
          </h1>
          <p className="text-ink-muted mt-2 text-sm font-medium">{APP_TAGLINE}</p>
          <p className="text-ink-muted/80 mt-1 text-xs font-medium">{APP_PROMISE}</p>
        </div>

        <div className="bg-white/70 backdrop-blur-2xl p-6 sm:p-8 rounded-[2rem] border border-soft-sky/50 shadow-soft-lg">
          <div className="flex gap-2 mb-6">
            {['Identity', 'Voice'].map((label, i) => (
              <div
                key={label}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i <= step ? 'bg-soft-deep' : 'bg-soft-sky/70'
                }`}
                title={label}
              />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-ink-soft mb-2">
                  Company name <span className="text-soft-coral">*</span>
                </label>
                <input
                  className="nexora-input w-full py-3 px-4 text-sm text-ink"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Tecavy client business name"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-soft mb-2">
                  Bot / assistant name <span className="text-soft-coral">*</span>
                </label>
                <input
                  className="nexora-input w-full py-3 px-4 text-sm text-ink"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="e.g. Tecavy Agent"
                  required
                />
                <p className="text-[11px] text-ink-muted mt-1.5">
                  Shown in Lead Agent chat and channel replies.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-ink-soft mb-2">Industry</label>
                  <input
                    className="nexora-input w-full py-3 px-4 text-sm text-ink"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink-soft mb-2">Tagline</label>
                  <input
                    className="nexora-input w-full py-3 px-4 text-sm text-ink"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-soft mb-2">Audience</label>
                <input
                  className="nexora-input w-full py-3 px-4 text-sm text-ink"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Who you sell to (optional)"
                />
              </div>

              {error && <p className="text-sm text-soft-coral font-medium">{error}</p>}

              <button
                type="button"
                disabled={!canContinueIdentity}
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className="nexora-btn-primary w-full py-3.5 text-sm disabled:opacity-50"
              >
                Continue to brand voice
              </button>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">
                  Start from a preset (optional)
                </p>
                <div className="flex flex-wrap gap-2">
                  {VOICE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-soft-mint/70 text-soft-deep border border-soft-sky/60 hover:bg-soft-mint"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink-soft mb-2">
                  Voice tone <span className="text-soft-coral">*</span>
                </label>
                <textarea
                  className="nexora-input w-full py-3 px-4 text-sm text-ink min-h-[88px] resize-y"
                  value={voiceTone}
                  onChange={(e) => setVoiceTone(e.target.value)}
                  placeholder="How should your brand sound?"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-soft mb-2">
                  Writing style <span className="text-soft-coral">*</span>
                </label>
                <textarea
                  className="nexora-input w-full py-3 px-4 text-sm text-ink min-h-[88px] resize-y"
                  value={writingStyle}
                  onChange={(e) => setWritingStyle(e.target.value)}
                  placeholder="Sentence length, formality, structure…"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-soft mb-2">
                  Products / focus
                </label>
                <textarea
                  className="nexora-input w-full py-3 px-4 text-sm text-ink min-h-[64px] resize-y"
                  value={productsFocus}
                  onChange={(e) => setProductsFocus(e.target.value)}
                  placeholder="Optional — what you sell or promote most"
                />
              </div>

              {error && <p className="text-sm text-soft-coral font-medium">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(0);
                  }}
                  className="flex-1 py-3.5 rounded-full text-sm font-bold text-ink-soft bg-white border border-soft-sky/70 hover:bg-soft-sky/20"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || busy}
                  className="nexora-btn-primary flex-[1.4] py-3.5 text-sm disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Finish setup & open workspace'}
                </button>
              </div>
            </form>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full mt-5 text-center text-xs font-semibold text-ink-muted hover:text-ink"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrandSetupWizard;
