import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { PlanJob } from '../../../legacy/services/plannerService';
import { usePlannerStyles } from './plannerUi';

const STEPS = [
  { id: 'planning', label: 'Planning your campaign', hint: 'Working out the story across your calendar' },
  { id: 'writing', label: 'Writing each post', hint: 'In your brand voice, one platform at a time' },
  { id: 'images', label: 'Creating images', hint: 'You can start reviewing while these finish' },
] as const;

const ORDER = ['queued', 'planning', 'writing', 'images', 'done'];

export default function PlanProgress({ job, onReviewNow }: { job: PlanJob | null; onReviewNow?: () => void }) {
  const s = usePlannerStyles();
  const at = Math.max(0, ORDER.indexOf(job?.stage || 'queued'));
  const detail = job?.detail;
  const canReview = Boolean(detail?.campaignId) && at >= ORDER.indexOf('images');

  return (
    <div className="max-w-xl mx-auto py-10 space-y-6">
      <div className="text-center space-y-1">
        <h2 className={`text-2xl font-bold ${s.title}`}>Building your calendar</h2>
        <p className={`text-sm ${s.muted}`}>This usually takes a minute or two. You can leave this page; your plan keeps building.</p>
      </div>
      <ul className={`${s.card} divide-y ${s.isLight ? 'divide-slate-100' : 'divide-[rgba(169,191,165,0.12)]'}`}>
        {STEPS.map((step, i) => {
          const idx = ORDER.indexOf(step.id);
          const state = at > idx ? 'done' : at === idx ? 'active' : 'todo';
          const pct = state === 'active' && detail?.total ? Math.round(((detail.done || 0) / detail.total) * 100) : state === 'done' ? 100 : 0;
          return (
            <li key={step.id} className="p-4 flex items-start gap-3">
              {state === 'done' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : state === 'active' ? <Loader2 className="w-5 h-5 text-teal-500 animate-spin shrink-0" /> : <Circle className={`w-5 h-5 shrink-0 ${s.muted}`} />}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${state === 'todo' ? s.muted : s.title}`}>
                  {step.label}
                  {state === 'active' && detail?.total ? ` (${detail.done || 0} of ${detail.total})` : ''}
                </p>
                <p className={`text-[11px] ${s.muted}`}>{step.hint}</p>
                {step.id !== 'planning' && state !== 'todo' && (
                  <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${s.isLight ? 'bg-slate-100' : 'bg-[#0D2D2A]'}`}>
                    <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
              <span className="sr-only">{i + 1}</span>
            </li>
          );
        })}
      </ul>
      {canReview && onReviewNow && (
        <button type="button" onClick={onReviewNow} className={`w-full py-2.5 rounded-lg text-sm font-semibold ${s.secondary}`}>
          Start reviewing posts while images finish
        </button>
      )}
    </div>
  );
}
