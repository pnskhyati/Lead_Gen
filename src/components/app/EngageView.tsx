import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Send, 
  Paperclip, 
  AlertTriangle, 
  Bot, 
  User, 
  UserCheck, 
  ChevronDown, 
  ChevronLeft,
  Check, 
  Flame, 
  Calendar, 
  Clock, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  Phone,
  Building2,
  MapPin,
  CheckCircle2,
  PanelRight,
  Archive,
  RefreshCw,
  X,
  FileText,
  HelpCircle,
  ShieldCheck,
  Filter,
  ArrowUpDown,
  SlidersHorizontal
} from 'lucide-react';
import { Lead, SubCategory } from '../../types';
import { useTheme } from '../../context/ThemeContext';

export type InboxFilterTab = 'needs_you' | 'all' | 'ai_handling' | 'closed';
export type ChannelFilter = 'All' | 'WhatsApp' | 'Instagram' | 'LinkedIn' | 'Website';
export type SortOption = 'newest' | 'oldest_waiting' | 'score';

export interface ConversationItem {
  id: string;
  name: string;
  company: string;
  location: string;
  time: string;
  timestampRaw?: number;
  channel: 'WhatsApp' | 'Instagram' | 'LinkedIn' | 'Website';
  status: 'needs_you' | 'ai_handling' | 'closed';
  snippet: string;
  stage: string;
  score: number;
  temperature: 'HOT' | 'WARM' | 'COLD';
  intelPill: string;
  whyPoints: string[];
  qualification: {
    requirement: boolean;
    budget: string;
    timeline: string;
    decisionMaker: boolean;
  };
  nextAction: string;
  aiAlert?: {
    isPaused: boolean;
    reason: string;
    confidence: 'low' | 'medium' | 'high';
  };
  messages: Array<{
    id: string;
    sender: 'customer' | 'ai' | 'agent';
    senderName: string;
    text: string;
    time: string;
  }>;
  assignedTo: string;
  leadReferenceId?: string;
  unread?: boolean;
  // Intent categories synced with Overview "Needs You" section
  isOverdueFollowUp?: boolean;
  overdueText?: string;
  askedForPricing?: boolean;
  readyToBookCall?: boolean;
  waitingForHuman?: boolean;
}

export interface EngageLiveHandlers {
  sendReply?: (leadId: string, text: string) => Promise<void>;
  takeOver?: (leadId: string) => Promise<void>;
  releaseToAi?: (leadId: string) => Promise<void>;
  closeLead?: (leadId: string) => Promise<void>;
  loadMessages?: (leadId: string) => Promise<ConversationItem['messages']>;
}

interface EngageViewProps {
  activeSubCategory: SubCategory;
  leads: Lead[];
  onNavigateSub: (sub: SubCategory) => void;
  onSelectLead?: (lead: Lead) => void;
  onNotify?: (title: string, desc: string) => void;
  isFirstRun?: boolean;
  onNavigateSettings?: () => void;
  /** When provided (including []), replaces demo conversations with live CRM data */
  seedConversations?: ConversationItem[] | null;
  liveHandlers?: EngageLiveHandlers;
}

export type InboxSpecialFilter = 'all' | 'overdue-followups' | 'asked-pricing' | 'ready-to-book' | 'waiting-human';

export default function EngageView({
  activeSubCategory,
  leads,
  onNavigateSub,
  onSelectLead,
  onNotify,
  isFirstRun = false,
  onNavigateSettings,
  seedConversations = null,
  liveHandlers,
}: EngageViewProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const leadIdOf = (c: ConversationItem) => c.leadReferenceId || c.id;

  // Special intent filter state synced with activeSubCategory from Overview Needs You section
  const [specialFilter, setSpecialFilter] = useState<InboxSpecialFilter>(() => {
    if (activeSubCategory === 'overdue-followups' || activeSubCategory === 'follow-ups') return 'overdue-followups';
    if (activeSubCategory === 'asked-pricing' || activeSubCategory === 'pricing') return 'asked-pricing';
    if (activeSubCategory === 'ready-to-book' || activeSubCategory === 'book-call') return 'ready-to-book';
    if (activeSubCategory === 'waiting-human' || activeSubCategory === 'human-handoff') return 'waiting-human';
    return 'all';
  });

  // Top Filter Bar State
  const [activeTab, setActiveTab] = useState<InboxFilterTab>('needs_you');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('All');
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [showLeadPanel, setShowLeadPanel] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});

  // Close filter popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        setShowFilterPopover(false);
      }
    }
    if (showFilterPopover) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilterPopover]);

  // Mobile responsive view mode: 'list' | 'chat' | 'details'
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'details'>('chat');

  // Sync specialFilter whenever activeSubCategory prop changes
  useEffect(() => {
    if (activeSubCategory === 'overdue-followups' || activeSubCategory === 'follow-ups') {
      setSpecialFilter('overdue-followups');
    } else if (activeSubCategory === 'asked-pricing' || activeSubCategory === 'pricing') {
      setSpecialFilter('asked-pricing');
    } else if (activeSubCategory === 'ready-to-book' || activeSubCategory === 'book-call') {
      setSpecialFilter('ready-to-book');
    } else if (activeSubCategory === 'waiting-human' || activeSubCategory === 'human-handoff') {
      setSpecialFilter('waiting-human');
    }
  }, [activeSubCategory]);

  // Initial Conversations Data with full detail
  const [conversations, setConversations] = useState<ConversationItem[]>([
    // 1. Rahul Sharma - Asked for Pricing & Waiting for Human (Aster Labs)
    {
      id: 'convo-rahul',
      name: 'Rahul Sharma',
      company: 'Aster Labs',
      location: 'Pune',
      time: '4m',
      timestampRaw: Date.now() - 4 * 60 * 1000,
      channel: 'WhatsApp',
      status: 'needs_you',
      waitingForHuman: true,
      askedForPricing: true,
      snippet: 'Asked for custom pricing: Enterprise CRM & WhatsApp automation.',
      stage: 'Qualified',
      score: 92,
      temperature: 'HOT',
      intelPill: 'Aster Labs · Pune · Hot',
      whyPoints: ['+ asked for pricing twice', '+ clear budget ₹5-8L', '+ requested live call'],
      qualification: {
        requirement: true,
        budget: '₹5-8L',
        timeline: '30 days',
        decisionMaker: false
      },
      nextAction: 'schedule pricing discovery call',
      aiAlert: {
        isPaused: true,
        reason: 'AI paused: prospect asked for custom pricing. Confidence: low.',
        confidence: 'low'
      },
      messages: [
        {
          id: 'm1',
          sender: 'customer',
          senderName: 'Rahul',
          text: 'Hi, I need pricing for enterprise CRM and WhatsApp automation.',
          time: '10:42 AM'
        },
        {
          id: 'm2',
          sender: 'ai',
          senderName: 'AI',
          text: 'Absolutely Rahul! Could you share your monthly volume and team size so I can calculate your tier?',
          time: '10:44 AM'
        },
        {
          id: 'm3',
          sender: 'customer',
          senderName: 'Rahul',
          text: 'Can someone speak to me about enterprise pricing for 12 seats?',
          time: '10:46 AM'
        }
      ],
      assignedTo: 'Rahul — Sales',
      leadReferenceId: 'lead-rahul-sharma'
    },

    // 2. Neha Gupta - Asked for Pricing (Kavya Luxury Interiors)
    {
      id: 'convo-neha',
      name: 'Neha Gupta',
      company: 'Kavya Luxury Interiors',
      location: 'New Delhi',
      time: '15m',
      timestampRaw: Date.now() - 15 * 60 * 1000,
      channel: 'Instagram',
      status: 'needs_you',
      unread: true,
      askedForPricing: true,
      snippet: 'Asked for pricing: Commercial pricing sheet for 5 store locations.',
      stage: 'Qualified',
      score: 89,
      temperature: 'HOT',
      intelPill: 'Kavya Interiors · Pricing Inquiry',
      whyPoints: ['+ asked for commercial price sheet', '+ multi-store expansion', '+ verified store owner'],
      qualification: {
        requirement: true,
        budget: '₹4.5L',
        timeline: '15 days',
        decisionMaker: true
      },
      nextAction: 'send commercial pricing PDF',
      aiAlert: {
        isPaused: true,
        reason: 'AI paused: commercial rate card requested.',
        confidence: 'medium'
      },
      messages: [
        {
          id: 'm-n1',
          sender: 'customer',
          senderName: 'Neha',
          text: 'Hi! We love your studio workflows. Could you please send your detailed commercial pricing sheet?',
          time: '11:15 AM'
        },
        {
          id: 'm-n2',
          sender: 'ai',
          senderName: 'AI',
          text: 'Hello Neha! Our business plans start at ₹45,000/mo. Would you like a customized enterprise quote?',
          time: '11:17 AM'
        },
        {
          id: 'm-n3',
          sender: 'customer',
          senderName: 'Neha',
          text: 'Yes please, send the full pricing breakdown for our 5 store locations.',
          time: '11:20 AM'
        }
      ],
      assignedTo: 'Sarah — Solutions',
      leadReferenceId: 'lead-neha'
    },

    // 3. Elena Rostova - Overdue Follow-up & Waiting for Human (Nordic Space Design)
    {
      id: 'convo-elena',
      name: 'Elena Rostova',
      company: 'Nordic Space Design',
      location: 'Stockholm',
      time: '2h',
      timestampRaw: Date.now() - 120 * 60 * 1000,
      channel: 'WhatsApp',
      status: 'needs_you',
      isOverdueFollowUp: true,
      overdueText: '3 days overdue',
      waitingForHuman: true,
      snippet: 'Proposal sent Friday; overdue follow-up on bespoke studio integration.',
      stage: 'Proposal',
      score: 95,
      temperature: 'HOT',
      intelPill: 'Nordic Design · 3d Overdue Follow-up',
      whyPoints: ['+ 3 days overdue on proposal follow-up', '+ enterprise budget €12k', '+ founder reviewed proposal'],
      qualification: {
        requirement: true,
        budget: '€12,000',
        timeline: '14 days',
        decisionMaker: true
      },
      nextAction: 'ping Elena regarding tailored proposal feedback',
      aiAlert: {
        isPaused: true,
        reason: 'AI paused: overdue follow-up on customized commercial contract.',
        confidence: 'high'
      },
      messages: [
        {
          id: 'm-e1',
          sender: 'agent',
          senderName: 'You',
          text: 'Hi Elena, I sent over the updated Nordic Space workflow proposal on Friday. Did you get a chance to review?',
          time: 'Friday 4:30 PM'
        },
        {
          id: 'm-e2',
          sender: 'customer',
          senderName: 'Elena',
          text: 'Hi! Yes, reviewing with our CFO this afternoon. Can we talk at 3 PM CET?',
          time: '12:05 PM'
        }
      ],
      assignedTo: 'Rahul — Sales',
      leadReferenceId: 'lead-elena'
    },

    // 4. Marcus Vance - Ready to Book Call (Apex Velocity)
    {
      id: 'convo-marcus',
      name: 'Marcus Vance',
      company: 'Apex Velocity',
      location: 'Singapore',
      time: '35m',
      timestampRaw: Date.now() - 35 * 60 * 1000,
      channel: 'LinkedIn',
      status: 'needs_you',
      readyToBookCall: true,
      snippet: 'Ready to book: Requested demo slot for engineering team of 18.',
      stage: 'Engaged',
      score: 87,
      temperature: 'HOT',
      intelPill: 'Apex Velocity · Ready to Book Demo',
      whyPoints: ['+ confirmed engineering budget $10k', '+ ready to schedule walkthrough', '+ 18 engineers'],
      qualification: {
        requirement: true,
        budget: '$10,000/mo',
        timeline: 'Immediate',
        decisionMaker: true
      },
      nextAction: 'send calendar booking link',
      aiAlert: {
        isPaused: true,
        reason: 'Prospect ready to book: clinical lead requested calendar booking.',
        confidence: 'high'
      },
      messages: [
        {
          id: 'm-m1',
          sender: 'customer',
          senderName: 'Marcus',
          text: 'Hi team, our engineering managers checked your system and want a tailored 20-min live demo.',
          time: '1:12 PM'
        },
        {
          id: 'm-m2',
          sender: 'ai',
          senderName: 'AI',
          text: 'Delighted to hear that Marcus! We have slots open today and tomorrow afternoon.',
          time: '1:14 PM'
        },
        {
          id: 'm-m3',
          sender: 'customer',
          senderName: 'Marcus',
          text: 'Great, please drop your calendar link here and I will book 3 PM.',
          time: '1:25 PM'
        }
      ],
      assignedTo: 'Priya — AE',
      leadReferenceId: 'lead-marcus'
    },

    // 5. Dr. Ananya Sen - Overdue Follow-up (Nura Wellness)
    {
      id: 'convo-ananya',
      name: 'Dr. Ananya Sen',
      company: 'Nura Wellness',
      location: 'Bengaluru',
      time: '1d',
      timestampRaw: Date.now() - 24 * 60 * 60 * 1000,
      channel: 'WhatsApp',
      status: 'needs_you',
      isOverdueFollowUp: true,
      overdueText: '2 days overdue',
      snippet: 'Pending HIPAA & Indian DPDP compliance verification check.',
      stage: 'Engaged',
      score: 79,
      temperature: 'WARM',
      intelPill: 'Nura Wellness · 2d Overdue',
      whyPoints: ['+ clinical compliance questions', '+ 2 clinics in Bengaluru', '+ timeline Q4 rollout'],
      qualification: {
        requirement: true,
        budget: '₹3L',
        timeline: '45 days',
        decisionMaker: false
      },
      nextAction: 'share DPDP compliance certificate & security whitepaper',
      aiAlert: {
        isPaused: true,
        reason: 'Compliance qualification requires certified officer sign-off.',
        confidence: 'medium'
      },
      messages: [
        {
          id: 'm-a1',
          sender: 'customer',
          senderName: 'Dr. Ananya',
          text: 'Hello. Does your WhatsApp automation comply with Indian DPDP Act standards for medical clinics?',
          time: 'Yesterday'
        }
      ],
      assignedTo: 'Sarah — Solutions',
      leadReferenceId: 'lead-ananya'
    },

    // 6. Vikram Mehta - AI Handling (Mehta FinTech)
    {
      id: 'convo-vikram',
      name: 'Vikram Mehta',
      company: 'Mehta FinTech',
      location: 'Mumbai',
      time: '1h',
      timestampRaw: Date.now() - 60 * 60 * 1000,
      channel: 'WhatsApp',
      status: 'ai_handling',
      snippet: 'AI qualified prospect: ₹10L budget, 60 days timeline, founder lead.',
      stage: 'Qualified',
      score: 94,
      temperature: 'HOT',
      intelPill: 'Mehta FinTech · AI Automated Qualification',
      whyPoints: ['+ verified founder', '+ ₹10L budget stated', '+ automated qualification complete'],
      qualification: {
        requirement: true,
        budget: '₹10L',
        timeline: '60 days',
        decisionMaker: true
      },
      nextAction: 'prepare executive walkthrough for next week',
      aiAlert: undefined,
      messages: [
        {
          id: 'm-v1',
          sender: 'customer',
          senderName: 'Vikram',
          text: 'Hi, we are building a private wealth advisory and need quiet CRM tools.',
          time: '12:30 PM'
        },
        {
          id: 'm-v2',
          sender: 'ai',
          senderName: 'AI',
          text: 'Welcome Vikram! We serve leading boutique wealth firms. What team size are you planning for?',
          time: '12:31 PM'
        },
        {
          id: 'm-v3',
          sender: 'customer',
          senderName: 'Vikram',
          text: 'Around 25 advisors across Mumbai and Surat.',
          time: '12:35 PM'
        },
        {
          id: 'm-v4',
          sender: 'ai',
          senderName: 'AI',
          text: 'Perfect. Our Enterprise tier includes end-to-end data residency in Mumbai. I have noted this on your file.',
          time: '12:36 PM'
        }
      ],
      assignedTo: 'Rahul — Sales',
      leadReferenceId: 'lead-vikram'
    },

    // 7. Priya Nair - AI Handling (Studio Form & Light)
    {
      id: 'convo-priya',
      name: 'Priya Nair',
      company: 'Studio Form & Light',
      location: 'Kochi',
      time: '3h',
      timestampRaw: Date.now() - 180 * 60 * 1000,
      channel: 'Instagram',
      status: 'ai_handling',
      snippet: 'AI answered portfolio syndication queries; scheduled follow-up for Tuesday.',
      stage: 'Contacted',
      score: 84,
      temperature: 'WARM',
      intelPill: 'Form & Light · Instagram Inquiry',
      whyPoints: ['+ architectural studio lead', '+ interested in asset syndication', '+ responsive to AI'],
      qualification: {
        requirement: true,
        budget: '₹2.5L',
        timeline: '30 days',
        decisionMaker: true
      },
      nextAction: 'automated follow-up Tuesday 10 AM',
      aiAlert: undefined,
      messages: [
        {
          id: 'm-p1',
          sender: 'customer',
          senderName: 'Priya',
          text: 'Hey! Loved your recent post about quiet aesthetics. How does your studio sync work?',
          time: '10:05 AM'
        },
        {
          id: 'm-p2',
          sender: 'ai',
          senderName: 'AI',
          text: 'Hello Priya! We sync your creative assets across Instagram, LinkedIn, and WhatsApp without manual export steps.',
          time: '10:07 AM'
        }
      ],
      assignedTo: 'Sarah — Solutions',
      leadReferenceId: 'lead-priya'
    },

    // 8. Carlos Mendes - Closed / Resolved (Iberia Mobility)
    {
      id: 'convo-carlos',
      name: 'Carlos Mendes',
      company: 'Iberia Mobility',
      location: 'Madrid',
      time: '1d',
      timestampRaw: Date.now() - 26 * 60 * 60 * 1000,
      channel: 'Website',
      status: 'closed',
      snippet: 'Contract executed: Signed 12-month enterprise subscription.',
      stage: 'Won',
      score: 98,
      temperature: 'HOT',
      intelPill: 'Iberia Mobility · Deal Closed',
      whyPoints: ['+ annual contract signed', '+ €18,000 ARR', '+ onboarded via European datacenter'],
      qualification: {
        requirement: true,
        budget: '€18,000/yr',
        timeline: 'Closed',
        decisionMaker: true
      },
      nextAction: 'hand off to Customer Success team',
      aiAlert: undefined,
      messages: [
        {
          id: 'm-c1',
          sender: 'customer',
          senderName: 'Carlos',
          text: 'Docusign completed and countersigned. Looking forward to kick-off!',
          time: 'Yesterday 5:20 PM'
        },
        {
          id: 'm-c2',
          sender: 'agent',
          senderName: 'You',
          text: 'Thank you Carlos! Your onboarding engineer will reach out at 10:00 AM CET.',
          time: 'Yesterday 5:25 PM'
        }
      ],
      assignedTo: 'Rahul — Sales',
      leadReferenceId: 'lead-carlos'
    },

    // 9. Sophie Dubois - Closed / Resolved (Lumière Atelier)
    {
      id: 'convo-sophie',
      name: 'Sophie Dubois',
      company: 'Lumière Atelier',
      location: 'Paris',
      time: '3d',
      timestampRaw: Date.now() - 72 * 60 * 60 * 1000,
      channel: 'Instagram',
      status: 'closed',
      snippet: 'Resolved: Self-served starter plan through web checkout.',
      stage: 'Won',
      score: 82,
      temperature: 'WARM',
      intelPill: 'Lumière Atelier · Starter Checkout',
      whyPoints: ['+ self-serve starter checkout', '+ €450/mo active', '+ automated onboarding email sent'],
      qualification: {
        requirement: true,
        budget: '€450/mo',
        timeline: 'Closed',
        decisionMaker: true
      },
      nextAction: 'monitor 30-day usage health',
      aiAlert: undefined,
      messages: [
        {
          id: 'm-s1',
          sender: 'customer',
          senderName: 'Sophie',
          text: 'Thank you for answering my questions earlier. Upgraded through your link!',
          time: 'Oct 14'
        }
      ],
      assignedTo: 'Priya — AE',
      leadReferenceId: 'lead-sophie'
    },

    // 10. David Chen - AI Handling (Vanguard Architectural Group)
    {
      id: 'convo-david',
      name: 'David Chen',
      company: 'Vanguard Architectural Group',
      location: 'Vancouver',
      time: '4h',
      timestampRaw: Date.now() - 240 * 60 * 1000,
      channel: 'Website',
      status: 'ai_handling',
      snippet: 'AI shared architectural whitepaper and studio case study.',
      stage: 'Qualified',
      score: 91,
      temperature: 'HOT',
      intelPill: 'Vanguard Arch · Whitepaper Shared',
      whyPoints: ['+ downloaded architectural case study', '+ 4 partner studios', '+ budget confirmed $8k/mo'],
      qualification: {
        requirement: true,
        budget: '$8,000/mo',
        timeline: '30 days',
        decisionMaker: true
      },
      nextAction: 'schedule follow-up with partner group',
      aiAlert: undefined,
      messages: [
        {
          id: 'm-j1',
          sender: 'customer',
          senderName: 'David',
          text: 'Hello, our architecture team is reviewing quiet CRM workflows for our studio.',
          time: '9:45 AM'
        },
        {
          id: 'm-j2',
          sender: 'ai',
          senderName: 'AI',
          text: 'Welcome David! We specialize in low-latency asset syndication and client portal generation.',
          time: '9:47 AM'
        },
        {
          id: 'm-j3',
          sender: 'customer',
          senderName: 'David',
          text: 'Thanks, that documentation helps. Let me circle back with our technical lead.',
          time: '9:50 AM'
        }
      ],
      assignedTo: 'Sarah — Solutions',
      leadReferenceId: 'lead-vanguard'
    }
  ]);

  // Selected conversation
  const [selectedConvoId, setSelectedConvoId] = useState<string>('convo-rahul');

  // Replace demo seed when live CRM conversations are provided
  useEffect(() => {
    if (seedConversations == null) return;
    setConversations((prev) => {
      const prevMsgs = new Map(prev.map((c) => [c.id, c.messages]));
      return seedConversations.map((c) => {
        const existing = prevMsgs.get(c.id);
        if (existing && existing.length > (c.messages?.length || 0)) {
          return { ...c, messages: existing };
        }
        return c;
      });
    });
    if (seedConversations.length > 0) {
      setSelectedConvoId((id) =>
        seedConversations.some((c) => c.id === id) ? id : seedConversations[0].id
      );
    }
  }, [seedConversations]);

  // Active reply text
  const [replyInput, setReplyInput] = useState('');

  // Assign dropdown state in center panel
  const [showAssignMenu, setShowAssignMenu] = useState(false);

  // Filtered list with status tab, channel, search, special intent filters, and sorting
  const filteredConversations = useMemo(() => {
    let list = conversations.filter(c => {
      // Special intent filters from Overview Needs You section
      if (specialFilter === 'overdue-followups' && !c.isOverdueFollowUp) return false;
      if (specialFilter === 'asked-pricing' && !c.askedForPricing) return false;
      if (specialFilter === 'ready-to-book' && !c.readyToBookCall) return false;
      if (specialFilter === 'waiting-human' && !c.waitingForHuman) return false;

      // Status tab filter
      if (specialFilter === 'all') {
        if (activeTab === 'needs_you' && c.status !== 'needs_you') return false;
        if (activeTab === 'ai_handling' && c.status !== 'ai_handling') return false;
        if (activeTab === 'closed' && c.status !== 'closed') return false;
      }

      // Channel filter
      if (channelFilter !== 'All' && c.channel !== channelFilter) return false;

      // Assignee filter
      if (assigneeFilter !== 'All' && !c.assignedTo.includes(assigneeFilter)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesCompany = c.company.toLowerCase().includes(q);
        const matchesSnippet = c.snippet.toLowerCase().includes(q);
        if (!matchesName && !matchesCompany && !matchesSnippet) return false;
      }

      return true;
    });

    // Apply sorting
    if (sortBy === 'score') {
      list = [...list].sort((a, b) => b.score - a.score);
    } else if (sortBy === 'oldest_waiting') {
      list = [...list].sort((a, b) => (a.timestampRaw || 0) - (b.timestampRaw || 0));
    } else {
      // 'newest' default
      list = [...list].sort((a, b) => (b.timestampRaw || 0) - (a.timestampRaw || 0));
    }

    return list;
  }, [conversations, activeTab, channelFilter, searchQuery, specialFilter, sortBy, assigneeFilter]);

  // Current selected conversation
  const currentConvo = useMemo(() => {
    return filteredConversations.find(c => c.id === selectedConvoId) || filteredConversations[0] || conversations[0];
  }, [conversations, selectedConvoId, filteredConversations]);

  // Update selected conversation when filter switches
  useEffect(() => {
    if (specialFilter !== 'all' && filteredConversations.length > 0) {
      if (!filteredConversations.some(c => c.id === selectedConvoId)) {
        setSelectedConvoId(filteredConversations[0].id);
      }
    }
  }, [specialFilter, filteredConversations, selectedConvoId]);

  // Needs you count
  const needsYouCount = useMemo(() => {
    return conversations.filter(c => c.status === 'needs_you').length;
  }, [conversations]);

  // Message history container ref and scroll handling
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevConvoIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number>(0);

  useEffect(() => {
    if (!currentConvo) return;
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNewConversation = prevConvoIdRef.current !== currentConvo.id;
    const currentCount = currentConvo.messages.length;
    const hasNewMessage = currentCount > prevMessageCountRef.current;

    if (isNewConversation) {
      container.scrollTop = container.scrollHeight;
      prevConvoIdRef.current = currentConvo.id;
      prevMessageCountRef.current = currentCount;
    } else if (hasNewMessage) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 180;
      if (isNearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
      prevMessageCountRef.current = currentCount;
    }
  }, [currentConvo?.id, currentConvo?.messages]);

  // Load live transcript when switching conversations
  useEffect(() => {
    if (!liveHandlers?.loadMessages || !currentConvo) return;
    const leadId = leadIdOf(currentConvo);
    let cancelled = false;
    void liveHandlers.loadMessages(leadId).then((msgs) => {
      if (cancelled || !msgs?.length) return;
      setConversations((prev) =>
        prev.map((c) => (c.id === currentConvo.id ? { ...c, messages: msgs } : c))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [currentConvo?.id, liveHandlers]);

  // Handle Send Reply
  const handleSendReply = (customText?: string) => {
    const textToSend = (customText || replyInput).trim();
    if (!textToSend || !currentConvo) return;

    const newMsg = {
      id: `m-${Date.now()}`,
      sender: 'agent' as const,
      senderName: 'You',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversations(prev => prev.map(c => {
      if (c.id === currentConvo.id) {
        return {
          ...c,
          messages: [...c.messages, newMsg],
          snippet: textToSend.slice(0, 52) + (textToSend.length > 52 ? '...' : ''),
          time: 'Just now',
          timestampRaw: Date.now(),
          status: 'needs_you'
        };
      }
      return c;
    }));

    setReplyInput('');
    if (liveHandlers?.sendReply) {
      void liveHandlers.sendReply(leadIdOf(currentConvo), textToSend).catch((err) => {
        if (onNotify) onNotify('Send failed', err instanceof Error ? err.message : 'Reply failed');
      });
    }
    if (onNotify) onNotify('Message Sent', `Dispatched reply to ${currentConvo.name} via ${currentConvo.channel}.`);
    
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 50);
  };

  // Handle Take Over
  const handleTakeOver = () => {
    setConversations(prev => prev.map(c => {
      if (c.id === currentConvo.id) {
        return {
          ...c,
          status: 'needs_you',
          aiAlert: {
            isPaused: true,
            reason: 'Human agent active: AI auto-responder paused.',
            confidence: 'low'
          }
        };
      }
      return c;
    }));
    if (liveHandlers?.takeOver && currentConvo) {
      void liveHandlers.takeOver(leadIdOf(currentConvo)).catch(() => undefined);
    }
    if (onNotify) onNotify('Conversation Taken Over', 'AI paused. You are now actively handling this prospect.');
  };

  // Handle Hand Back to AI
  const handleHandBack = () => {
    setConversations(prev => prev.map(c => {
      if (c.id === currentConvo.id) {
        return {
          ...c,
          status: 'ai_handling',
          aiAlert: undefined
        };
      }
      return c;
    }));
    if (liveHandlers?.releaseToAi && currentConvo) {
      void liveHandlers.releaseToAi(leadIdOf(currentConvo)).catch(() => undefined);
    }
    if (onNotify) onNotify('Handed to AI', 'AI auto-responder has resumed for this conversation.');
  };

  // Handle Dismiss AI Alert Banner / Tab
  const handleDismissAlert = () => {
    if (!currentConvo) return;
    setDismissedAlerts(prev => ({ ...prev, [currentConvo.id]: true }));
    setConversations(prev => prev.map(c => {
      if (c.id === currentConvo.id && c.aiAlert) {
        return {
          ...c,
          aiAlert: undefined
        };
      }
      return c;
    }));
    if (onNotify) onNotify('Notice Closed', 'AI alert banner dismissed.');
  };

  // Handle Toggle Closed / Resolved
  const handleToggleClosed = () => {
    if (!currentConvo) return;
    const isNowClosed = currentConvo.status !== 'closed';
    setConversations(prev => prev.map(c => {
      if (c.id === currentConvo.id) {
        return {
          ...c,
          status: isNowClosed ? 'closed' : 'needs_you'
        };
      }
      return c;
    }));
    if (isNowClosed && liveHandlers?.closeLead) {
      void liveHandlers.closeLead(leadIdOf(currentConvo)).catch(() => undefined);
    }
    if (onNotify) {
      onNotify(
        isNowClosed ? 'Conversation Resolved' : 'Conversation Reopened',
        `${currentConvo.name} moved to ${isNowClosed ? 'Closed' : 'Needs Attention'}.`
      );
    }
  };

  // Handle Assign
  const handleAssign = (agentName: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === currentConvo.id) {
        return {
          ...c,
          assignedTo: agentName
        };
      }
      return c;
    }));
    setShowAssignMenu(false);
    if (onNotify) onNotify('Assigned', `Conversation assigned to ${agentName}.`);
  };

  // Handle Stage Change
  const handleStageChange = (newStage: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id === currentConvo.id) {
        return {
          ...c,
          stage: newStage
        };
      }
      return c;
    }));
    if (onNotify) onNotify('Stage Updated', `${currentConvo.name} moved to ${newStage}.`);
  };

  // Handle Open Lead in workspace drawer
  const handleOpenLead = () => {
    if (!onSelectLead || !currentConvo) return;
    const matchingLead = leads.find(l => 
      (currentConvo.leadReferenceId && l.id === currentConvo.leadReferenceId) ||
      l.name.toLowerCase() === currentConvo.name.toLowerCase() ||
      l.company.toLowerCase() === currentConvo.company.toLowerCase()
    );

    if (matchingLead) {
      onSelectLead(matchingLead);
    } else {
      const dynamicLead: Lead = {
        id: currentConvo.id,
        name: currentConvo.name,
        company: currentConvo.company,
        location: currentConvo.location,
        email: `${currentConvo.name.toLowerCase().replace(' ', '.')}@${currentConvo.company.toLowerCase().replace(' ', '')}.com`,
        phone: '+91 98201 44820',
        title: 'Decision Maker & Operations Lead',
        source: currentConvo.channel,
        score: currentConvo.score,
        temperature: currentConvo.temperature,
        stage: currentConvo.stage as any,
        status: currentConvo.stage === 'Qualified' ? 'Qualified' : 'Engaged',
        value: currentConvo.qualification.budget,
        budget: currentConvo.qualification.budget,
        timeline: currentConvo.qualification.timeline,
        requirement: currentConvo.snippet,
        assignee: { name: currentConvo.assignedTo, role: 'Sales' },
        tag: 'Priority',
        isPriority: currentConvo.temperature === 'HOT',
        decisionMaker: currentConvo.qualification.decisionMaker,
        date: 'Today',
        lastActivity: currentConvo.time
      };
      onSelectLead(dynamicLead);
    }
  };

  // Clean initials helper
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Score badge helper (green >= 90, yellow 80-89, red < 80)
  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return {
        text: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
        dot: 'bg-emerald-500'
      };
    }
    if (score >= 80) {
      return {
        text: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
        dot: 'bg-amber-500'
      };
    }
    return {
      text: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
      dot: 'bg-rose-500'
    };
  };

  // Channel badge colors
  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'WhatsApp':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40';
      case 'Instagram':
        return 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-800/40';
      case 'LinkedIn':
        return 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/40';
      default:
        return 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/40';
    }
  };

  return (
    <div className={`w-full flex-1 min-h-0 flex flex-col gap-3 animate-fadeIn overflow-hidden select-text ${
      isLight ? 'text-slate-900' : 'text-[#E8E9D8]'
    }`}>
      
      {/* First-Run Empty State (when isFirstRun is active) */}
      {isFirstRun && (
        <div className={`p-8 sm:p-12 rounded-xl border text-center space-y-4 max-w-lg mx-auto my-6 animate-fadeIn shadow-sm ${
          isLight
            ? 'bg-white border-slate-200'
            : 'bg-[#061816] border-teal-500/30'
        }`}>
          <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200/60 dark:bg-teal-950/40 dark:border-teal-800/40 flex items-center justify-center mx-auto text-teal-600 dark:text-teal-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h3 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              No conversations yet
            </h3>
            <p className={`text-xs max-w-sm mx-auto leading-relaxed ${
              isLight ? 'text-slate-500' : 'text-[#A9BFA5]'
            }`}>
              When customers message your connected WhatsApp, Instagram, or Website channels, conversations flow into this unified inbox.
            </p>
          </div>
          <div>
            <button
              type="button"
              id="inbox-connect-channel-btn"
              onClick={() => {
                if (onNavigateSettings) onNavigateSettings();
                else onNavigateSub('conversation');
              }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center space-x-2 cursor-pointer shadow-xs"
            >
              <span>Connect Channels</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          UNIFIED THREE-PANEL WORKSPACE (Full Height)
          - Left Panel: Conversations list, search, tabs, filters, sorting
          - Center Panel: Active conversation workspace
          - Right Panel: Prospect details & qualification (collapsible)
         ======================================================== */}
      <div className={`flex flex-col lg:flex-row flex-1 min-h-0 w-full rounded-xl border overflow-hidden transition-colors ${
        isLight
          ? 'bg-white border-slate-200/90 shadow-2xs'
          : 'bg-[#071C1A] border-[rgba(169,191,165,0.18)] shadow-md'
      }`}>
        
        {/* ========================================================
            PANEL 1: CONVERSATION LIST (LEFT COLUMN)
           ======================================================== */}
        <div className={`${
          mobileView === 'list' ? 'flex' : 'hidden'
        } lg:flex w-full lg:w-[310px] xl:w-[330px] shrink-0 h-full min-h-0 border-b lg:border-b-0 lg:border-r flex-col overflow-hidden transition-colors ${
          isLight
            ? 'bg-white border-slate-200/90'
            : 'bg-[#051614] border-[rgba(169,191,165,0.18)]'
        }`}>
          
          {/* Conversations Panel Header & Controls */}
          <div className={`p-3 border-b space-y-2.5 shrink-0 ${
            isLight
              ? 'bg-slate-50/70 border-slate-200/80'
              : 'bg-[#041210] border-[rgba(169,191,165,0.14)]'
          }`}>
            
            {/* Conversations Title Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h1 className={`text-sm font-bold tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  Conversations
                </h1>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                  isLight ? 'bg-slate-200/70 text-slate-700' : 'bg-slate-800 text-slate-300'
                }`}>
                  {filteredConversations.length}
                </span>
              </div>

              {needsYouCount > 0 ? (
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40 px-2 py-0.5 rounded-full shrink-0">
                  {needsYouCount} pending
                </span>
              ) : (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                  <Check className="w-3 h-3" />
                  <span>Caught up</span>
                </span>
              )}
            </div>

            {/* Search Box + Secondary Filter Popover Trigger */}
            <div className="flex items-center space-x-1.5 relative">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full text-xs px-2.5 py-1.5 pl-8 pr-7 rounded-lg border focus:outline-none transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-500/20 shadow-2xs'
                      : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-white placeholder-[#A9BFA5]/50 focus:border-teal-400'
                  }`}
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Single Filter Icon Button that opens Secondary Filters Popover */}
              <div className="relative" ref={filterPopoverRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterPopover(!showFilterPopover)}
                  className={`p-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer relative shrink-0 ${
                    showFilterPopover || channelFilter !== 'All' || sortBy !== 'newest' || assigneeFilter !== 'All'
                      ? 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-[#A9BFA5] hover:text-white'
                  }`}
                  title="Filter & sort conversations"
                  aria-label="Filter & sort conversations"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  {(channelFilter !== 'All' || sortBy !== 'newest' || assigneeFilter !== 'All') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-600 absolute -top-0.5 -right-0.5 ring-1 ring-white dark:ring-black" />
                  )}
                </button>

                {/* Secondary Filters Popover */}
                {showFilterPopover && (
                  <div className={`absolute right-0 mt-1.5 w-56 rounded-xl border shadow-xl p-3 z-40 text-xs space-y-3 animate-fadeIn ${
                    isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#051816] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                  }`}>
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">Filters & Sort</span>
                      {(channelFilter !== 'All' || sortBy !== 'newest' || assigneeFilter !== 'All') && (
                        <button
                          type="button"
                          onClick={() => {
                            setChannelFilter('All');
                            setSortBy('newest');
                            setAssigneeFilter('All');
                          }}
                          className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Channel */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Channel</label>
                      <select
                        value={channelFilter}
                        onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
                        className={`w-full text-xs p-1.5 rounded-md border focus:outline-none cursor-pointer ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-white'
                        }`}
                      >
                        <option value="All">All Channels</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Instagram">Instagram</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Website">Website</option>
                      </select>
                    </div>

                    {/* Sort Order */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Sort By</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        className={`w-full text-xs p-1.5 rounded-md border focus:outline-none cursor-pointer ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-white'
                        }`}
                      >
                        <option value="newest">Newest first</option>
                        <option value="oldest_waiting">Oldest waiting</option>
                        <option value="score">Priority score</option>
                      </select>
                    </div>

                    {/* Assignee */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Assignee</label>
                      <select
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        className={`w-full text-xs p-1.5 rounded-md border focus:outline-none cursor-pointer ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-white'
                        }`}
                      >
                        <option value="All">All Assignees</option>
                        <option value="Rahul">Rahul — Sales</option>
                        <option value="Sarah">Sarah — Solutions</option>
                        <option value="Priya">Priya — AE</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Filter Tabs */}
            <div className={`flex items-center space-x-1 p-0.5 rounded-lg border text-xs font-medium w-full ${
              isLight
                ? 'bg-slate-200/60 border-slate-200/80'
                : 'bg-[#030E0C] border-[rgba(169,191,165,0.16)]'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('needs_you');
                  setSpecialFilter('all');
                }}
                className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center text-[11px] ${
                  activeTab === 'needs_you' && specialFilter === 'all'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <span>Needs You</span>
                {needsYouCount > 0 && (
                  <span className={`text-[9px] px-1 py-0.2 rounded-full font-bold ml-1 ${
                    activeTab === 'needs_you'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {needsYouCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setSpecialFilter('all');
                }}
                className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center text-[11px] ${
                  activeTab === 'all' && specialFilter === 'all'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <span>All ({conversations.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('ai_handling');
                  setSpecialFilter('all');
                }}
                className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center text-[11px] flex items-center justify-center space-x-1 ${
                  activeTab === 'ai_handling' && specialFilter === 'all'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <Bot className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                <span>AI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('closed');
                  setSpecialFilter('all');
                }}
                className={`flex-1 py-1 rounded-md transition-all cursor-pointer text-center text-[11px] ${
                  activeTab === 'closed' && specialFilter === 'all'
                    ? isLight
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'bg-[#0E2C26] text-white font-semibold border border-teal-500/30'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-[#A9BFA5] hover:text-white'
                }`}
              >
                <span>Closed</span>
              </button>
            </div>

            {/* Special Intent Announcement Banner (if navigated from Overview) */}
            {specialFilter !== 'all' && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-medium dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800/60">
                <span className="truncate">
                  {specialFilter === 'overdue-followups' && '⚠️ Overdue Follow-ups'}
                  {specialFilter === 'asked-pricing' && '💰 Asked for Pricing'}
                  {specialFilter === 'ready-to-book' && '📅 Ready to Book'}
                  {specialFilter === 'waiting-human' && '🔴 Waiting for Human'}
                </span>
                <button
                  type="button"
                  onClick={() => setSpecialFilter('all')}
                  className="ml-1 text-amber-800 hover:text-red-700 dark:text-amber-300 dark:hover:text-red-400 cursor-pointer font-bold text-xs"
                  title="Clear filter"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Conversation List Items */}
          <div className={`divide-y flex-1 min-h-0 overflow-y-auto ${
            isLight ? 'divide-slate-100' : 'divide-[rgba(169,191,165,0.08)]'
          }`}>
            {filteredConversations.length > 0 ? (
              filteredConversations.map(convo => {
                const isSelected = convo.id === currentConvo?.id;
                const isClosed = convo.status === 'closed';

                // Single compact status indicator dot
                const statusDot = (() => {
                  if (convo.isOverdueFollowUp) {
                    return { className: 'bg-amber-500 ring-2 ring-amber-500/20', title: convo.overdueText || 'Overdue' };
                  }
                  if (convo.waitingForHuman) {
                    return { className: 'bg-rose-500 ring-2 ring-rose-500/20', title: 'Waiting for human' };
                  }
                  if (convo.status === 'needs_you') {
                    return { className: 'bg-amber-500 ring-2 ring-amber-500/20', title: 'Needs attention' };
                  }
                  if (isClosed) {
                    return { className: 'bg-slate-400', title: 'Resolved' };
                  }
                  return { className: 'bg-teal-500 ring-2 ring-teal-500/20', title: 'AI handling' };
                })();

                return (
                  <div
                    key={convo.id}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedConvoId(convo.id);
                      setMobileView('chat');
                      if (convo.unread) {
                        setConversations(prev => prev.map(c => c.id === convo.id ? { ...c, unread: false } : c));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedConvoId(convo.id);
                        setMobileView('chat');
                      }
                    }}
                    className={`px-3.5 py-2.5 transition-colors cursor-pointer relative outline-none border-l-2 ${
                      isSelected
                        ? isLight
                          ? 'bg-teal-50/70 border-l-teal-600'
                          : 'bg-[#0B2522] border-l-teal-400'
                        : isLight
                          ? 'border-l-transparent hover:bg-slate-50'
                          : 'border-l-transparent hover:bg-[#081F1C]'
                    } ${isClosed ? 'opacity-75' : ''}`}
                  >
                    {/* Top Row: Name + single compact status indicator + Time */}
                    <div className="flex items-center justify-between min-w-0">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot.className}`} title={statusDot.title} />
                        <span className={`text-xs truncate ${
                          isSelected || convo.unread
                            ? 'font-bold text-slate-900 dark:text-white'
                            : 'font-medium text-slate-800 dark:text-[#E8E9D8]'
                        }`}>
                          {convo.name}
                        </span>
                        {convo.unread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" title="Unread" />
                        )}
                      </div>

                      <span className={`text-[11px] font-mono tabular-nums shrink-0 ml-2 ${
                        isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                      }`}>
                        {convo.time}
                      </span>
                    </div>

                    {/* Sub Row: Company & Channel */}
                    <div className="flex items-center space-x-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-[#A9BFA5]">
                      <span className="truncate max-w-[140px]">{convo.company}</span>
                      <span className="opacity-40">·</span>
                      <span className="font-medium text-slate-600 dark:text-[#E8E9D8]/80">{convo.channel}</span>
                    </div>

                    {/* Message Preview Snippet (Cleanly truncated, no redundant bottom badges) */}
                    <p className={`text-xs truncate mt-1 leading-snug ${
                      isLight ? 'text-slate-500' : 'text-[#A9BFA5]/75'
                    }`}>
                      {convo.snippet}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs text-slate-400 dark:text-[#A9BFA5]/60">
                  No conversations match filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setChannelFilter('All');
                    setAssigneeFilter('All');
                    setActiveTab('all');
                    setSpecialFilter('all');
                  }}
                  className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>

        </div>

        {/* ========================================================
            PANEL 2: CONVERSATION WORKSPACE (CENTER COLUMN - FOCUS)
           ======================================================== */}
        <div className={`${
          mobileView === 'chat' ? 'flex' : 'hidden'
        } lg:flex flex-1 min-w-0 min-h-0 h-full flex-col overflow-hidden transition-colors ${
          isLight ? 'bg-slate-50/30' : 'bg-[#071C1A]'
        }`}>
          
          {currentConvo ? (
            <>
              {/* Conversation Workspace Header */}
              <div className={`px-4 sm:px-5 py-2.5 border-b flex items-center justify-between shrink-0 transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#051614] border-[rgba(169,191,165,0.18)]'
              }`}>
                <div className="flex items-center space-x-3 min-w-0">
                  {/* Mobile Back Button */}
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className="lg:hidden p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer mr-0.5"
                    title="Back to list"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-200/70 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/40 flex items-center justify-center text-xs shrink-0">
                    {getInitials(currentConvo.name)}
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h2 className={`font-semibold text-sm truncate ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}>
                        {currentConvo.name}
                      </h2>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className={`text-xs truncate ${
                        isLight ? 'text-slate-500' : 'text-[#A9BFA5]'
                      }`}>
                        {currentConvo.company}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-[#A9BFA5]/80">
                      <span className={`font-medium ${
                        currentConvo.channel === 'WhatsApp' ? 'text-emerald-600 dark:text-emerald-400' :
                        currentConvo.channel === 'Instagram' ? 'text-pink-600 dark:text-pink-400' :
                        currentConvo.channel === 'LinkedIn' ? 'text-sky-600 dark:text-sky-400' :
                        'text-teal-600 dark:text-teal-400'
                      }`}>
                        {currentConvo.channel}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Connected</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleClosed}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center space-x-1.5 ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-[#E8E9D8] hover:bg-[#0B2522]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{currentConvo.status === 'closed' ? 'Reopen' : 'Mark Resolved'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        setMobileView('details');
                      } else {
                        setShowLeadPanel(prev => !prev);
                      }
                    }}
                    title={showLeadPanel ? "Hide Prospect Details" : "Show Prospect Details"}
                    className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-center ${
                      showLeadPanel
                        ? isLight
                          ? 'bg-slate-100 border-slate-300 text-slate-800'
                          : 'bg-[#0B2522] border-[rgba(169,191,165,0.3)] text-white'
                        : isLight
                          ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-[#A9BFA5] hover:text-white'
                    }`}
                  >
                    <PanelRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status Banner: AI Pause & Human Takeover Notice */}
              {currentConvo.aiAlert && currentConvo.aiAlert.isPaused && !dismissedAlerts[currentConvo.id] && (
                <div className={`relative border-b px-4 sm:px-5 py-2.5 space-y-2 text-xs shrink-0 transition-colors animate-fadeIn ${
                  isLight
                    ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                    : 'bg-[#1A180E] border-amber-500/40 text-amber-200'
                }`}>
                  {/* Top-right cross button */}
                  <button
                    type="button"
                    onClick={handleDismissAlert}
                    className={`absolute top-2.5 right-3 p-1 rounded-md transition-colors cursor-pointer ${
                      isLight
                        ? 'text-amber-800/70 hover:text-amber-950 hover:bg-amber-100/80'
                        : 'text-amber-300/70 hover:text-amber-100 hover:bg-amber-900/40'
                    }`}
                    title="Close notice"
                    aria-label="Close notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-start space-x-2 pr-7">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs leading-snug">{currentConvo.aiAlert.reason}</p>
                      <p className={`text-[11px] mt-0.5 leading-normal ${
                        isLight ? 'text-amber-700/90' : 'text-amber-300/80'
                      }`}>
                        Automated AI responses paused. Human intervention recommended.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center flex-wrap gap-2 pt-1 border-t border-amber-200/70 dark:border-amber-800/50">
                    <button
                      type="button"
                      onClick={handleTakeOver}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md text-xs cursor-pointer transition-colors"
                    >
                      Take Over Conversation
                    </button>

                    {/* Assign Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAssignMenu(!showAssignMenu)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer flex items-center space-x-1 border ${
                          isLight
                            ? 'bg-white border-amber-300 text-amber-900 hover:bg-amber-50'
                            : 'bg-[#0B2522] border-amber-500/50 text-amber-200'
                        }`}
                      >
                        <span>Assign ({currentConvo.assignedTo.split('—')[0].trim()})</span>
                        <ChevronDown className="w-3 h-3 ml-0.5" />
                      </button>

                      {showAssignMenu && (
                        <div className={`absolute left-0 mt-1 w-44 rounded-lg border shadow-xl py-1 z-30 text-xs font-medium ${
                          isLight
                            ? 'bg-white border-slate-200 text-slate-800'
                            : 'bg-[#041210] border-[rgba(169,191,165,0.25)] text-white'
                        }`}>
                          {['Rahul — Sales', 'Sarah — Solutions', 'Priya — AE'].map(agent => (
                            <button
                              key={agent}
                              type="button"
                              onClick={() => handleAssign(agent)}
                              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-[#071F1C] transition-colors"
                            >
                              {agent}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleHandBack}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors border ${
                        isLight
                          ? 'bg-white border-amber-300 text-amber-800 hover:bg-amber-50'
                          : 'bg-[#0B2522] border-amber-500/50 text-amber-200'
                      }`}
                    >
                      Let AI Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Conversation Timeline */}
              <div 
                ref={messagesContainerRef}
                className="flex-1 min-h-0 p-4 sm:p-5 space-y-3 overflow-y-auto"
              >
                {/* Date Separator */}
                <div className="flex items-center justify-center py-1">
                  <span className={`text-[11px] font-medium ${
                    isLight ? 'text-slate-400' : 'text-[#A9BFA5]/50'
                  }`}>
                    Today
                  </span>
                </div>

                {/* Messages Sequence */}
                <div className="space-y-2">
                  {currentConvo.messages.map((msg, idx) => {
                    const isCustomer = msg.sender === 'customer';
                    const isAi = msg.sender === 'ai';
                    const prevMsg = idx > 0 ? currentConvo.messages[idx - 1] : null;
                    const isSameSenderAsPrev = prevMsg && prevMsg.sender === msg.sender;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'} text-xs ${
                          isSameSenderAsPrev ? 'mt-1' : 'mt-2.5'
                        }`}
                      >
                        {!isSameSenderAsPrev && (
                          <div className={`flex items-center space-x-1.5 text-[11px] mb-1 px-1 ${
                            isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                          }`}>
                            {isCustomer ? (
                              <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-white'}`}>
                                {currentConvo.name}
                              </span>
                            ) : isAi ? (
                              <span className="text-teal-600 dark:text-teal-400 font-semibold flex items-center space-x-1">
                                <Bot className="w-3 h-3" />
                                <span>Nexora AI</span>
                              </span>
                            ) : (
                              <span className="text-teal-600 dark:text-teal-300 font-semibold flex items-center space-x-1">
                                <UserCheck className="w-3 h-3" />
                                <span>You</span>
                              </span>
                            )}
                            <span>·</span>
                            <span className="text-[10px] font-mono">{msg.time}</span>
                          </div>
                        )}

                        <div
                          className={`px-3.5 py-2.5 leading-relaxed max-w-[85%] sm:max-w-[70%] text-xs sm:text-[13px] rounded-xl ${
                            isCustomer 
                              ? isLight
                                ? 'bg-slate-100 text-slate-800 rounded-tl-sm'
                                : 'bg-slate-800/90 text-slate-100 rounded-tl-sm'
                              : isAi 
                              ? isLight
                                ? 'bg-teal-50/90 text-teal-950 border border-teal-200/60 rounded-tr-sm'
                                : 'bg-[#0E2C26] border border-teal-500/30 text-teal-50 rounded-tr-sm'
                              : 'bg-teal-600 text-white dark:bg-teal-700 rounded-tr-sm'
                          }`}
                        >
                          {msg.text}
                          {isSameSenderAsPrev && (
                            <div className="text-[9px] font-mono text-right opacity-60 mt-1">
                              {msg.time}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggestions & Reply Composer (Fixed at Bottom) */}
              <div className={`border-t p-3 space-y-2 shrink-0 transition-colors ${
                isLight
                  ? 'bg-white border-slate-200/90'
                  : 'bg-[#051614] border-[rgba(169,191,165,0.18)]'
              }`}>
                
                {/* Compact Suggestion Chips with Minimal Borders */}
                <div className="flex items-center space-x-1.5 text-xs overflow-x-auto pb-0.5 scrollbar-none">
                  <span className={`text-[10px] font-semibold mr-0.5 flex items-center space-x-1 shrink-0 ${
                    isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                  }`}>
                    <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    <span>Suggestions:</span>
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setReplyInput(`Here is our enterprise pricing monograph and feature matrix for ${currentConvo.company}: [Download PDF]`);
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer shrink-0 ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-700'
                        : 'bg-[#071F1C] border-[rgba(169,191,165,0.2)] text-[#A9BFA5] hover:border-teal-400 hover:text-white'
                    }`}
                  >
                    Pricing Deck
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyInput('I would be delighted to set up a 20-minute tailored walkthrough. Would tomorrow at 11:30 AM or 3:00 PM work for you?');
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer shrink-0 ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-700'
                        : 'bg-[#071F1C] border-[rgba(169,191,165,0.2)] text-[#A9BFA5] hover:border-teal-400 hover:text-white'
                    }`}
                  >
                    Offer Call Slot
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyInput('Thank you! Could you share the name and email of your primary technical lead so we can loop them in?');
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer shrink-0 ${
                      isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-600 hover:border-teal-500 hover:text-teal-700'
                        : 'bg-[#071F1C] border-[rgba(169,191,165,0.2)] text-[#A9BFA5] hover:border-teal-400 hover:text-white'
                    }`}
                  >
                    Ask for Tech Lead
                  </button>
                </div>

                {/* Input Composer Box */}
                <div className="flex items-center space-x-2">
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="text"
                      placeholder={`Reply to ${currentConvo.name}...`}
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendReply();
                      }}
                      className={`w-full text-xs sm:text-sm px-3 py-2 pr-9 rounded-lg border focus:outline-none transition-colors ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-teal-600 focus:ring-1 focus:ring-teal-500/20'
                          : 'bg-[#071F1C] border-[rgba(169,191,165,0.25)] text-white placeholder-[#A9BFA5]/50 focus:border-teal-400'
                      }`}
                    />
                    <button
                      type="button"
                      title="Attach file"
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSendReply()}
                    disabled={!replyInput.trim()}
                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-40 flex items-center space-x-1.5 shrink-0 shadow-2xs"
                  >
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Composer Status Sub-bar */}
                <div className={`flex items-center justify-between text-[11px] pt-0.5 ${
                  isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                }`}>
                  <span className="flex items-center space-x-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      currentConvo.aiAlert?.isPaused ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <span>
                      Direct reply · {currentConvo.aiAlert?.isPaused ? 'AI paused' : 'AI active'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleHandBack}
                    className="text-teal-600 dark:text-teal-400 hover:underline cursor-pointer font-medium"
                  >
                    Hand back to AI
                  </button>
                </div>

              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400 dark:text-[#A9BFA5]/60">
              Select a conversation to start messaging.
            </div>
          )}

        </div>

        {/* ========================================================
            PANEL 3: PROSPECT DETAILS (RIGHT COLUMN - COLLAPSIBLE)
           ======================================================== */}
        {showLeadPanel && currentConvo && (
          <div className={`${
            mobileView === 'details' ? 'flex' : 'hidden lg:flex'
          } w-full lg:w-[280px] xl:w-[300px] shrink-0 h-full min-h-0 border-t lg:border-t-0 lg:border-l flex flex-col overflow-hidden transition-colors ${
            isLight
              ? 'bg-slate-50/40 border-slate-200/90'
              : 'bg-[#051614] border-[rgba(169,191,165,0.18)]'
          }`}>
            
            {/* Header: Title & Synced status */}
            <div className={`px-4 py-2.5 border-b flex items-center justify-between shrink-0 ${
              isLight ? 'border-slate-200/80 bg-white' : 'border-[rgba(169,191,165,0.12)] bg-[#051614]'
            }`}>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setMobileView('chat')}
                  className="lg:hidden p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer mr-0.5"
                  title="Back to chat"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={`text-xs font-semibold tracking-tight ${
                  isLight ? 'text-slate-800' : 'text-white'
                }`}>
                  Prospect Details
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Synced</span>
                </span>
              </div>
            </div>

            {/* Scrollable Dossier Content - 3 clean groups: Contact, Deal, Qualification */}
            <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
              
              {/* Group 1: Contact Information & Pipeline Stage */}
              <div className="space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className={`text-sm font-bold leading-tight ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}>
                      {currentConvo.name}
                    </h3>
                    <p className={`text-xs mt-0.5 ${
                      isLight ? 'text-slate-500' : 'text-[#A9BFA5]'
                    }`}>
                      {currentConvo.company} · {currentConvo.location}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border tabular-nums ${getScoreBadge(currentConvo.score).bg}`}>
                    Score {currentConvo.score}
                  </span>
                </div>

                {/* Pipeline Stage Inline Selector */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className={`text-[11px] ${
                    isLight ? 'text-slate-500' : 'text-[#A9BFA5]/70'
                  }`}>
                    Stage:
                  </span>
                  <div className="relative">
                    <select
                      value={currentConvo.stage}
                      onChange={(e) => handleStageChange(e.target.value)}
                      className={`text-xs px-2 py-1 rounded-md border focus:outline-none cursor-pointer pr-5 appearance-none font-medium ${
                        isLight
                          ? 'bg-white border-slate-200 text-slate-800 focus:border-teal-600 shadow-2xs'
                          : 'bg-[#041210] border-[rgba(169,191,165,0.25)] text-[#E8E9D8]'
                      }`}
                    >
                      <option value="New">New</option>
                      <option value="Engaged">Engaged</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Proposal">Proposal</option>
                      <option value="Won">Won</option>
                      <option value="Lost">Lost</option>
                    </select>
                    <ChevronDown className="w-2.5 h-2.5 text-slate-400 absolute right-1.5 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Group 2: Deal Parameters (Budget and Timeline aligned without oversized cards) */}
              <div className="py-2.5 border-y border-slate-100 dark:border-slate-800/60 space-y-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider block ${
                  isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                }`}>
                  Deal
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-[#A9BFA5]/60 block font-medium">Budget</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{currentConvo.qualification.budget}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-[#A9BFA5]/60 block font-medium">Timeline</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{currentConvo.qualification.timeline}</span>
                  </div>
                </div>
              </div>

              {/* Group 3: Qualification Criteria Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase font-bold tracking-wider block ${
                    isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                  }`}>
                    Qualification
                  </span>
                  <span className={`text-xs font-semibold tabular-nums ${
                    [currentConvo.qualification.requirement, Boolean(currentConvo.qualification.budget), Boolean(currentConvo.qualification.timeline), currentConvo.qualification.decisionMaker].filter(Boolean).length === 4
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {[currentConvo.qualification.requirement, Boolean(currentConvo.qualification.budget), Boolean(currentConvo.qualification.timeline), currentConvo.qualification.decisionMaker].filter(Boolean).length}/4 verified
                  </span>
                </div>
                
                <div className="space-y-1.5 text-xs">
                  <div className={`flex items-center space-x-2 ${
                    currentConvo.qualification.requirement ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-[#A9BFA5]/60'
                  }`}>
                    {currentConvo.qualification.requirement ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-[rgba(169,191,165,0.3)] inline-block shrink-0" />
                    )}
                    <span>Requirement identified</span>
                  </div>

                  <div className={`flex items-center space-x-2 ${
                    currentConvo.qualification.budget ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-[#A9BFA5]/60'
                  }`}>
                    {currentConvo.qualification.budget ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-[rgba(169,191,165,0.3)] inline-block shrink-0" />
                    )}
                    <span>Budget confirmed</span>
                  </div>

                  <div className={`flex items-center space-x-2 ${
                    currentConvo.qualification.timeline ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-[#A9BFA5]/60'
                  }`}>
                    {currentConvo.qualification.timeline ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-[rgba(169,191,165,0.3)] inline-block shrink-0" />
                    )}
                    <span>Timeline defined</span>
                  </div>

                  <div className={`flex items-center space-x-2 ${
                    currentConvo.qualification.decisionMaker ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-[#A9BFA5]/60'
                  }`}>
                    {currentConvo.qualification.decisionMaker ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-[rgba(169,191,165,0.3)] inline-block shrink-0" />
                    )}
                    <span>Direct decision maker</span>
                  </div>
                </div>
              </div>

              {/* Condensed Recommended Action */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                <span className={`text-[10px] uppercase font-bold tracking-wider block mb-0.5 ${
                  isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                }`}>
                  Recommended Action
                </span>
                <p className={`font-medium capitalize ${
                  isLight ? 'text-slate-800' : 'text-[#E8E9D8]'
                }`}>
                  {currentConvo.nextAction}
                </p>
                <p className={`text-[11px] ${
                  isLight ? 'text-slate-400' : 'text-[#A9BFA5]/60'
                }`}>
                  Assigned: {currentConvo.assignedTo}
                </p>
              </div>

            </div>

            {/* Compact Bottom Action Area */}
            <div className={`p-3 border-t space-y-1.5 shrink-0 ${
              isLight
                ? 'bg-white border-slate-200/90'
                : 'bg-[#051614] border-[rgba(169,191,165,0.12)]'
            }`}>
              <button
                type="button"
                onClick={handleOpenLead}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center space-x-1.5 text-xs shadow-2xs"
              >
                <span>Open Lead Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onNotify) onNotify('Follow-up Scheduled', `Follow-up task created for ${currentConvo.name}.`);
                }}
                className={`w-full py-2 rounded-lg border font-medium transition-colors cursor-pointer text-center text-xs ${
                  isLight
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    : 'bg-[#041210] hover:bg-[#071C1A] text-[#A9BFA5] hover:text-[#E8E9D8] border-[rgba(169,191,165,0.2)]'
                }`}
              >
                Schedule Follow-up
              </button>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
