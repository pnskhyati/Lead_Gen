import React from 'react';
import { PenLine, Calendar, SlidersHorizontal, ArrowUpRight } from 'lucide-react';

interface FeaturesProps {
  onOpenApp: () => void;
}

export default function Features({ onOpenApp }: FeaturesProps) {
  const features = [
    {
      number: '01',
      label: 'Create',
      icon: PenLine,
      description: 'Bring your ideas to life and turn them into organized projects and tasks.',
      nuance: 'Frictionless ideation with fluid outlining, fast drafting, and structured thought spaces.',
      facets: ['Fluid ideation', 'Project architectures', 'Effortless drafting']
    },
    {
      number: '02',
      label: 'Schedule',
      icon: Calendar,
      description: 'Plan what matters and keep everything moving at the right time.',
      nuance: 'Harmonize your hours with intuitive time blocks, milestone pacing, and realistic horizons.',
      facets: ['Rhythm over rush', 'Horizon planning', 'Uninterrupted flow']
    },
    {
      number: '03',
      label: 'Manage',
      icon: SlidersHorizontal,
      description: 'Keep your work, plans, and priorities organized in one place.',
      nuance: 'A singular command view to track progress, eliminate decision fatigue, and maintain forward momentum.',
      facets: ['Singular focus queue', 'Cognitive clarity', 'Progress without noise']
    }
  ];

  return (
    <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-24 sm:py-32 border-t border-[rgba(169,191,165,0.2)]">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 sm:mb-20 gap-8">
        <div>
          <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-3">
            CORE CAPABILITIES
          </span>
          <h2 className="serif text-4xl sm:text-5xl md:text-6xl font-light text-[#E8E9D8] tracking-tight">
            One place. Everything handled.
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[#A9BFA5] max-w-md opacity-80 leading-relaxed font-light">
          Traditional workflows scatter attention across dozens of disconnected tools. Nexora restores poise through three interconnected disciplines.
        </p>
      </div>

      {/* 3-Column Grid with thin-border styling matching the Sophisticated Dark pattern */}
      <div className="grid grid-cols-1 lg:grid-cols-3 border-t border-b border-[rgba(169,191,165,0.2)] divide-y lg:divide-y-0 lg:divide-x divide-[rgba(169,191,165,0.2)]">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div 
              key={feature.number}
              id={`feature-item-${idx}`}
              className="p-8 sm:p-10 lg:p-12 group transition-colors duration-300 hover:bg-[#0D2D2A]/20"
            >
              {/* Numeral: serif text-3xl mb-4 opacity-40 italic */}
              <div className="flex items-baseline justify-between mb-4">
                <span className="serif text-3xl opacity-40 italic text-[#E8E9D8] group-hover:opacity-70 transition-opacity">
                  {feature.number}
                </span>
                <Icon className="w-4 h-4 text-[#A9BFA5]/60 group-hover:text-[#E8E9D8] transition-colors" strokeWidth={1.5} />
              </div>

              {/* Title: text-xs uppercase tracking-widest font-bold mb-3 */}
              <h3 className="text-xs uppercase tracking-widest font-bold mb-3 text-[#E8E9D8]">
                {feature.label}
              </h3>

              {/* Core Description: text-[#A9BFA5] text-xs sm:text-sm leading-relaxed */}
              <p className="text-[#A9BFA5] text-xs sm:text-sm leading-relaxed mb-4">
                {feature.description}
              </p>

              {/* Nuance */}
              <p className="text-[#A9BFA5]/70 text-xs leading-relaxed mb-6 font-light">
                {feature.nuance}
              </p>

              {/* Thin hairline accent */}
              <div className="w-8 h-px bg-[rgba(169,191,165,0.2)] group-hover:w-full group-hover:bg-[#A9BFA5]/40 transition-all duration-300 mb-6" />

              {/* Facets */}
              <ul className="space-y-2 text-[11px] uppercase tracking-widest text-[#A9BFA5]/60 font-light">
                {feature.facets.map((facet, i) => (
                  <li key={i} className="flex items-center space-x-2">
                    <span className="w-1 h-px bg-[#A9BFA5]/40" />
                    <span>{facet}</span>
                  </li>
                ))}
              </ul>

              {/* Action link */}
              <div className="mt-8 pt-4">
                <button
                  type="button"
                  onClick={onOpenApp}
                  className="inline-flex items-center text-[11px] uppercase tracking-widest text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer focus:outline-none"
                >
                  <span>Explore {feature.label}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 ml-1.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

