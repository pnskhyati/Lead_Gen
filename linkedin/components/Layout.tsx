
import React, { useState } from 'react';
import { LinkedInUser, WorkflowStep } from '../types';

/** Compact status bar for LinkedIn Hub inside Nexora (not a second product chrome). */
export const HubStatusBar: React.FC<{
  user: LinkedInUser | null;
  onLogout: () => void;
  onLogin: () => void;
  onViewDashboard?: () => void;
}> = ({ user, onLogout, onLogin, onViewDashboard }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="bg-white/90 backdrop-blur-xl border border-white shadow-soft rounded-3xl py-3.5 px-5 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-soft-sky text-soft-azure rounded-2xl flex items-center justify-center">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.238 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Social Hub</h2>
          <p className="text-[10px] text-ink-muted font-medium">Schedule to LinkedIn, Instagram &amp; Facebook</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onViewDashboard}
          className="text-xs font-bold text-ink-muted hover:text-ink transition-colors px-3 py-2 rounded-full hover:bg-soft-bg"
        >
          History
        </button>

        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-soft-bg transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-soft-lavender flex items-center justify-center overflow-hidden border-2 border-white shadow-soft">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-soft-lilac font-bold text-xs">{user.name.charAt(0)}</span>
                )}
              </div>
              <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
                <span className="text-xs font-bold text-ink">{user.name}</span>
                <span className="text-[9px] text-emerald-600 font-bold uppercase">Connected</span>
              </div>
            </button>

            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-3xl border border-white shadow-soft-lg z-20 overflow-hidden">
                  <div className="p-3 border-b border-slate-100">
                    <p className="text-xs font-bold text-ink truncate">{user.name}</p>
                    <p className="text-[10px] text-ink-muted truncate">{user.email}</p>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      onClick={() => { onLogin(); setShowDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-soft-azure hover:bg-soft-sky rounded-2xl font-bold"
                    >
                      Switch / Add Account
                    </button>
                    <button
                      onClick={() => { onLogout(); setShowDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-soft-coral hover:bg-soft-peach rounded-2xl font-bold"
                    >
                      Disconnect LinkedIn
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="nexora-btn-primary px-4 py-2 text-xs"
          >
            Connect LinkedIn
          </button>
        )}
      </div>
    </div>
  );
};

export const StepIndicator: React.FC<{ currentStep: WorkflowStep }> = ({ currentStep }) => {
  const steps = [
    { label: "Setup", key: WorkflowStep.SOURCE_SELECTION },
    { label: "Schedule", key: WorkflowStep.SCHEDULING },
    { label: "Refine", key: WorkflowStep.PREFERENCES },
    { label: "Preview", key: WorkflowStep.REVIEW },
  ];

  const currentIdx = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex justify-center mb-8 animate-fade-in">
      <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl border border-white shadow-soft rounded-full px-4 py-3">
        {steps.map((stepObj, idx) => (
          <React.Fragment key={stepObj.label}>
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${idx <= currentIdx ? 'bg-ink text-white shadow-soft' : 'bg-soft-bg text-ink-muted'
                }`}>
                {idx + 1}
              </div>
              <span className={`text-[9px] mt-1.5 font-bold uppercase tracking-widest ${idx <= currentIdx ? 'text-ink' : 'text-ink-muted'}`}>
                {stepObj.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-10 h-1 mb-5 rounded-full ${idx < currentIdx ? 'bg-ink' : 'bg-soft-bg'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
