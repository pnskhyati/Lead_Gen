import React, { useState } from 'react';
import { Sparkles, Edit3, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';

export interface BrandContext {
  productName: string;
  brandVoice: string;
  audience: string;
  visualLanguage: string;
  brandConstraints: string;
}

export const DEFAULT_BRAND_CONTEXT: BrandContext = {
  productName: 'Nexora Atelier OS',
  brandVoice: 'Quiet · Precise · Editorial · Premium',
  audience: 'Creative directors · Studio founders',
  visualLanguage: 'Minimal · Architectural · Wabi-Sabi',
  brandConstraints: 'No hype · No excessive emojis · No buzzwords'
};

interface BrandContextBannerProps {
  context: BrandContext;
  onUpdateContext: (newContext: BrandContext) => void;
}

export default function BrandContextBanner({
  context,
  onUpdateContext
}: BrandContextBannerProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<BrandContext>(context);

  const handleSave = () => {
    onUpdateContext(draft);
    setIsOpen(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_BRAND_CONTEXT);
    onUpdateContext(DEFAULT_BRAND_CONTEXT);
    setIsOpen(false);
  };

  return (
    <div
      className={`border rounded-[2px] transition-all text-xs ${
        isLight
          ? 'bg-white border-[#E2ECE0] text-[#122420]'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)] text-[#E8E9D8]'
      }`}
    >
      {/* Sleek Compact Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center space-x-2.5 truncate">
          <Sparkles
            className={`w-3.5 h-3.5 shrink-0 ${
              isLight ? 'text-[#143630]' : 'text-[#A9BFA5]'
            }`}
          />
          <span
            className={`text-[10px] uppercase font-mono tracking-widest shrink-0 font-medium ${
              isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'
            }`}
          >
            Brand Context:
          </span>
          <span className="font-medium truncate font-mono text-[11px]">
            {context.productName}
          </span>
          <span className="hidden sm:inline opacity-40">·</span>
          <span
            className={`hidden sm:inline truncate text-[11px] font-light ${
              isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/80'
            }`}
          >
            {context.brandVoice}
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => {
              if (!isOpen) setDraft(context);
              setIsOpen(!isOpen);
            }}
            className={`inline-flex items-center space-x-1 px-2 py-1 rounded-[2px] border text-[11px] font-mono transition-colors cursor-pointer ${
              isOpen
                ? isLight
                  ? 'border-[#143630] bg-[#143630] text-white'
                  : 'border-[#E8E9D8] bg-[#E8E9D8] text-[#071C1A]'
                : isLight
                  ? 'border-[#D0DDD0] text-[#244B40] hover:bg-[#EDF3EA]'
                  : 'border-[rgba(169,191,165,0.25)] text-[#A9BFA5] hover:text-white'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>{isOpen ? 'Close' : 'Customize'}</span>
            {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Customization Form */}
      {isOpen && (
        <div
          className={`p-4 border-t ${
            isLight
              ? 'border-[#E2ECE0] bg-[#F8F9F5]'
              : 'border-[rgba(169,191,165,0.15)] bg-[#061816]'
          } space-y-3.5 animate-fadeIn`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                className={`block text-[10px] uppercase font-mono tracking-wider mb-1 ${
                  isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'
                }`}
              >
                Product Name
              </label>
              <input
                type="text"
                value={draft.productName}
                onChange={(e) =>
                  setDraft({ ...draft, productName: e.target.value })
                }
                className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                  isLight
                    ? 'bg-white border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-[10px] uppercase font-mono tracking-wider mb-1 ${
                  isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'
                }`}
              >
                Brand Voice
              </label>
              <input
                type="text"
                value={draft.brandVoice}
                onChange={(e) =>
                  setDraft({ ...draft, brandVoice: e.target.value })
                }
                className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                  isLight
                    ? 'bg-white border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-[10px] uppercase font-mono tracking-wider mb-1 ${
                  isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'
                }`}
              >
                Target Audience
              </label>
              <input
                type="text"
                value={draft.audience}
                onChange={(e) => setDraft({ ...draft, audience: e.target.value })}
                className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                  isLight
                    ? 'bg-white border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              />
            </div>

            <div>
              <label
                className={`block text-[10px] uppercase font-mono tracking-wider mb-1 ${
                  isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'
                }`}
              >
                Brand Constraints
              </label>
              <input
                type="text"
                value={draft.brandConstraints}
                onChange={(e) =>
                  setDraft({ ...draft, brandConstraints: e.target.value })
                }
                className={`w-full text-xs px-2.5 py-1.5 rounded-[2px] border focus:outline-none ${
                  isLight
                    ? 'bg-white border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
                }`}
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-inherit">
            <button
              type="button"
              onClick={handleReset}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-[2px] border text-[11px] font-mono transition-colors cursor-pointer ${
                isLight
                  ? 'border-[#D0DDD0] text-[#668877] hover:text-[#122420]'
                  : 'border-[rgba(169,191,165,0.2)] text-[#A9BFA5]/60 hover:text-white'
              }`}
              title="Reset to Atelier default"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-[2px] text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                isLight
                  ? 'bg-[#143630] text-white hover:bg-[#0A1F1B]'
                  : 'bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-medium'
              }`}
            >
              <Check className="w-3 h-3" />
              <span>Save Context</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
