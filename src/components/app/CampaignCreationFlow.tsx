import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Sparkles, 
  Check, 
  Plus, 
  X, 
  Calendar, 
  DollarSign, 
  Globe, 
  Users, 
  Compass, 
  Wand2, 
  Target 
} from 'lucide-react';
import { Campaign, CampaignBlueprint } from '../../types';
import { CampaignFormData, generateBlueprintFromForm } from '../../data/campaignBlueprintGenerator';
import { generateCampaignPlan } from '../../legacy/services/geminiService';
import { blueprintFromLivePlan, buildCampaignBrief } from './liveCampaignUtils';

interface CampaignCreationFlowProps {
  onBack: () => void;
  onBlueprintGenerated: (campaign: Campaign, blueprint: CampaignBlueprint) => void;
  /** Prefill from company profile when available */
  initialFormPatch?: Partial<CampaignFormData>;
  companyName?: string;
}

const CAMPAIGN_TYPES = [
  'Product Launch',
  'Brand Awareness',
  'Lead Generation',
  'Product Promotion',
  'Event',
  'Social Media Campaign',
  'Content Campaign',
  'Custom'
];

const PRIMARY_GOALS = [
  'Generate Leads',
  'Increase Sales',
  'Increase Brand Awareness',
  'Drive Website Traffic',
  'Increase Engagement',
  'Launch a Product',
  'Grow Audience',
  'Other'
];

const AVAILABLE_RESOURCES = [
  'Existing social media accounts',
  'Website',
  'Email list',
  'Design assets',
  'Video assets',
  'Existing content',
  'Sales team',
  'Marketing team'
];

const CHANNELS = [
  'Instagram',
  'LinkedIn',
  'Facebook',
  'X',
  'Email',
  'Website',
  'Google Ads',
  'Other'
];

const BRAND_VOICES = [
  'Professional',
  'Friendly',
  'Bold',
  'Premium',
  'Playful',
  'Minimal',
  'Inspirational',
  'Custom'
];

const VISUAL_STYLES = [
  'Minimal',
  'Modern',
  'Bold',
  'Corporate',
  'Editorial',
  'Creative',
  'Custom'
];

const LOADING_STEPS = [
  'Nexora is analyzing your campaign...',
  'Understanding your audience...',
  'Planning your channels...',
  'Building your roadmap...',
  'Creating your execution strategy...'
];

export default function CampaignCreationFlow({
  onBack,
  onBlueprintGenerated,
  initialFormPatch,
  companyName,
}: CampaignCreationFlowProps) {
  // Active Form Step (1 to 7)
  const [step, setStep] = useState<number>(1);

  // Loading generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState<number>(0);
  // Form State — company-aware defaults (no Acme / whisky demo copy)
  const [formData, setFormData] = useState<CampaignFormData>(() => ({
    name: initialFormPatch?.name || `${companyName || 'Brand'} lead growth`,
    type: initialFormPatch?.type || 'Lead Generation',
    description:
      initialFormPatch?.description ||
      `Drive qualified enquiries for ${companyName || 'our business'} via social and web.`,
    primaryGoal: initialFormPatch?.primaryGoal || 'Generate Leads',
    measurableGoals: initialFormPatch?.measurableGoals || [
      'Capture 20 qualified leads',
      'Book 8 consultations',
      'Grow channel engagement',
    ],
    ageRange: initialFormPatch?.ageRange || '25–55',
    location: initialFormPatch?.location || 'Local + nearby cities',
    industry: initialFormPatch?.industry || 'Services',
    interests: initialFormPatch?.interests || 'Quality, trust, convenience',
    occupation: initialFormPatch?.occupation || 'Local buyers & decision makers',
    audienceType: initialFormPatch?.audienceType || 'High-intent prospects',
    audienceDescription:
      initialFormPatch?.audienceDescription ||
      'People actively comparing options and ready to enquire.',
    budgetType: initialFormPatch?.budgetType || 'total',
    budgetAmount: initialFormPatch?.budgetAmount || '2,000',
    resources: initialFormPatch?.resources || [
      'Existing social media accounts',
      'Website',
      'Sales team',
    ],
    startDate: initialFormPatch?.startDate || new Date().toISOString().slice(0, 10),
    endDate:
      initialFormPatch?.endDate ||
      new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    milestones: initialFormPatch?.milestones || [
      'Kickoff content',
      'Mid-campaign review',
      'Conversion push',
    ],
    channels: initialFormPatch?.channels || ['Instagram', 'WhatsApp', 'Website'],
    autoRecommendChannels: initialFormPatch?.autoRecommendChannels ?? false,
    brandVoice: initialFormPatch?.brandVoice || 'Professional',
    visualStyle: initialFormPatch?.visualStyle || 'Minimal',
    additionalInstructions:
      initialFormPatch?.additionalInstructions ||
      'Stay on-brand. No invented pricing. Prefer booking / enquire CTAs.',
  }));

  // Inputs for multi-item list additions
  const [newGoalInput, setNewGoalInput] = useState('');
  const [newMilestoneInput, setNewMilestoneInput] = useState('');

  // Step names for progression
  const stepTitles = [
    'Basics',
    'Goals & Objectives',
    'Target Audience',
    'Budget & Resources',
    'Timeline',
    'Channels',
    'Brand & Creative'
  ];

  // Progress copy while Vertex builds the plan
  useEffect(() => {
    if (!isGenerating) return;
    if (loadingStepIndex >= LOADING_STEPS.length - 1) return;
    const timer = setTimeout(() => setLoadingStepIndex((prev) => prev + 1), 1200);
    return () => clearTimeout(timer);
  }, [isGenerating, loadingStepIndex]);

  const handleStartGeneration = () => {
    setIsGenerating(true);
    setLoadingStepIndex(0);

    const brief = buildCampaignBrief(formData, companyName);
    void (async () => {
      let blueprint: CampaignBlueprint;
      try {
        const plan = await generateCampaignPlan(brief);
        blueprint = blueprintFromLivePlan(formData, plan);
      } catch {
        // Offline / AI failure — still produce a structured local blueprint
        blueprint = generateBlueprintFromForm(formData);
      }

      const newCampaign: Campaign = {
        id: `camp-${Date.now()}`,
        name: blueprint.campaignName || formData.name || 'Campaign',
        objective: formData.primaryGoal || blueprint.overview.objective || 'Generate Leads',
        channel: (blueprint.overview.primaryChannels || formData.channels).join(', ') || 'Multichannel',
        status: 'Planning',
        impressions: '0',
        leads: 0,
        conversion: '0.0%',
        budget: formData.budgetType === 'none' ? 'Discretionary' : `$${formData.budgetAmount}`,
        startDate: formData.startDate || new Date().toISOString().slice(0, 10),
        endDate: formData.endDate || '',
        progress: 5,
        owner: 'You',
        blueprint,
      };
      setIsGenerating(false);
      onBlueprintGenerated(newCampaign, blueprint);
    })();
  };

  const addMeasurableGoal = () => {
    if (!newGoalInput.trim()) return;
    setFormData(prev => ({
      ...prev,
      measurableGoals: [...prev.measurableGoals, newGoalInput.trim()]
    }));
    setNewGoalInput('');
  };

  const removeMeasurableGoal = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      measurableGoals: prev.measurableGoals.filter((_, i) => i !== idx)
    }));
  };

  const addMilestone = () => {
    if (!newMilestoneInput.trim()) return;
    setFormData(prev => ({
      ...prev,
      milestones: [...prev.milestones, newMilestoneInput.trim()]
    }));
    setNewMilestoneInput('');
  };

  const removeMilestone = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== idx)
    }));
  };

  const toggleResource = (resource: string) => {
    setFormData(prev => {
      const exists = prev.resources.includes(resource);
      return {
        ...prev,
        resources: exists 
          ? prev.resources.filter(r => r !== resource)
          : [...prev.resources, resource]
      };
    });
  };

  const toggleChannel = (channel: string) => {
    setFormData(prev => {
      const exists = prev.channels.includes(channel);
      return {
        ...prev,
        channels: exists 
          ? prev.channels.filter(c => c !== channel)
          : [...prev.channels, channel]
      };
    });
  };

  /* =========================================================================
     LOADING STATE (CALM, REFINED, NOT OVERLY ANIMATED)
     ========================================================================= */
  if (isGenerating) {
    return (
      <div className="py-24 max-w-xl mx-auto text-center space-y-8 animate-fadeIn">
        <div className="w-12 h-12 mx-auto border border-[#A9BFA5] flex items-center justify-center bg-[#0D2D2A]/60">
          <Sparkles className="w-5 h-5 text-[#A9BFA5] animate-pulse" />
        </div>

        <div className="space-y-3">
          <span className="text-[10px] uppercase tracking-widest-plus text-[#A9BFA5] font-mono block">
            NEXORA CAMPAIGN STRATEGIST
          </span>

          <h2 className="serif text-2xl sm:text-3xl font-light text-[#E8E9D8] tracking-tight">
            {LOADING_STEPS[loadingStepIndex]}
          </h2>

          <p className="text-xs text-[#A9BFA5]/70 font-light max-w-sm mx-auto">
            Synthesizing multichannel roadmap, positioning angles, workstreams, and tactical content plans.
          </p>
        </div>

        {/* Minimal Progress Line */}
        <div className="w-48 h-0.5 mx-auto bg-[#061816] border border-[rgba(169,191,165,0.2)] overflow-hidden">
          <div 
            className="h-full bg-[#A9BFA5] transition-all duration-700" 
            style={{ width: `${((loadingStepIndex + 1) / LOADING_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 py-4 max-w-4xl mx-auto animate-fadeIn text-[#E8E9D8]">
      {/* Header */}
      <header className="border-b border-[rgba(169,191,165,0.2)] pb-8">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center space-x-2 text-xs uppercase tracking-widest text-[#A9BFA5]/70 hover:text-[#E8E9D8] transition-colors mb-4 cursor-pointer font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Campaigns</span>
        </button>

        <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-mono block mb-2">
          CAMPAIGN ARCHITECT // STEP {step} OF 7
        </span>

        <h1 className="serif text-3xl sm:text-4xl font-light text-[#E8E9D8] tracking-tight">
          Create a new campaign
        </h1>

        <p className="mt-2 text-xs sm:text-sm text-[#A9BFA5]/80 font-light leading-relaxed max-w-2xl">
          Tell Nexora what you're trying to achieve. We'll turn your idea into an actionable campaign blueprint.
        </p>

        {/* Step Progression Bar */}
        <div className="mt-8 flex items-center justify-between border-t border-[rgba(169,191,165,0.15)] pt-4 text-[10px] uppercase tracking-wider font-mono text-[#A9BFA5]/70 overflow-x-auto">
          {stepTitles.map((title, idx) => {
            const stepNum = idx + 1;
            const isCurrent = step === stepNum;
            const isCompleted = step > stepNum;
            return (
              <button
                key={stepNum}
                type="button"
                onClick={() => setStep(stepNum)}
                className={`flex items-center space-x-2 pb-1 border-b transition-colors cursor-pointer mr-4 whitespace-nowrap ${
                  isCurrent 
                    ? 'text-[#E8E9D8] border-[#A9BFA5] font-semibold' 
                    : isCompleted
                    ? 'text-[#A9BFA5] border-transparent hover:text-[#E8E9D8]'
                    : 'text-[#A9BFA5]/40 border-transparent hover:text-[#A9BFA5]/70'
                }`}
              >
                <span>0{stepNum}</span>
                <span>{title}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* =====================================================================
          STEP 1: CAMPAIGN BASICS
          ===================================================================== */}
      {step === 1 && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Step 1 — Campaign Basics
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Name and describe your campaign focus.
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            {/* Campaign Name */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Campaign Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Summer Product Launch"
                className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-4 py-3 text-sm text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/40 font-light"
              />
            </div>

            {/* Campaign Type */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Campaign Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CAMPAIGN_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    className={`px-3 py-2 text-xs border text-left transition-colors cursor-pointer ${
                      formData.type === t
                        ? 'border-[#A9BFA5] bg-[#0D2D2A] text-[#E8E9D8] font-medium'
                        : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8] hover:border-[rgba(169,191,165,0.4)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign Description */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Campaign Description
              </label>
              <textarea
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell us about your campaign, product, service, or idea..."
                className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] p-4 text-sm text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/40 font-light leading-relaxed resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2: GOALS & OBJECTIVES
          ===================================================================== */}
      {step === 2 && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Step 2 — Goals & Objectives
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Define primary milestones and concrete success metrics.
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            {/* Primary Goal */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                What is the primary goal?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIMARY_GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setFormData({ ...formData, primaryGoal: goal })}
                    className={`px-3 py-2 text-xs border text-left transition-colors cursor-pointer ${
                      formData.primaryGoal === goal
                        ? 'border-[#A9BFA5] bg-[#0D2D2A] text-[#E8E9D8] font-medium'
                        : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8] hover:border-[rgba(169,191,165,0.4)]'
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            {/* Measurable Goals */}
            <div className="space-y-3 pt-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                What does success look like? (Measurable goals)
              </label>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newGoalInput}
                  onChange={(e) => setNewGoalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMeasurableGoal()}
                  placeholder="e.g. Generate 500 leads, Reach 50,000 people"
                  className="flex-1 bg-[#061816] border border-[rgba(169,191,165,0.25)] px-4 py-2.5 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/40 font-light"
                />
                <button
                  type="button"
                  onClick={addMeasurableGoal}
                  className="px-4 py-2.5 bg-[#0D2D2A] border border-[rgba(169,191,165,0.3)] text-xs text-[#E8E9D8] hover:bg-[#E8E9D8] hover:text-[#071C1A] transition-colors cursor-pointer font-mono"
                >
                  + Add Goal
                </button>
              </div>

              {/* Goal Tags */}
              <div className="space-y-2 pt-2">
                {formData.measurableGoals.map((goal, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[#0D2D2A]/30 border border-[rgba(169,191,165,0.15)] text-xs text-[#E8E9D8]"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 bg-[#A9BFA5]" />
                      <span>{goal}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMeasurableGoal(idx)}
                      className="text-[#A9BFA5]/60 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 3: TARGET AUDIENCE
          ===================================================================== */}
      {step === 3 && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Step 3 — Target Audience
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Who are you trying to reach?
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  Age Range
                </label>
                <input
                  type="text"
                  value={formData.ageRange}
                  onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                  placeholder="e.g. 25–45"
                  className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-3 py-2 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. North America, Global"
                  className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-3 py-2 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="e.g. Technology & SaaS, Design"
                  className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-3 py-2 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  Interests
                </label>
                <input
                  type="text"
                  value={formData.interests}
                  onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                  placeholder="e.g. Productivity, AI, Minimalism"
                  className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-3 py-2 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  Occupation
                </label>
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  placeholder="e.g. Founders, Marketing Directors"
                  className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-3 py-2 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  Audience Type
                </label>
                <input
                  type="text"
                  value={formData.audienceType}
                  onChange={(e) => setFormData({ ...formData, audienceType: e.target.value })}
                  placeholder="e.g. B2B Decision Makers"
                  className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-3 py-2 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5]"
                />
              </div>
            </div>

            {/* Free-text description */}
            <div className="space-y-2 pt-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Describe your ideal audience
              </label>
              <textarea
                rows={4}
                value={formData.audienceDescription}
                onChange={(e) => setFormData({ ...formData, audienceDescription: e.target.value })}
                placeholder="e.g. Young professionals interested in productivity and AI tools..."
                className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] p-4 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/40 font-light resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 4: BUDGET & RESOURCES
          ===================================================================== */}
      {step === 4 && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Step 4 — Budget & Resources
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Select your resource allocation parameters.
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            {/* Campaign Budget */}
            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Campaign Budget
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'total', label: 'Total Budget' },
                  { id: 'daily', label: 'Daily Budget' },
                  { id: 'none', label: 'No Fixed Budget' }
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, budgetType: b.id as any })}
                    className={`py-2.5 px-3 text-xs border text-center transition-colors cursor-pointer ${
                      formData.budgetType === b.id
                        ? 'border-[#A9BFA5] bg-[#0D2D2A] text-[#E8E9D8] font-medium'
                        : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8]'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              {formData.budgetType !== 'none' && (
                <div className="relative pt-2">
                  <span className="absolute left-3.5 top-5 text-xs text-[#A9BFA5]/60 font-mono">$</span>
                  <input
                    type="text"
                    value={formData.budgetAmount}
                    onChange={(e) => setFormData({ ...formData, budgetAmount: e.target.value })}
                    placeholder="5,000"
                    className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] pl-8 pr-4 py-2.5 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] font-mono"
                  />
                </div>
              )}
            </div>

            {/* Available Resources */}
            <div className="space-y-3 pt-4">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Available Resources (Select all that apply)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {AVAILABLE_RESOURCES.map((res) => {
                  const isChecked = formData.resources.includes(res);
                  return (
                    <div
                      key={res}
                      onClick={() => toggleResource(res)}
                      className={`p-3 border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-[#A9BFA5] bg-[#0D2D2A]/60 text-[#E8E9D8]'
                          : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8]'
                      }`}
                    >
                      <span>{res}</span>
                      <div className={`w-4 h-4 border flex items-center justify-center ${
                        isChecked ? 'bg-[#E8E9D8] border-[#E8E9D8]' : 'border-[rgba(169,191,165,0.4)]'
                      }`}>
                        {isChecked && <Check className="w-3 h-3 text-[#071C1A] stroke-[2.5]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 5: TIMELINE
          ===================================================================== */}
      {step === 5 && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Step 5 — Timeline
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Specify campaign run dates and key milestones.
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  Campaign Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-4 py-2.5 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  Campaign End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] px-4 py-2.5 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] font-mono"
                />
              </div>
            </div>

            {/* Important Milestones */}
            <div className="space-y-3 pt-4">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Important Milestones (Optional)
              </label>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMilestoneInput}
                  onChange={(e) => setNewMilestoneInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addMilestone()}
                  placeholder="e.g. Product announcement, Launch day, Influencer collaboration"
                  className="flex-1 bg-[#061816] border border-[rgba(169,191,165,0.25)] px-4 py-2 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] font-light"
                />
                <button
                  type="button"
                  onClick={addMilestone}
                  className="px-4 py-2 bg-[#0D2D2A] border border-[rgba(169,191,165,0.3)] text-xs text-[#E8E9D8] hover:bg-[#E8E9D8] hover:text-[#071C1A] cursor-pointer font-mono"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-2 pt-1">
                {formData.milestones.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-[#0D2D2A]/30 border border-[rgba(169,191,165,0.15)] text-xs text-[#E8E9D8]"
                  >
                    <span className="font-mono text-[11px]">{m}</span>
                    <button
                      type="button"
                      onClick={() => removeMilestone(idx)}
                      className="text-[#A9BFA5]/60 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 6: CHANNELS
          ===================================================================== */}
      {step === 6 && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Step 6 — Channels
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Where do you want to run this campaign?
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            {/* Nexora Recommendation Toggle */}
            <div 
              onClick={() => setFormData({ ...formData, autoRecommendChannels: !formData.autoRecommendChannels })}
              className={`p-4 border flex items-center justify-between cursor-pointer transition-colors ${
                formData.autoRecommendChannels
                  ? 'border-[#A9BFA5] bg-[#0D2D2A]'
                  : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] hover:border-[rgba(169,191,165,0.4)]'
              }`}
            >
              <div>
                <span className="text-xs font-medium text-[#E8E9D8] block">
                  Let Nexora recommend channels
                </span>
                <span className="text-[11px] text-[#A9BFA5]/70 font-light">
                  Nexora will determine the most suitable channels based on your campaign objectives and target audience.
                </span>
              </div>
              <div className={`w-4 h-4 border flex items-center justify-center shrink-0 ml-4 ${
                formData.autoRecommendChannels ? 'bg-[#E8E9D8] border-[#E8E9D8]' : 'border-[rgba(169,191,165,0.4)]'
              }`}>
                {formData.autoRecommendChannels && <Check className="w-3 h-3 text-[#071C1A] stroke-[2.5]" />}
              </div>
            </div>

            {/* Channel Selection Grid */}
            <div className={`space-y-3 pt-2 ${formData.autoRecommendChannels ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Select Specific Channels
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CHANNELS.map((chan) => {
                  const isChecked = formData.channels.includes(chan);
                  return (
                    <div
                      key={chan}
                      onClick={() => toggleChannel(chan)}
                      className={`p-3 border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-[#A9BFA5] bg-[#0D2D2A]/60 text-[#E8E9D8]'
                          : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8]'
                      }`}
                    >
                      <span>{chan}</span>
                      <div className={`w-3.5 h-3.5 border flex items-center justify-center ${
                        isChecked ? 'bg-[#E8E9D8] border-[#E8E9D8]' : 'border-[rgba(169,191,165,0.4)]'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5 text-[#071C1A] stroke-[2.5]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 7: BRAND & CREATIVE DIRECTION
          ===================================================================== */}
      {step === 7 && (
        <div className="space-y-8 animate-fadeIn">
          <div>
            <h2 className="serif text-2xl font-light text-[#E8E9D8]">
              Step 7 — Brand & Creative Direction
            </h2>
            <p className="text-xs text-[#A9BFA5]/80 font-light mt-1">
              Calibrate voice, visual resonance, and specific editorial constraints.
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            {/* Brand Voice */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Brand Voice
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BRAND_VOICES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setFormData({ ...formData, brandVoice: v })}
                    className={`px-3 py-2 text-xs border text-left transition-colors cursor-pointer ${
                      formData.brandVoice === v
                        ? 'border-[#A9BFA5] bg-[#0D2D2A] text-[#E8E9D8] font-medium'
                        : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Style */}
            <div className="space-y-2 pt-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Visual Style
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VISUAL_STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormData({ ...formData, visualStyle: s })}
                    className={`px-3 py-2 text-xs border text-left transition-colors cursor-pointer ${
                      formData.visualStyle === s
                        ? 'border-[#A9BFA5] bg-[#0D2D2A] text-[#E8E9D8] font-medium'
                        : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional instructions */}
            <div className="space-y-2 pt-2">
              <label className="text-xs uppercase tracking-widest text-[#A9BFA5] font-mono block">
                Additional Instructions
              </label>
              <textarea
                rows={3}
                value={formData.additionalInstructions}
                onChange={(e) => setFormData({ ...formData, additionalInstructions: e.target.value })}
                placeholder="e.g. Keep the campaign dark, sophisticated, and focused on AI."
                className="w-full bg-[#061816] border border-[rgba(169,191,165,0.25)] p-4 text-xs text-[#E8E9D8] focus:outline-none focus:border-[#A9BFA5] placeholder-[#A9BFA5]/40 font-light resize-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP CONTROLS & BOTTOM TRIGGER
          ===================================================================== */}
      <div className="pt-8 border-t border-[rgba(169,191,165,0.2)] flex items-center justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="px-5 py-2.5 border border-[rgba(169,191,165,0.3)] text-xs uppercase tracking-widest font-mono text-[#A9BFA5] hover:text-[#E8E9D8] hover:bg-[#0D2D2A] transition-colors cursor-pointer"
          >
            &larr; Previous Step
          </button>
        ) : (
          <div />
        )}

        {step < 7 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="px-6 py-2.5 bg-[#E8E9D8] text-[#071C1A] hover:bg-white text-xs uppercase tracking-widest font-medium transition-colors cursor-pointer flex items-center space-x-2"
          >
            <span>Next: {stepTitles[step]}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          /* Step 8 — Generate Campaign Blueprint */
          <button
            type="button"
            onClick={handleStartGeneration}
            className="px-8 py-3 bg-[#E8E9D8] text-[#071C1A] hover:bg-white text-xs uppercase tracking-widest font-bold transition-all shadow-lg hover:shadow-xl cursor-pointer flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-current" />
            <span>Generate Campaign Blueprint &rarr;</span>
          </button>
        )}
      </div>
    </div>
  );
}
