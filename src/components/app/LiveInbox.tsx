import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EngageView, { type ConversationItem, type EngageLiveHandlers } from './EngageView';
import LeadsView from './LeadsView';
import type { Lead, SubCategory } from '../../types';
import type { Lead as LegacyLead, LeadMessage } from '../../legacy/types';
import {
  executeFollowUp,
  fetchFollowUpQueue,
  fetchLeadDetail,
  fetchLeads,
  getLeads,
  releaseLeadToAi,
  replyToLead,
  scanLeadLifecycle,
  triggerHandoff,
  updateLeadStatus,
} from '../../legacy/services/leadStore';
import type { FollowUpQueueItem, LifecyclePipelineSummary } from '../../legacy/types';
import { approveAutoReply, dismissAutoReply, listAutoReplyItems, type AutoReplyItem } from '../../legacy/services/autoReplyService';

interface LiveInboxProps {
  mode: 'inbox' | 'leads';
  activeSubCategory: SubCategory;
  onNavigateSub: (sub: SubCategory) => void;
  onNavigateChannels: () => void;
  onNotify?: (title: string, desc: string) => void;
  onSelectLead?: (lead: Lead) => void;
}

function relativeShort(iso?: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function mapChannel(lead: LegacyLead): ConversationItem['channel'] {
  const ch = String(lead.channel || lead.source || lead.platform || '').toLowerCase();
  if (ch === 'email' || ch.includes('email')) return 'Email';
  if (ch.includes('whatsapp')) return 'WhatsApp';
  if (ch.includes('instagram')) return 'Instagram';
  if (ch.includes('linkedin')) return 'LinkedIn';
  if (ch.includes('facebook') || ch.includes('messenger')) return 'Facebook';
  if (ch === 'x' || ch.includes('twitter')) return 'X';
  if (ch === 'google_ads' || ch.includes('google ads')) return 'Google Ads';
  return 'Website';
}

function mapInboxStatus(lead: LegacyLead): ConversationItem['status'] {
  if (lead.status === 'closed') return 'closed';
  if (
    lead.status === 'handed_off' ||
    lead.conversationState === 'HUMAN_REQUIRED' ||
    lead.conversationState === 'HUMAN_ACTIVE' ||
    lead.autoReplyPaused
  ) {
    return 'needs_you';
  }
  if (lead.conversationState === 'AI_ACTIVE' || lead.conversationState === 'AI_WAITING') {
    return 'ai_handling';
  }
  if (lead.temperature === 'hot') return 'needs_you';
  return 'ai_handling';
}

function mapTemp(temp?: LegacyLead['temperature']): ConversationItem['temperature'] {
  if (temp === 'hot') return 'HOT';
  if (temp === 'warm') return 'WARM';
  return 'COLD';
}

function mapUiLead(lead: LegacyLead): Lead {
  const name = lead.author?.trim() || lead.phone || 'Inbound lead';
  const ch = mapChannel(lead);
  return {
    id: lead.id,
    name,
    company: lead.platform || lead.channel || 'Inbound',
    email: lead.email || '',
    phone: lead.phone,
    source: ch === 'Website' ? 'Website' : ch === 'Email' ? 'Email' : ch,
    status:
      lead.status === 'qualified'
        ? 'Qualified'
        : lead.status === 'closed'
          ? 'Converted'
          : lead.status === 'handed_off'
            ? 'Engaged'
            : lead.status === 'contacted'
              ? 'Contacted'
              : 'New',
    value: '—',
    lastActivity: relativeShort(lead.lastMessageAt || lead.createdAt),
    score: typeof lead.score === 'number' ? lead.score : 0,
    temperature: mapTemp(lead.temperature),
    description: lead.customerComment || lead.intentSummary || '',
    conversationSummary: lead.intentSummary || lead.customerComment || '',
    aiRecommendation: lead.nextBestAction || undefined,
    preferredChannel: lead.channel || lead.platform,
    date: relativeShort(lead.lastMessageAt || lead.createdAt),
    stage: lead.status === 'qualified' ? 'Qualified' : lead.status === 'handed_off' ? 'Contacted' : 'New',
  };
}

function mapMessages(msgs: LeadMessage[], lead: LegacyLead): ConversationItem['messages'] {
  if (!msgs.length) {
    const text = lead.customerComment || lead.intentSummary || 'Conversation started';
    return [
      {
        id: `${lead.id}-seed`,
        sender: 'customer',
        senderName: lead.author?.split(' ')[0] || 'Customer',
        text,
        time: relativeShort(lead.lastMessageAt || lead.createdAt),
      },
    ];
  }
  return msgs.map((m) => ({
    id: m.id,
    sender: m.role === 'customer' ? 'customer' : m.role === 'human' ? 'agent' : 'ai',
    senderName:
      m.role === 'customer'
        ? lead.author?.split(' ')[0] || 'Customer'
        : m.role === 'human'
          ? 'You'
          : 'AI',
    text: m.text,
    time: relativeShort(m.createdAt),
  }));
}

function toConversation(lead: LegacyLead): ConversationItem {
  const name = lead.author?.trim() || lead.phone || 'Inbound lead';
  const channel = mapChannel(lead);
  const status = mapInboxStatus(lead);
  const temperature = mapTemp(lead.temperature);
  const snippet = (lead.customerComment || lead.intentSummary || 'New conversation').slice(0, 80);
  const waitingForHuman =
    lead.status === 'handed_off' ||
    lead.conversationState === 'HUMAN_REQUIRED' ||
    lead.conversationState === 'HUMAN_ACTIVE';
  const whyPoints = [
    lead.intentSummary ? `+ ${lead.intentSummary}` : null,
    lead.nextBestAction ? `+ next: ${lead.nextBestAction}` : null,
    lead.scoreBand ? `+ score band ${lead.scoreBand}` : null,
  ].filter(Boolean) as string[];

  return {
    id: `convo-${lead.id}`,
    name,
    company: lead.platform || channel,
    location: '—',
    time: relativeShort(lead.lastMessageAt || lead.createdAt),
    timestampRaw: new Date(lead.lastMessageAt || lead.createdAt || Date.now()).getTime(),
    channel,
    status,
    snippet,
    stage:
      lead.status === 'qualified'
        ? 'Qualified'
        : lead.status === 'handed_off'
          ? 'Handoff'
          : lead.status === 'closed'
            ? 'Closed'
            : 'New',
    score: typeof lead.score === 'number' ? lead.score : 0,
    temperature,
    intelPill: `${channel} · ${temperature}`,
    whyPoints: whyPoints.length ? whyPoints : ['+ inbound conversation'],
    // Only what the person actually said counts. Budget and timeline are not collected from chats yet, so they stay empty.
    qualification: {
      requirement: Boolean(lead.intent && !/^(UNKNOWN|GENERAL_QUERY|GREETING)$/i.test(String(lead.intent))),
      budget: '',
      timeline: '',
      decisionMaker: false,
    },
    nextAction: lead.nextBestAction || 'Reply while intent is warm',
    aiAlert: waitingForHuman
      ? {
          isPaused: true,
          reason: lead.handoffReason || 'Human attention required. AI paused.',
          confidence: 'medium',
        }
      : undefined,
    messages: mapMessages([], lead),
    assignedTo: waitingForHuman ? 'You' : 'AI',
    leadReferenceId: lead.id,
    waitingForHuman,
    askedForPricing: /pric|cost|quote|budget/i.test(`${lead.customerComment || ''} ${lead.intentSummary || ''}`),
    readyToBookCall: /book|call|demo|schedule|meeting/i.test(`${lead.customerComment || ''} ${lead.intentSummary || ''}`),
    isOverdueFollowUp: (lead.followUps || []).some((f) => {
      if (f.status !== 'pending') return false;
      return new Date(f.dueAt).getTime() < Date.now();
    }),
  };
}

/** Facebook gives times like 2026-11-13T11:49:29+0000; make them a form every browser reads. */
const fixTime = (t?: string | null) => (t ? t.replace(/([+-][0-9]{2})([0-9]{2})$/, '$1:$2') : t ?? null);

const AR_CHANNEL: Record<AutoReplyItem['platform'], ConversationItem['channel']> = { instagram: 'Instagram', facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn' };
const AR_KIND: Record<AutoReplyItem['kind'], string> = { comment: 'Comment', dm: 'Message' };

/** A comment or mention on one of our posts, as a conversation: what they wrote and what we answered (or drafted). */
function arMessages(item: AutoReplyItem): ConversationItem['messages'] {
  const msgs: ConversationItem['messages'] = [{ id: `${item.id}-in`, sender: 'customer', senderName: item.author || 'Customer', text: item.text, time: relativeShort(item.receivedAt) }];
  const ours = item.finalText || item.draft;
  if (ours) {
    msgs.push({ id: `${item.id}-out`, sender: 'ai', senderName: item.status === 'sent' ? 'AI' : 'AI draft (not sent)', text: ours, time: relativeShort(item.sentAt || item.receivedAt) });
  }
  return msgs;
}

function fromAutoReply(item: AutoReplyItem): ConversationItem {
  const channel = AR_CHANNEL[item.platform] || 'Website';
  const waiting = item.status === 'pending_review' || item.status === 'needs_human' || item.status === 'failed';
  const alertReason =
    item.status === 'needs_human' ? item.reason || 'This needs a person, so no reply was sent.'
    : item.status === 'pending_review' ? 'A reply is drafted and waits for your OK. Send it from here.'
    : item.status === 'failed' ? item.error || 'The reply could not be sent.'
    : '';
  return {
    id: `convo-ar-${item.id}`,
    name: item.author || 'Someone',
    company: `${channel} ${AR_KIND[item.kind].toLowerCase()}`,
    location: '—',
    time: relativeShort(item.receivedAt),
    timestampRaw: new Date(item.receivedAt).getTime(),
    channel,
    status: waiting ? 'needs_you' : 'ai_handling',
    snippet: item.text.slice(0, 80),
    stage: item.status === 'sent' ? 'Replied' : 'New',
    score: 0,
    temperature: 'COLD',
    intelPill: `${channel} · ${item.intent}`,
    whyPoints: [item.context ? `+ on your post: ${item.context.slice(0, 80)}` : '+ public comment on your post', item.reason ? `+ ${item.reason}` : ''].filter(Boolean),
    qualification: { requirement: false, budget: '', timeline: '', decisionMaker: false },
    nextAction: waiting ? 'Review and send the reply' : 'Replied',
    aiAlert: waiting ? { isPaused: true, reason: alertReason, confidence: 'medium' } : undefined,
    messages: arMessages(item),
    assignedTo: waiting ? 'You' : 'AI',
    leadReferenceId: `ar:${item.id}`,
    waitingForHuman: waiting,
  };
}

export default function LiveInbox({
  mode,
  activeSubCategory,
  onNavigateSub,
  onNavigateChannels,
  onNotify,
  onSelectLead,
}: LiveInboxProps) {
  const [legacyLeads, setLegacyLeads] = useState<LegacyLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [followUpQueue, setFollowUpQueue] = useState<FollowUpQueueItem[]>([]);
  const [lifecycleSummary, setLifecycleSummary] = useState<LifecyclePipelineSummary | null>(null);
  const [arItems, setArItems] = useState<AutoReplyItem[]>([]);
  const arRef = useRef<AutoReplyItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const list = await fetchLeads();
      setLegacyLeads(list);
    } catch {
      setLegacyLeads(getLeads());
    }
    try {
      // Comments and mentions on our posts, read from the connected platforms by the auto-reply checker.
      const items = (await listAutoReplyItems())
        .filter((i) => i.status !== 'skipped' && i.status !== 'dismissed')
        .map((i) => ({ ...i, receivedAt: fixTime(i.receivedAt) || i.receivedAt, sentAt: fixTime(i.sentAt) }));
      arRef.current = items;
      setArItems(items);
    } catch {
      /* keep what we had */
    }
    try {
      const { queue, summary } = await fetchFollowUpQueue();
      setFollowUpQueue(queue);
      setLifecycleSummary(summary);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    void scanLeadLifecycle();
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener('nexora-leads-updated', onUpdate);
    const poll = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.removeEventListener('nexora-leads-updated', onUpdate);
      window.clearInterval(poll);
    };
  }, [refresh]);

  const seedConversations = useMemo(
    () => [...legacyLeads.map(toConversation), ...arItems.map(fromAutoReply)].sort((a, b) => (b.timestampRaw || 0) - (a.timestampRaw || 0)),
    [legacyLeads, arItems]
  );

  const uiLeads = useMemo(() => legacyLeads.map(mapUiLead), [legacyLeads]);

  const liveHandlers: EngageLiveHandlers = useMemo(
    () => ({
      sendReply: async (leadId, text) => {
        if (leadId.startsWith('ar:')) {
          await approveAutoReply(leadId.slice(3), text);
          await refresh();
          return;
        }
        await replyToLead(leadId, text, true);
        await refresh();
      },
      takeOver: async (leadId) => {
        if (leadId.startsWith('ar:')) return;
        await triggerHandoff(leadId, 'Taken over from Inbox UI');
        await refresh();
      },
      releaseToAi: async (leadId) => {
        if (leadId.startsWith('ar:')) return;
        await releaseLeadToAi(leadId);
        await refresh();
      },
      closeLead: async (leadId) => {
        if (leadId.startsWith('ar:')) {
          await dismissAutoReply(leadId.slice(3));
          await refresh();
          return;
        }
        updateLeadStatus(leadId, 'closed');
        await refresh();
      },
      loadMessages: async (leadId) => {
        if (leadId.startsWith('ar:')) {
          const item = arRef.current.find((i) => i.id === leadId.slice(3));
          return item ? arMessages(item) : [];
        }
        const detail = await fetchLeadDetail(leadId);
        const lead = detail?.lead || getLeads().find((l) => l.id === leadId);
        if (!lead) return [];
        return mapMessages(detail?.messages || [], lead);
      },
    }),
    [refresh]
  );

  if (mode === 'leads') {
    return (
      <LeadsView
        activeSubCategory={activeSubCategory}
        leads={uiLeads}
        selectedLead={selectedLead}
        onNavigateSub={onNavigateSub}
        onSelectLead={(lead) => {
          setSelectedLead(lead);
          onSelectLead?.(lead);
        }}
        onAddLeadModal={() => onNotify?.('New lead', 'Create leads from Channels or inbound messages.')}
        onNotify={onNotify}
        isFirstRun={uiLeads.length === 0}
        followUpQueue={followUpQueue}
        lifecycleSummary={lifecycleSummary}
        onExecuteFollowUp={async (leadId, followUpId, draft) => {
          try {
            const result = await executeFollowUp(leadId, followUpId, draft);
            await refresh();
            onNotify?.(
              'Follow-up sent',
              result.delivered ? 'Message delivered on channel.' : 'Saved to conversation thread.'
            );
          } catch (e) {
            onNotify?.('Follow-up failed', e instanceof Error ? e.message : 'Could not send');
          }
        }}
        onRefreshFollowUps={() => void refresh()}
      />
    );
  }

  return (
    <EngageView
      activeSubCategory={activeSubCategory}
      leads={uiLeads}
      onNavigateSub={onNavigateSub}
      onSelectLead={(lead) => {
        setSelectedLead(lead);
        onSelectLead?.(lead);
      }}
      onNotify={onNotify}
      isFirstRun={seedConversations.length === 0}
      onNavigateSettings={onNavigateChannels}
      seedConversations={seedConversations}
      liveHandlers={liveHandlers}
    />
  );
}
