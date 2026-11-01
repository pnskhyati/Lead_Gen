import React, { useState } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { CategoryType } from './CategoryNav';

interface QuickGenerateFormProps {
  onQuickGenerate: (prompt: string, variationsCount: number, detectedCategory: CategoryType) => void;
  isGenerating: boolean;
}

export default function QuickGenerateForm({
  onQuickGenerate,
  isGenerating
}: QuickGenerateFormProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [prompt, setPrompt] = useState('');
  const [variationsCount, setVariationsCount] = useState<number>(3);

  const SUGGESTIONS = [
    {
      label: 'VIP Launch Email',
      text: 'Create a launch email for Nexora Atelier OS aimed at creative directors and agency founders.',
      cat: 'Email Copy' as CategoryType
    },
    {
      label: 'Healthcare × AI (all channels)',
      text: 'Healthcare and AI — how hospitals and clinics can adopt AI safely. Posts optimized for reach on LinkedIn, Facebook, Instagram, and X.',
      cat: 'Social Post' as CategoryType
    },
    {
      label: 'Contrarian Social Post',
      text: 'Write a sharp contrarian post about how notification badges fracture creative agency productivity.',
      cat: 'Social Post' as CategoryType
    },
    {
      label: '3D Spatial Visual Brief',
      text: 'Generate an art direction brief for a 3D key visual of a dark glass workspace with brass instruments.',
      cat: 'Hero Brief' as CategoryType
    }
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    const lower = prompt.toLowerCase();
    let detected: CategoryType = 'Social Post';
    if (lower.includes('email') || lower.includes('newsletter') || lower.includes('subject line')) {
      detected = 'Email Copy';
    } else if (lower.includes('headline') || lower.includes('h1') || lower.includes('tagline')) {
      detected = 'Headline Set';
    } else if (lower.includes('video') || lower.includes('script') || lower.includes('reel') || lower.includes(' ad ')) {
      detected = 'Ad Script';
    } else if (lower.includes('visual') || lower.includes('3d') || lower.includes('render') || lower.includes('hero brief')) {
      detected = 'Hero Brief';
    } else if (lower.includes('essay') || lower.includes('editorial') || lower.includes('journal') || lower.includes('article')) {
      detected = 'Thought Leadership';
    } else if (
      lower.includes('post') ||
      lower.includes('twitter') ||
      lower.includes('linkedin') ||
      lower.includes('instagram') ||
      lower.includes('facebook') ||
      lower.includes('social') ||
      lower.includes('thread') ||
      lower.includes(' all channel') ||
      lower.includes('multi-channel')
    ) {
      detected = 'Social Post';
    }

    onQuickGenerate(prompt, variationsCount, detected);
  };

  return (
    <div
      className={`border rounded-[2px] p-5 transition-colors shadow-sm ${
        isLight
          ? 'bg-white border-[#E2ECE0]'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)]'
      }`}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="quick-prompt"
            className={`text-xs uppercase tracking-widest font-mono font-medium ${
              isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
            }`}
          >
            Prompt Prompt / Brief
          </label>
          <span
            className={`text-[10px] font-mono ${
              isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/60'
            }`}
          >
            Press ⌘+Enter to run
          </span>
        </div>

        <div className="relative">
          <textarea
            id="quick-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
            placeholder="e.g. Healthcare and AI — safe adoption for clinics (generates LinkedIn, Facebook, Instagram & X layouts)..."
            className={`w-full text-xs font-mono p-3 rounded-[2px] border focus:outline-none resize-none leading-relaxed transition-colors ${
              isLight
                ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40] placeholder-[#889988]'
                : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5] placeholder-[#A9BFA5]/30'
            }`}
          />
        </div>

        {/* Quick Inspiration Tags */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          <span
            className={`text-[10px] uppercase font-mono tracking-wider shrink-0 mr-1 ${
              isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/60'
            }`}
          >
            Try:
          </span>
          {SUGGESTIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setPrompt(item.text)}
              className={`text-[10px] px-2 py-0.5 rounded-[2px] border font-mono transition-colors cursor-pointer shrink-0 ${
                isLight
                  ? 'border-[#E2ECE0] bg-[#F8F9F5] text-[#244B40] hover:border-[#143630]'
                  : 'border-[rgba(169,191,165,0.2)] bg-[#061816] text-[#A9BFA5] hover:border-[#A9BFA5]/60 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Bottom bar with Variations and Generate button */}
        <div
          className={`pt-3 border-t ${
            isLight ? 'border-[#E2ECE0]' : 'border-[rgba(169,191,165,0.15)]'
          } flex items-center justify-between gap-3`}
        >
          <div className="flex items-center space-x-2">
            <span
              className={`text-[10px] uppercase font-mono tracking-wider ${
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
                  onClick={() => setVariationsCount(num)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium transition-colors cursor-pointer ${
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

          <button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className={`px-4 py-2 rounded-[2px] text-xs font-mono uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              !prompt.trim() || isGenerating
                ? 'opacity-40 cursor-not-allowed bg-neutral-400 text-white'
                : isLight
                  ? 'bg-[#143630] text-white hover:bg-[#0A1F1B] shadow-sm'
                  : 'bg-[#E8E9D8] text-[#071C1A] hover:bg-white shadow-sm'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
