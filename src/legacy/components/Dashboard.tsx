import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Card from './common/Card';
import LeadBadge from './common/LeadBadge';
import type { View, Lead, LeadTemperature } from '../types';
import { APP_NAME, APP_PROMISE } from '../constants/branding';
import { fetchLeads, getLeads, getLeadCounts, updateLeadStatus } from '../services/leadStore';
import { getCompanyStatus, type CompanyStatus } from '../services/companyService';
import { getInstagramStatus, type InstagramStatus } from '../services/instagramService';
import InstagramConnect from './InstagramConnect';
import FacebookConnect from './FacebookConnect';
import SeoGeoPanel from '../../components/app/SeoGeoPanel';

interface DashboardProps {
  setCurrentView: (view: View) => void;
}

const DEMO_STEPS_KEY = 'tecavy-demo-checklist';

const DEMO_STEPS = [
  { id: 'brain', label: 'Business AI Brain ready (voice + knowledge)', view: 'admin' as View },
  { id: 'rag', label: 'Upload / verify SmileCare RAG doc', view: 'admin' as View },
  { id: 'chat', label: 'Ask Lead Agent a price question', view: 'insights' as View },
  { id: 'qualify', label: 'Capture a booking-intent lead', view: 'automation' as View },
  { id: 'handoff', label: 'Demo complaint → Take over', view: 'automation' as View },
  { id: 'ig', label: 'Connect Instagram (when Meta app ready)', view: 'automation' as View },
];

const TEMP_FILTERS: Array<'all' | LeadTemperature> = ['all', 'hot', 'warm', 'cold'];

function loadDemoChecks(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(DEMO_STEPS_KEY) || '{}');
  } catch {
    return {};
  }
}

const Dashboard: React.FC<DashboardProps> = ({ setCurrentView }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadFilter, setLeadFilter] = useState<'all' | LeadTemperature>('all');
  const [company, setCompany] = useState<CompanyStatus | null>(null);
  const [ig, setIg] = useState<InstagramStatus | null>(null);
  const [demoChecks, setDemoChecks] = useState<Record<string, boolean>>(loadDemoChecks);
  const refreshLeads = useCallback(() => {
    void fetchLeads().then((list) => setLeads(list.length ? list : getLeads()));
  }, []);

  useEffect(() => {
    refreshLeads();
    void getCompanyStatus().then(setCompany).catch(() => setCompany(null));
    void getInstagramStatus().then(setIg).catch(() => setIg(null));
    const onUpdate = () => refreshLeads();
    window.addEventListener('nexora-leads-updated', onUpdate);
    return () => window.removeEventListener('nexora-leads-updated', onUpdate);
  }, [refreshLeads]);

  const counts = getLeadCounts();
  const handoffs = leads.filter((l) => l.status === 'handed_off' || l.conversationState === 'HUMAN_REQUIRED').length;
  const filteredLeads = leadFilter === 'all' ? leads : leads.filter((l) => l.temperature === leadFilter);

  const opportunities = useMemo(() => {
    const items: { tone: string; text: string }[] = [];
    if (counts.hot > 0) items.push({ tone: 'text-soft-coral', text: `${counts.hot} hot lead${counts.hot === 1 ? '' : 's'} need immediate attention` });
    if (counts.warm > 0) items.push({ tone: 'text-amber-600', text: `${counts.warm} warm lead${counts.warm === 1 ? '' : 's'} ready for follow-up` });
    if (handoffs > 0) items.push({ tone: 'text-soft-coral', text: `${handoffs} conversation${handoffs === 1 ? '' : 's'} awaiting human takeover` });
    if (!company?.hasVoice) items.push({ tone: 'text-ink-muted', text: 'Brand voice incomplete — finish Admin setup' });
    if ((company?.documentCount || 0) < 1) items.push({ tone: 'text-ink-muted', text: 'No knowledge docs — upload SmileCare RAG to demo grounding' });
    if (!ig?.connected) items.push({ tone: 'text-soft-azure', text: 'Instagram not connected — comments/DMs stay offline' });
    if (items.length === 0) items.push({ tone: 'text-soft-deep', text: 'Pipeline quiet — run the Lead Agent demo script' });
    return items.slice(0, 6);
  }, [counts, handoffs, company, ig]);

  const toggleDemo = (id: string) => {
    setDemoChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(DEMO_STEPS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const demoDone = DEMO_STEPS.filter((s) => demoChecks[s.id]).length;

  // Auto-tick brain/rag from live status
  useEffect(() => {
    if (!company) return;
    setDemoChecks((prev) => {
      const next = { ...prev };
      if (company.hasVoice && company.setupComplete) next.brain = true;
      if ((company.documentCount || 0) > 0) next.rag = true;
      if (ig?.connected) next.ig = true;
      localStorage.setItem(DEMO_STEPS_KEY, JSON.stringify(next));
      return next;
    });
  }, [company, ig]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-soft-azure mb-1">Growth Radar</p>
          <h1 className="font-display text-4xl font-semibold text-ink tracking-tight">
            Good morning. {APP_NAME} found {opportunities.length} opportunities.
          </h1>
          <p className="text-ink-muted mt-1.5 font-medium max-w-2xl">
            {APP_PROMISE} Attract → Engage → Qualify → Convert — with policy in charge.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCurrentView('automation')}
            className="nexora-btn-primary px-4 py-2.5 text-xs"
          >
            Open Lead Inbox
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('admin')}
            className="px-4 py-2.5 rounded-full text-xs font-bold bg-white border border-soft-sky/70 text-ink-soft"
          >
            AI Brain
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Hot', value: counts.hot, sub: 'Call / book now', tint: 'bg-soft-coral/15 text-soft-coral' },
          { title: 'Warm', value: counts.warm, sub: 'Nurture', tint: 'bg-amber-50 text-amber-700' },
          { title: 'Cold', value: counts.cold, sub: 'Light touch', tint: 'bg-soft-sky text-soft-azure' },
          { title: 'Handoffs', value: handoffs, sub: 'Human required', tint: 'bg-soft-mint text-soft-deep' },
        ].map((k) => (
          <Card key={k.title} className="!p-4">
            <p className="text-xs font-semibold text-ink-muted">{k.title}</p>
            <p className="text-3xl font-extrabold text-ink mt-1 tracking-tight">{k.value}</p>
            <p className={`text-[11px] font-semibold mt-1 ${k.tint.split(' ').pop()}`}>{k.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 !p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-soft-sky/40 bg-gradient-to-r from-soft-foam/80 to-white/50">
            <h2 className="text-lg font-bold text-ink">Opportunity feed</h2>
            <p className="text-xs text-ink-muted">Live signals from leads, knowledge, and channels</p>
          </div>
          <ul className="divide-y divide-soft-sky/30">
            {opportunities.map((o, i) => (
              <li key={i} className="px-5 py-3.5 flex items-start gap-3">
                <span className={`mt-1 w-2 h-2 rounded-full bg-current ${o.tone}`} />
                <p className={`text-sm font-semibold ${o.tone}`}>{o.text}</p>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 border-t border-soft-sky/40 grid sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-soft-bg/80 rounded-2xl px-3 py-2.5">
              <p className="text-ink-muted font-medium">Company</p>
              <p className="font-bold text-ink mt-0.5">{company?.companyName || '—'}</p>
            </div>
            <div className="bg-soft-bg/80 rounded-2xl px-3 py-2.5">
              <p className="text-ink-muted font-medium">Knowledge</p>
              <p className="font-bold text-ink mt-0.5">
                {company?.documentCount ?? 0} docs · {company?.chunkCount ?? 0} chunks
              </p>
            </div>
            <div className="bg-soft-bg/80 rounded-2xl px-3 py-2.5">
              <p className="text-ink-muted font-medium">Instagram</p>
              <p className="font-bold text-ink mt-0.5">{ig?.connected ? 'Connected' : 'Not connected'}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Demo checklist</h2>
              <p className="text-xs text-ink-muted">
                {demoDone}/{DEMO_STEPS.length} ready for pitch
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {DEMO_STEPS.map((step) => (
              <li key={step.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(demoChecks[step.id])}
                  onChange={() => toggleDemo(step.id)}
                  className="mt-1 accent-[#0A6B73]"
                />
                <button
                  type="button"
                  onClick={() => setCurrentView(step.view)}
                  className="text-left text-sm text-ink-soft hover:text-soft-deep font-medium"
                >
                  {step.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SeoGeoPanel
          variant="legacy"
          isLight
          onLegacyAdmin={() => setCurrentView('admin')}
          className="!rounded-2xl !shadow-none border-soft-sky/40"
        />

        <div className="space-y-5">
          <InstagramConnect compact onSynced={() => refreshLeads()} />
          <FacebookConnect compact onSynced={() => refreshLeads()} />
          <Card>
            <h3 className="text-lg font-bold text-ink mb-3">Quick actions</h3>
            <div className="grid gap-2">
              {[
                { t: 'Lead Inbox', d: 'Qualify · handoff · release to AI', v: 'automation' as View },
                { t: 'Creative Lab', d: 'Captions & assets (Attract)', v: 'lab' as View },
                { t: 'Admin · Audit', d: 'Agent decisions & knowledge', v: 'admin' as View },
              ].map((a) => (
                <button
                  key={a.t}
                  type="button"
                  onClick={() => setCurrentView(a.v)}
                  className="text-left px-4 py-3 rounded-2xl bg-soft-bg/80 hover:bg-white border border-transparent hover:border-soft-sky/60 transition-all"
                >
                  <p className="text-sm font-bold text-ink">{a.t}</p>
                  <p className="text-[11px] text-ink-muted">{a.d}</p>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink">Live leads</h3>
            <p className="text-sm text-ink-muted">Web agent · Instagram · WhatsApp</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMP_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setLeadFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all ${
                  leadFilter === f
                    ? 'bg-gradient-to-r from-soft-deep to-soft-azure text-white shadow-aqua'
                    : 'bg-soft-bg text-ink-muted hover:bg-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-ink font-semibold">Pipeline is empty — good for a clean demo</p>
            <p className="text-sm text-ink-muted mt-1 max-w-md mx-auto">
              Open the Lead Agent and ask “How much is your premium package?” using SmileCare RAG.
            </p>
            <button
              type="button"
              onClick={() => setCurrentView('automation')}
              className="mt-4 nexora-btn-primary px-4 py-2.5 text-xs"
            >
              Go to Lead Inbox
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {filteredLeads.slice(0, 10).map((lead) => (
              <li
                key={lead.id}
                className="bg-soft-bg/70 rounded-3xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <LeadBadge temperature={lead.temperature} score={lead.score} />
                    <span className="text-xs font-semibold text-ink-muted">{lead.platform}</span>
                    {lead.nextBestAction && (
                      <span className="text-[10px] font-bold text-soft-azure bg-soft-sky/60 px-2 py-0.5 rounded-full truncate max-w-[220px]">
                        Next: {lead.nextBestAction}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink line-clamp-2">“{lead.customerComment}”</p>
                  <p className="text-xs text-ink-muted mt-1.5">
                    {lead.intent ? `${lead.intent} · ` : ''}
                    {lead.intentSummary}
                  </p>
                  {lead.scoreExplanation && (
                    <p className="text-[11px] text-soft-deep mt-1 truncate" title={lead.scoreExplanation}>
                      Why: {lead.scoreExplanation}
                    </p>
                  )}
                </div>
                <select
                  value={lead.status}
                  onChange={(e) => {
                    updateLeadStatus(lead.id, e.target.value as Lead['status']);
                    refreshLeads();
                  }}
                  className="text-xs font-semibold bg-white rounded-full px-3 py-1.5 text-ink border-0 focus:outline-none focus:ring-2 focus:ring-soft-sky shrink-0"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="handed_off">Handed off</option>
                  <option value="closed">Closed</option>
                </select>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
