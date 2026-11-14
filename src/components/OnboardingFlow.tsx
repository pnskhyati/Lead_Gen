import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  Globe,
  Mail,
  Plus,
  Trash2,
  CheckCircle2,
  Building2,
  HelpCircle,
  ChevronDown,
  Loader2,
  UploadCloud,
  FileText
} from 'lucide-react';
import { register } from '../legacy/services/authService';
import {
  ANALYZE_STAGE_LABEL,
  analyzeBusiness,
  completeCompanySetup,
  deleteCompanyDocument,
  getOnboardingDraft,
  listCompanyDocuments,
  saveOnboardingDraft,
  uploadCompanyFiles,
  type BusinessDraft,
  type CompanyDocumentMeta,
} from '../legacy/services/companyService';

type Step = 'signup' | 'business' | 'channels' | 'ai-basics';
type Tone = 'Professional' | 'Friendly' | 'Premium' | 'Conversational';
type ChannelKey = 'whatsapp' | 'instagram' | 'facebook' | 'email';

export interface OnboardingData {
  businessName: string;
}

interface OnboardingFlowProps {
  isOpen: boolean;
  initialStep?: Step;
  /** Set when the visitor already has an account (resuming setup): skips signup. */
  existingUser?: { name: string; email: string } | null;
  onClose: () => void;
  onOpenLogin: () => void;
  onComplete: (data: OnboardingData) => void;
}

const BASE_INDUSTRIES = [
  'Interior design',
  'Real estate',
  'Professional services',
  'Agency & Consulting',
  'Healthcare & Wellness',
  'Technology & SaaS',
  'E-commerce & Retail',
];

const TONE_PRESETS: Record<Tone, { voiceTone: string; writingStyle: string }> = {
  Professional: {
    voiceTone: 'Professional, precise and respectful. Confident without being stiff.',
    writingStyle: 'Clear, well-structured sentences. Answer the question first, then offer the next step.',
  },
  Friendly: {
    voiceTone: 'Friendly, warm and approachable. Helpful without being pushy.',
    writingStyle: 'Short, plain sentences. Answer the question first, then offer the next step.',
  },
  Premium: {
    voiceTone: 'Refined, calm and assured. Understated luxury; never salesy.',
    writingStyle: 'Elegant, concise sentences with considered word choice. No exclamation marks or slang.',
  },
  Conversational: {
    voiceTone: 'Relaxed and conversational, like a knowledgeable friend. Natural and personable.',
    writingStyle: 'Casual, short sentences and contractions. Ask one question at a time.',
  },
};

const ACCEPTED_FILES = '.pdf,.docx,.txt,.md,.csv,.json,.html,.png,.jpg,.jpeg,.webp';
const newFaq = () => ({ id: `faq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, question: '', answer: '' });

export default function OnboardingFlow({
  isOpen,
  initialStep = 'signup',
  existingUser = null,
  onClose,
  onOpenLogin,
  onComplete
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>(existingUser ? 'business' : initialStep);
  const [authed, setAuthed] = useState(Boolean(existingUser));
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Step 0: Signup fields
  const [name, setName] = useState(existingUser?.name || '');
  const [workEmail, setWorkEmail] = useState(existingUser?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Step 1: Business fields
  const [businessName, setBusinessName] = useState('');
  const [website, setWebsite] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [whatYouSell, setWhatYouSell] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessHours, setBusinessHours] = useState('');
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillNote, setAutoFillNote] = useState<string | null>(null);
  const [autoFillStage, setAutoFillStage] = useState<string>('');
  const [handoffEmail, setHandoffEmail] = useState('');
  /** What the AI learned (voice, vocabulary…) — carried into the final setup call. */
  const [learned, setLearned] = useState<BusinessDraft | null>(null);
  const [companyDocuments, setCompanyDocuments] = useState<CompanyDocumentMeta[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Channels the business plans to use (accounts are connected in the app via OAuth)
  const [connectedChannels, setConnectedChannels] = useState<Record<ChannelKey, boolean>>({
    whatsapp: true,
    instagram: false,
    facebook: false,
    email: false
  });

  // Step 3: AI Basics fields
  const [botName, setBotName] = useState('Ava');
  const [aiTone, setAiTone] = useState<Tone>('Friendly');
  const [faqs, setFaqs] = useState([newFaq(), newFaq(), newFaq()]);
  const [handoffRules, setHandoffRules] = useState({
    customerAsksPerson: true,
    aiNotSure: true,
    dealValueAbove: false,
    dealValueThreshold: ''
  });

  // Resume: hydrate saved progress + already-uploaded documents once the user is signed in.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!isOpen || !authed || hydrated.current) return;
    hydrated.current = true;
    void listCompanyDocuments().then(setCompanyDocuments).catch(() => undefined);
    void getOnboardingDraft<Record<string, any>>()
      .then((d) => {
        if (!d) return;
        if (d.businessName) setBusinessName(d.businessName);
        if (d.website) setWebsite(d.website);
        if (d.industry) setIndustry(d.industry);
        if (d.location) setLocation(d.location);
        if (d.whatYouSell) setWhatYouSell(d.whatYouSell);
        if (d.businessPhone) setBusinessPhone(d.businessPhone);
        if (d.businessAddress) setBusinessAddress(d.businessAddress);
        if (d.businessHours) setBusinessHours(d.businessHours);
        if (d.botName) setBotName(d.botName);
        if (d.aiTone) setAiTone(d.aiTone);
        if (d.connectedChannels) setConnectedChannels(d.connectedChannels);
        if (Array.isArray(d.faqs) && d.faqs.length) setFaqs(d.faqs);
        if (d.handoffRules) setHandoffRules(d.handoffRules);
        if (d.learned) setLearned(d.learned);
        if (d.handoffEmail) setHandoffEmail(d.handoffEmail);
        if (d.step && d.step !== 'signup') setCurrentStep(d.step);
      })
      .catch(() => undefined);
  }, [isOpen, authed]);

  if (!isOpen) return null;

  const persistDraft = (step: Step) => {
    if (!authed) return;
    void saveOnboardingDraft({
      step, businessName, website, industry, location, whatYouSell, businessPhone, businessAddress,
      businessHours, botName, aiTone, connectedChannels, faqs, handoffRules, learned, handoffEmail,
    });
  };

  const goTo = (step: Step) => {
    setStepError(null);
    persistDraft(step);
    setCurrentStep(step);
  };

  // Handle Signup Submission — creates the real account (and its own workspace)
  const handleSignupSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSignupError(null);

    if (!workEmail.trim()) {
      setSignupError('Please provide your work email.');
      return;
    }
    if (password.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      await register(workEmail.trim(), password, name.trim() || undefined);
      setAuthed(true);
      setPassword('');
      setCurrentStep('business');
    } catch (err) {
      setSignupError(err instanceof Error ? err.message : 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  };

  // Learn the business from its website (and any uploaded documents)
  const handleFillFromWebsite = async () => {
    if (!website.trim()) {
      setStepError('Enter your website address first.');
      return;
    }
    setStepError(null);
    setAutoFillNote(null);
    setAutoFillStage(ANALYZE_STAGE_LABEL.queued);
    setIsAutoFilling(true);
    try {
      const { draft, sources } = await analyzeBusiness(website.trim(), (stage, detail) => {
        setAutoFillStage(
          stage === 'reading' && detail?.pages
            ? `Reading ${detail.pages} page${detail.pages === 1 ? '' : 's'}${detail.rendered ? ' (rendered)' : ''}…`
            : ANALYZE_STAGE_LABEL[stage]
        );
      });
      setLearned(draft);
      if (draft.companyName) setBusinessName(draft.companyName);
      if (draft.industry) setIndustry(draft.industry);
      if (draft.location) setLocation(draft.location);
      if (draft.whatYouSell) setWhatYouSell(draft.whatYouSell);
      if (draft.businessPhone) setBusinessPhone(draft.businessPhone);
      if (draft.businessAddress) setBusinessAddress(draft.businessAddress);
      if (draft.businessHours) setBusinessHours(draft.businessHours);
      if (draft.faqs?.length) {
        setFaqs((prev) => {
          const filled = prev.filter((f) => f.question.trim() && f.answer.trim());
          return [...filled, ...draft.faqs!.map((f) => ({ ...f, id: `${f.id}-${Date.now()}` }))];
        });
      }
      setAutoFillNote(
        `Read ${sources.pages.length} page${sources.pages.length === 1 ? '' : 's'} from your site` +
          `${draft.faqs?.length ? ` and drafted ${draft.faqs.length} FAQs` : ''}. Review everything — anything the site didn't say was left blank.`
      );
      void listCompanyDocuments().then(setCompanyDocuments).catch(() => undefined);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not read that website.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleFileUpload = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    setStepError(null);
    setIsUploading(true);
    try {
      const results = await uploadCompanyFiles(list);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) setStepError(failed.map((f) => `${f.fileName}: ${f.error}`).join(' · '));
      setCompanyDocuments(await listCompanyDocuments());
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteCompanyDocument(id);
      setCompanyDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not remove the document.');
    }
  };

  const formatSize = (chars: number) => `${Math.max(1, Math.round(chars / 1000))}k chars`;

  const handleBusinessContinue = () => {
    if (!businessName.trim()) {
      setStepError('Business name is required.');
      return;
    }
    goTo('channels');
  };

  // Toggle Channel
  const toggleChannel = (channel: ChannelKey) => {
    setConnectedChannels(prev => ({
      ...prev,
      [channel]: !prev[channel]
    }));
  };

  // Add FAQ
  const handleAddFaq = () => {
    setFaqs(prev => [...prev, newFaq()]);
  };

  // Remove FAQ
  const handleRemoveFaq = (id: string) => {
    if (faqs.length <= 1) return;
    setFaqs(prev => prev.filter(f => f.id !== id));
  };

  // Update FAQ
  const handleUpdateFaq = (id: string, field: 'question' | 'answer', val: string) => {
    setFaqs(prev => prev.map(f => f.id === id ? { ...f, [field]: val } : f));
  };

  // Finish Setup — saves everything to the server (the workspace's knowledge base)
  const handleFinish = async () => {
    setStepError(null);
    if (!businessName.trim()) {
      setStepError('Business name is required — go back to step 1.');
      return;
    }
    if (!botName.trim()) {
      setStepError('Give your assistant a name.');
      return;
    }
    const preset = TONE_PRESETS[aiTone];
    setBusy(true);
    try {
      await completeCompanySetup({
        companyName: businessName.trim(),
        botName: botName.trim(),
        industry,
        location,
        productsFocus: whatYouSell,
        websiteUrl: website,
        businessPhone,
        businessAddress,
        businessHours,
        handoffEmail: handoffEmail.trim(),
        tagline: learned?.tagline,
        audience: learned?.audience,
        vocabulary: learned?.vocabulary,
        avoid: learned?.avoid,
        voiceTone: learned?.voiceTone ? `${preset.voiceTone} ${learned.voiceTone}` : preset.voiceTone,
        writingStyle: learned?.writingStyle || preset.writingStyle,
        faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
        handoffRules,
        plannedChannels: connectedChannels,
      });
      onComplete({ businessName: businessName.trim() });
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Could not finish setup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Container matching ASCII Wireframe aesthetic */}
      <div className="relative w-full max-w-xl bg-[#071C1A] border border-[rgba(169,191,165,0.35)] shadow-2xl rounded-[3px] text-[#E8E9D8] font-mono p-6 sm:p-8 my-8">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#A9BFA5]/60 hover:text-[#E8E9D8] p-1.5 transition-colors cursor-pointer"
          aria-label={existingUser ? 'Sign out' : 'Close'}
          title={existingUser ? 'Sign out' : 'Close'}
        >
          <X className="w-5 h-5" strokeWidth={1.5} />
        </button>

        {/* ------------------------------------------------------------- */}
        {/* STEP 0: SIGN UP SCREEN (Image 1 Wireframe) */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 'signup' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Header: TECAVY / Never miss another lead. / Create your free workspace */}
            <div className="text-center space-y-1.5 pt-2 pb-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-widest text-[#E8E9D8] uppercase">
                TECAVY
              </h1>
              <p className="text-sm text-[#A9BFA5] font-light">
                Never miss another lead.
              </p>
              <p className="text-xs uppercase tracking-wider text-[#A9BFA5]/80 font-medium">
                Create your free workspace
              </p>
            </div>

            {signupError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-[2px]">
                {signupError}
              </div>
            )}

            {/* Signup Form */}
            <form onSubmit={handleSignupSubmit} className="space-y-3.5 text-xs">
              {/* Name */}
              <div className="flex items-center space-x-3">
                <label className="w-24 text-[#A9BFA5] uppercase tracking-wider text-[11px] shrink-0">
                  Name
                </label>
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                </div>
              </div>

              {/* Work email */}
              <div className="flex items-center space-x-3">
                <label className="w-24 text-[#A9BFA5] uppercase tracking-wider text-[11px] shrink-0">
                  Work email
                </label>
                <div className="flex-1">
                  <input
                    type="email"
                    required
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="you@acme.com"
                    className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex items-center space-x-3">
                <label className="w-24 text-[#A9BFA5] uppercase tracking-wider text-[11px] shrink-0">
                  Password
                </label>
                <div className="flex-1 relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-3 pr-9 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] placeholder-[#A9BFA5]/40 text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2 text-[#A9BFA5]/70 hover:text-[#E8E9D8] transition-colors cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Helper text */}
              <div className="text-center text-[10px] text-[#A9BFA5]/60 pt-0.5">
                8+ characters
              </div>

              {/* Submit: [ Create account ] */}
              <button
                type="submit"
                id="signup-create-account-btn"
                disabled={busy}
                className="w-full py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white disabled:opacity-60 disabled:cursor-wait font-bold uppercase tracking-widest text-xs rounded-[2px] transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2"
              >
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{busy ? 'Creating account…' : 'Create account'}</span>
              </button>
            </form>

            {/* Divider: —————————— or —————————— */}
            <div className="relative flex items-center justify-center py-1">
              <div className="w-full border-t border-[rgba(169,191,165,0.2)]" />
              <span className="absolute bg-[#071C1A] px-3 text-[11px] uppercase tracking-widest text-[#A9BFA5]/60">
                or
              </span>
            </div>

            {/* [ G Continue with Google ] */}
            <button
              type="button"
              disabled
              title="Google sign-in is not available yet"
              className="w-full py-2.5 px-3 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-xs text-[#E8E9D8] flex items-center justify-center space-x-3 opacity-50 cursor-not-allowed"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="font-medium">Continue with Google (coming soon)</span>
            </button>

            {/* Footnote Terms & Login */}
            <div className="text-center space-y-1.5 pt-2 text-[11px] text-[#A9BFA5]/80">
              <p>By continuing you agree to Terms and Privacy.</p>
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLogin();
                  }}
                  className="text-white hover:text-emerald-300 underline font-medium cursor-pointer"
                >
                  Log in
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: BUSINESS (Image 2 Wireframe) */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 'business' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Step Indicator Header */}
            <div className="flex items-center justify-between text-xs tracking-wider pb-3 border-b border-[rgba(169,191,165,0.2)] text-[#A9BFA5]">
              <div className="flex items-center space-x-2">
                <span className="text-[#E8E9D8] font-bold">● Business</span>
                <span className="opacity-40">————</span>
                <span className="opacity-60">○ Channels</span>
                <span className="opacity-40">————</span>
                <span className="opacity-60">○ AI basics</span>
              </div>
              <span className="text-[10px] text-[#A9BFA5]/60 uppercase">Step 1 of 3</span>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-xs uppercase tracking-widest text-[#A9BFA5] font-semibold mb-1">
                STEP 1 — Tell us about your business
              </h2>
              <p className="text-xs text-[#A9BFA5]/80 font-light">
                Tecavy uses this to autonomously converse, qualify customer intent, and draft quotes.
              </p>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              {/* Business Name */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  Business name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your business name"
                  className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                />
              </div>

              {/* Website + [✦ Fill from website] */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  Website
                </label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="acme.com"
                      className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFillFromWebsite}
                    disabled={isAutoFilling}
                    className="px-3 py-2 bg-[#0D2D2A] hover:bg-[#123E3A] border border-[#A9BFA5]/40 text-emerald-300 text-xs rounded-[2px] transition-colors cursor-pointer shrink-0 flex items-center space-x-1.5"
                  >
                    {isAutoFilling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{autoFillStage || 'Reading your site…'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>✦ Fill from website</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Industry & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                    Industry
                  </label>
                  <div className="relative">
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs appearance-none focus:outline-none focus:border-[#A9BFA5] transition-colors cursor-pointer"
                    >
                      <option value="">Select…</option>
                      {industry && !BASE_INDUSTRIES.includes(industry) && (
                        <option value={industry}>{industry}</option>
                      )}
                      {BASE_INDUSTRIES.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-[#A9BFA5]/70 absolute right-3 top-2.5 pointer-events-none" />
                  </div>

                  {/* Division in which documents can be uploaded regarding the company */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] font-medium">
                        Company Documents
                      </label>
                      <span className="text-[10px] text-[#A9BFA5]/60 font-mono">
                        {companyDocuments.length} uploaded
                      </span>
                    </div>

                    {/* Upload zone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        void handleFileUpload(e.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border border-dashed p-3 rounded-[3px] text-center cursor-pointer transition-all duration-150 ${
                        isDragging
                          ? 'border-emerald-400 bg-[#0D2D2A]/60'
                          : 'border-[rgba(169,191,165,0.35)] hover:border-[#A9BFA5] bg-[#051513] hover:bg-[#081F1C]'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={ACCEPTED_FILES}
                        className="hidden"
                        onChange={(e) => {
                          void handleFileUpload(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <div className="flex items-center justify-center space-x-2 text-[#A9BFA5]">
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                          <UploadCloud className="w-4 h-4 text-emerald-400" />
                        )}
                        <span className="text-xs text-[#E8E9D8] font-medium">
                          {isUploading ? 'Reading your documents…' : 'Upload company documents'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A9BFA5]/70 mt-1 leading-snug">
                        PDF, DOCX, TXT, MD, CSV, JSON, HTML or photos of scanned pages — price lists, brochures, FAQs (up to 10MB each)
                      </p>
                    </div>

                    {/* List of uploaded documents */}
                    {companyDocuments.length > 0 && (
                      <div className="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-0.5">
                        {companyDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between px-2.5 py-1.5 bg-[#061816] border border-[rgba(169,191,165,0.2)] rounded-[2px] text-[11px]"
                          >
                            <div className="flex items-center space-x-2 truncate min-w-0">
                              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-[#E8E9D8] truncate font-mono">
                                {doc.title}
                              </span>
                              <span className="text-[10px] text-[#A9BFA5]/60 shrink-0">
                                {formatSize(doc.charCount)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveDoc(doc.id, e)}
                              className="text-[#A9BFA5]/60 hover:text-rose-400 ml-2 p-0.5 transition-colors cursor-pointer shrink-0"
                              title="Remove document"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Pune"
                    className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                  />
                </div>
              </div>

              {/* What you sell */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  What you sell
                </label>
                <textarea
                  rows={3}
                  value={whatYouSell}
                  onChange={(e) => setWhatYouSell(e.target.value)}
                  placeholder="Residential and office interiors, bespoke architectural fit-outs..."
                  className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors resize-none"
                />
              </div>
            </div>

            {/* How customers reach you — answers to "where are you / when are you open" */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">Phone</label>
                <input
                  type="text"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="+91 …"
                  className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">Opening hours</label>
                <input
                  type="text"
                  value={businessHours}
                  onChange={(e) => setBusinessHours(e.target.value)}
                  placeholder="Mon–Sat, 9am–7pm"
                  className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">Address</label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="Street, area, city"
                  className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                />
              </div>
            </div>

            {autoFillNote && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs rounded-[2px]">
                {autoFillNote}
              </div>
            )}
            {stepError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-[2px]" role="alert">
                {stepError}
              </div>
            )}

            {/* Actions: [Continue →] */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[rgba(169,191,165,0.2)]">
              <button
                type="button"
                disabled={isAutoFilling || isUploading}
                onClick={handleBusinessContinue}
                className="px-5 py-2 bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-bold text-xs uppercase tracking-wider rounded-[2px] transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: CHANNELS (Image 3 Wireframe) */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 'channels' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Step Indicator Header */}
            <div className="flex items-center justify-between text-xs tracking-wider pb-3 border-b border-[rgba(169,191,165,0.2)] text-[#A9BFA5]">
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-medium">✓ Business</span>
                <span className="opacity-40">————</span>
                <span className="text-[#E8E9D8] font-bold">● Channels</span>
                <span className="opacity-40">————</span>
                <span className="opacity-60">○ AI basics</span>
              </div>
              <span className="text-[10px] text-[#A9BFA5]/60 uppercase">Step 2 of 3</span>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-xs uppercase tracking-widest text-[#A9BFA5] font-semibold mb-1">
                STEP 2 — CHANNELS
              </h2>
              <p className="text-xs text-[#E8E9D8] font-medium">
                Where do your customers reach you?
              </p>
              <p className="text-[11px] text-[#A9BFA5]/80 font-light mt-1">
                Pick what you plan to use. You'll securely connect each account from Channels once setup is done.
              </p>
            </div>

            {/* Channels Grid matching wireframe cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WhatsApp (Recommended) */}
              <div className={`p-3.5 rounded-[2px] border transition-all flex flex-col justify-between ${
                connectedChannels.whatsapp 
                  ? 'bg-[#0D2D2A]/80 border-emerald-400/50 text-white' 
                  : 'bg-[#051513] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    <span className="font-semibold text-xs">WhatsApp</span>
                  </div>
                  <span className="text-[10px] text-emerald-300/90 font-light block mb-3">
                    Recommended · Instant Sync
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleChannel('whatsapp')}
                  className={`w-full py-1.5 px-2 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer text-center ${
                    connectedChannels.whatsapp
                      ? 'bg-emerald-400 text-[#071C1A]'
                      : 'bg-[#0D2D2A] text-[#E8E9D8] hover:bg-[#123E3A]'
                  }`}
                >
                  {connectedChannels.whatsapp ? 'Selected ✓' : '[Select]'}
                </button>
              </div>

              {/* Instagram */}
              <div className={`p-3.5 rounded-[2px] border transition-all flex flex-col justify-between ${
                connectedChannels.instagram 
                  ? 'bg-[#0D2D2A]/80 border-purple-400/50 text-white' 
                  : 'bg-[#051513] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
                    <span className="font-semibold text-xs">Instagram</span>
                  </div>
                  <span className="text-[10px] text-[#A9BFA5]/60 font-light block mb-3">
                    DMs & Comments
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleChannel('instagram')}
                  className={`w-full py-1.5 px-2 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer text-center ${
                    connectedChannels.instagram
                      ? 'bg-purple-300 text-[#071C1A]'
                      : 'bg-[#0D2D2A] text-[#E8E9D8] hover:bg-[#123E3A]'
                  }`}
                >
                  {connectedChannels.instagram ? 'Selected ✓' : '[Select]'}
                </button>
              </div>

              {/* Facebook */}
              <div className={`p-3.5 rounded-[2px] border transition-all flex flex-col justify-between ${
                connectedChannels.facebook 
                  ? 'bg-[#0D2D2A]/80 border-blue-400/50 text-white' 
                  : 'bg-[#051513] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />
                    <span className="font-semibold text-xs">Facebook</span>
                  </div>
                  <span className="text-[10px] text-[#A9BFA5]/60 font-light block mb-3">
                    Messenger & Ads
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleChannel('facebook')}
                  className={`w-full py-1.5 px-2 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer text-center ${
                    connectedChannels.facebook
                      ? 'bg-blue-300 text-[#071C1A]'
                      : 'bg-[#0D2D2A] text-[#E8E9D8] hover:bg-[#123E3A]'
                  }`}
                >
                  {connectedChannels.facebook ? 'Selected ✓' : '[Select]'}
                </button>
              </div>

              {/* Email */}
              <div className={`p-3.5 rounded-[2px] border transition-all flex flex-col justify-between ${
                connectedChannels.email 
                  ? 'bg-[#0D2D2A]/80 border-emerald-400/50 text-white' 
                  : 'bg-[#051513] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
              }`}>
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <Mail className="w-3.5 h-3.5 text-[#A9BFA5]" />
                    <span className="font-semibold text-xs">Email</span>
                  </div>
                  <span className="text-[10px] text-[#A9BFA5]/60 font-light block mb-3">
                    Inbound & Auto-replies
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggleChannel('email')}
                  className={`w-full py-1.5 px-2 text-xs font-semibold rounded-[2px] transition-colors cursor-pointer text-center ${
                    connectedChannels.email
                      ? 'bg-emerald-400 text-[#071C1A]'
                      : 'bg-[#0D2D2A] text-[#E8E9D8] hover:bg-[#123E3A]'
                  }`}
                >
                  {connectedChannels.email ? 'Selected ✓' : '[Select]'}
                </button>
              </div>
            </div>

            {/* Actions: ← Back on left | [Skip for now] [Continue →] on right */}
            <div className="flex items-center justify-between pt-4 border-t border-[rgba(169,191,165,0.2)]">
              <button
                type="button"
                onClick={() => goTo('business')}
                className="inline-flex items-center space-x-1 text-xs text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => goTo('ai-basics')}
                  className="px-3 py-2 text-xs text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer"
                >
                  [Skip for now]
                </button>
                <button
                  type="button"
                  onClick={() => goTo('ai-basics')}
                  className="px-5 py-2 bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-bold text-xs uppercase tracking-wider rounded-[2px] transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: AI BASICS (Image 4 Wireframe) */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 'ai-basics' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Step Indicator Header */}
            <div className="flex items-center justify-between text-xs tracking-wider pb-3 border-b border-[rgba(169,191,165,0.2)] text-[#A9BFA5]">
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-medium">✓ Business</span>
                <span className="opacity-40">————</span>
                <span className="text-emerald-400 font-medium">✓ Channels</span>
                <span className="opacity-40">————</span>
                <span className="text-[#E8E9D8] font-bold">● AI basics</span>
              </div>
              <span className="text-[10px] text-[#A9BFA5]/60 uppercase">Step 3 of 3</span>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-xs uppercase tracking-widest text-[#A9BFA5] font-semibold mb-1">
                STEP 3 — AI BASICS
              </h2>
              <p className="text-xs text-[#E8E9D8] font-medium">
                How should the AI talk to customers?
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Assistant name — customers see this in every conversation */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                  Assistant name
                </label>
                <input
                  type="text"
                  value={botName}
                  maxLength={40}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Ava"
                  className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                />
                {learned?.voiceTone && (
                  <p className="mt-1.5 text-[10px] text-emerald-300/80 leading-snug">
                    Your site's own voice was learned and will be blended with the tone you pick below.
                  </p>
                )}
              </div>

              {/* Tone Selection: [Professional] [Friendly ✓] [Premium] [Conversational] */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-2">
                  Tone
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['Professional', 'Friendly', 'Premium', 'Conversational'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAiTone(t)}
                      className={`px-3.5 py-1.5 rounded-[2px] text-xs border font-mono transition-colors cursor-pointer ${
                        aiTone === t
                          ? 'bg-[#E8E9D8] text-[#071C1A] border-[#E8E9D8] font-bold'
                          : 'bg-[#051513] text-[#A9BFA5] border-[rgba(169,191,165,0.3)] hover:text-[#E8E9D8]'
                      }`}
                    >
                      {t} {aiTone === t ? '✓' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Top questions customers ask (add 3) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5]">
                    Top questions customers ask — the assistant answers these exactly
                  </label>
                  <button
                    type="button"
                    onClick={handleAddFaq}
                    className="text-[11px] text-emerald-300 hover:text-white flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>[+ Add question]</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {faqs.map((faq, idx) => (
                    <div key={faq.id} className="p-2.5 bg-[#051513] border border-[rgba(169,191,165,0.25)] rounded-[2px] space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-[#A9BFA5] font-bold text-[11px] shrink-0">Q</span>
                        <input
                          type="text"
                          value={faq.question}
                          onChange={(e) => handleUpdateFaq(faq.id, 'question', e.target.value)}
                          placeholder="e.g. What are your prices?"
                          className="w-full px-2.5 py-1 bg-[#071C1A] border border-[rgba(169,191,165,0.2)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5]"
                        />
                        {faqs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFaq(faq.id)}
                            className="text-[#A9BFA5]/60 hover:text-rose-400 p-1 cursor-pointer"
                            aria-label="Remove question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[#A9BFA5] font-bold text-[11px] shrink-0">A</span>
                        <input
                          type="text"
                          value={faq.answer}
                          onChange={(e) => handleUpdateFaq(faq.id, 'answer', e.target.value)}
                          placeholder="e.g. Starts at ₹..."
                          className="w-full px-2.5 py-1 bg-[#071C1A] border border-[rgba(169,191,165,0.2)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hand to a human when: */}
              <div className="pt-1">
                <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-2">
                  Hand to a human when:
                </label>
                <div className="space-y-2 font-mono text-xs">
                  <label className="flex items-center space-x-2 text-[#E8E9D8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handoffRules.customerAsksPerson}
                      onChange={(e) => setHandoffRules({ ...handoffRules, customerAsksPerson: e.target.checked })}
                      className="w-3.5 h-3.5 rounded-[2px] bg-[#051513] border-[rgba(169,191,165,0.3)] text-[#0D2D2A] accent-[#A9BFA5]"
                    />
                    <span>customer asks for a person</span>
                  </label>

                  <label className="flex items-center space-x-2 text-[#E8E9D8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={handoffRules.aiNotSure}
                      onChange={(e) => setHandoffRules({ ...handoffRules, aiNotSure: e.target.checked })}
                      className="w-3.5 h-3.5 rounded-[2px] bg-[#051513] border-[rgba(169,191,165,0.3)] text-[#0D2D2A] accent-[#A9BFA5]"
                    />
                    <span>AI isn't sure</span>
                  </label>

                  <div className="pt-1 font-sans">
                    <label className="block text-[11px] uppercase tracking-wider text-[#A9BFA5] mb-1">
                      Send handoffs to (email)
                    </label>
                    <input
                      type="email"
                      value={handoffEmail}
                      onChange={(e) => setHandoffEmail(e.target.value)}
                      placeholder="sales@yourbusiness.com"
                      className="w-full px-3 py-2 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-[#E8E9D8] text-xs focus:outline-none focus:border-[#A9BFA5] transition-colors"
                    />
                  </div>

                  <div className="flex items-center space-x-2 text-[#E8E9D8]">
                    <input
                      type="checkbox"
                      id="handoff-deal-value"
                      checked={handoffRules.dealValueAbove}
                      onChange={(e) => setHandoffRules({ ...handoffRules, dealValueAbove: e.target.checked })}
                      className="w-3.5 h-3.5 rounded-[2px] bg-[#051513] border-[rgba(169,191,165,0.3)] text-[#0D2D2A] accent-[#A9BFA5] cursor-pointer"
                    />
                    <label htmlFor="handoff-deal-value" className="cursor-pointer">
                      deal value above
                    </label>
                    <input
                      type="text"
                      value={handoffRules.dealValueThreshold}
                      onChange={(e) => setHandoffRules({ ...handoffRules, dealValueThreshold: e.target.value })}
                      className="w-24 px-2 py-0.5 bg-[#051513] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {stepError && (
              <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-[2px]" role="alert">
                {stepError}
              </div>
            )}

            {/* Actions: ← Back on left | [Finish setup ✓] on right */}
            <div className="flex items-center justify-between pt-4 border-t border-[rgba(169,191,165,0.2)]">
              <button
                type="button"
                onClick={() => goTo('channels')}
                className="inline-flex items-center space-x-1 text-xs text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                id="finish-setup-btn"
                disabled={busy}
                onClick={() => void handleFinish()}
                className="px-6 py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white disabled:opacity-60 disabled:cursor-wait font-bold text-xs uppercase tracking-wider rounded-[2px] transition-all cursor-pointer flex items-center space-x-2 shadow-md"
              >
                <span>{busy ? 'Saving…' : 'Finish setup'}</span>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[2.5]" />}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
