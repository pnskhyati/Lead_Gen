import React from 'react';

interface HeroProps {
  onGetStarted: () => void;
  onLearnMore: () => void;
}

export default function Hero({ onGetStarted, onLearnMore }: HeroProps) {
  return (
    <section className="relative z-10 min-h-[calc(100vh-6rem)] flex flex-col justify-center max-w-5xl mx-auto px-6 sm:px-12 pt-16 pb-20 sm:pt-20 sm:pb-28 text-center">
      {/* Category Eyebrow: text-[10px] uppercase tracking-widest-plus text-[#A9BFA5] */}
      <div className="mb-6">
        <span 
          id="hero-eyebrow"
          className="text-[10px] sm:text-xs uppercase tracking-widest-plus text-[#A9BFA5] font-normal inline-block"
        >
          CREATE · SCHEDULE · MANAGE
        </span>
      </div>

      {/* Main title: serif text-[110px] leading-none mb-6 font-light tracking-tight */}
      <div className="relative mb-6">
        <h1 
          id="hero-title"
          className="serif text-7xl sm:text-9xl lg:text-[110px] xl:text-[120px] font-light text-[#E8E9D8] tracking-tight leading-none lowercase select-none"
        >
          nexora
        </h1>
      </div>

      {/* Subtitles: 2xl font-light and italic accent */}
      <div className="max-w-2xl mx-auto">
        <h2 
          id="hero-subheading"
          className="serif text-2xl sm:text-3xl font-light text-[#E8E9D8] leading-tight mb-2"
        >
          Everything you need.
        </h2>
        <p className="serif text-2xl sm:text-3xl font-light text-[#A9BFA5] italic mb-6 sm:mb-8">
          All in one place.
        </p>

        {/* Supporting description */}
        <p 
          id="hero-description"
          className="text-[#A9BFA5] text-xs sm:text-sm max-w-md mx-auto mb-10 opacity-80 leading-relaxed font-light"
        >
          Create, schedule, and manage everything effortlessly from one simple workspace.
        </p>
      </div>

      {/* Actions: Elegant minimalist uppercase tracking-widest link buttons */}
      <div className="flex items-center justify-center space-x-8 sm:space-x-10">
        <button
          type="button"
          id="hero-get-started-button"
          onClick={onGetStarted}
          className="group inline-flex items-center text-xs sm:text-sm uppercase tracking-widest border-b border-[#E8E9D8] pb-1 text-[#E8E9D8] hover:text-white transition-all cursor-pointer focus:outline-none"
        >
          <span>Get started</span>
          <span className="ml-2 group-hover:translate-x-1 transition-transform">&rarr;</span>
        </button>

        <button
          type="button"
          id="hero-learn-more-button"
          onClick={onLearnMore}
          className="text-xs sm:text-sm uppercase tracking-widest text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors cursor-pointer focus:outline-none"
        >
          Learn more
        </button>
      </div>

      {/* Bottom metadata footnote with thin-border */}
      <div className="mt-20 sm:mt-24 pt-6 border-t border-[rgba(169,191,165,0.2)] flex flex-wrap justify-between items-center text-[10px] sm:text-xs uppercase tracking-widest text-[#A9BFA5]/60 font-light">
        <span>Calm Productivity Architecture</span>
        <span className="hidden sm:inline-block">Deliberate simplicity & uncluttered execution</span>
        <span>01 // System</span>
      </div>
    </section>
  );
}

