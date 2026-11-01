import React, { useState, useEffect, useRef } from 'react';
import { 
  X,
  Sparkles, 
  MessageSquare, 
  Send, 
  UserCheck, 
  RotateCw, 
  Plus, 
  Lock, 
  AlertTriangle,
  Bot, 
  User, 
  Check,
  Calendar,
  Clock,
  Building2,
  Mail,
  Phone,
  MapPin,
  Flame,
  CheckCircle2,
  Tag as TagIcon,
  ChevronRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { 
  Lead, 
  LeadTemperature, 
  LeadHandlingMode, 
  LeadMessage, 
  LeadTimelineEvent, 
  LeadFollowUp,
  NavCategory,
  SubCategory
} from '../../../types';
import { useTheme } from '../../../context/ThemeContext';

interface LeadIntelligenceWorkspaceProps {
  lead: Lead | null;
  onClose: () => void;
  onUpdateLead: (updated: Lead) => void;
  onNavigate?: (category: NavCategory, subCategory?: SubCategory) => void;
  onNotify?: (title: string, desc: string) => void;
}

export function getChannelBadge(source: string) {
  const s = (source || '').toLowerCase();
  if (s.includes('whatsapp')) {
    return { 
      name: 'WhatsApp', 
      badge: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800/40' 
    };
  }
  if (s.includes('instagram')) {
    return { 
      name: 'Instagram', 
      badge: 'text-pink-700 bg-pink-50 border-pink-200 dark:text-pink-300 dark:bg-pink-950/60 dark:border-pink-800/40' 
    };
  }
  if (s.includes('linkedin')) {
    return { 
      name: 'LinkedIn', 
      badge: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/60 dark:border-sky-800/40' 
    };
  }
  if (s.includes('website')) {
    return { 
      name: 'Website', 
      badge: 'text-teal-700 bg-teal-50 border-teal-200 dark:text-teal-300 dark:bg-teal-950/60 dark:border-teal-800/40' 
    };
  }
  return { 
    name: source || 'Direct', 
    badge: 'text-slate-700 bg-slate-100 border-slate-200 dark:text-[#A9BFA5] dark:bg-[#0D2D2A] dark:border-[rgba(169,191,165,0.3)]' 
  };
}

export default function LeadIntelligenceWorkspace({
  lead,
  onClose,
  onUpdateLead,
  onNavigate,
  onNotify
}: LeadIntelligenceWorkspaceProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!lead) return null;

  // Intelligence derivation
  const isHot = lead.score >= 85 || lead.temperature === 'HOT' || lead.isPriority;
  const isWarm = (lead.score >= 65 && lead.score < 85) || lead.temperature === 'WARM';
  const temperature: LeadTemperature = lead.temperature || (isHot ? 'HOT' : isWarm ? 'WARM' : 'COLD');

  const intentLevel = lead.intentLevel || (isHot ? 'High purchase intent' : isWarm ? 'Evaluating alternatives' : 'Information gathering');
  const aiRecommendation = lead.aiRecommendation || (isHot ? 'Schedule a sales discovery call within 24 hours' : 'Send product comparison deck & follow-up sequence');

  // Contact & Business details
  const phone = lead.phone || '+91 98201 44820';
  const jobTitle = lead.title || (lead.name === 'Rahul Sharma' ? 'VP of Marketing & Growth' : 'Head of Growth & Operations');
  const location = lead.location || (lead.name.includes('Rahul') ? 'Pune, India' : 'San Francisco, CA');
  const companySize = lead.companySize || '25 - 50 employees';
  const budget = lead.budget || lead.value || '₹5L – ₹8L ($10,000)';
  const timeline = lead.timeline || 'Within 30 days';
  const requirement = lead.requirement || (lead.description || 'Omnichannel lead management and WhatsApp automated workflows with human handoff.');
  const preferredChannel = lead.preferredChannel || (lead.source.includes('WhatsApp') ? 'WhatsApp' : lead.source);
  const decisionMaker = lead.decisionMaker !== undefined ? lead.decisionMaker : true;

  // Sub-tabs: 'qualification' | 'conversation' | 'info' | 'timeline' | 'notes'
  type WorkspaceSubTab = 'qualification' | 'conversation' | 'info' | 'timeline' | 'notes';
  const [activeSubTab, setActiveSubTab] = useState<WorkspaceSubTab>('qualification');

  // Conversation history
  const [messages, setMessages] = useState<LeadMessage[]>(lead.messages || [
    {
      id: 'm-1',
      sender: 'customer',
      senderName: lead.name,
      text: `Hi, I wanted to know more about your Tecavy OS solution for ${lead.company}.`,
      time: '10:42 AM',
      channel: lead.source
    },
    {
      id: 'm-2',
      sender: 'ai',
      senderName: 'Tecavy AI Assistant',
      text: "Absolutely! I can help with that. Could you tell me a little about what you're looking to automate?",
      time: '10:44 AM'
    },
    {
      id: 'm-3',
      sender: 'customer',
      senderName: lead.name,
      text: 'We need lead management, WhatsApp automation, and quick escalation when high-ticket prospects reply.',
      time: '10:46 AM',
      channel: lead.source
    },
    {
      id: 'm-4',
      sender: 'ai',
      senderName: 'Tecavy AI Assistant',
      text: 'That sounds like a great fit. What is your expected implementation timeline and budget range?',
      time: '10:48 AM'
    },
    {
      id: 'm-5',
      sender: 'customer',
      senderName: lead.name,
      text: `We are looking to implement within 30 days. Budget allocated is around ${budget}. Could we see pricing and have a call with your solutions team?`,
      time: '10:50 AM',
      channel: lead.source
    }
  ]);

  // Reply text input
  const [replyText, setReplyText] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Handling mode: AI or HUMAN
  const [handlingMode, setHandlingMode] = useState<LeadHandlingMode>(lead.handlingMode || (isHot ? 'HUMAN' : 'AI'));

  // Activity timeline
  const [timelineEvents, setTimelineEvents] = useState<LeadTimelineEvent[]>(lead.timelineEvents || [
    {
      id: 't-1',
      time: '10:42 AM',
      title: `Lead captured from ${lead.source}`,
      description: 'Captured via October Lead Generation Campaign (Instagram Ad → WhatsApp DM)',
      type: 'campaign'
    },
    {
      id: 't-2',
      time: '10:44 AM',
      title: 'AI initial auto-response engaged',
      description: 'Dispatched automated qualifier sequence and workflow discovery questions',
      type: 'ai_action'
    },
    {
      id: 't-3',
      time: '10:47 AM',
      title: 'Requirement identified',
      description: 'Prospect confirmed requirement: Lead management & WhatsApp automated funnel',
      type: 'qualification'
    },
    {
      id: 't-4',
      time: '10:49 AM',
      title: 'Lead classified as HOT (Score 92/100)',
      description: 'High intent algorithm triggered based on budget and timeline match',
      type: 'qualification'
    },
    {
      id: 't-5',
      time: '10:51 AM',
      title: `Budget confirmed (${budget})`,
      description: 'Prospect stated explicit enterprise allocation ready for Q3/Q4 implementation',
      type: 'qualification'
    },
    {
      id: 't-6',
      time: '10:53 AM',
      title: 'AI recommended human handoff & sales call',
      description: 'Confidence 96%. Recommended 20-min tailored solution discovery call',
      type: 'handoff'
    },
    {
      id: 't-7',
      time: '11:05 AM',
      title: `Assigned to ${lead.assignee?.name || 'Rahul — Sales'}`,
      description: 'Routing complete. Direct notification dispatched to account executive',
      type: 'assignment'
    }
  ]);

  // Follow-ups
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>(lead.followUps || [
    {
      id: 'f-1',
      title: 'Follow up regarding CRM & WhatsApp implementation discovery call',
      dueTime: 'Tomorrow — 11:00 AM',
      type: 'upcoming',
      isCompleted: false
    },
    {
      id: 'f-2',
      title: 'Pricing sheet and architecture blueprint dispatched via WhatsApp',
      dueTime: 'Yesterday — 4:30 PM',
      type: 'previous',
      isCompleted: true
    }
  ]);
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [newFollowUpText, setNewFollowUpText] = useState('');
  const [newFollowUpTime, setNewFollowUpTime] = useState('Tomorrow — 11:00 AM');

  // Internal Notes
  const [notes, setNotes] = useState<string[]>(lead.internalNotes || [
    'Client is specifically interested in WhatsApp automation and human escalation. Mention enterprise pricing during the discovery call.',
    'Decision maker has reviewed competitor solutions. Highlight Tecavy OS real-time routing latency.'
  ]);
  const [newNote, setNewNote] = useState('');

  // Tags
  const [tags, setTags] = useState<string[]>(lead.tags || ['HOT', 'CRM', 'WhatsApp', 'Enterprise', 'High Intent', 'Decision Maker']);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // AI Summary
  const [aiSummary, setAiSummary] = useState<string>(
    lead.conversationSummary || 
    `${lead.name} from ${lead.company} is actively evaluating Tecavy for omnichannel lead management and WhatsApp automation. They have a clearly specified requirement, an approved budget of ${budget}, and require implementation within 30 days. They are the primary decision maker and have explicitly requested a solutions discovery call and pricing.`
  );
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);

  // Status handler
  const handleStatusChange = (newStatus: Lead['status']) => {
    const updated: Lead = {
      ...lead,
      status: newStatus,
      stage: newStatus === 'Won' ? 'Deal closed' :
             newStatus === 'Proposal' ? 'Offer sent' :
             newStatus === 'Qualified' ? 'Negotiation' : 'Contacted'
    };
    onUpdateLead(updated);
    if (onNotify) onNotify('Status Updated', `Lead status updated to ${newStatus}.`);
  };

  // Temperature handler
  const handleTemperatureChange = (newTemp: LeadTemperature) => {
    const newScore = newTemp === 'HOT' ? Math.max(88, lead.score) : newTemp === 'WARM' ? 72 : 54;
    const updated: Lead = {
      ...lead,
      temperature: newTemp,
      score: newScore,
      isPriority: newTemp === 'HOT'
    };
    onUpdateLead(updated);
    if (onNotify) onNotify('Temperature Changed', `Lead flagged as ${newTemp} (${newScore}/100).`);
  };

  // Send message
  const handleSendMessage = () => {
    if (!replyText.trim()) return;
    const newMsg: LeadMessage = {
      id: `m-${Date.now()}`,
      sender: handlingMode === 'AI' ? 'ai' : 'human',
      senderName: handlingMode === 'AI' ? 'Tecavy AI' : (lead.assignee?.name || 'Rahul — Sales'),
      text: replyText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updatedMsgs = [...messages, newMsg];
    setMessages(updatedMsgs);
    setReplyText('');

    const newTimelineEvent: LeadTimelineEvent = {
      id: `t-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: `${handlingMode === 'AI' ? 'AI' : 'Agent'} sent reply`,
      description: newMsg.text.slice(0, 60) + '...',
      type: 'message'
    };
    const updatedTimeline = [...timelineEvents, newTimelineEvent];
    setTimelineEvents(updatedTimeline);

    onUpdateLead({
      ...lead,
      messages: updatedMsgs,
      timelineEvents: updatedTimeline,
      lastActivity: 'Just now'
    });

    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Generate AI Reply
  const handleGenerateAiReply = () => {
    setIsAiGenerating(true);
    setTimeout(() => {
      setReplyText(
        `Hi ${lead.name}, thanks for confirming! I have shared our Enterprise overview and pricing sheet. Would tomorrow at 11:30 AM or 3:00 PM IST work for a 20-minute tailored walkthrough with our solution architect?`
      );
      setIsAiGenerating(false);
      setActiveSubTab('conversation');
    }, 450);
  };

  // Toggle Human Handoff
  const handleToggleHandoff = () => {
    const nextMode: LeadHandlingMode = handlingMode === 'AI' ? 'HUMAN' : 'AI';
    setHandlingMode(nextMode);

    const newTimelineEvent: LeadTimelineEvent = {
      id: `t-${Date.now()}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: nextMode === 'HUMAN' ? 'Human agent took over conversation' : 'Conversation handed back to AI',
      description: `Handling mode switched to ${nextMode}`,
      type: 'handoff'
    };
    const updatedTimeline = [...timelineEvents, newTimelineEvent];
    setTimelineEvents(updatedTimeline);

    onUpdateLead({
      ...lead,
      handlingMode: nextMode,
      timelineEvents: updatedTimeline
    });

    if (onNotify) {
      onNotify(
        nextMode === 'HUMAN' ? 'Human Handoff Active' : 'AI Handled',
        nextMode === 'HUMAN' ? 'Sales agent is now handling prospect replies.' : 'AI auto-responder resumed.'
      );
    }
  };

  // Regenerate summary
  const handleRegenerateSummary = () => {
    setIsRegeneratingSummary(true);
    setTimeout(() => {
      setAiSummary(
        `High purchase intent lead: ${lead.name} (${jobTitle} at ${lead.company}) is evaluating Tecavy OS for omnichannel lead intake and WhatsApp automation. Implementation deadline is strictly within 30 days, supported by an allocated budget of ${budget}. Decision maker verified. Recommended: immediate discovery call.`
      );
      setIsRegeneratingSummary(false);
      if (onNotify) onNotify('Summary Refreshed', 'AI intelligence summary updated with latest signals.');
    }, 600);
  };

  // Add follow-up
  const handleAddFollowUp = () => {
    if (!newFollowUpText.trim()) return;
    const newFollowUp: LeadFollowUp = {
      id: `f-${Date.now()}`,
      title: newFollowUpText.trim(),
      dueTime: newFollowUpTime,
      type: 'upcoming',
      isCompleted: false
    };
    const updated = [newFollowUp, ...followUps];
    setFollowUps(updated);
    setNewFollowUpText('');
    setShowAddFollowUp(false);
    onUpdateLead({ ...lead, followUps: updated });
    if (onNotify) onNotify('Follow-up Added', `Scheduled: ${newFollowUp.title}`);
  };

  // Toggle follow-up completed
  const handleToggleFollowUp = (id: string) => {
    const updated = followUps.map(f => f.id === id ? { ...f, isCompleted: !f.isCompleted } : f);
    setFollowUps(updated);
    onUpdateLead({ ...lead, followUps: updated });
  };

  // Add internal note
  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const updated = [newNote.trim(), ...notes];
    setNotes(updated);
    setNewNote('');
    onUpdateLead({ ...lead, internalNotes: updated });
    if (onNotify) onNotify('Note Added', 'Internal note saved.');
  };

  // Add tag
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const formatted = newTagInput.trim();
    if (!tags.includes(formatted)) {
      const updated = [...tags, formatted];
      setTags(updated);
      onUpdateLead({ ...lead, tags: updated });
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter(t => t !== tagToRemove);
    setTags(updated);
    onUpdateLead({ ...lead, tags: updated });
  };

  const channelBadge = getChannelBadge(lead.source);
  const initials = lead.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-fadeIn">
      {/* 1. Backdrop (Clicking outside closes drawer) */}
      <div 
        className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-[2px] transition-opacity cursor-pointer"
        onClick={onClose}
        aria-label="Close lead profile"
      />

      {/* 2. Slide-over Workspace Drawer Panel */}
      <div className={`relative w-full max-w-4xl lg:max-w-4xl xl:max-w-5xl h-full flex flex-col z-10 transition-colors shadow-2xl select-text ${
        isLight
          ? 'bg-slate-50 text-slate-900 border-l border-slate-200'
          : 'bg-[#071C1A] text-[#E8E9D8] border-l border-[rgba(169,191,165,0.25)]'
      }`}>
        
        {/* ========================================================
            PERSISTENT HEADER: LEAD OVERVIEW & ACTIONS
            Identical across all 5 tabs
           ======================================================== */}
        <div className={`px-6 py-4 border-b flex flex-col gap-3 shrink-0 transition-colors ${
          isLight
            ? 'bg-white border-slate-200/90'
            : 'bg-[#061816] border-[rgba(169,191,165,0.18)]'
        }`}>
          <div className="flex items-start justify-between gap-4">
            
            {/* Lead Identity & Badges */}
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-200/80 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/40 flex items-center justify-center text-sm shrink-0 shadow-xs">
                {initials}
              </div>

              <div className="min-w-0">
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <h1 className={`text-xl font-bold tracking-tight truncate ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    {lead.name}
                  </h1>
                  
                  {/* Score & Temperature Badge */}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border tabular-nums flex items-center space-x-1 ${
                    temperature === 'HOT' 
                      ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800/60 dark:text-rose-300' 
                      : temperature === 'WARM' 
                      ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800/60 dark:text-amber-300' 
                      : 'bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}>
                    <span>{temperature === 'HOT' ? '🔥 HOT' : temperature === 'WARM' ? '🟠 WARM' : '⚪ COLD'}</span>
                    <span className="tabular-nums font-mono">{lead.score}/100</span>
                  </span>

                  {/* Channel Badge */}
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${channelBadge.badge}`}>
                    {channelBadge.name}
                  </span>
                </div>

                <div className={`flex items-center space-x-2 text-xs mt-1 truncate ${
                  isLight ? 'text-slate-500' : 'text-[#A9BFA5]'
                }`}>
                  <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-[#E8E9D8]'}`}>
                    {lead.company}
                  </span>
                  <span>·</span>
                  <span>{jobTitle}</span>
                  <span>·</span>
                  <span>{location}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions: Status, Temp, Handoff, Close */}
            <div className="flex items-center space-x-2 shrink-0">
              {/* Status Selector */}
              <select
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value as Lead['status'])}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer focus:outline-none focus:border-teal-600 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs'
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] hover:bg-[#0B2522]'
                }`}
                title="Update Pipeline Status"
              >
                <option value="New">Status: New</option>
                <option value="Engaged">Status: Engaged</option>
                <option value="Qualified">Status: Qualified</option>
                <option value="Contacted">Status: Contacted</option>
                <option value="Proposal">Status: Proposal</option>
                <option value="Won">Status: Won</option>
                <option value="Lost">Status: Lost</option>
              </select>

              {/* Temperature Selector */}
              <select
                value={temperature}
                onChange={(e) => handleTemperatureChange(e.target.value as LeadTemperature)}
                className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer focus:outline-none focus:border-teal-600 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs'
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] hover:bg-[#0B2522]'
                }`}
                title="Change Lead Temperature"
              >
                <option value="HOT">🔥 HOT</option>
                <option value="WARM">🟠 WARM</option>
                <option value="COLD">🔵 COLD</option>
              </select>

              {/* Human Handoff Toggle */}
              <button
                type="button"
                onClick={handleToggleHandoff}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  handlingMode === 'HUMAN' 
                    ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-200' 
                    : isLight
                    ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#A9BFA5] hover:text-[#E8E9D8]'
                }`}
                title="Toggle AI handling vs Human handling"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{handlingMode === 'HUMAN' ? 'Human Handled' : 'AI Handled'}</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isLight
                    ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                    : 'text-[#A9BFA5] hover:text-white hover:bg-[#0D2D2A]'
                }`}
                title="Close Lead Profile (Esc)"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Persistent Metadata Row: Budget · Timeline · Decision Maker · Assigned Owner */}
          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t text-xs ${
            isLight ? 'border-slate-100 text-slate-600' : 'border-[rgba(169,191,165,0.12)] text-[#A9BFA5]'
          }`}>
            <div>
              <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
              }`}>Budget</span>
              <span className={`font-semibold tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {budget}
              </span>
            </div>
            <div>
              <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
              }`}>Timeline</span>
              <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {timeline}
              </span>
            </div>
            <div>
              <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
              }`}>Decision Maker</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Verified Approver
              </span>
            </div>
            <div>
              <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
              }`}>Assigned Owner</span>
              <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {lead.assignee?.name || 'Rahul — Sales'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            STANDARDIZED FIVE-TAB NAVIGATION BAR
            Consistent styling matching Inbox and Overview
           ======================================================== */}
        <div className={`border-b px-6 flex items-center space-x-1 sm:space-x-2 overflow-x-auto shrink-0 select-none scrollbar-none transition-colors ${
          isLight
            ? 'bg-white border-slate-200/90'
            : 'bg-[#051513] border-[rgba(169,191,165,0.15)]'
        }`}>
          
          {/* Tab 1: AI Qualification */}
          <button
            type="button"
            onClick={() => setActiveSubTab('qualification')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'qualification'
                ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400 bg-teal-50/40 dark:bg-teal-950/20'
                : isLight
                ? 'text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-50'
                : 'text-[#A9BFA5]/70 border-transparent hover:text-white hover:bg-[#0D2D2A]/10'
            }`}
          >
            <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span>AI Qualification</span>
          </button>

          {/* Tab 2: Conversation */}
          <button
            type="button"
            onClick={() => setActiveSubTab('conversation')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'conversation'
                ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400 bg-teal-50/40 dark:bg-teal-950/20'
                : isLight
                ? 'text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-50'
                : 'text-[#A9BFA5]/70 border-transparent hover:text-white hover:bg-[#0D2D2A]/10'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>Conversation</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums font-mono ${
              activeSubTab === 'conversation'
                ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200'
                : isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
            }`}>
              {messages.length}
            </span>
          </button>

          {/* Tab 3: Lead Info & Source */}
          <button
            type="button"
            onClick={() => setActiveSubTab('info')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'info'
                ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400 bg-teal-50/40 dark:bg-teal-950/20'
                : isLight
                ? 'text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-50'
                : 'text-[#A9BFA5]/70 border-transparent hover:text-white hover:bg-[#0D2D2A]/10'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Lead Info & Source</span>
          </button>

          {/* Tab 4: Activity Timeline */}
          <button
            type="button"
            onClick={() => setActiveSubTab('timeline')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'timeline'
                ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400 bg-teal-50/40 dark:bg-teal-950/20'
                : isLight
                ? 'text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-50'
                : 'text-[#A9BFA5]/70 border-transparent hover:text-white hover:bg-[#0D2D2A]/10'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>Activity Timeline</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums font-mono ${
              activeSubTab === 'timeline'
                ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200'
                : isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
            }`}>
              {timelineEvents.length}
            </span>
          </button>

          {/* Tab 5: Follow-ups & Notes */}
          <button
            type="button"
            onClick={() => setActiveSubTab('notes')}
            className={`py-3 px-3.5 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeSubTab === 'notes'
                ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-400 bg-teal-50/40 dark:bg-teal-950/20'
                : isLight
                ? 'text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-50'
                : 'text-[#A9BFA5]/70 border-transparent hover:text-white hover:bg-[#0D2D2A]/10'
            }`}
          >
            <Lock className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Follow-ups & Notes</span>
            <span className={`text-[11px] px-1.5 py-0.2 rounded-full tabular-nums font-mono ${
              activeSubTab === 'notes'
                ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200'
                : isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
            }`}>
              {followUps.length}
            </span>
          </button>
        </div>

        {/* ========================================================
            SUB-TAB CONTENT CONTAINER (Scrollable with bottom clearance)
           ======================================================== */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6 pb-24">
          
          {/* ========================================================
              TAB 1: AI QUALIFICATION
             ======================================================== */}
          {activeSubTab === 'qualification' && (
            <div className="space-y-6 max-w-3xl">
              
              {/* Card 1: Score & Assessment Hero */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 block mb-1">
                      AI Lead Intelligence Assessment
                    </span>
                    <div className="flex items-baseline space-x-3 mt-1">
                      <span className={`text-4xl font-extrabold tabular-nums tracking-tight ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}>
                        {lead.score} <span className="text-xl font-normal text-slate-400">/ 100</span>
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/50 dark:border-rose-800/60 dark:text-rose-300">
                        🔥 {intentLevel}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className={`px-3 py-1.5 rounded-lg border font-medium ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-[#0D2D2A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                    }`}>
                      Confidence: <strong className="tabular-nums">96%</strong>
                    </span>
                    <span className={`px-3 py-1.5 rounded-lg border font-medium ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-[#0D2D2A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                    }`}>
                      Readiness: <strong className="text-emerald-600 dark:text-emerald-400">Immediate</strong>
                    </span>
                  </div>
                </div>

                {/* AI Conversation Summary */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                    }`}>
                      AI Conversation Summary
                    </span>
                    <button
                      type="button"
                      onClick={handleRegenerateSummary}
                      disabled={isRegeneratingSummary}
                      className="text-xs text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1.5 cursor-pointer font-medium disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isRegeneratingSummary ? 'animate-spin' : ''}`} />
                      <span>{isRegeneratingSummary ? 'Regenerating...' : 'Regenerate'}</span>
                    </button>
                  </div>
                  <p className={`text-sm leading-relaxed font-normal ${
                    isLight ? 'text-slate-600' : 'text-[#A9BFA5]'
                  }`}>
                    {aiSummary}
                  </p>
                </div>
              </div>

              {/* Card 2: Why This Lead is Qualified */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider block ${
                  isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                }`}>
                  Why this lead is qualified
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="flex items-center space-x-2.5 font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Requirement clearly identified</span>
                  </div>
                  <div className="flex items-center space-x-2.5 font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Budget mentioned ({budget})</span>
                  </div>
                  <div className="flex items-center space-x-2.5 font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Decision maker identified</span>
                  </div>
                  <div className="flex items-center space-x-2.5 font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Timeline identified (&lt;30 days)</span>
                  </div>
                  <div className="flex items-center space-x-2.5 font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Asked for enterprise pricing</span>
                  </div>
                  <div className="flex items-center space-x-2.5 font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Requested a discovery call</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Recommended Next Action */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-amber-50/70 border-amber-200/90'
                  : 'bg-[#18160E] border-amber-500/30'
              }`}>
                <div className="flex items-center space-x-2">
                  <Flame className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    Recommended Next Action
                  </span>
                </div>

                <div>
                  <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {aiRecommendation}
                  </h3>
                  <p className={`text-xs mt-1 leading-relaxed ${
                    isLight ? 'text-slate-600' : 'text-[#A9BFA5]'
                  }`}>
                    Reason: The prospect has high purchase intent, explicit budget allocated, and requested pricing and live support.
                  </p>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mt-1">
                    Suggested Timing: <strong>Within 24 hours</strong>
                  </p>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab('notes');
                      setShowAddFollowUp(true);
                      if (onNotify) onNotify('Discovery Call Queued', 'Ready to schedule discovery call with Rahul.');
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    Accept & Schedule Call
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSubTab('conversation');
                      handleGenerateAiReply();
                    }}
                    className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                        : 'bg-[#071F1C] border-[rgba(169,191,165,0.3)] text-white hover:bg-[#0B2522]'
                    }`}
                  >
                    Draft AI Follow-up
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 2: CONVERSATION
             ======================================================== */}
          {activeSubTab === 'conversation' && (
            <div className="space-y-4 max-w-3xl">
              
              {/* Channel & Mode banner */}
              <div className={`flex items-center justify-between p-3.5 rounded-xl border text-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90 text-slate-700 shadow-xs'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)] text-[#E8E9D8]'
              }`}>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                  <span className="font-semibold">{channelBadge.name} ({phone})</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={isLight ? 'text-slate-500 font-medium' : 'text-[#A9BFA5]'}>
                    Mode: {handlingMode === 'HUMAN' ? '👤 Human Handled' : '🤖 AI Handled'}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleHandoff}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                  >
                    {handlingMode === 'HUMAN' ? 'Return to AI' : 'Take Over'}
                  </button>
                </div>
              </div>

              {/* Chat Thread Container */}
              <div className={`border rounded-xl flex flex-col h-[520px] shadow-xs overflow-hidden transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {messages.map((msg, idx) => {
                    const isCustomer = msg.sender === 'customer';
                    const isAi = msg.sender === 'ai';
                    return (
                      <div 
                        key={msg.id}
                        className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                      >
                        <div className={`flex items-center space-x-1.5 mb-1 text-[11px] px-1 ${
                          isLight ? 'text-slate-400' : 'text-[#A9BFA5]/70'
                        }`}>
                          {isCustomer ? (
                            <>
                              <User className="w-3 h-3" />
                              <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {msg.senderName}
                              </span>
                            </>
                          ) : isAi ? (
                            <>
                              <Bot className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                              <span className="font-semibold text-teal-600 dark:text-teal-400">Tecavy AI</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                              <span className="font-semibold text-sky-600 dark:text-sky-300">Agent ({msg.senderName})</span>
                            </>
                          )}
                          <span>·</span>
                          <span className="text-[10px] font-mono tabular-nums">{msg.time}</span>
                        </div>

                        {/* Bubble matched to Inbox */}
                        <div className={`p-3.5 text-xs max-w-[82%] sm:max-w-[75%] leading-relaxed shadow-xs ${
                          isCustomer
                            ? isLight
                              ? 'bg-slate-100 text-slate-800 border border-slate-200/70 rounded-2xl rounded-tl-sm'
                              : 'bg-[#0B2522] border border-[rgba(169,191,165,0.2)] text-[#E8E9D8] rounded-2xl rounded-tl-sm'
                            : isAi
                            ? isLight
                              ? 'bg-teal-50/90 text-teal-950 border border-teal-200/60 rounded-2xl rounded-tr-sm'
                              : 'bg-[#0E2C26] border border-emerald-500/25 text-emerald-50 rounded-2xl rounded-tr-sm'
                            : isLight
                              ? 'bg-slate-900 text-white rounded-2xl rounded-tr-sm'
                              : 'bg-[#0D2D38] border border-sky-500/30 text-sky-50 rounded-2xl rounded-tr-sm'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                {/* Reply Toolbar & Composer */}
                <div className={`p-3.5 border-t space-y-2.5 transition-colors ${
                  isLight
                    ? 'bg-slate-50/80 border-slate-200/80'
                    : 'bg-[#071C1A] border-[rgba(169,191,165,0.15)]'
                }`}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleGenerateAiReply}
                      disabled={isAiGenerating}
                      className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
                      <span>{isAiGenerating ? 'Generating response...' : 'Generate AI Reply'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleHandoff}
                      className={`text-xs font-medium cursor-pointer ${
                        isLight ? 'text-slate-500 hover:text-slate-800' : 'text-[#A9BFA5] hover:text-white'
                      }`}
                    >
                      {handlingMode === 'AI' ? 'Take Over Conversation →' : 'Hand Back to AI 🤖'}
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      id="lead-reply-input"
                      type="text"
                      placeholder={`Reply to ${lead.name} via ${channelBadge.name}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                      className={`flex-1 text-xs px-3.5 py-2.5 rounded-lg border transition-colors focus:outline-none focus:border-teal-600 ${
                        isLight
                          ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                          : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] placeholder:text-[#A9BFA5]/50'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!replyText.trim()}
                      className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-40 flex items-center space-x-1.5"
                    >
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 3: LEAD INFO & SOURCE
             ======================================================== */}
          {activeSubTab === 'info' && (
            <div className="space-y-6 max-w-3xl">
              
              {/* Card 1: Contact Information */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider block ${
                  isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                }`}>
                  Contact Information
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Full Name</span>
                    <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{lead.name}</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Job Title</span>
                    <span className={isLight ? 'text-slate-800 font-medium' : 'text-[#E8E9D8]'}>{jobTitle}</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Email Address</span>
                    <a href={`mailto:${lead.email}`} className="text-teal-600 dark:text-teal-400 font-medium hover:underline flex items-center space-x-1">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span>{lead.email}</span>
                    </a>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Phone Number</span>
                    <a href={`tel:${phone}`} className="text-teal-600 dark:text-teal-400 font-medium hover:underline flex items-center space-x-1">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{phone}</span>
                    </a>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Company</span>
                    <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{lead.company}</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Company Size</span>
                    <span className={isLight ? 'text-slate-800 font-medium' : 'text-[#E8E9D8]'}>{companySize}</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Location</span>
                    <span className={isLight ? 'text-slate-800 font-medium' : 'text-[#E8E9D8]'}>{location}</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Preferred Channel</span>
                    <span className="text-teal-600 dark:text-teal-400 font-semibold">{preferredChannel}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Business & Requirement */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider block ${
                  isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                }`}>
                  Business & Requirement Scope
                </span>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Requirement Statement</span>
                    <p className={`p-3.5 rounded-lg border leading-relaxed font-normal ${
                      isLight
                        ? 'bg-slate-50 border-slate-200/80 text-slate-800'
                        : 'bg-[#071C1A] border-[rgba(169,191,165,0.15)] text-[#E8E9D8]'
                    }`}>
                      {requirement}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                        isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                      }`}>Budget Allocated</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{budget}</span>
                    </div>
                    <div>
                      <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                        isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                      }`}>Expected Timeline</span>
                      <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{timeline}</span>
                    </div>
                    <div>
                      <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                        isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                      }`}>Decision Maker</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{decisionMaker ? '✓ Yes (Verified)' : 'Influencer'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Attribution & Campaign Source */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <span className={`text-xs font-bold uppercase tracking-wider block ${
                  isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                }`}>
                  Lead Source & Campaign Attribution
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Origin Channel</span>
                    <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{lead.source}</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Campaign Name</span>
                    <span className={isLight ? 'text-slate-800 font-medium' : 'text-[#E8E9D8]'}>October Lead Generation Campaign</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>First Touch</span>
                    <span className={isLight ? 'text-slate-600' : 'text-[#A9BFA5]'}>Instagram Sponsored Story</span>
                  </div>
                  <div>
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Last Touch</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">WhatsApp Inbound Message</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={`block text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                      isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                    }`}>Creative / Ad Title</span>
                    <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-[#E8E9D8]'}`}>“AI-powered CRM for growing businesses”</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================
              TAB 4: ACTIVITY TIMELINE
             ======================================================== */}
          {activeSubTab === 'timeline' && (
            <div className="space-y-4 max-w-3xl">
              <div className={`p-6 rounded-xl border space-y-6 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                  }`}>
                    Chronological Activity Timeline
                  </span>
                  <span className={`text-xs font-mono tabular-nums ${
                    isLight ? 'text-slate-400' : 'text-[#A9BFA5]/70'
                  }`}>
                    {timelineEvents.length} events logged
                  </span>
                </div>

                <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                  {timelineEvents.map((evt) => (
                    <div key={evt.id} className="flex items-start space-x-3.5 relative pl-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 text-[10px] shadow-2xs ${
                        evt.type === 'message'
                          ? 'bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/40'
                          : evt.type === 'ai_action'
                          ? 'bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/40'
                          : evt.type === 'qualification'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/40'
                          : evt.type === 'handoff'
                          ? 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40'
                          : 'bg-purple-50 text-purple-600 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/40'
                      }`}>
                        {evt.type === 'message' ? <MessageSquare className="w-3 h-3" /> :
                         evt.type === 'ai_action' ? <Bot className="w-3 h-3" /> :
                         evt.type === 'qualification' ? <Check className="w-3 h-3" /> :
                         evt.type === 'handoff' ? <UserCheck className="w-3 h-3" /> :
                         <Clock className="w-3 h-3" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-xs font-semibold ${isLight ? 'text-slate-900' : 'text-[#E8E9D8]'}`}>
                            {evt.title}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                            {evt.time}
                          </span>
                        </div>
                        {evt.description && (
                          <p className={`text-xs font-normal mt-0.5 leading-relaxed ${
                            isLight ? 'text-slate-500' : 'text-[#A9BFA5]/75'
                          }`}>
                            {evt.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 5: FOLLOW-UPS, NOTES & TAGS
             ======================================================== */}
          {activeSubTab === 'notes' && (
            <div className="space-y-6 max-w-3xl">
              
              {/* Card 1: Scheduled Follow-ups */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                  }`}>
                    Scheduled Follow-ups
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddFollowUp(!showAddFollowUp)}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Follow-up</span>
                  </button>
                </div>

                {showAddFollowUp && (
                  <div className={`p-4 rounded-lg border space-y-3 animate-fadeIn ${
                    isLight
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-[#071C1A] border-[rgba(169,191,165,0.3)]'
                  }`}>
                    <input
                      type="text"
                      placeholder="e.g. Schedule discovery call regarding CRM implementation..."
                      value={newFollowUpText}
                      onChange={(e) => setNewFollowUpText(e.target.value)}
                      className={`w-full text-xs px-3 py-2 rounded-lg border focus:outline-none focus:border-teal-600 ${
                        isLight
                          ? 'bg-white border-slate-200 text-slate-900'
                          : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <input
                        type="text"
                        placeholder="Due date & time..."
                        value={newFollowUpTime}
                        onChange={(e) => setNewFollowUpTime(e.target.value)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-mono tabular-nums focus:outline-none focus:border-teal-600 ${
                          isLight
                            ? 'bg-white border-slate-200 text-slate-700'
                            : 'bg-[#061816] border-[rgba(169,191,165,0.25)] text-[#A9BFA5]'
                        }`}
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setShowAddFollowUp(false)}
                          className={`text-xs font-medium cursor-pointer px-2.5 py-1.5 ${
                            isLight ? 'text-slate-500 hover:text-slate-800' : 'text-[#A9BFA5] hover:text-white'
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleAddFollowUp}
                          disabled={!newFollowUpText.trim()}
                          className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-40"
                        >
                          Save Follow-up
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {followUps.map((item) => (
                    <div 
                      key={item.id}
                      className={`p-3.5 rounded-lg border text-xs flex items-start justify-between gap-3 transition-colors ${
                        item.isCompleted 
                          ? isLight
                            ? 'bg-slate-50 border-slate-200/60 opacity-60'
                            : 'bg-[#061816] border-[rgba(169,191,165,0.1)] opacity-60'
                          : isLight
                          ? 'bg-white border-slate-200/90 shadow-2xs'
                          : 'bg-[#071C1A] border-[rgba(169,191,165,0.2)]'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <button
                          type="button"
                          onClick={() => handleToggleFollowUp(item.id)}
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center cursor-pointer transition-colors border ${
                            item.isCompleted 
                              ? 'bg-teal-600 border-teal-600 text-white' 
                              : isLight
                              ? 'border-slate-300 hover:border-teal-600'
                              : 'border-[#A9BFA5]/50 hover:border-white'
                          }`}
                          aria-label={item.isCompleted ? "Mark incomplete" : "Mark complete"}
                        >
                          {item.isCompleted && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </button>
                        <div>
                          <p className={`font-medium leading-snug ${
                            item.isCompleted 
                              ? 'line-through text-slate-400 dark:text-[#A9BFA5]' 
                              : isLight ? 'text-slate-800' : 'text-[#E8E9D8]'
                          }`}>
                            {item.title}
                          </p>
                          <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-[#A9BFA5]/70 mt-0.5 block">
                            {item.dueTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 2: Internal Notes */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                    }`}>
                      Internal Notes
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2.5 py-0.5 rounded-md">
                    Internal Team Only — Not visible to customer
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Add an internal note for sales or solutions engineering..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                      className={`flex-1 text-xs px-3.5 py-2.5 rounded-lg border transition-colors focus:outline-none focus:border-teal-600 ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'
                          : 'bg-[#071C1A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] placeholder:text-[#A9BFA5]/50'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={!newNote.trim()}
                      className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      Save Note
                    </button>
                  </div>

                  {notes.map((n, i) => (
                    <div 
                      key={i} 
                      className={`p-3.5 rounded-lg border text-xs leading-relaxed font-normal ${
                        isLight
                          ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                          : 'bg-[#18160E] border-amber-500/25 text-amber-200'
                      }`}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              </div>

              {/* Card 3: Tags & Labels */}
              <div className={`p-6 rounded-xl border space-y-4 shadow-xs transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#061816] border-[rgba(169,191,165,0.2)]'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-700' : 'text-[#E8E9D8]'
                  }`}>
                    Tags & Labels
                  </span>
                  {!isAddingTag && (
                    <button
                      type="button"
                      onClick={() => setIsAddingTag(true)}
                      className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                    >
                      + Add Tag
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span 
                      key={tag}
                      className={`inline-flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-md border font-medium ${
                        isLight
                          ? 'bg-slate-100 border-slate-200 text-slate-800'
                          : 'bg-[#0D2D2A] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-slate-400 hover:text-rose-600 dark:text-[#A9BFA5]/60 dark:hover:text-rose-400 ml-1 cursor-pointer"
                        title="Remove tag"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>

                {isAddingTag && (
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      type="text"
                      placeholder="New tag label..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                      className={`text-xs px-3 py-1.5 rounded-lg border focus:outline-none focus:border-teal-600 ${
                        isLight
                          ? 'bg-white border-slate-200 text-slate-900'
                          : 'bg-[#071C1A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3.5 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold cursor-pointer shadow-xs"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingTag(false)}
                      className={`text-xs cursor-pointer px-2 ${
                        isLight ? 'text-slate-500 hover:text-slate-800' : 'text-[#A9BFA5] hover:text-white'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* ========================================================
            STANDARDIZED PERSISTENT BOTTOM ACTION BAR
            Anchored consistently across all 5 tabs
           ======================================================== */}
        <div className={`border-t px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 transition-colors shadow-sm ${
          isLight
            ? 'bg-white border-slate-200/90 text-slate-700'
            : 'bg-[#061816] border-[rgba(169,191,165,0.18)] text-[#A9BFA5]'
        }`}>
          <div className="flex items-center space-x-2.5 text-xs">
            <span>
              Assigned: <strong className={isLight ? 'text-slate-900' : 'text-white'}>{lead.assignee?.name || 'Rahul — Sales'}</strong>
            </span>
            <span>·</span>
            <span className={handlingMode === 'HUMAN' ? 'text-amber-600 dark:text-amber-300 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
              {handlingMode === 'HUMAN' ? '⚠️ Human Attention Active' : '🤖 AI Qualifier Active'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setActiveSubTab('conversation');
                setTimeout(() => {
                  document.getElementById('lead-reply-input')?.focus();
                }, 50);
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                  : 'bg-[#071C1A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8] hover:bg-[#0D2D2A]'
              }`}
            >
              Reply
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSubTab('notes');
                setShowAddFollowUp(true);
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                  : 'bg-[#071C1A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8] hover:bg-[#0D2D2A]'
              }`}
            >
              Follow-up
            </button>

            <button
              type="button"
              onClick={handleToggleHandoff}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                  : 'bg-[#071C1A] border-[rgba(169,191,165,0.3)] text-[#E8E9D8] hover:bg-[#0D2D2A]'
              }`}
            >
              {handlingMode === 'HUMAN' ? 'Hand to AI' : 'Human Handoff'}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSubTab('qualification');
                if (onNotify) onNotify('Discovery Call Queued', 'Discovery call invite scheduled for tomorrow 11:00 AM.');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              Schedule Discovery Call
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
