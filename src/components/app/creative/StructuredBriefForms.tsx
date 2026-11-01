import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { CategoryType } from './CategoryNav';

export interface StructuredFormsState {
  emailForm: {
    campaignType: string;
    recipientPersona: string;
    subjectAngle: string;
    keyProposition: string;
    cta: string;
    brandTone: string;
    senderPersona: string;
    preheader: string;
  };
  socialForm: {
    platform: string;
    format: string;
    coreHook: string;
    keyTakeaways: string;
    visualDirection: string;
    hashtagStyle: string;
    primaryCtaUrl: string;
  };
  headlineForm: {
    surface: string;
    productFocus: string;
    coreTransformation: string;
    archetype: string;
    targetAudience: string;
    subheadGuidance: string;
    buttonLockup: string;
  };
  adScriptForm: {
    videoFormat: string;
    hookScene: string;
    coreTension: string;
    solutionReveal: string;
    closingCta: string;
    voiceoverStyle: string;
    audioDirection: string;
    aspectRatio: string;
  };
  thoughtLeadershipForm: {
    workingTitle: string;
    publication: string;
    coreThesis: string;
    supportingArguments: string;
    depth: string;
    pullQuote: string;
    authorBio: string;
  };
  heroBriefForm: {
    deliverable: string;
    focalSubject: string;
    aesthetic: string;
    lightingMood: string;
    composition: string;
    colorPalette: string;
    aspectRatio: string;
    cameraDirection: string;
    materials: string;
    additionalConstraints: string;
  };
}

interface StructuredBriefFormsProps {
  category: CategoryType;
  formsState: StructuredFormsState;
  onUpdateState: (newState: StructuredFormsState) => void;
  variationsCount: number;
  onSelectVariationsCount: (count: number) => void;
  onGenerate: () => void;
  onLoadExample: () => void;
  onClearForm: () => void;
  isGenerating: boolean;
}

export default function StructuredBriefForms({
  category,
  formsState,
  onUpdateState,
  variationsCount,
  onSelectVariationsCount,
  onGenerate,
  onLoadExample,
  onClearForm,
  isGenerating
}: StructuredBriefFormsProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    emailForm,
    socialForm,
    headlineForm,
    adScriptForm,
    thoughtLeadershipForm,
    heroBriefForm
  } = formsState;

  return (
    <div
      className={`border rounded-[2px] p-6 transition-colors shadow-sm space-y-5 ${
        isLight
          ? 'bg-white border-[#E2ECE0]'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)]'
      }`}
    >
      {/* Top action header: Category title + subtle Load example / Clear */}
      <div
        className={`flex items-center justify-between pb-3 border-b ${
          isLight ? 'border-[#E2ECE0]' : 'border-[rgba(169,191,165,0.15)]'
        }`}
      >
        <span
          className={`text-[10px] uppercase font-mono tracking-widest font-medium ${
            isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'
          }`}
        >
          {category} Brief
        </span>

        <div className="flex items-center space-x-2 text-[11px] font-mono">
          <button
            type="button"
            onClick={onLoadExample}
            className={`px-2.5 py-0.5 rounded-[2px] border transition-colors cursor-pointer ${
              isLight
                ? 'border-[#D0DDD0] bg-[#F8F9F5] text-[#244B40] hover:bg-[#EDF3EA]'
                : 'border-[rgba(169,191,165,0.25)] bg-[#0D2D2A]/40 text-[#A9BFA5] hover:text-white hover:border-[#A9BFA5]/60'
            }`}
          >
            Load example
          </button>
          <button
            type="button"
            onClick={onClearForm}
            className={`px-2.5 py-0.5 rounded-[2px] border transition-colors cursor-pointer ${
              isLight
                ? 'border-[#D0DDD0] text-[#668877] hover:text-[#122420]'
                : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]/60 hover:text-white'
            }`}
            title="Reset to empty fields"
          >
            Clear
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. EMAIL COPY */}
      {/* ------------------------------------------------------------- */}
      {category === 'Email Copy' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Email angle
              </label>
              <select
                value={emailForm.campaignType}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    emailForm: { ...emailForm, campaignType: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="Direct VIP Outreach">Direct VIP Outreach</option>
                <option value="Product Launch Announcement">Product Launch Announcement</option>
                <option value="Editorial Newsletter">Editorial Newsletter</option>
                <option value="Private Beta Invitation">Private Beta Invitation</option>
                <option value="Re-engagement Sequence">Re-engagement Sequence</option>
              </select>
            </div>

            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Subject tone
              </label>
              <select
                value={emailForm.subjectAngle}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    emailForm: { ...emailForm, subjectAngle: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="Low-key Curiosity (lowercase)">Low-key Curiosity (lowercase)</option>
                <option value="Direct Value Proposition">Direct Value Proposition</option>
                <option value="Thought-Provoking Question">Thought-Provoking Question</option>
                <option value="Exclusive Invitation">Exclusive Invitation</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Audience / Persona
            </label>
            <input
              type="text"
              value={emailForm.recipientPersona}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  emailForm: { ...emailForm, recipientPersona: e.target.value }
                })
              }
              placeholder="e.g. Design Directors & Studio Founders"
              className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Key proposition
            </label>
            <textarea
              rows={3}
              value={emailForm.keyProposition}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  emailForm: { ...emailForm, keyProposition: e.target.value }
                })
              }
              placeholder="Exclusive invitation to experience Nexora v2.0 with zero-notification CRM..."
              className={`w-full text-xs p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Call to action (CTA)
            </label>
            <input
              type="text"
              value={emailForm.cta}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  emailForm: { ...emailForm, cta: e.target.value }
                })
              }
              placeholder="e.g. Schedule a 15-min Private Walkthrough"
              className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          {/* Advanced Settings */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center space-x-1.5 text-xs font-mono transition-colors cursor-pointer ${
                isLight ? 'text-[#244B40] hover:text-[#122420]' : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <span>Advanced settings</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div
                className={`mt-3 p-4 rounded-[2px] border space-y-3 ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#E2ECE0]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Sender persona & sign-off
                    </label>
                    <input
                      type="text"
                      value={emailForm.senderPersona}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          emailForm: { ...emailForm, senderPersona: e.target.value }
                        })
                      }
                      placeholder="e.g. Julian Vance · Atelier Director"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Brand tone override
                    </label>
                    <input
                      type="text"
                      value={emailForm.brandTone}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          emailForm: { ...emailForm, brandTone: e.target.value }
                        })
                      }
                      placeholder="e.g. Deliberate & Architectural"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                    Preheader text
                  </label>
                  <input
                    type="text"
                    value={emailForm.preheader || ''}
                    onChange={(e) =>
                      onUpdateState({
                        ...formsState,
                        emailForm: { ...emailForm, preheader: e.target.value }
                      })
                    }
                    placeholder="e.g. Why modern studios are muting notification badges for hairline precision."
                    className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                      isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. SOCIAL POST */}
      {/* ------------------------------------------------------------- */}
      {category === 'Social Post' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Channel
              </label>
              <select
                value={socialForm.platform}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    socialForm: { ...socialForm, platform: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="All platforms (multi-channel pack)">All platforms (multi-channel pack)</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Facebook Page">Facebook Page</option>
                <option value="Instagram / Threads">Instagram / Threads</option>
                <option value="X (Twitter)">X (Twitter)</option>
                <option value="Substack Notes">Substack Notes</option>
              </select>
            </div>

            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Format
              </label>
              <select
                value={socialForm.format}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    socialForm: { ...socialForm, format: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="Sharp Contrarian Take (Single Post)">Sharp Contrarian Take (Single Post)</option>
                <option value="Multi-part Breakdown (Thread / Carousel)">Multi-part Breakdown (Thread / Carousel)</option>
                <option value="Behind-the-Scenes Case Study">Behind-the-Scenes Case Study</option>
                <option value="Manifesto Excerpt">Manifesto Excerpt</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Opening hook
            </label>
            <textarea
              rows={2}
              value={socialForm.coreHook}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  socialForm: { ...socialForm, coreHook: e.target.value }
                })
              }
              placeholder="Topic or hook — e.g. Healthcare and AI: safe adoption for hospitals and clinics..."
              className={`w-full text-xs p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Key points
            </label>
            <textarea
              rows={3}
              value={socialForm.keyTakeaways}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  socialForm: { ...socialForm, keyTakeaways: e.target.value }
                })
              }
              placeholder="1. Red notification badges hijack executive dopamine.\n2. Hairline layouts recover 40% working memory.\n3. Subtract the noise. Multiply the depth."
              className={`w-full text-xs p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed font-mono transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          {/* Advanced Settings */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center space-x-1.5 text-xs font-mono transition-colors cursor-pointer ${
                isLight ? 'text-[#244B40] hover:text-[#122420]' : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <span>Advanced settings</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div
                className={`mt-3 p-4 rounded-[2px] border space-y-3 ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#E2ECE0]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
                }`}
              >
                <div>
                  <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                    Visual direction
                  </label>
                  <input
                    type="text"
                    value={socialForm.visualDirection}
                    onChange={(e) =>
                      onUpdateState({
                        ...formsState,
                        socialForm: { ...socialForm, visualDirection: e.target.value }
                      })
                    }
                    placeholder="e.g. Monochromatic UI specimen render on dark obsidian slate"
                    className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                      isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Hashtag policy
                    </label>
                    <select
                      value={socialForm.hashtagStyle}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          socialForm: { ...socialForm, hashtagStyle: e.target.value }
                        })
                      }
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    >
                      <option value="Zero Hashtags (Strict Editorial)">Zero Hashtags (Strict Editorial)</option>
                      <option value="Curated 2-3 Focus Tags">Curated 2-3 Focus Tags</option>
                      <option value="Full Discovery Tags">Full Discovery Tags</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Destination link / CTA
                    </label>
                    <input
                      type="text"
                      value={socialForm.primaryCtaUrl || ''}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          socialForm: { ...socialForm, primaryCtaUrl: e.target.value }
                        })
                      }
                      placeholder="e.g. nexora.studio/atelier"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. HEADLINE SET */}
      {/* ------------------------------------------------------------- */}
      {category === 'Headline Set' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Surface
              </label>
              <select
                value={headlineForm.surface}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    headlineForm: { ...headlineForm, surface: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="Hero Section H1 (Landing Page)">Hero Section H1 (Landing Page)</option>
                <option value="Product Feature Page Header">Product Feature Page Header</option>
                <option value="Executive Pitch Deck Cover">Executive Pitch Deck Cover</option>
                <option value="Performance Ad Title">Performance Ad Title</option>
              </select>
            </div>

            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Headline archetype
              </label>
              <select
                value={headlineForm.archetype}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    headlineForm: { ...headlineForm, archetype: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="Poetic & Architectural">Poetic & Architectural</option>
                <option value="Direct & High-Conversion">Direct & High-Conversion</option>
                <option value="Contrarian & Provocative">Contrarian & Provocative</option>
                <option value="Diverse Mix (All Styles)">Diverse Mix (All Styles)</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Product focus
            </label>
            <input
              type="text"
              value={headlineForm.productFocus}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  headlineForm: { ...headlineForm, productFocus: e.target.value }
                })
              }
              placeholder="e.g. Nexora Atelier OS"
              className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Key benefit
            </label>
            <textarea
              rows={2}
              value={headlineForm.coreTransformation}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  headlineForm: { ...headlineForm, coreTransformation: e.target.value }
                })
              }
              placeholder="Replaces chaotic, badge-heavy CRM clutter with serene, hairline precision and quiet focus."
              className={`w-full text-xs p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          {/* Advanced Settings */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center space-x-1.5 text-xs font-mono transition-colors cursor-pointer ${
                isLight ? 'text-[#244B40] hover:text-[#122420]' : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <span>Advanced settings</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div
                className={`mt-3 p-4 rounded-[2px] border space-y-3 ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#E2ECE0]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
                }`}
              >
                <div>
                  <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                    Audience
                  </label>
                  <input
                    type="text"
                    value={headlineForm.targetAudience}
                    onChange={(e) =>
                      onUpdateState({
                        ...formsState,
                        headlineForm: { ...headlineForm, targetAudience: e.target.value }
                      })
                    }
                    placeholder="e.g. High-taste studio directors, agency leads, and architects"
                    className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                      isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Subhead guidance
                    </label>
                    <input
                      type="text"
                      value={headlineForm.subheadGuidance || ''}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          headlineForm: { ...headlineForm, subheadGuidance: e.target.value }
                        })
                      }
                      placeholder="e.g. Max 14 words with serif styling"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Button lockup copy
                    </label>
                    <input
                      type="text"
                      value={headlineForm.buttonLockup || ''}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          headlineForm: { ...headlineForm, buttonLockup: e.target.value }
                        })
                      }
                      placeholder="e.g. Experience Stillness"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. VIDEO / AD SCRIPT */}
      {/* ------------------------------------------------------------- */}
      {(category === 'Ad Script' || category === 'Product Demo' || category === 'Brand Film') && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Video format
              </label>
              <select
                value={adScriptForm.videoFormat}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    adScriptForm: { ...adScriptForm, videoFormat: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="30s Problem-Agitate-Solve (Paid Social)">30s Problem-Agitate-Solve (Paid Social)</option>
                <option value="15s Hook & Reel Loop (Instagram/TikTok)">15s Hook & Reel Loop (Instagram/TikTok)</option>
                <option value="60s Manifesto Storyboard (YouTube/Web)">60s Manifesto Storyboard (YouTube/Web)</option>
                <option value="6s Bumper Hook">6s Bumper Hook</option>
              </select>
            </div>

            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Voiceover style
              </label>
              <select
                value={adScriptForm.voiceoverStyle}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    adScriptForm: { ...adScriptForm, voiceoverStyle: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="Quiet, Measured & Articulate">Quiet, Measured & Articulate</option>
                <option value="Bold, Direct & Urgent">Bold, Direct & Urgent</option>
                <option value="Documentary Narrator (Cinematic)">Documentary Narrator (Cinematic)</option>
                <option value="Conversational Founder Walkthrough">Conversational Founder Walkthrough</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Hook scene
            </label>
            <input
              type="text"
              value={adScriptForm.hookScene}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  adScriptForm: { ...adScriptForm, hookScene: e.target.value }
                })
              }
              placeholder="e.g. Extreme macro tracking shot across an empty timber desk at dawn."
              className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Core tension
            </label>
            <textarea
              rows={2}
              value={adScriptForm.coreTension}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  adScriptForm: { ...adScriptForm, coreTension: e.target.value }
                })
              }
              placeholder="A laptop screen suddenly bursts with 50 blinking notification badges, red numbers, and modal popups."
              className={`w-full text-xs p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Product reveal
            </label>
            <input
              type="text"
              value={adScriptForm.solutionReveal}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  adScriptForm: { ...adScriptForm, solutionReveal: e.target.value }
                })
              }
              placeholder="User taps one key. Screen fades into Nexora hairline interface. Complete calm."
              className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          {/* Advanced Settings */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center space-x-1.5 text-xs font-mono transition-colors cursor-pointer ${
                isLight ? 'text-[#244B40] hover:text-[#122420]' : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <span>Advanced settings</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div
                className={`mt-3 p-4 rounded-[2px] border space-y-3 ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#E2ECE0]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
                }`}
              >
                <div>
                  <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                    Closing CTA & endcard
                  </label>
                  <input
                    type="text"
                    value={adScriptForm.closingCta}
                    onChange={(e) =>
                      onUpdateState({
                        ...formsState,
                        adScriptForm: { ...adScriptForm, closingCta: e.target.value }
                      })
                    }
                    placeholder="e.g. Make space for what matters. Reserve your atelier at nexora.studio"
                    className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                      isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Audio direction
                    </label>
                    <input
                      type="text"
                      value={adScriptForm.audioDirection || ''}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          adScriptForm: { ...adScriptForm, audioDirection: e.target.value }
                        })
                      }
                      placeholder="e.g. Natural room tone into warm ambient acoustic cello"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Aspect ratio
                    </label>
                    <select
                      value={adScriptForm.aspectRatio || '9:16 Vertical Reel'}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          adScriptForm: { ...adScriptForm, aspectRatio: e.target.value }
                        })
                      }
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    >
                      <option value="9:16 Vertical Reel">9:16 Vertical Reel</option>
                      <option value="16:9 Landscape Video">16:9 Landscape Video</option>
                      <option value="1:1 Square Feed">1:1 Square Feed</option>
                      <option value="4:5 Portrait Feed">4:5 Portrait Feed</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. EDITORIAL / THOUGHT LEADERSHIP */}
      {/* ------------------------------------------------------------- */}
      {category === 'Thought Leadership' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Working title
              </label>
              <input
                type="text"
                value={thoughtLeadershipForm.workingTitle}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    thoughtLeadershipForm: { ...thoughtLeadershipForm, workingTitle: e.target.value }
                  })
                }
                placeholder="e.g. The Tyranny of the Unread Notification Badge"
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Publication
              </label>
              <select
                value={thoughtLeadershipForm.publication}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    thoughtLeadershipForm: { ...thoughtLeadershipForm, publication: e.target.value }
                  })
                }
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              >
                <option value="Nexora Studio Journal & Substack">Nexora Studio Journal & Substack</option>
                <option value="Fast Company / Tech Op-Ed">Fast Company / Tech Op-Ed</option>
                <option value="Medium / UX Collective">Medium / UX Collective</option>
                <option value="Executive Dossier">Executive Dossier</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Core thesis
            </label>
            <textarea
              rows={2}
              value={thoughtLeadershipForm.coreThesis}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  thoughtLeadershipForm: { ...thoughtLeadershipForm, coreThesis: e.target.value }
                })
              }
              placeholder="Productivity tools should behave like quiet architecture, not carnival barkers."
              className={`w-full text-xs p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Key supporting arguments
            </label>
            <textarea
              rows={3}
              value={thoughtLeadershipForm.supportingArguments}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  thoughtLeadershipForm: { ...thoughtLeadershipForm, supportingArguments: e.target.value }
                })
              }
              placeholder="1. The cognitive cost of attention switching in modern workspaces.\n2. Lessons from Swiss spatial typography.\n3. Why high-output creative agencies are returning to asynchronous quietude."
              className={`w-full text-xs p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed font-mono transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          {/* Advanced Settings */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center space-x-1.5 text-xs font-mono transition-colors cursor-pointer ${
                isLight ? 'text-[#244B40] hover:text-[#122420]' : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <span>Advanced settings</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div
                className={`mt-3 p-4 rounded-[2px] border space-y-3 ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#E2ECE0]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
                }`}
              >
                <div>
                  <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                    Pull-quote highlight
                  </label>
                  <input
                    type="text"
                    value={thoughtLeadershipForm.pullQuote}
                    onChange={(e) =>
                      onUpdateState({
                        ...formsState,
                        thoughtLeadershipForm: { ...thoughtLeadershipForm, pullQuote: e.target.value }
                      })
                    }
                    placeholder="When software speaks in hairlines, your mind recovers the bandwidth required for contemplation."
                    className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                      isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Depth / length
                    </label>
                    <select
                      value={thoughtLeadershipForm.depth}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          thoughtLeadershipForm: { ...thoughtLeadershipForm, depth: e.target.value }
                        })
                      }
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    >
                      <option value="Deep-Dive Essay (~1,000 words)">Deep-Dive Essay (~1,000 words)</option>
                      <option value="Crisp Editorial Column (~500 words)">Crisp Editorial Column (~500 words)</option>
                      <option value="Atelier Manifesto (~1,500 words)">Atelier Manifesto (~1,500 words)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Author sign-off
                    </label>
                    <input
                      type="text"
                      value={thoughtLeadershipForm.authorBio || ''}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          thoughtLeadershipForm: { ...thoughtLeadershipForm, authorBio: e.target.value }
                        })
                      }
                      placeholder="e.g. Evelyn Vance · Principal Partner"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. VISUAL BRIEF / HERO BRIEF (Explicitly Specified in Point 13) */}
      {/* ------------------------------------------------------------- */}
      {(category === 'Hero Brief' || category === 'Product Render' || category === 'Brand Specimen') && (
        <div className="space-y-4">
          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              What are you creating?
            </label>
            <select
              value={heroBriefForm.deliverable}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  heroBriefForm: { ...heroBriefForm, deliverable: e.target.value }
                })
              }
              className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            >
              <option value="3D Spatial Key Visual (16:9)">3D Spatial Key Visual (16:9)</option>
              <option value="Editorial Product Specimen (1:1)">Editorial Product Specimen (1:1)</option>
              <option value="Architectural Workspace Render">Architectural Workspace Render</option>
              <option value="Brand Identity Lockup & Specimen">Brand Identity Lockup & Specimen</option>
            </select>
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Concept
            </label>
            <textarea
              rows={3}
              value={heroBriefForm.focalSubject}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  heroBriefForm: { ...heroBriefForm, focalSubject: e.target.value }
                })
              }
              placeholder="A cantilevered dark glass workspace surface displaying Nexora's hairline CRM graph, next to handcrafted ceramic vessel and brass drafting instruments."
              className={`w-full text-xs p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Art direction
              </label>
              <input
                type="text"
                value={heroBriefForm.aesthetic}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    heroBriefForm: { ...heroBriefForm, aesthetic: e.target.value }
                  })
                }
                placeholder="Japanese Wabi-Sabi + Brutalist Typography"
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                  isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
                }`}
              >
                Lighting
              </label>
              <input
                type="text"
                value={heroBriefForm.lightingMood}
                onChange={(e) =>
                  onUpdateState({
                    ...formsState,
                    heroBriefForm: { ...heroBriefForm, lightingMood: e.target.value }
                  })
                }
                placeholder="Soft morning sunlight (4500K) through shoji screens, deep obsidian shadows"
                className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block text-[11px] uppercase tracking-wider font-mono mb-1.5 ${
                isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
              }`}
            >
              Composition
            </label>
            <input
              type="text"
              value={heroBriefForm.composition}
              onChange={(e) =>
                onUpdateState({
                  ...formsState,
                  heroBriefForm: { ...heroBriefForm, composition: e.target.value }
                })
              }
              placeholder="Left-heavy layout with 60% negative space on right for editorial typography"
              className={`w-full text-xs px-3 py-2 rounded-[2px] border focus:outline-none transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          </div>

          {/* Advanced Settings (palette, exact aspect ratio, environment details, camera direction, materials, constraints) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center space-x-1.5 text-xs font-mono transition-colors cursor-pointer ${
                isLight ? 'text-[#244B40] hover:text-[#122420]' : 'text-[#A9BFA5] hover:text-white'
              }`}
            >
              <span>Advanced settings</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div
                className={`mt-3 p-4 rounded-[2px] border space-y-3 ${
                  isLight
                    ? 'bg-[#F8F9F5] border-[#E2ECE0]'
                    : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
                }`}
              >
                <div>
                  <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                    Color palette
                  </label>
                  <input
                    type="text"
                    value={heroBriefForm.colorPalette}
                    onChange={(e) =>
                      onUpdateState({
                        ...formsState,
                        heroBriefForm: { ...heroBriefForm, colorPalette: e.target.value }
                      })
                    }
                    placeholder="Deep Forest Obsidian (#071C1A), Soft Sage (#A9BFA5), Warm Parchment (#E8E9D8)"
                    className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                      isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Aspect ratio
                    </label>
                    <select
                      value={heroBriefForm.aspectRatio || '16:9 Landscape'}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          heroBriefForm: { ...heroBriefForm, aspectRatio: e.target.value }
                        })
                      }
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    >
                      <option value="16:9 Landscape (3840×2160)">16:9 Landscape (3840×2160)</option>
                      <option value="1:1 Square (2048×2048)">1:1 Square (2048×2048)</option>
                      <option value="4:5 Portrait (1600×2000)">4:5 Portrait (1600×2000)</option>
                      <option value="21:9 Ultra-wide (3440×1440)">21:9 Ultra-wide (3440×1440)</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Camera direction
                    </label>
                    <input
                      type="text"
                      value={heroBriefForm.cameraDirection || ''}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          heroBriefForm: { ...heroBriefForm, cameraDirection: e.target.value }
                        })
                      }
                      placeholder="e.g. 35mm lens, 15° low-angle isometric elevation"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Material shaders
                    </label>
                    <input
                      type="text"
                      value={heroBriefForm.materials || ''}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          heroBriefForm: { ...heroBriefForm, materials: e.target.value }
                        })
                      }
                      placeholder="e.g. Micro-brushed titanium, matte black anodized aluminum"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] uppercase font-mono mb-1 ${isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/70'}`}>
                      Additional visual constraints
                    </label>
                    <input
                      type="text"
                      value={heroBriefForm.additionalConstraints || ''}
                      onChange={(e) =>
                        onUpdateState({
                          ...formsState,
                          heroBriefForm: { ...heroBriefForm, additionalConstraints: e.target.value }
                        })
                      }
                      placeholder="e.g. No saturated neon lights, keep typography safe margins"
                      className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                        isLight ? 'bg-white border-[#D0DDD0] text-[#122420]' : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Bar: Variations Selector + Prominent [ ✨ GENERATE ] */}
      <div
        className={`pt-5 border-t ${
          isLight ? 'border-[#E2ECE0]' : 'border-[rgba(169,191,165,0.15)]'
        } flex flex-col sm:flex-row sm:items-center justify-between gap-3`}
      >
        {/* Variations selector: [ 1 ] [ 3 ] [ 5 ] */}
        <div className="flex items-center space-x-2">
          <span
            className={`text-[11px] uppercase font-mono tracking-wider ${
              isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/80'
            }`}
          >
            Variations:
          </span>
          <div className="inline-flex rounded-[2px] border border-inherit overflow-hidden">
            {[1, 3, 5].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onSelectVariationsCount(num)}
                className={`px-3 py-1 text-xs font-mono font-medium transition-colors cursor-pointer ${
                  variationsCount === num
                    ? isLight
                      ? 'bg-[#143630] text-white font-medium'
                      : 'bg-[#E8E9D8] text-[#071C1A] font-semibold'
                    : isLight
                      ? 'bg-[#F8F9F5] text-[#3E6A5E] hover:text-[#122420]'
                      : 'bg-[#061816] text-[#A9BFA5]/60 hover:text-[#E8E9D8]'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Prominent [ ✨ GENERATE ] button */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className={`px-6 py-2.5 rounded-[2px] text-xs font-mono uppercase tracking-widest flex items-center justify-center space-x-2 transition-all cursor-pointer ${
            isGenerating
              ? 'opacity-60 cursor-not-allowed bg-neutral-400 text-white'
              : isLight
                ? 'bg-[#143630] text-white hover:bg-[#0A1F1B] shadow-sm'
                : 'bg-[#E8E9D8] text-[#071C1A] hover:bg-white shadow-sm'
          }`}
        >
          {isGenerating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ GENERATE</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
