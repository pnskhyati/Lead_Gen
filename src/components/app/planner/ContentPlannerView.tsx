import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getConnections,
  getPlanJob,
  getPlannerSettings,
  pollJob,
  startImport,
  startPlan,
  type Connections,
  type PlanJob,
  type PlanRequest,
} from '../../../legacy/services/plannerService';
import CalendarReview from './CalendarReview';
import BrandStylePanel from './BrandStylePanel';
import CompetitorsPanel from './CompetitorsPanel';
import ImportCalendar from './ImportCalendar';
import PlanForm from './PlanForm';
import PlanProgress from './PlanProgress';
import { browserTimeZone, usePlannerStyles } from './plannerUi';

type Tab = 'plan' | 'calendar' | 'style' | 'competitors';

interface Props {
  isAdmin: boolean;
  /** (title, description) toast supplied by the app shell */
  onNotify: (title: string, desc: string) => void;
  onOpenChannels: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'plan', label: 'New plan' },
  { id: 'calendar', label: 'Calendar & review' },
  { id: 'style', label: 'Brand style' },
  { id: 'competitors', label: 'Competitors' },
];

/**
 * One prompt -> a reviewable calendar -> approval -> reliable scheduled publishing.
 * (The flow of the LinkUp scheduler, extended to every connected platform.)
 */
export default function ContentPlannerView({ isAdmin, onNotify, onOpenChannels }: Props) {
  const s = usePlannerStyles();
  const [tab, setTab] = useState<Tab>('calendar');
  const [connections, setConnections] = useState<Connections | null>(null);
  const [timezone, setTimezone] = useState(browserTimeZone());
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [job, setJob] = useState<PlanJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<'ai' | 'upload'>('ai');
  const mounted = useRef(true);

  const notify = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => onNotify(kind === 'error' ? 'Planner' : 'Content planner', msg), [onNotify]);

  useEffect(() => {
    mounted.current = true;
    void Promise.all([getConnections().catch(() => null), getPlannerSettings().catch(() => null)]).then(([c, st]) => {
      if (!mounted.current) return;
      setConnections(c);
      if (st?.timezone) setTimezone(st.timezone);
      setReady(true);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  async function generate(start: () => Promise<PlanJob>) {
    setFormError(null);
    setStarting(true);
    try {
      const first = await start();
      setJob(first);
      setStarting(false);
      const done = await pollJob(first, getPlanJob, (j) => {
        if (!mounted.current) return;
        setJob(j);
        if (j.detail?.campaignId) setCampaignId((cur) => cur || j.detail!.campaignId!);
      });
      if (!mounted.current) return;
      setJob(null);
      setCampaignId(done.result?.campaignId || null);
      setTab('calendar');
      onNotify('Content planner', 'Your calendar is ready to review. Nothing is posted until you approve it.');
    } catch (err) {
      if (!mounted.current) return;
      setStarting(false);
      setJob(null);
      setFormError(err instanceof Error ? err.message : 'Could not build your plan');
    }
  }

  const building = job !== null && job.status === 'running';

  return (
    <div className="space-y-5">
      <div className={`flex flex-wrap gap-1 border-b ${s.border}`} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${tab === t.id ? `border-teal-500 font-bold ${s.title}` : `border-transparent font-medium ${s.muted}`}`}
          >
            {t.label}
            {t.id === 'plan' && building && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-violet-500 animate-pulse" aria-label="building" />}
          </button>
        ))}
      </div>

      {tab === 'plan' &&
        (building ? (
          <PlanProgress
            job={job}
            onReviewNow={() => {
              if (job?.detail?.campaignId) setCampaignId(job.detail.campaignId);
              setTab('calendar');
            }}
          />
        ) : (
          ready && (
            <div className="space-y-5">
              <div className="flex justify-center">
                <div className={`inline-flex rounded-lg border p-1 ${s.border}`} role="group" aria-label="How do you want to plan?">
                  {([['ai', 'Describe it, AI plans it'], ['upload', 'Upload my calendar']] as const).map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={source === id} onClick={() => { setSource(id); setFormError(null); }} className={`px-4 py-1.5 rounded-md text-xs font-semibold ${source === id ? s.primary : s.muted}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {source === 'ai' ? (
                <PlanForm connections={connections} defaultTimezone={timezone} busy={starting} error={formError} onSubmit={(r: PlanRequest) => void generate(() => startPlan(r))} onOpenChannels={onOpenChannels} />
              ) : (
                <ImportCalendar connections={connections} defaultTimezone={timezone} busy={starting} error={formError} onSubmit={(r) => void generate(() => startImport(r))} />
              )}
            </div>
          )
        ))}

      {tab === 'calendar' && (
        <CalendarReview
          campaignId={campaignId}
          isAdmin={isAdmin}
          onSelectCampaign={setCampaignId}
          onNewPlan={() => setTab('plan')}
          onOpenChannels={onOpenChannels}
          onNotify={notify}
        />
      )}

      {tab === 'style' && <BrandStylePanel isAdmin={isAdmin} onNotify={notify} />}

      {tab === 'competitors' && <CompetitorsPanel isAdmin={isAdmin} onNotify={notify} />}
    </div>
  );
}
