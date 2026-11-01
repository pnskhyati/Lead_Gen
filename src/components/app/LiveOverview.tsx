import React, { useCallback, useEffect, useMemo, useState } from 'react';
import OverviewView from './OverviewView';
import type { Campaign, Lead, NavCategory, StatMetric, SubCategory, TrendingTopic } from '../../types';
import type { Lead as LegacyLead } from '../../legacy/types';
import { fetchLeads, getLeadCounts, getLeads } from '../../legacy/services/leadStore';
import { getCompanyStatus } from '../../legacy/services/companyService';
import { getInstagramStatus } from '../../legacy/services/instagramService';
import { getWhatsAppStatus } from '../../legacy/services/whatsappService';
import { getFacebookStatus } from '../../legacy/services/facebookService';

interface LiveOverviewProps {
  workspaceName?: string;
  onNavigate: (category: NavCategory, subCategory?: SubCategory) => void;
  onSelectLead: (lead: Lead) => void;
  onTriggerQuickAction?: (action: 'campaign' | 'content' | 'lead' | 'schedule') => void;
}

function relativeTime(iso?: string): string {
  if (!iso) return 'Recently';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Recently';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function mapSource(lead: LegacyLead): Lead['source'] {
  const ch = String(lead.channel || lead.source || lead.platform || '').toLowerCase();
  if (ch.includes('whatsapp')) return 'WhatsApp';
  if (ch.includes('instagram')) return 'Instagram';
  if (ch.includes('linkedin')) return 'LinkedIn';
  if (ch.includes('facebook')) return 'Website';
  if (ch.includes('web')) return 'Website';
  return 'Manual';
}

function mapStatus(status: LegacyLead['status']): Lead['status'] {
  switch (status) {
    case 'qualified':
      return 'Qualified';
    case 'contacted':
      return 'Contacted';
    case 'closed':
      return 'Converted';
    case 'handed_off':
      return 'Engaged';
    default:
      return 'New';
  }
}

function mapTemperature(temp?: LegacyLead['temperature']): Lead['temperature'] {
  if (temp === 'hot') return 'HOT';
  if (temp === 'warm') return 'WARM';
  if (temp === 'cold') return 'COLD';
  return undefined;
}

function toUiLead(lead: LegacyLead): Lead {
  const name = lead.author?.trim() || lead.phone || 'Inbound lead';
  return {
    id: lead.id,
    name,
    company: lead.platform || lead.channel || 'Inbound',
    email: '',
    phone: lead.phone,
    source: mapSource(lead),
    status: mapStatus(lead.status),
    value: '—',
    lastActivity: relativeTime(lead.lastMessageAt || lead.createdAt),
    score: typeof lead.score === 'number' ? lead.score : 0,
    temperature: mapTemperature(lead.temperature),
    description: lead.customerComment || lead.intentSummary || '',
    conversationSummary: lead.intentSummary || lead.customerComment || '',
    aiRecommendation: lead.nextBestAction || undefined,
    preferredChannel: lead.channel || lead.platform,
    date: relativeTime(lead.lastMessageAt || lead.createdAt),
    stage: lead.status === 'qualified' ? 'Qualified' : lead.status === 'handed_off' ? 'Contacted' : 'New',
  };
}

export default function LiveOverview({
  workspaceName = 'Nexora',
  onNavigate,
  onSelectLead,
  onTriggerQuickAction,
}: LiveOverviewProps) {
  const [legacyLeads, setLegacyLeads] = useState<LegacyLead[]>([]);
  const [channelBits, setChannelBits] = useState({ ig: false, wa: false, fb: false, docs: 0, hasVoice: false });

  const refresh = useCallback(() => {
    void fetchLeads().then((list) => setLegacyLeads(list.length ? list : getLeads()));
  }, []);

  useEffect(() => {
    refresh();
    void Promise.all([
      getCompanyStatus().catch(() => null),
      getInstagramStatus().catch(() => null),
      getWhatsAppStatus().catch(() => null),
      getFacebookStatus().catch(() => null),
    ]).then(([company, ig, wa, fb]) => {
      setChannelBits({
        ig: Boolean(ig?.connected),
        wa: Boolean(wa?.configured),
        fb: Boolean(fb?.connected),
        docs: company?.documentCount || 0,
        hasVoice: Boolean(company?.hasVoice),
      });
    });
    const onUpdate = () => refresh();
    window.addEventListener('nexora-leads-updated', onUpdate);
    return () => window.removeEventListener('nexora-leads-updated', onUpdate);
  }, [refresh]);

  const uiLeads = useMemo(() => legacyLeads.map(toUiLead), [legacyLeads]);
  const counts = useMemo(() => getLeadCounts(), [legacyLeads]);
  const waitingHuman = useMemo(
    () =>
      legacyLeads.filter(
        (l) => l.status === 'handed_off' || l.conversationState === 'HUMAN_REQUIRED' || l.conversationState === 'HUMAN_ACTIVE'
      ).length,
    [legacyLeads]
  );
  const hotLead = useMemo(
    () => [...uiLeads].sort((a, b) => b.score - a.score).find((l) => l.temperature === 'HOT') || uiLeads[0],
    [uiLeads]
  );

  const metrics: StatMetric[] = useMemo(
    () => [
      {
        id: 'leads',
        value: String(legacyLeads.length),
        label: 'Total Leads',
        change: counts.hot > 0 ? `${counts.hot} hot` : 'Pipeline',
        isPositive: true,
        timeframe: 'live CRM',
      },
      {
        id: 'conversion',
        value: `${counts.hot + counts.warm}`,
        label: 'Active Intent',
        change: `${counts.warm} warm`,
        isPositive: true,
        timeframe: 'hot + warm',
      },
      {
        id: 'campaigns',
        value: String([channelBits.ig, channelBits.wa, channelBits.fb].filter(Boolean).length),
        label: 'Channels Live',
        change: channelBits.hasVoice ? 'Voice ready' : 'Setup voice',
        isPositive: channelBits.hasVoice,
        timeframe: 'IG · WA · FB',
      },
      {
        id: 'reach',
        value: String(channelBits.docs),
        label: 'Knowledge Docs',
        change: waitingHuman > 0 ? `${waitingHuman} need you` : 'All clear',
        isPositive: waitingHuman === 0,
        timeframe: 'brand brain',
      },
    ],
    [legacyLeads.length, counts, channelBits, waitingHuman]
  );

  const campaigns: Campaign[] = [];
  const trendingTopics: TrendingTopic[] = useMemo(
    () => [
      {
        id: 't1',
        name: 'Competitor social patterns',
        category: 'Agents',
        growth: '+',
        isPositive: true,
        volume: 'Live',
        relevantCampaign: 'Agents',
      },
      {
        id: 't2',
        name: channelBits.ig ? 'Instagram connected' : 'Connect Instagram',
        category: 'Channels',
        growth: channelBits.ig ? 'On' : 'Off',
        isPositive: channelBits.ig,
        volume: 'Meta',
        relevantCampaign: 'Channels',
      },
      {
        id: 't3',
        name: channelBits.wa ? 'WhatsApp Cloud API' : 'Configure WhatsApp',
        category: 'Channels',
        growth: channelBits.wa ? 'On' : 'Off',
        isPositive: channelBits.wa,
        volume: 'WA',
        relevantCampaign: 'Channels',
      },
    ],
    [channelBits]
  );

  const liveInsights = useMemo(
    () => ({
      waitingHuman,
      hotLeads: counts.hot,
      warmLeads: counts.warm,
      totalLeads: legacyLeads.length,
      needsAttentionCount: waitingHuman + counts.hot,
      recommendationTitle: hotLead
        ? `${hotLead.name} · score ${hotLead.score}${hotLead.temperature ? ` · ${hotLead.temperature}` : ''}`
        : 'No hot leads yet — run Agents or connect a channel.',
      recommendationBody: hotLead?.aiRecommendation
        || hotLead?.conversationSummary
        || (channelBits.ig || channelBits.wa
          ? 'Suggested: open Inbox and reply while intent is warm.'
          : 'Suggested: connect Instagram or WhatsApp under Channels.'),
    }),
    [waitingHuman, counts, legacyLeads.length, hotLead, channelBits]
  );

  return (
    <OverviewView
      metrics={metrics}
      leads={uiLeads}
      campaigns={campaigns}
      trendingTopics={trendingTopics}
      onNavigate={onNavigate}
      onSelectLead={onSelectLead}
      onTriggerQuickAction={onTriggerQuickAction}
      isFirstRun={legacyLeads.length === 0 && !channelBits.ig && !channelBits.wa}
      workspaceName={workspaceName}
      liveInsights={liveInsights}
    />
  );
}
