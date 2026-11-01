import React from 'react';
import { ArrowRight } from 'lucide-react';

interface FinalCTAProps {
  onGetStarted: () => void;
}

export default function FinalCTA({ onGetStarted }: FinalCTAProps) {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 sm:px-12 py-32 sm:py-44 border-t border-[rgba(169,191,165,0.2)] text-center overflow-hidden">
      {/* Soft central sage luminescence */}
      <div 
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full blur-[140px] pointer-events-none opacity-[0.08]"
        style={{ background: 'radial-gradient(circle, #A9BFA5 0%, #173832 60%, transparent 80%)' }}
      />

      {/* Decorative ambient vector curves */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1200 400"
      >
        <path
          d="M 100 300 C 400 150, 800 150, 1100 300"
          fill="none"
          stroke="#A9BFA5"
          strokeWidth="0.75"
          strokeDasharray="4 6"
        />
        <circle cx="600" cy="180" r="140" fill="none" stroke="#A9BFA5" strokeWidth="0.4" strokeDasharray="3 6" opacity="0.3" />
      </svg>

      <div className="relative z-10 max-w-3xl mx-auto">
        <span className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal block mb-6">
          THE CALM WORKSPACE
        </span>

        {/* Heading: Make space for what matters. */}
        <h2 
          id="cta-title"
          className="serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light text-[#E8E9D8] tracking-tight leading-[1.05]"
        >
          Make space for<br />
          <span className="italic text-[#A9BFA5] font-normal">what matters.</span>
        </h2>

        {/* Supporting text */}
        <p 
          id="cta-description"
          className="mt-6 text-xs sm:text-sm md:text-base text-[#A9BFA5] font-light leading-relaxed max-w-xl mx-auto opacity-80"
        >
          Nexora brings creating, scheduling, and managing together — so you can focus on doing.
        </p>

        {/* Button: Sophisticated Dark uppercase button */}
        <div className="mt-10">
          <button
            type="button"
            id="cta-get-started-button"
            onClick={onGetStarted}
            className="group inline-flex items-center justify-center bg-[#E8E9D8] text-[#071C1A] px-8 sm:px-9 py-3.5 sm:py-4 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-all duration-200 cursor-pointer focus:outline-none shadow-sm"
          >
            <span>Get started</span>
            <ArrowRight className="ml-2.5 w-4 h-4 text-current group-hover:translate-x-1 transition-transform duration-200" strokeWidth={1.75} />
          </button>
        </div>

        {/* Discreet reassurance */}
        <div className="mt-8 flex items-center justify-center space-x-6 text-[10px] uppercase tracking-widest text-[#A9BFA5]/60 font-light">
          <span>No credit card required</span>
          <span className="w-1 h-1 bg-[#A9BFA5]/40 rounded-full" />
          <span>Instant setup</span>
          <span className="w-1 h-1 bg-[#A9BFA5]/40 rounded-full" />
          <span>Full private encryption</span>
        </div>
      </div>
    </section>
  );
}

