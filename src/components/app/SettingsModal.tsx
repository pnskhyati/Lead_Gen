import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sun, 
  Moon, 
  Laptop, 
  Check, 
  Sliders, 
  Bell, 
  User, 
  Sparkles,
  ShieldCheck,
  Palette
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (title: string, desc: string) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onNotify
}: SettingsModalProps) {
  const { theme, setTheme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'appearance' | 'workspace' | 'notifications'>('appearance');

  // Additional subtle preferences
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [compactDensity, setCompactDensity] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    if (onNotify) {
      onNotify(
        newTheme === 'light' ? 'Light Mode Enabled' : 'Dark Mode Enabled',
        newTheme === 'light' 
          ? 'Switched the entire application to the Botanical Ivory light palette.' 
          : 'Switched the entire application to the Botanical Noir dark palette.'
      );
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#061816] border border-[rgba(169,191,165,0.25)] shadow-2xl rounded-[2px] overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp text-[#E8E9D8]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(169,191,165,0.18)] bg-[#071C1A]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-[2px] bg-[#0D2D2A] border border-[rgba(169,191,165,0.25)] flex items-center justify-center text-[#A9BFA5]">
              <Sliders className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="serif text-xl sm:text-2xl font-light tracking-tight text-[#E8E9D8]">
                Application Settings
              </h2>
              <p className="text-[11px] text-[#A9BFA5]/70 font-light">
                Configure theme appearance, display density, and workspace defaults.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#A9BFA5]/60 hover:text-[#E8E9D8] hover:bg-[rgba(169,191,165,0.1)] rounded transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="flex border-b border-[rgba(169,191,165,0.15)] bg-[#071C1A]/60 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`py-3 px-3.5 text-xs font-mono uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeTab === 'appearance'
                ? 'border-[#A9BFA5] text-[#E8E9D8] font-semibold bg-[#0D2D2A]/30'
                : 'border-transparent text-[#A9BFA5]/60 hover:text-[#E8E9D8]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Appearance & Theme</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`py-3 px-3.5 text-xs font-mono uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeTab === 'workspace'
                ? 'border-[#A9BFA5] text-[#E8E9D8] font-semibold bg-[#0D2D2A]/30'
                : 'border-transparent text-[#A9BFA5]/60 hover:text-[#E8E9D8]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`py-3 px-3.5 text-xs font-mono uppercase tracking-wider transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
              activeTab === 'notifications'
                ? 'border-[#A9BFA5] text-[#E8E9D8] font-semibold bg-[#0D2D2A]/30'
                : 'border-transparent text-[#A9BFA5]/60 hover:text-[#E8E9D8]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme Mode Picker */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-[#E8E9D8] tracking-wide">
                      Theme Mode
                    </h3>
                    <p className="text-xs text-[#A9BFA5]/75 font-light">
                      Choose between the high-clarity light theme and the classic botanical dark theme.
                    </p>
                  </div>

                  {/* Quick Toggle Button */}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-[2px] border border-[rgba(169,191,165,0.25)] bg-[#071C1A] text-xs font-mono text-[#A9BFA5] hover:text-[#E8E9D8] hover:border-[#A9BFA5] transition-all cursor-pointer"
                  >
                    {theme === 'light' ? (
                      <>
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>Light active &mdash; Switch to Dark</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 text-sky-300" />
                        <span>Dark active &mdash; Switch to Light</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Visual Theme Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  {/* 1. Light Mode Card */}
                  <div
                    onClick={() => handleSelectTheme('light')}
                    className={`border p-4 rounded-[2px] cursor-pointer transition-all duration-200 relative group flex flex-col justify-between ${
                      theme === 'light'
                        ? 'bg-[#0D2D2A] border-[#A9BFA5] ring-2 ring-[#A9BFA5]/40 shadow-lg'
                        : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)] hover:border-[rgba(169,191,165,0.4)] hover:bg-[#09221F]'
                    }`}
                  >
                    <div>
                      {/* Mini Mockup Thumbnail */}
                      <div className="w-full h-24 rounded-[2px] bg-[#F8F9F5] border border-stone-200 p-2.5 flex flex-col justify-between mb-3 shadow-inner overflow-hidden select-none">
                        {/* Mock topbar */}
                        <div className="flex items-center justify-between border-b border-stone-200 pb-1.5">
                          <span className="serif text-[11px] font-bold text-[#142824] lowercase">nexora</span>
                          <div className="flex space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3D5A50]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                          </div>
                        </div>
                        {/* Mock cards */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="bg-white border border-stone-200 p-1.5 rounded-[1px]">
                            <span className="text-[8px] text-[#416055] font-mono block">Contacted</span>
                            <span className="serif text-[11px] font-bold text-[#142824]">16 leads</span>
                          </div>
                          <div className="bg-white border border-stone-200 p-1.5 rounded-[1px]">
                            <span className="text-[8px] text-[#416055] font-mono block">Conversion</span>
                            <span className="serif text-[11px] font-bold text-[#142824]">64%</span>
                          </div>
                        </div>
                      </div>

                      {/* Header & Badges */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          <Sun className="w-4 h-4 text-amber-400" />
                          <h4 className="serif text-base font-light text-[#E8E9D8]">
                            Light Mode
                          </h4>
                        </div>
                        {theme === 'light' && (
                          <span className="w-5 h-5 rounded-full bg-[#E8E9D8] text-[#071C1A] flex items-center justify-center shadow-sm">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#A9BFA5]/75 font-light leading-relaxed">
                        Crisp porcelain palette (<span className="font-mono text-[10px]">#F8F9F5</span>) with clean white cards, deep forest text, and clear contrast.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[rgba(169,191,165,0.15)] flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#A9BFA5]/60">Botanical Ivory</span>
                      <span className={theme === 'light' ? 'text-[#E8E9D8] font-bold' : 'text-[#A9BFA5]/40'}>
                        {theme === 'light' ? 'Active' : 'Click to select'}
                      </span>
                    </div>
                  </div>

                  {/* 2. Dark Mode Card */}
                  <div
                    onClick={() => handleSelectTheme('dark')}
                    className={`border p-4 rounded-[2px] cursor-pointer transition-all duration-200 relative group flex flex-col justify-between ${
                      theme === 'dark'
                        ? 'bg-[#0D2D2A] border-[#A9BFA5] ring-2 ring-[#A9BFA5]/40 shadow-lg'
                        : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)] hover:border-[rgba(169,191,165,0.4)] hover:bg-[#09221F]'
                    }`}
                  >
                    <div>
                      {/* Mini Mockup Thumbnail */}
                      <div className="w-full h-24 rounded-[2px] bg-[#071C1A] border border-[rgba(169,191,165,0.3)] p-2.5 flex flex-col justify-between mb-3 shadow-inner overflow-hidden select-none">
                        {/* Mock topbar */}
                        <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.2)] pb-1.5">
                          <span className="serif text-[11px] font-bold text-[#E8E9D8] lowercase">nexora</span>
                          <div className="flex space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#A9BFA5]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0D2D2A]" />
                          </div>
                        </div>
                        {/* Mock cards */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="bg-[#061816] border border-[rgba(169,191,165,0.2)] p-1.5 rounded-[1px]">
                            <span className="text-[8px] text-[#A9BFA5] font-mono block">Contacted</span>
                            <span className="serif text-[11px] font-bold text-[#E8E9D8]">16 leads</span>
                          </div>
                          <div className="bg-[#061816] border border-[rgba(169,191,165,0.2)] p-1.5 rounded-[1px]">
                            <span className="text-[8px] text-[#A9BFA5] font-mono block">Conversion</span>
                            <span className="serif text-[11px] font-bold text-[#E8E9D8]">64%</span>
                          </div>
                        </div>
                      </div>

                      {/* Header & Badges */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          <Moon className="w-4 h-4 text-sky-300" />
                          <h4 className="serif text-base font-light text-[#E8E9D8]">
                            Dark Mode
                          </h4>
                        </div>
                        {theme === 'dark' && (
                          <span className="w-5 h-5 rounded-full bg-[#E8E9D8] text-[#071C1A] flex items-center justify-center shadow-sm">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#A9BFA5]/75 font-light leading-relaxed">
                        Classic deep botanical teal palette (<span className="font-mono text-[10px]">#071C1A</span>) with warm cream typography and luminous sage telemetry.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[rgba(169,191,165,0.15)] flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#A9BFA5]/60">Botanical Noir</span>
                      <span className={theme === 'dark' ? 'text-[#E8E9D8] font-bold' : 'text-[#A9BFA5]/40'}>
                        {theme === 'dark' ? 'Active' : 'Click to select'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Display Enhancements */}
              <div className="pt-4 border-t border-[rgba(169,191,165,0.15)] space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-widest text-[#A9BFA5]/70">
                  Display Preferences
                </h4>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 border border-[rgba(169,191,165,0.18)] bg-[#071C1A] rounded-[2px] cursor-pointer hover:border-[rgba(169,191,165,0.35)] transition-colors">
                    <div>
                      <span className="text-xs font-medium text-[#E8E9D8] block">High Contrast Accents</span>
                      <span className="text-[11px] text-[#A9BFA5]/65 font-light">Enforce AAA ratio on telemetry badges and grid outlines</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={highContrast}
                      onChange={(e) => setHighContrast(e.target.checked)}
                      className="w-4 h-4 accent-[#A9BFA5] cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 border border-[rgba(169,191,165,0.18)] bg-[#071C1A] rounded-[2px] cursor-pointer hover:border-[rgba(169,191,165,0.35)] transition-colors">
                    <div>
                      <span className="text-xs font-medium text-[#E8E9D8] block">Compact Table Density</span>
                      <span className="text-[11px] text-[#A9BFA5]/65 font-light">Decrease vertical padding in live leads and stats grids</span>
                    </div>
                    <input 
                      type="checkbox"
                      checked={compactDensity}
                      onChange={(e) => setCompactDensity(e.target.checked)}
                      className="w-4 h-4 accent-[#A9BFA5] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#E8E9D8]">Workspace Identity</h3>
              <div className="space-y-3">
                <div className="p-3.5 border border-[rgba(169,191,165,0.2)] bg-[#071C1A] rounded-[2px] space-y-1">
                  <span className="text-[10px] font-mono text-[#A9BFA5]/60 uppercase tracking-wider block">Organization</span>
                  <p className="text-sm text-[#E8E9D8] font-medium">Nexora Studios Ltd.</p>
                  <p className="text-xs text-[#A9BFA5]/70">Tokyo &bull; London &bull; Zurich</p>
                </div>

                <div className="p-3.5 border border-[rgba(169,191,165,0.2)] bg-[#071C1A] rounded-[2px] space-y-1">
                  <span className="text-[10px] font-mono text-[#A9BFA5]/60 uppercase tracking-wider block">Account Tier</span>
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-[#E8E9D8] font-medium">Pro Enterprise Workspace</span>
                  </div>
                  <p className="text-xs text-[#A9BFA5]/70">Unlimited AI campaign roadmaps & 100,000 monthly lead sync credits.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-[#E8E9D8]">Notification Routing</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3.5 border border-[rgba(169,191,165,0.2)] bg-[#071C1A] rounded-[2px] cursor-pointer">
                  <div>
                    <span className="text-xs font-medium text-[#E8E9D8] block">Audible Feedback</span>
                    <span className="text-[11px] text-[#A9BFA5]/70 font-light">Play quiet chime upon campaign generation or lead qualification</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#A9BFA5] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(169,191,165,0.18)] bg-[#071C1A] flex items-center justify-between">
          <span className="text-[11px] text-[#A9BFA5]/60 font-mono">
            {theme === 'light' ? 'Mode: Light (Botanical Ivory)' : 'Mode: Dark (Botanical Noir)'}
          </span>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#E8E9D8] text-[#071C1A] px-5 py-2 rounded-[2px] font-semibold text-xs uppercase tracking-wider hover:bg-white transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
