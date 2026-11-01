import React, { useState } from 'react';
import { Sparkles, Compass, CheckCircle2, ArrowRight } from 'lucide-react';

interface HowItWorksProps {
  onOpenApp: () => void;
}

export default function HowItWorks({ onOpenApp }: HowItWorksProps) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      num: '01',
      title: 'Capture',
      lead: 'Start with an idea, task, or plan.',
      description: 'Write freely in pure text without categorizing upfront. Ideas land in a calm inbox designed for instant velocity and zero distraction.',
      insight: 'Nothing gets lost; nothing demands premature sorting. Pure cognitive relief.',
      icon: Sparkles
    },
    {
      num: '02',
      title: 'Organize',
      lead: 'Structure everything exactly how you need it.',
      description: 'Assign milestones, allocate time windows, or nest sub-tasks into lucid project architectures with effortless keyboard navigation.',
      insight: 'Transform abstract thoughts into executable plans with natural date expressions.',
      icon: Compass
    },
    {
      num: '03',
      title: 'Get it done',
      lead: 'Stay on top of your work without the clutter.',
      description: 'Filter out the noise. When it is time to execute, Nexora presents solely what is actionable today, shielding your mental bandwidth.',
      insight: 'One unified horizon. Meaningful momentum without the constant anxiety of 50 open tabs.',
      icon: CheckCircle2
    }
  ];

  return (
    <section id="how-it-works" className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-24 sm:py-32 border-t border-[rgba(169,191,165,0.2)]">
      {/* Section Header */}
      <div className="mb-16 sm:mb-20">
        <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-3">
          A THREE-STEP RHYTHM
        </span>
        <h2 className="serif text-4xl sm:text-5xl md:text-6xl font-light text-[#E8E9D8] tracking-tight">
          How it works.
        </h2>
        <p className="mt-4 text-xs sm:text-sm text-[#A9BFA5] max-w-xl opacity-80 font-light leading-relaxed">
          A seamless transition from spontaneous thought to calm completion. No complicated setup, no mandatory onboarding hurdles.
        </p>
      </div>

      {/* Editorial Step Flow: Typography and Thin Lines, Zero Cards */}
      <div className="space-y-0 divide-y divide-[rgba(169,191,165,0.2)] border-y border-[rgba(169,191,165,0.2)]">
        {steps.map((step, idx) => {
          const isSelected = activeStep === idx;
          const Icon = step.icon;

          return (
            <div 
              key={step.num}
              id={`how-it-works-step-${idx}`}
              onClick={() => setActiveStep(idx)}
              className={`py-10 sm:py-14 px-4 sm:px-6 transition-colors duration-300 cursor-pointer group ${
                isSelected ? 'bg-[#0D2D2A]/30' : 'hover:bg-[#0D2D2A]/15'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-baseline">
                {/* Numeral */}
                <div className="md:col-span-2 flex items-baseline justify-between md:justify-start space-x-4">
                  <span className={`serif text-3xl sm:text-4xl italic font-light transition-colors ${
                    isSelected ? 'text-[#E8E9D8]' : 'text-[#A9BFA5]/40 group-hover:text-[#A9BFA5]/80'
                  }`}>
                    {step.num}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 font-light md:hidden">
                    Step {step.num}
                  </span>
                </div>

                {/* Title & Core Lead */}
                <div className="md:col-span-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <Icon className={`w-4 h-4 transition-colors ${
                      isSelected ? 'text-[#A9BFA5]' : 'text-[#A9BFA5]/50 group-hover:text-[#E8E9D8]'
                    }`} strokeWidth={1.5} />
                    <h3 className={`serif text-2xl sm:text-3xl font-light tracking-tight transition-colors ${
                      isSelected ? 'text-[#E8E9D8]' : 'text-[#E8E9D8]/80 group-hover:text-[#E8E9D8]'
                    }`}>
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm uppercase tracking-widest font-semibold text-[#E8E9D8] leading-snug">
                    {step.lead}
                  </p>
                </div>

                {/* Deep Description & Insight */}
                <div className="md:col-span-6">
                  <p className="text-xs sm:text-sm text-[#A9BFA5] font-light leading-relaxed mb-3">
                    {step.description}
                  </p>
                  <p className="serif text-xs sm:text-sm text-[#A9BFA5]/60 italic">
                    {step.insight}
                  </p>
                </div>
              </div>

              {/* Active step progress indicator rule */}
              <div className="mt-6 relative h-px w-full bg-[rgba(169,191,165,0.15)] overflow-hidden">
                <div 
                  className={`absolute left-0 top-0 h-full bg-[#E8E9D8] transition-all duration-500 ${
                    isSelected ? 'w-full opacity-60' : 'w-0 opacity-0'
                  }`} 
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive step trigger to test in app */}
      <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-4">
        <span className="text-[10px] sm:text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-light">
          Active Mode: {steps[activeStep].title} — Ready to experience?
        </span>
        <button
          type="button"
          onClick={onOpenApp}
          className="inline-flex items-center text-xs uppercase tracking-widest text-[#E8E9D8] hover:text-white group cursor-pointer focus:outline-none"
        >
          <span className="border-b border-[#E8E9D8]/60 pb-1 group-hover:border-white transition-colors">
            Try this workflow in the workspace &rarr;
          </span>
        </button>
      </div>
    </section>
  );
}
