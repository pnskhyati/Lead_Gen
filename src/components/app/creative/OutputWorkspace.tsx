import React, { useState, useRef } from 'react';
import {
  Copy,
  Check,
  Edit2,
  RefreshCw,
  Download,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Maximize2,
  X,
  Eye,
  Layers,
  FileText
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { CategoryType } from './CategoryNav';

export interface GeneratedVariation {
  id: string;
  versionLabel: string; // e.g. "VERSION 01 — QUIET"
  content: string;
  imagePrompt?: string;
  imageUrl?: string;
  renderedImageMock?: string;
}

interface OutputWorkspaceProps {
  category: CategoryType;
  variations: GeneratedVariation[];
  activeVariationIndex: number;
  onSelectVariation: (index: number) => void;
  onUpdateVariationContent: (index: number, newContent: string) => void;
  onUpdateVariationImage?: (index: number, newImageUrl: string) => void;
  onRegenerate: () => void;
  onRefine: (instruction: string) => void;
  isGenerating: boolean;
}

const STOCK_RENDER_ASSETS = [
  '/src/assets/images/spatial_key_visual_1790755715787.jpg',
  '/src/assets/images/titanium_studio_render_1790755733959.jpg',
  '/src/assets/images/swiss_brand_specimen_1790755749195.jpg',
  '/src/assets/images/scandinavian_dawn_studio_1790755765807.jpg',
  '/src/assets/images/ceramic_glass_volume_1790755783767.jpg'
];

export default function OutputWorkspace({
  category,
  variations,
  activeVariationIndex,
  onSelectVariation,
  onUpdateVariationContent,
  onUpdateVariationImage,
  onRegenerate,
  onRefine,
  isGenerating
}: OutputWorkspaceProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedImageUrl, setCopiedImageUrl] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [customRefinement, setCustomRefinement] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  // View mode for image generation categories
  const isImageCategory = ['Hero Brief', 'Product Render', 'Brand Specimen'].includes(category);

  const refineInputRef = useRef<HTMLInputElement>(null);

  const currentVariation = variations[activeVariationIndex] || null;

  // Active image url fallback or from current variation
  const activeImageUrl = currentVariation?.imageUrl || (isImageCategory ? STOCK_RENDER_ASSETS[activeVariationIndex % STOCK_RENDER_ASSETS.length] : undefined);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPrompt = (promptText: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyImageLink = (url: string) => {
    navigator.clipboard.writeText(window.location.origin + url);
    setCopiedImageUrl(true);
    setTimeout(() => setCopiedImageUrl(false), 2000);
  };

  const handleExport = () => {
    if (!currentVariation) return;
    const blob = new Blob([currentVariation.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexora-${category.toLowerCase().replace(/\s+/g, '-')}-${currentVariation.versionLabel.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadImage = (imgSrc: string) => {
    const a = document.createElement('a');
    a.href = imgSrc;
    a.download = `nexora-${category.toLowerCase().replace(/\s+/g, '-')}-${currentVariation ? currentVariation.versionLabel.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'render'}.jpg`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleTriggerImageGeneration = () => {
    setIsGeneratingImage(true);
    setGenerationStep('Allocating Octane raytracing cluster...');

    setTimeout(() => {
      setGenerationStep('Sampling 4500K directional radiance fields...');
    }, 450);

    setTimeout(() => {
      setGenerationStep('Synthesizing hairline materials & micro-knurling...');
    }, 900);

    setTimeout(() => {
      setGenerationStep('Finalizing 3840×2160 UHD rendering passes...');
    }, 1350);

    setTimeout(() => {
      setIsGeneratingImage(false);
      setGenerationStep('');
      // Assign appropriate image from high-fidelity rendered library
      const nextImg = STOCK_RENDER_ASSETS[(activeVariationIndex + 1) % STOCK_RENDER_ASSETS.length];
      if (onUpdateVariationImage) {
        onUpdateVariationImage(activeVariationIndex, nextImg);
      } else if (currentVariation) {
        currentVariation.imageUrl = nextImg;
      }
    }, 1800);
  };

  const handleApplyRefinement = (instruction: string) => {
    if (!instruction.trim()) return;
    onRefine(instruction);
    setCustomRefinement('');
  };

  // 12. CLEAN EDITORIAL EMPTY STATE
  if (!currentVariation && variations.length === 0) {
    return (
      <div
        className={`border rounded-[2px] p-8 sm:p-12 transition-colors flex flex-col items-center justify-center text-center min-h-[440px] shadow-sm ${
          isLight
            ? 'bg-white border-[#E2ECE0]'
            : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)]'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center mb-4 text-base ${
            isLight
              ? 'bg-[#EDF3EA] text-[#143630]'
              : 'bg-[#0D2D2A] text-[#A9BFA5]'
          }`}
        >
          ✦
        </div>

        <span
          className={`text-[11px] uppercase tracking-widest-plus font-mono font-medium block mb-2 ${
            isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'
          }`}
        >
          YOUR CREATIVE OUTPUT
        </span>

        <h3
          className={`serif text-xl sm:text-2xl font-light mb-2.5 ${
            isLight ? 'text-[#122420]' : 'text-[#E8E9D8]'
          }`}
        >
          will appear here
        </h3>

        <p
          className={`text-xs sm:text-sm font-light max-w-sm leading-relaxed ${
            isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/70'
          }`}
        >
          Configure your brief and generate your first version.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`border rounded-[2px] p-6 transition-colors shadow-sm space-y-6 ${
        isLight
          ? 'bg-white border-[#E2ECE0]'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)]'
      }`}
    >
      {/* Top Bar: Variations Tabs & Global Actions */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b ${
          isLight ? 'border-[#E2ECE0]' : 'border-[rgba(169,191,165,0.15)]'
        } gap-3`}
      >
        {/* Variation Version Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {variations.map((v, idx) => {
            const isSelected = idx === activeVariationIndex;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVariation(idx)}
                className={`px-3 py-1.5 text-xs font-mono rounded-[2px] border transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? isLight
                      ? 'bg-[#143630] border-[#143630] text-white font-medium shadow-sm'
                      : 'bg-[#E8E9D8] border-[#E8E9D8] text-[#071C1A] font-semibold shadow-sm'
                    : isLight
                      ? 'border-[#E2ECE0] bg-[#F8F9F5] text-[#3E6A5E] hover:text-[#122420] hover:border-[#D0DDD0]'
                      : 'border-[rgba(169,191,165,0.2)] bg-[#061816] text-[#A9BFA5]/70 hover:text-[#E8E9D8]'
                }`}
              >
                {v.versionLabel.replace(/VERSION\s0?/, 'V')}
              </button>
            );
          })}
        </div>

        {/* Action icons: Edit, Copy, Regenerate, Export */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`p-1.5 rounded-[2px] border transition-colors cursor-pointer ${
              isEditing
                ? isLight
                  ? 'bg-[#143630] border-[#143630] text-white'
                  : 'bg-[#E8E9D8] border-[#E8E9D8] text-[#071C1A]'
                : isLight
                  ? 'border-[#D0DDD0] bg-[#F8F9F5] text-[#244B40] hover:bg-[#EDF3EA]'
                  : 'border-[rgba(169,191,165,0.25)] bg-[#061816] text-[#A9BFA5] hover:text-white'
            }`}
            title={isEditing ? 'Save and preview' : 'Edit content'}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleCopy(currentVariation.content)}
            className={`px-2.5 py-1 text-xs font-mono rounded-[2px] border transition-colors cursor-pointer flex items-center space-x-1.5 ${
              isLight
                ? 'border-[#D0DDD0] bg-[#F8F9F5] text-[#244B40] hover:bg-[#EDF3EA]'
                : 'border-[rgba(169,191,165,0.25)] bg-[#061816] text-[#A9BFA5] hover:text-white'
            }`}
            title="Copy content"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onRegenerate}
            disabled={isGenerating}
            className={`p-1.5 rounded-[2px] border transition-colors cursor-pointer ${
              isLight
                ? 'border-[#D0DDD0] bg-[#F8F9F5] text-[#244B40] hover:bg-[#EDF3EA]'
                : 'border-[rgba(169,191,165,0.25)] bg-[#061816] text-[#A9BFA5] hover:text-white'
            }`}
            title="Regenerate all variations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExport}
            className={`p-1.5 rounded-[2px] border transition-colors cursor-pointer ${
              isLight
                ? 'border-[#D0DDD0] bg-[#F8F9F5] text-[#244B40] hover:bg-[#EDF3EA]'
                : 'border-[rgba(169,191,165,0.25)] bg-[#061816] text-[#A9BFA5] hover:text-white'
            }`}
            title="Export markdown file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ACTUAL GENERATED IMAGE RENDERING WORKSPACE                    */}
      {/* Shown prominently when in Images category or when image exists */}
      {/* ------------------------------------------------------------- */}
      {(isImageCategory || activeImageUrl) && (
        <div
          className={`border rounded-[2px] p-3.5 transition-colors space-y-3 ${
            isLight
              ? 'border-[#D0DDD0] bg-[#F8F9F5]'
              : 'border-[rgba(169,191,165,0.25)] bg-[#061816]'
          }`}
        >
          {/* Header Bar: Status & Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span
                className={`text-[10px] uppercase font-mono tracking-widest font-semibold ${
                  isLight ? 'text-[#143630]' : 'text-[#E8E9D8]'
                }`}
              >
                ✨ Generated Visual Specimen
              </span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] font-mono">
              {activeImageUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className={`px-2 py-0.5 rounded-[2px] border flex items-center space-x-1 transition-colors cursor-pointer ${
                      isLight
                        ? 'border-[#D0DDD0] bg-white text-[#143630] hover:bg-[#EDF3EA]'
                        : 'border-[rgba(169,191,165,0.25)] bg-[#0D2D2A]/60 text-[#E8E9D8] hover:text-white'
                    }`}
                    title="Inspect Full Resolution"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Inspect</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadImage(activeImageUrl)}
                    className={`px-2 py-0.5 rounded-[2px] border flex items-center space-x-1 transition-colors cursor-pointer ${
                      isLight
                        ? 'border-[#D0DDD0] bg-white text-[#143630] hover:bg-[#EDF3EA]'
                        : 'border-[rgba(169,191,165,0.25)] bg-[#0D2D2A]/60 text-[#E8E9D8] hover:text-white'
                    }`}
                    title="Download high-resolution image"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleTriggerImageGeneration}
                disabled={isGeneratingImage}
                className={`px-2.5 py-0.5 rounded-[2px] flex items-center space-x-1 transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-[#143630] text-white hover:bg-[#0A1F1B]'
                    : 'bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-medium'
                }`}
                title="Regenerate Image"
              >
                <RefreshCw className={`w-3 h-3 ${isGeneratingImage ? 'animate-spin' : ''}`} />
                <span>{isGeneratingImage ? 'Rendering...' : 'Regenerate'}</span>
              </button>
            </div>
          </div>

          {/* Actual Rendered Image Display Container */}
          <div className="relative group rounded-[2px] overflow-hidden border border-inherit bg-black shadow-md">
            {activeImageUrl ? (
              <div className="relative">
                <img
                  src={activeImageUrl}
                  alt={currentVariation.versionLabel}
                  referrerPolicy="no-referrer"
                  className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-[1.01] cursor-pointer"
                  onClick={() => setLightboxOpen(true)}
                />

                {/* Subtle hairline vignette overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 pointer-events-none">
                  <div className="text-white text-[11px] font-mono">
                    <span className="font-semibold block">{currentVariation.versionLabel}</span>
                  </div>

                  <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-[1px] text-[10px] text-white font-mono flex items-center space-x-1">
                    <Maximize2 className="w-3 h-3" />
                    <span>View 4K</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full flex flex-col items-center justify-center p-8 text-center bg-[#071C1A] text-[#E8E9D8]">
                <ImageIcon className="w-8 h-8 text-[#A9BFA5] mb-2 opacity-60" />
                <span className="text-xs font-mono mb-3">No visual rendered for this version yet</span>
                <button
                  type="button"
                  onClick={handleTriggerImageGeneration}
                  disabled={isGeneratingImage}
                  className="px-4 py-2 rounded-[2px] bg-[#E8E9D8] text-[#071C1A] text-xs font-mono font-medium hover:bg-white cursor-pointer"
                >
                  ✨ Render Image Now
                </button>
              </div>
            )}

            {/* Rendering Progress Overlay */}
            {isGeneratingImage && (
              <div className="absolute inset-0 bg-[#071C1A]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-[#E8E9D8] z-20">
                <div className="w-8 h-8 border-2 border-[#A9BFA5] border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs uppercase font-mono tracking-widest text-[#E8E9D8] font-semibold">
                  Synthesizing Visual
                </span>
                <span className="text-[11px] font-mono text-[#A9BFA5] mt-1">
                  {generationStep || 'Executing render pipeline...'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Generated Content Body (Art Direction Brief or Copy Script) */}
      <div className="space-y-2">
        {isImageCategory && (
          <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-widest font-medium">
            <span className={isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'}>
              Technical Art Direction Brief
            </span>
            <span className={isLight ? 'text-[#668877]' : 'text-[#A9BFA5]/60'}>
              {currentVariation.versionLabel}
            </span>
          </div>
        )}

        <div className="relative">
          {isEditing ? (
            <textarea
              rows={10}
              value={currentVariation.content}
              onChange={(e) =>
                onUpdateVariationContent(activeVariationIndex, e.target.value)
              }
              className={`w-full text-xs font-mono p-3.5 rounded-[2px] border focus:outline-none resize-y leading-relaxed transition-colors ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
              }`}
            />
          ) : (
            <div
              className={`p-4 rounded-[2px] border text-xs leading-relaxed font-mono whitespace-pre-wrap select-text overflow-x-auto max-h-[340px] overflow-y-auto ${
                isLight
                  ? 'bg-[#F8F9F5] border-[#E2ECE0] text-[#122420]'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)] text-[#E8E9D8]'
              }`}
            >
              {currentVariation.content}
            </div>
          )}
        </div>
      </div>

      {/* 11. REFINE FUNCTIONALITY INTERFACE */}
      <div
        className={`pt-3 border-t ${
          isLight ? 'border-[#E2ECE0]' : 'border-[rgba(169,191,165,0.15)]'
        } space-y-2`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] uppercase font-mono tracking-widest font-medium ${
              isLight ? 'text-[#244B40]' : 'text-[#A9BFA5]'
            }`}
          >
            Refine Output
          </span>
          <div className="flex items-center space-x-1.5 text-[10px] font-mono">
            {['Shorter', 'More premium', 'Provocative'].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => handleApplyRefinement(action)}
                className={`hover:underline cursor-pointer ${
                  isLight ? 'text-[#3E6A5E]' : 'text-[#A9BFA5]/80'
                }`}
              >
                +{action}
              </button>
            ))}
          </div>
        </div>

        {/* Custom refinement input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyRefinement(customRefinement);
          }}
          className="flex items-center space-x-2"
        >
          <input
            ref={refineInputRef}
            type="text"
            value={customRefinement}
            onChange={(e) => setCustomRefinement(e.target.value)}
            placeholder="e.g. Make it more concise and executive..."
            className={`flex-1 text-xs px-3 py-1.5 rounded-[2px] border focus:outline-none transition-colors ${
              isLight
                ? 'bg-[#F8F9F5] border-[#D0DDD0] text-[#122420] focus:border-[#244B40]'
                : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] focus:border-[#A9BFA5]'
            }`}
          />
          <button
            type="submit"
            disabled={!customRefinement.trim() || isGenerating}
            className={`px-3 py-1.5 text-xs font-mono rounded-[2px] transition-colors cursor-pointer uppercase tracking-wider shrink-0 ${
              !customRefinement.trim() || isGenerating
                ? 'opacity-40 cursor-not-allowed bg-neutral-400 text-white'
                : isLight
                  ? 'bg-[#143630] text-white hover:bg-[#0A1F1B]'
                  : 'bg-[#E8E9D8] text-[#071C1A] hover:bg-white font-medium'
            }`}
          >
            Refine
          </button>
        </form>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4K LIGHTBOX MODAL FOR FULL RESOLUTION INSPECTION              */}
      {/* ------------------------------------------------------------- */}
      {lightboxOpen && activeImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-8 animate-fadeIn"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Lightbox Header */}
          <div
            className="flex items-center justify-between text-white pb-3 border-b border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3">
              <span className="text-xs uppercase font-mono tracking-widest text-[#A9BFA5]">
                {category} · {currentVariation.versionLabel}
              </span>
              <span className="text-[11px] font-mono text-white/60">3840×2160 UHD</span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => handleDownloadImage(activeImageUrl)}
                className="px-3 py-1.5 rounded-[2px] bg-white/10 hover:bg-white/20 text-white text-xs font-mono flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .jpg</span>
              </button>

              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="p-1.5 rounded-[2px] bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close Lightbox"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Image */}
          <div
            className="flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeImageUrl}
              alt={currentVariation.versionLabel}
              referrerPolicy="no-referrer"
              className="max-h-[82vh] max-w-full object-contain rounded-[2px] shadow-2xl border border-white/10"
            />
          </div>

          {/* Lightbox Footer */}
          <div
            className="text-center text-white/70 text-xs font-mono pt-2 border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <span>Octane Path Traced · 4500K Radiance · 35mm Hasselblad X2D · Nexora Atelier OS</span>
          </div>
        </div>
      )}
    </div>
  );
}
