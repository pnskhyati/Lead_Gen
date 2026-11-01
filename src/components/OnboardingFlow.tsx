import React, { useState, useRef } from 'react';
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
import { UserSession } from './AuthModal';

export interface OnboardingData {
  name: string;
  email: string;
  password?: string;
  businessName: string;
  website: string;
  industry: string;
  location: string;
  whatYouSell: string;
  companyDocuments?: { id: string; name: string; size: string }[];
  connectedChannels: {
    whatsapp: boolean;
    instagram: boolean;
    facebook: boolean;
    webchat?: boolean;
    email: boolean;
  };
  aiTone: 'Professional' | 'Friendly' | 'Premium' | 'Conversational';
  faqs: { id: string; question: string; answer: string }[];
  handoffRules: {
    customerAsksPerson: boolean;
    aiNotSure: boolean;
    dealValueAbove: boolean;
    dealValueThreshold: string;
  };
}

interface OnboardingFlowProps {
  isOpen: boolean;
  initialStep?: 'signup' | 'business' | 'channels' | 'ai-basics';
  onClose: () => void;
  onOpenLogin: () => void;
  onComplete: (data: OnboardingData) => void;
}

export default function OnboardingFlow({
  isOpen,
  initialStep = 'signup',
  onClose,
  onOpenLogin,
  onComplete
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<'signup' | 'business' | 'channels' | 'ai-basics'>(initialStep);

  // Step 0: Signup fields
  const [name, setName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Step 1: Business fields
  const [businessName, setBusinessName] = useState('Acme Studio');
  const [website, setWebsite] = useState('acme.com');
  const [industry, setIndustry] = useState('Interior design');
  const [location, setLocation] = useState('Pune');
  const [whatYouSell, setWhatYouSell] = useState('Residential and office interiors, bespoke styling, and fit-outs.');
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [companyDocuments, setCompanyDocuments] = useState<{ id: string; name: string; size: string }[]>([
    { id: 'doc-1', name: 'Acme_Company_Profile.pdf', size: '1.2 MB' },
    { id: 'doc-2', name: 'Pricing_and_Services_2024.pdf', size: '850 KB' }
  ]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newDocs = Array.from(files).map((f, i) => ({
      id: `doc-${Date.now()}-${i}`,
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`
    }));
    setCompanyDocuments(prev => [...prev, ...newDocs]);
  };

  const handleRemoveDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompanyDocuments(prev => prev.filter(d => d.id !== id));
  };

  // Step 2: Channels fields
  const [connectedChannels, setConnectedChannels] = useState({
    whatsapp: true, // Recommended pre-activated or easily toggleable
    instagram: false,
    facebook: false,
    email: false
  });

  // Step 3: AI Basics fields
  const [aiTone, setAiTone] = useState<'Professional' | 'Friendly' | 'Premium' | 'Conversational'>('Friendly');
  const [faqs, setFaqs] = useState([
    { id: '1', question: 'What are your prices?', answer: 'Starts at ₹2.5L for residential projects, customized per square foot.' },
    { id: '2', question: 'Do you work outside Pune?', answer: 'Yes, across Mumbai, Pune, and Bangalore.' },
    { id: '3', question: 'What is the project turnaround time?', answer: 'Design mockups take 2 weeks; turnkey execution is typically 6-8 weeks.' }
  ]);
  const [handoffRules, setHandoffRules] = useState({
    customerAsksPerson: true,
    aiNotSure: true,
    dealValueAbove: false,
    dealValueThreshold: '₹50,000'
  });

  if (!isOpen) return null;

  // Handle Signup Submission
  const handleSignupSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSignupError(null);

    if (!workEmail.trim()) {
      setSignupError('Please provide your work email.');
      return;
    }
    if (password && password.length < 8) {
      setSignupError('Password must be at least 8 characters.');
      return;
    }

    // Default business name if empty
    if (!name.trim()) setName('Aryan Mehta');
    setCurrentStep('business');
  };

  // Google Continue
  const handleGoogleSignup = () => {
    setName('Alex Rivera');
    setWorkEmail('alex.workspace@gmail.com');
    setCurrentStep('business');
  };

  // Magic Website Autofill
  const handleFillFromWebsite = () => {
    setIsAutoFilling(true);
    setTimeout(() => {
      setIsAutoFilling(false);
      setBusinessName('Acme Studio');
      setIndustry('Interior design');
      setLocation('Pune');
      setWhatYouSell('High-end residential transformations, minimalist commercial studio spaces, and custom modular finishes.');
    }, 800);
  };

  // Toggle Channel
  const toggleChannel = (channel: keyof typeof connectedChannels) => {
    setConnectedChannels(prev => ({
      ...prev,
      [channel]: !prev[channel]
    }));
  };

  // Add FAQ
  const handleAddFaq = () => {
    const newId = String(Date.now());
    setFaqs(prev => [
      ...prev,
      { id: newId, question: '', answer: '' }
    ]);
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

  // Finish Setup
  const handleFinish = () => {
    const finalData: OnboardingData = {
      name: name || 'Aryan Mehta',
      email: workEmail || 'you@acme.com',
      password,
      businessName: businessName || 'Acme Studio',
      website: website || 'acme.com',
      industry,
      location,
      whatYouSell,
      companyDocuments,
      connectedChannels,
      aiTone,
      faqs,
      handoffRules
    };
    onComplete(finalData);
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
          aria-label="Close"
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
                    placeholder="Aryan Mehta"
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
                className="w-full py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-bold uppercase tracking-widest text-xs rounded-[2px] transition-all cursor-pointer shadow-md"
              >
                Create account
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
              onClick={handleGoogleSignup}
              className="w-full py-2.5 px-3 bg-[#051513] hover:bg-[#0D2D2A] border border-[rgba(169,191,165,0.3)] rounded-[2px] text-xs text-[#E8E9D8] flex items-center justify-center space-x-3 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="font-medium">Continue with Google</span>
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
                  placeholder="Acme Studio"
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
                        <span>Extracting...</span>
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
                      <option value="Interior design">Interior design</option>
                      <option value="Real estate">Real estate & Architecture</option>
                      <option value="Professional services">Professional services</option>
                      <option value="Agency & Consulting">Agency & Consulting</option>
                      <option value="Healthcare & Wellness">Healthcare & Clinic</option>
                      <option value="Technology & SaaS">Technology & SaaS</option>
                      <option value="E-commerce & Retail">E-commerce & Retail</option>
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
                        handleFileUpload(e.dataTransfer.files);
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
                        accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                      <div className="flex items-center justify-center space-x-2 text-[#A9BFA5]">
                        <UploadCloud className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-[#E8E9D8] font-medium">
                          Upload company documents
                        </span>
                      </div>
                      <p className="text-[10px] text-[#A9BFA5]/70 mt-1 leading-snug">
                        PDF, DOCX, CSV, or brochures (up to 10MB)
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
                                {doc.name}
                              </span>
                              <span className="text-[10px] text-[#A9BFA5]/60 shrink-0">
                                {doc.size}
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

            {/* Actions: [Skip for now] [Continue →] */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[rgba(169,191,165,0.2)]">
              <button
                type="button"
                onClick={() => setCurrentStep('channels')}
                className="px-4 py-2 text-xs text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer"
              >
                [Skip for now]
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep('channels')}
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
                  {connectedChannels.whatsapp ? 'Connected ✓' : '[Connect]'}
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
                  {connectedChannels.instagram ? 'Connected ✓' : '[Connect]'}
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
                  {connectedChannels.facebook ? 'Connected ✓' : '[Connect]'}
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
                  {connectedChannels.email ? 'Connected ✓' : '[Connect]'}
                </button>
              </div>
            </div>

            {/* Actions: ← Back on left | [Skip for now] [Continue →] on right */}
            <div className="flex items-center justify-between pt-4 border-t border-[rgba(169,191,165,0.2)]">
              <button
                type="button"
                onClick={() => setCurrentStep('business')}
                className="inline-flex items-center space-x-1 text-xs text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('ai-basics')}
                  className="px-3 py-2 text-xs text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer"
                >
                  [Skip for now]
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('ai-basics')}
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
                    Top questions customers ask (add 3)
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

            {/* Actions: ← Back on left | [Finish setup ✓] on right */}
            <div className="flex items-center justify-between pt-4 border-t border-[rgba(169,191,165,0.2)]">
              <button
                type="button"
                onClick={() => setCurrentStep('channels')}
                className="inline-flex items-center space-x-1 text-xs text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                type="button"
                id="finish-setup-btn"
                onClick={handleFinish}
                className="px-6 py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-bold text-xs uppercase tracking-wider rounded-[2px] transition-all cursor-pointer flex items-center space-x-2 shadow-md"
              >
                <span>Finish setup</span>
                <Check className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
