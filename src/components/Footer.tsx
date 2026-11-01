import React from 'react';

interface FooterProps {
  onOpenApp: () => void;
  onContactClick: () => void;
  onPrivacyClick: () => void;
  onTermsClick: () => void;
}

export default function Footer({ onOpenApp, onContactClick, onPrivacyClick, onTermsClick }: FooterProps) {
  return (
    <footer className="relative z-10 border-t border-[rgba(169,191,165,0.2)] bg-[#071C1A]/90">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 py-8 sm:py-10 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest text-[#A9BFA5]">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <a 
            href="#" 
            className="serif text-xl font-medium tracking-tight text-[#E8E9D8] hover:text-white transition-colors lowercase"
          >
            nexora
          </a>
          <span className="opacity-40">/</span>
          <span className="text-[#A9BFA5]/60">&copy; {new Date().getFullYear()} nexora systems</span>
        </div>

        {/* Text links */}
        <div className="flex flex-wrap items-center space-x-8">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-white transition-colors">
            How it works
          </a>
          <a href="#about" className="hover:text-white transition-colors">
            About
          </a>
          <button 
            type="button" 
            onClick={onContactClick} 
            className="hover:text-white transition-colors cursor-pointer uppercase tracking-widest"
          >
            Contact
          </button>
          <button 
            type="button" 
            onClick={onPrivacyClick} 
            className="hover:text-white transition-colors cursor-pointer uppercase tracking-widest"
          >
            Privacy
          </button>
          <button 
            type="button" 
            onClick={onTermsClick} 
            className="hover:text-white transition-colors cursor-pointer uppercase tracking-widest"
          >
            Terms
          </button>
        </div>
      </div>
    </footer>
  );
}

