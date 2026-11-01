import React, { useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  onOpenApp: (mode: 'login' | 'signup') => void;
}

export default function Navbar({ onOpenApp }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="relative z-30 w-full thin-border border-b border-[rgba(169,191,165,0.2)] bg-[#071C1A]/80 backdrop-blur-sm transition-colors">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 py-6 sm:py-7 flex items-center justify-between">
        {/* Left: nexora brand */}
        <a 
          href="#"
          id="navbar-brand"
          className="group flex items-center space-x-2 focus:outline-none"
        >
          <span className="serif text-2xl sm:text-3xl font-medium tracking-tight text-[#E8E9D8] group-hover:text-white transition-colors lowercase">
            nexora
          </span>
          <span className="inline-block w-1.5 h-1.5 bg-[#A9BFA5] rounded-full opacity-60 group-hover:opacity-100 transition-opacity" />
        </a>

        {/* Center/right navigation links (desktop) */}
        <nav className="hidden md:flex items-center space-x-12 text-xs sm:text-sm uppercase tracking-widest text-[#A9BFA5]">
          <a 
            href="#features" 
            id="nav-features"
            className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 hover:after:w-full after:h-px after:bg-[#E8E9D8] after:transition-all"
          >
            Features
          </a>
          <a 
            href="#how-it-works" 
            id="nav-how-it-works"
            className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 hover:after:w-full after:h-px after:bg-[#E8E9D8] after:transition-all"
          >
            How it works
          </a>
          <a 
            href="#about" 
            id="nav-about"
            className="hover:text-white transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 hover:after:w-full after:h-px after:bg-[#E8E9D8] after:transition-all"
          >
            About
          </a>
        </nav>

        {/* Far right: Log in & Get started */}
        <div className="hidden md:flex items-center space-x-6 text-sm">
          <button
            type="button"
            id="nav-theme-toggle"
            onClick={toggleTheme}
            className="text-[#A9BFA5] hover:text-[#E8E9D8] p-1.5 focus:outline-none cursor-pointer transition-colors rounded-[2px]"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle theme mode"
          >
            {theme === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
            ) : (
              <Moon className="w-4 h-4 text-sky-300" strokeWidth={1.5} />
            )}
          </button>

          <button
            type="button"
            id="nav-login-button"
            onClick={() => onOpenApp('login')}
            className="text-xs sm:text-sm uppercase tracking-widest text-[#A9BFA5] hover:text-[#E8E9D8] transition-colors focus:outline-none cursor-pointer"
          >
            Log in
          </button>
          <button
            type="button"
            id="nav-get-started-button"
            onClick={() => onOpenApp('signup')}
            className="bg-[#E8E9D8] text-[#071C1A] px-6 py-2.5 rounded-[2px] font-semibold uppercase tracking-widest text-xs hover:bg-white transition-all duration-200 cursor-pointer focus:outline-none shadow-sm"
          >
            Get started
          </button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center space-x-4">
          <button
            type="button"
            id="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-[#E8E9D8] p-1.5 focus:outline-none hover:text-[#A9BFA5] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" strokeWidth={1.5} /> : <Menu className="w-5 h-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile navigation dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[rgba(169,191,165,0.2)] bg-[#071C1A] px-6 py-8 space-y-6 animate-fadeIn">
          <nav className="flex flex-col space-y-4 text-xs uppercase tracking-widest text-[#A9BFA5]">
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)} 
              className="hover:text-white transition-colors"
            >
              Features
            </a>
            <a 
              href="#how-it-works" 
              onClick={() => setMobileMenuOpen(false)} 
              className="hover:text-white transition-colors"
            >
              How it works
            </a>
            <a 
              href="#about" 
              onClick={() => setMobileMenuOpen(false)} 
              className="hover:text-white transition-colors"
            >
              About
            </a>
          </nav>
          <div className="pt-4 border-t border-[rgba(169,191,165,0.2)] flex flex-col space-y-3">
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); onOpenApp('login'); }}
              className="text-left text-xs uppercase tracking-widest text-[#A9BFA5] hover:text-[#E8E9D8] py-2"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); onOpenApp('signup'); }}
              className="w-full text-center text-xs font-semibold uppercase tracking-widest text-[#071C1A] bg-[#E8E9D8] hover:bg-white py-3 rounded-[2px]"
            >
              Get started
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

