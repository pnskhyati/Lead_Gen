import React from 'react';

export default function EditorialPhilosophy() {
  return (
    <section id="about" className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-24 sm:py-36 border-t border-[rgba(169,191,165,0.2)]">
      {/* Editorial Header */}
      <div className="max-w-3xl mb-16 sm:mb-24">
        <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-3">
          ABOUT & PHILOSOPHY
        </span>
        <h2 className="serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light text-[#E8E9D8] tracking-tight leading-[1.08]">
          Clarity is not found by adding more tools.<br />
          <span className="italic text-[#A9BFA5] font-normal">It begins when you subtract the noise.</span>
        </h2>
      </div>

      {/* Editorial Two-Column Text with Central Hairline Divider */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 pt-8 border-t border-[rgba(169,191,165,0.2)]">
        <div className="lg:col-span-5 space-y-6">
          <p className="serif text-2xl sm:text-3xl text-[#E8E9D8] font-light leading-snug">
            We built Nexora out of exhaustion with the relentless complexity of contemporary software.
          </p>
          <div className="w-16 h-px bg-[rgba(169,191,165,0.2)]" />
          <p className="text-xs sm:text-sm text-[#A9BFA5] font-light leading-relaxed">
            Most productivity suites demand that you spend your working day maintaining the tools themselves — categorizing labels, configuring complex notification trees, and switching across five browser tabs just to plan a single afternoon.
          </p>
        </div>

        <div className="lg:col-span-7 space-y-6 lg:pl-8 lg:border-l border-[rgba(169,191,165,0.2)]">
          <p className="text-xs sm:text-sm text-[#E8E9D8] font-light leading-relaxed">
            Nexora unifies creating, scheduling, and managing into a single cohesive surface. When your notes, your calendar, and your active projects share the exact same visual vocabulary, your mind ceases context-switching.
          </p>
          <p className="text-xs sm:text-sm text-[#A9BFA5]/80 font-light leading-relaxed">
            There are no flashing notification badges here. No gamified badges or dopamine trackers. Just pure, disciplined negative space, thoughtful typography, and the calm necessary to produce your finest work.
          </p>

          {/* Editorial Principles List - Clean hairline separation */}
          <div className="pt-8 mt-8 border-t border-[rgba(169,191,165,0.2)] grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <span className="serif text-2xl opacity-40 italic text-[#E8E9D8] block mb-2 font-light">01</span>
              <h4 className="text-xs uppercase tracking-widest font-bold text-[#E8E9D8] mb-2">Zero Latency</h4>
              <p className="text-xs text-[#A9BFA5] font-light leading-relaxed">
                Instant keyboard commands and immediate responsiveness.
              </p>
            </div>
            <div>
              <span className="serif text-2xl opacity-40 italic text-[#E8E9D8] block mb-2 font-light">02</span>
              <h4 className="text-xs uppercase tracking-widest font-bold text-[#E8E9D8] mb-2">Dark Botanical</h4>
              <p className="text-xs text-[#A9BFA5] font-light leading-relaxed">
                Subtle organic green tones designed to comfort human vision.
              </p>
            </div>
            <div>
              <span className="serif text-2xl opacity-40 italic text-[#E8E9D8] block mb-2 font-light">03</span>
              <h4 className="text-xs uppercase tracking-widest font-bold text-[#E8E9D8] mb-2">Singular Horizon</h4>
              <p className="text-xs text-[#A9BFA5] font-light leading-relaxed">
                View only what matters for this present moment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

