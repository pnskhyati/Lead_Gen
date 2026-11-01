
import React from 'react';
import { LinkedInUser, WorkflowStep } from '../types';

export type SocialHubSection = 'create' | 'connected';

/** Compact status bar for Social Hub inside Nexora (not LinkedIn-branded chrome). */
export const HubStatusBar: React.FC<{
  user: LinkedInUser | null;
  hubSection: SocialHubSection;
  onHubSectionChange: (section: SocialHubSection) => void;
  onViewDashboard?: () => void;
}> = ({ user, hubSection, onHubSectionChange, onViewDashboard }) => {
  return (
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-sm rounded-2xl py-3.5 px-5 space-y-3">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[10px] border border-[#143630]/12 bg-[#f4f8f7] flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-[#143630]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Social Hub</h2>
            <p className="text-[10px] text-slate-500 font-medium truncate">
              LinkedIn · Instagram · Facebook · X
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onViewDashboard}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg hover:bg-slate-50"
          >
            History
          </button>
          {user ? (
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden">
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-600">
                    {user.name.charAt(0)}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold uppercase text-emerald-700">LI</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100/80 rounded-xl">
        <button
          type="button"
          onClick={() => onHubSectionChange('create')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            hubSection === 'create'
              ? 'bg-white text-[#143630] shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => onHubSectionChange('connected')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
            hubSection === 'connected'
              ? 'bg-white text-[#143630] shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Connected
        </button>
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
