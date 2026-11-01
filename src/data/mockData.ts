import { 
  Lead, 
  TrendingTopic, 
  StatMetric, 
  Campaign, 
  GeneratedAsset, 
  SocialAccount, 
  ScheduledPost,
  SystemNotification 
} from '../types';
import { SAMPLE_BLUEPRINT, generateBlueprintFromForm } from './campaignBlueprintGenerator';

export const INITIAL_METRICS: StatMetric[] = [
  {
    id: 'leads',
    value: '248',
    label: 'Total Leads',
    change: '+14.2%',
    isPositive: true,
    timeframe: 'vs last 7 days'
  },
  {
    id: 'conversion',
    value: '64%',
    label: 'Conversion Rate',
    change: '+3.1%',
    isPositive: true,
    timeframe: 'across pipelines'
  },
  {
    id: 'campaigns',
    value: '32',
    label: 'Active Campaigns',
    change: '4 channels',
    isPositive: true,
    timeframe: 'synchronized'
  },
  {
    id: 'reach',
    value: '18.4K',
    label: 'Reach',
    change: '+22.8%',
    isPositive: true,
    timeframe: 'organic & direct'
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'lead-rahul-sharma',
    name: 'Rahul Sharma',
    company: 'NovaTech Solutions',
    email: 'rahul.sharma@novatech.io',
    phone: '+91 98201 44820',
    title: 'VP of Marketing & Growth',
    location: 'Pune, India',
    source: 'WhatsApp',
    status: 'Qualified',
    stage: 'Negotiation',
    tag: 'Priority',
    description: 'High purchase intent lead requiring CRM lead management and WhatsApp automation.',
    requirement: 'Lead management and WhatsApp automation with SLA routing and human escalation.',
    productInterested: 'Tecavy Marketing OS (Enterprise Tier)',
    budget: '₹5L – ₹8L',
    timeline: 'Within 30 days',
    decisionMaker: true,
    preferredChannel: 'WhatsApp',
    companySize: '35 employees',
    temperature: 'HOT',
    intentLevel: '🔥 High purchase intent',
    purchaseReadiness: 'Ready for executive demonstration & proposal',
    aiConfidence: '96% High confidence based on 8 signals',
    aiRecommendation: 'Schedule a sales call within 24 hours',
    assignee: {
      name: 'Rahul — Sales',
      role: 'Enterprise Account Executive',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
    },
    date: 'Today, 10:42 AM',
    attachmentsCount: 3,
    messagesCount: 6,
    value: '₹6,50,000',
    lastActivity: '4 min ago',
    score: 92,
    isPriority: true,
    handlingMode: 'AI',
    humanAttentionRequired: true,
    tags: ['HOT', 'CRM', 'WhatsApp', 'Enterprise', 'High Intent', 'Decision Maker']
  },
  {
    id: 'lead-aster-labs',
    name: 'Aster Labs',
    company: 'Aster Labs',
    email: 'contact@asterlabs.health',
    source: 'Website',
    status: 'Contacted',
    stage: 'Contacted',
    tag: 'New lead',
    description: 'Healthcare startup. CRM implementation and lead automation.',
    assignee: {
      name: 'Mateo Petty',
      role: 'Lead Manager',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
    },
    date: '13 May',
    attachmentsCount: 2,
    messagesCount: 4,
    value: '$18,500',
    lastActivity: '12 min ago',
    score: 92
  },
  {
    id: 'lead-nova-retail',
    name: 'Nova Retail',
    company: 'Nova Retail',
    email: 'partnerships@novaretail.store',
    source: 'Organic Search',
    status: 'Contacted',
    stage: 'Contacted',
    tag: 'Returning',
    description: 'Ecommerce brand. Paid ads and conversion optimization.',
    assignee: {
      name: 'Mateo Petty',
      role: 'Lead Manager',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
    },
    date: '25 May',
    attachmentsCount: 1,
    messagesCount: 2,
    value: '$9,800',
    lastActivity: '45 min ago',
    score: 84
  },
  {
    id: 'lead-brightpath',
    name: 'BrightPath Legal',
    company: 'BrightPath Legal',
    email: 'inquiries@brightpathlegal.com',
    source: 'LinkedIn',
    status: 'Qualified',
    stage: 'Negotiation',
    tag: 'Returning',
    description: 'Law firm. Website redesign and client intake automation.',
    assignee: {
      name: 'Lawrence Patterson',
      role: 'Account Manager',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80'
    },
    date: '29 May',
    attachmentsCount: 4,
    messagesCount: 6,
    value: '$28,000',
    lastActivity: '1 hour ago',
    score: 95
  },
  {
    id: 'lead-northpeak',
    name: 'NorthPeak Finance',
    company: 'NorthPeak Finance',
    email: 'capital@northpeakfin.io',
    source: 'Website',
    status: 'Qualified',
    stage: 'Negotiation',
    tag: 'New lead',
    description: 'Fintech company. Sales pipeline setup and reporting dashboard.',
    assignee: {
      name: 'Lawrence Patterson',
      role: 'Account Manager',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80'
    },
    date: '28 May',
    attachmentsCount: 5,
    messagesCount: 12,
    value: '$34,500',
    lastActivity: '2 hours ago',
    score: 97
  },
  {
    id: 'lead-pulseworks',
    name: 'PulseWorks',
    company: 'PulseWorks',
    email: 'hello@pulseworks.wellness',
    source: 'Instagram',
    status: 'Proposal',
    stage: 'Offer sent',
    tag: 'Priority',
    isPriority: true,
    description: 'Wellness startup. Membership platform and booking automation.',
    assignee: {
      name: 'Aysha Hayes',
      role: 'Sales Manager',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80'
    },
    date: '13 May',
    attachmentsCount: 2,
    messagesCount: 4,
    value: '$16,200',
    lastActivity: '3 hours ago',
    score: 98
  },
  {
    id: 'lead-greenline',
    name: 'Greenline Logistics',
    company: 'Greenline Logistics',
    email: 'dispatch@greenlinelogistics.eu',
    source: 'Website',
    status: 'Proposal',
    stage: 'Offer sent',
    tag: 'Returning',
    description: 'Logistics provider. Workflow automation and client portal design.',
    assignee: {
      name: 'Aysha Hayes',
      role: 'Sales Manager',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80'
    },
    date: '13 May',
    attachmentsCount: 2,
    messagesCount: 4,
    value: '$14,000',
    lastActivity: '4 hours ago',
    score: 91
  },
  {
    id: 'lead-bloom-market',
    name: 'Bloom Market',
    company: 'Bloom Market',
    email: 'growth@bloommarket.co',
    source: 'Referral',
    status: 'Converted',
    stage: 'Deal closed',
    tag: 'Follow-up',
    description: 'Retail brand. Performance ads and checkout optimization.',
    assignee: {
      name: 'Scarlett Floyd',
      role: 'Project Manager',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80'
    },
    date: '1 May',
    attachmentsCount: 12,
    messagesCount: 17,
    value: '$42,000',
    lastActivity: '1 day ago',
    score: 99
  },
  {
    id: 'lead-atlas-energy',
    name: 'Atlas Energy',
    company: 'Atlas Energy',
    email: 'enterprise@atlasenergy.org',
    source: 'LinkedIn',
    status: 'Converted',
    stage: 'Deal closed',
    tag: 'Follow-up',
    description: 'Energy services company. Internal dashboard and reporting tools.',
    assignee: {
      name: 'Scarlett Floyd',
      role: 'Project Manager',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80'
    },
    date: '3 May',
    attachmentsCount: 6,
    messagesCount: 14,
    value: '$31,500',
    lastActivity: '2 days ago',
    score: 97
  },
  {
    id: 'lead-2',
    name: 'Alex Morgan',
    company: 'Morgan Spatial',
    email: 'alex@morganspatial.design',
    source: 'Website',
    status: 'Contacted',
    stage: 'Contacted',
    tag: 'New lead',
    description: '3D architectural practice migrating to unified editorial pipeline.',
    assignee: {
      name: 'Mateo Petty',
      role: 'Lead Manager',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'
    },
    date: '18 May',
    attachmentsCount: 3,
    messagesCount: 3,
    value: '$14,200',
    lastActivity: '8 min ago',
    score: 87
  },
  {
    id: 'lead-4',
    name: 'Julian Montgomery',
    company: 'Vanguard Atelier',
    email: 'j.montgomery@vanguardatelier.co',
    source: 'LinkedIn',
    status: 'Qualified',
    stage: 'Negotiation',
    tag: 'Priority',
    description: 'Bespoke design studio requesting customized workflow automation.',
    assignee: {
      name: 'Lawrence Patterson',
      role: 'Account Manager',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80'
    },
    date: '22 May',
    attachmentsCount: 4,
    messagesCount: 8,
    value: '$12,400',
    lastActivity: '32 min ago',
    score: 94
  },
  {
    id: 'lead-6',
    name: 'Marcus Thorne',
    company: 'Aether Collective',
    email: 'marcus@aethercollective.io',
    source: 'X (Twitter)',
    status: 'Proposal',
    stage: 'Offer sent',
    tag: 'New lead',
    description: 'Creative engineering group negotiating multi-seat license tier.',
    assignee: {
      name: 'Aysha Hayes',
      role: 'Sales Manager',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80'
    },
    date: '11 May',
    attachmentsCount: 3,
    messagesCount: 7,
    value: '$18,000',
    lastActivity: '1 hour ago',
    score: 96
  },
  {
    id: 'lead-8',
    name: 'Darius Vance',
    company: 'Solstice Media House',
    email: 'd.vance@solsticemedia.com',
    source: 'Newsletter',
    status: 'Converted',
    stage: 'Deal closed',
    tag: 'Returning',
    description: 'Global editorial media house finalized annual retainer.',
    assignee: {
      name: 'Scarlett Floyd',
      role: 'Project Manager',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80'
    },
    date: '28 April',
    attachmentsCount: 8,
    messagesCount: 11,
    value: '$24,000',
    lastActivity: '5 hours ago',
    score: 99
  }
];

export const INITIAL_TRENDING_TOPICS: TrendingTopic[] = [
  {
    id: 'trend-1',
    name: 'Minimalist Spatial Audio Systems',
    category: 'Acoustic Architecture',
    growth: '+58.4%',
    isPositive: true,
    volume: '24.2K mentions',
    relevantCampaign: 'Spring Acoustic Release'
  },
  {
    id: 'trend-2',
    name: 'Zero-Latency Local LLM Workflows',
    category: 'Productivity Systems',
    growth: '+42.1%',
    isPositive: true,
    volume: '38.9K mentions',
    relevantCampaign: 'Developer Editorial Series'
  },
  {
    id: 'trend-3',
    name: 'Sustainable Botanical Workspaces',
    category: 'Interior Ecology',
    growth: '+34.7%',
    isPositive: true,
    volume: '19.4K mentions',
    relevantCampaign: 'Quiet Horizon Narrative'
  },
  {
    id: 'trend-4',
    name: 'Tactile Computing & Micro-Interactions',
    category: 'Interface Philosophy',
    growth: '+27.0%',
    isPositive: true,
    volume: '14.1K mentions',
    relevantCampaign: 'Nexora v2 Design Drops'
  },
  {
    id: 'trend-5',
    name: 'Asynchronous Studio Operations',
    category: 'Team Governance',
    growth: '+19.5%',
    isPositive: true,
    volume: '11.8K mentions',
    relevantCampaign: 'Executive Memo Series'
  }
];

export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1',
    name: 'Quiet Horizon / Q2 Narrative',
    objective: 'Position Nexora as the premier anti-burnout workspace for sovereign operators',
    channel: 'LinkedIn + Newsletter',
    status: 'Active',
    impressions: '142,300',
    leads: 86,
    conversion: '4.8%',
    budget: '$3,200',
    startDate: 'May 18, 2026',
    endDate: 'July 15, 2026',
    progress: 72,
    owner: 'Elena Rostova',
    blueprint: SAMPLE_BLUEPRINT
  },
  {
    id: 'camp-2',
    name: 'Architectural Digest Inbound Sequence',
    objective: 'Acquire 40 design agencies on annual bespoke enterprise contracts',
    channel: 'X (Twitter) + Email',
    status: 'Active',
    impressions: '88,900',
    leads: 64,
    conversion: '6.1%',
    budget: '$1,800',
    startDate: 'May 24, 2026',
    endDate: 'July 30, 2026',
    progress: 54,
    owner: 'Julian Montgomery',
    blueprint: generateBlueprintFromForm({
      name: 'Architectural Digest Inbound Sequence',
      type: 'Lead Generation',
      description: 'Acquire design studios and architectural practices fatigued by chaotic project management suites.',
      primaryGoal: 'Generate Leads',
      measurableGoals: ['Acquire 40 design studios', 'Achieve 8% click-to-lead rate', 'Generate $180k pipeline value'],
      ageRange: '28–50',
      location: 'Western Europe & North America',
      industry: 'Design & Architecture',
      interests: 'Spatial design, Typography, Minimal architecture',
      occupation: 'Creative Directors, Principals, Studio Founders',
      audienceType: 'High-end Studio Partners',
      audienceDescription: 'Principals who demand software that looks and feels as refined as their physical projects.',
      budgetType: 'total',
      budgetAmount: '1,800',
      resources: ['Website', 'Email list', 'Design assets', 'Sales team'],
      startDate: 'May 24, 2026',
      endDate: 'July 30, 2026',
      milestones: ['Studio Memo drop', 'Private Portfolio Review Invite', 'Webinar on Minimal Ops'],
      channels: ['X', 'LinkedIn', 'Email'],
      autoRecommendChannels: false,
      brandVoice: 'Editorial',
      visualStyle: 'Minimal',
      additionalInstructions: 'Focus strictly on spatial elegance, typography, and calm productivity.'
    })
  },
  {
    id: 'camp-3',
    name: 'Summer Studio Retainer Launch',
    objective: 'Launch enterprise retainer tier to existing warm leads and waitlist',
    channel: 'Direct Email + LinkedIn',
    status: 'Planning',
    impressions: '12,500',
    leads: 28,
    conversion: '12.4%',
    budget: '$850',
    startDate: 'June 01, 2026',
    endDate: 'August 15, 2026',
    progress: 30,
    owner: 'Seraphina Lin',
    blueprint: generateBlueprintFromForm({
      name: 'Summer Studio Retainer Launch',
      type: 'Product Promotion',
      description: 'Rollout of the annual Nexora Executive Retainer tier with dedicated white-glove onboarding.',
      primaryGoal: 'Increase Sales',
      measurableGoals: ['Close 25 retainer slots', 'Reach $100k ARR expansion', '100% onboarding completion'],
      ageRange: '30–55',
      location: 'Global',
      industry: 'Enterprise & Agency',
      interests: 'High-leverage scaling, Executive productivity',
      occupation: 'Founders & Managing Partners',
      audienceType: 'Vetted Inbound Waitlist',
      audienceDescription: 'Warm executive contacts seeking immediate high-touch deployment.',
      budgetType: 'total',
      budgetAmount: '850',
      resources: ['Email list', 'Sales team', 'Website'],
      startDate: 'June 01, 2026',
      endDate: 'August 15, 2026',
      milestones: ['Waitlist priority email', 'Demo day', 'Public slot release'],
      channels: ['Email', 'LinkedIn'],
      autoRecommendChannels: false,
      brandVoice: 'Premium',
      visualStyle: 'Corporate',
      additionalInstructions: 'Position as an exclusive, limited-seat institutional membership.'
    })
  },
  {
    id: 'camp-4',
    name: 'Micro-Interaction Showcase Video Essay',
    objective: 'Deep-dive into deliberate UI craftsmanship to cultivate viral developer & designer love',
    channel: 'YouTube + Meta',
    status: 'Draft',
    impressions: '—',
    leads: 0,
    conversion: '0.0%',
    budget: '$2,400',
    startDate: 'June 10, 2026',
    endDate: 'July 10, 2026',
    progress: 10,
    owner: 'Marcus Thorne',
    blueprint: generateBlueprintFromForm({
      name: 'Micro-Interaction Showcase Video Essay',
      type: 'Brand Awareness',
      description: 'A 10-minute 4K documentary essay on why software should feel physical, quiet, and tactile.',
      primaryGoal: 'Increase Brand Awareness',
      measurableGoals: ['Reach 100,000 video views', 'Gain 2,500 newsletter signups', 'Spark organic tech discourse'],
      ageRange: '20–40',
      location: 'Global',
      industry: 'Software Design & Engineering',
      interests: 'Interaction design, Craftsmanship, Minimal aesthetics',
      occupation: 'Design Engineers, Product Designers, Indie Hackers',
      audienceType: 'Creative Technologists',
      audienceDescription: 'People who care deeply about 60fps animations, keyboard shortcuts, and zero latency.',
      budgetType: 'total',
      budgetAmount: '2,400',
      resources: ['Video assets', 'Existing social media accounts', 'Website'],
      startDate: 'June 10, 2026',
      endDate: 'July 10, 2026',
      milestones: ['Rough cut approval', 'Trailer drop', 'Full premiere on YouTube'],
      channels: ['Other', 'X', 'Instagram'],
      autoRecommendChannels: false,
      brandVoice: 'Inspirational',
      visualStyle: 'Editorial',
      additionalInstructions: 'Film-grade pacing, ambient synth score, zero SaaS buzzwords.'
    })
  },
  {
    id: 'camp-5',
    name: 'Spring Sovereign Founder Sprint',
    objective: 'Acquire early adopters for beta release v1.8 with bespoke founder feedback loop',
    channel: 'Private Community + Referral',
    status: 'Completed',
    impressions: '64,200',
    leads: 112,
    conversion: '18.2%',
    budget: '$1,200',
    startDate: 'March 01, 2026',
    endDate: 'April 30, 2026',
    progress: 100,
    owner: 'Elena Rostova',
    blueprint: generateBlueprintFromForm({
      name: 'Spring Sovereign Founder Sprint',
      type: 'Product Launch',
      description: 'Private closed beta onboarding campaign for 100 founding members.',
      primaryGoal: 'Launch a Product',
      measurableGoals: ['Onboard 100 founding members', 'Reach >85% NPS', 'Acquire 30 video testimonials'],
      ageRange: '25–50',
      location: 'North America',
      industry: 'Technology',
      interests: 'Deep work, Async communication',
      occupation: 'Tech Founders',
      audienceType: 'Founding Members',
      audienceDescription: 'Early adopters willing to test and provide rapid weekly feedback.',
      budgetType: 'total',
      budgetAmount: '1,200',
      resources: ['Email list', 'Website', 'Sales team'],
      startDate: 'March 01, 2026',
      endDate: 'April 30, 2026',
      milestones: ['Cohort 1 intake', 'Feedback synthesis', 'Cohort 2 graduation'],
      channels: ['Email', 'LinkedIn'],
      autoRecommendChannels: false,
      brandVoice: 'Professional',
      visualStyle: 'Minimal',
      additionalInstructions: 'Concluded successfully with 112 converted accounts.'
    })
  },
  {
    id: 'camp-6',
    name: 'Nordic Architecture Forum Inbound',
    objective: 'Drive partner inquiries from Copenhagen and Stockholm design collectives',
    channel: 'LinkedIn + Newsletter',
    status: 'Active',
    impressions: '52,400',
    leads: 39,
    conversion: '5.4%',
    budget: '$1,650',
    startDate: 'June 05, 2026',
    endDate: 'August 20, 2026',
    progress: 42,
    owner: 'Elena Rostova',
    blueprint: generateBlueprintFromForm({
      name: 'Nordic Architecture Forum Inbound',
      type: 'Lead Generation',
      description: 'Engage Scandinavian design principals with bespoke workflow whitepaper.',
      primaryGoal: 'Generate Leads',
      measurableGoals: ['Acquire 30 design firms', 'Generate 40 sales conversations'],
      ageRange: '30–55',
      location: 'Northern Europe',
      industry: 'Architecture & Industrial Design',
      interests: 'Functionalism, Calm interiors, Scandinavian design',
      occupation: 'Lead Architects & Partners',
      audienceType: 'Studio Principals',
      audienceDescription: 'Senior design leaders evaluating quiet software alternatives.',
      budgetType: 'total',
      budgetAmount: '1,650',
      resources: ['Whitepaper PDF', 'Website', 'Email cadence'],
      startDate: 'June 05, 2026',
      endDate: 'August 20, 2026',
      milestones: ['Whitepaper publication', 'Webinar on calm studios', 'Cohort review'],
      channels: ['LinkedIn', 'Email'],
      autoRecommendChannels: false,
      brandVoice: 'Editorial',
      visualStyle: 'Minimal',
      additionalInstructions: 'Emphasize architectural precision and calm software interface.'
    })
  },
  {
    id: 'camp-7',
    name: 'Sovereign Operator Manifesto Series',
    objective: 'Distribute 4-part essay series on cognitive sovereignty and async workflows',
    channel: 'Substack + X (Twitter)',
    status: 'Active',
    impressions: '98,700',
    leads: 71,
    conversion: '7.2%',
    budget: '$900',
    startDate: 'May 10, 2026',
    endDate: 'July 25, 2026',
    progress: 68,
    owner: 'Julian Montgomery',
    blueprint: generateBlueprintFromForm({
      name: 'Sovereign Operator Manifesto Series',
      type: 'Brand Awareness',
      description: 'Thought-leadership essays exploring the cost of notification fatigue.',
      primaryGoal: 'Increase Brand Awareness',
      measurableGoals: ['50k reads', '3k newsletter subscribers', '100 studio trial signups'],
      ageRange: '24–48',
      location: 'Global',
      industry: 'Creative Technology',
      interests: 'Focus, Deep work, Typography',
      occupation: 'Founders & Creative Technologists',
      audienceType: 'Autonomous Operators',
      audienceDescription: 'Minds seeking high-leverage tools with zero distraction.',
      budgetType: 'total',
      budgetAmount: '900',
      resources: ['Substack publication', 'Social distribution'],
      startDate: 'May 10, 2026',
      endDate: 'July 25, 2026',
      milestones: ['Essay 1 drop', 'Audio version release', 'Reader roundtable'],
      channels: ['Other', 'X'],
      autoRecommendChannels: false,
      brandVoice: 'Inspirational',
      visualStyle: 'Editorial',
      additionalInstructions: 'Maintain contemplative tone with literary prose.'
    })
  },
  {
    id: 'camp-8',
    name: 'Autumn Studio Beta Waitlist Intake',
    objective: 'Build private preview waitlist for Nexora 3.0 spatial canvas',
    channel: 'Website + Direct Referral',
    status: 'Planning',
    impressions: '8,400',
    leads: 19,
    conversion: '14.1%',
    budget: '$500',
    startDate: 'July 15, 2026',
    endDate: 'September 30, 2026',
    progress: 15,
    owner: 'Seraphina Lin',
    blueprint: generateBlueprintFromForm({
      name: 'Autumn Studio Beta Waitlist Intake',
      type: 'Product Launch',
      description: 'Exclusive invitations for top tier creative agencies.',
      primaryGoal: 'Generate Leads',
      measurableGoals: ['300 waitlist applicants', 'Select 50 benchmark studios'],
      ageRange: '28–50',
      location: 'Global',
      industry: 'Spatial & Product Design',
      interests: 'Experimental computing, Spatial canvases',
      occupation: 'Design Leads',
      audienceType: 'Elite Beta Cohort',
      audienceDescription: 'Practitioners shaping next-generation digital interfaces.',
      budgetType: 'total',
      budgetAmount: '500',
      resources: ['Landing page', 'Private referral links'],
      startDate: 'July 15, 2026',
      endDate: 'September 30, 2026',
      milestones: ['Private teaser page', 'Alpha access release', 'Cohort feedback'],
      channels: ['Email', 'Other'],
      autoRecommendChannels: false,
      brandVoice: 'Premium',
      visualStyle: 'Minimal',
      additionalInstructions: 'Ultra-exclusive private application flow.'
    })
  },
  {
    id: 'camp-9',
    name: 'Winter Retrospective & Case Archive',
    objective: 'Document 12 studio migrations and showcase productivity delta metrics',
    channel: 'Direct Email + LinkedIn',
    status: 'Completed',
    impressions: '41,800',
    leads: 53,
    conversion: '9.8%',
    budget: '$1,100',
    startDate: 'January 10, 2026',
    endDate: 'March 15, 2026',
    progress: 100,
    owner: 'Marcus Thorne',
    blueprint: generateBlueprintFromForm({
      name: 'Winter Retrospective & Case Archive',
      type: 'Brand Awareness',
      description: 'Case studies demonstrating quantifiable time saved and cognitive calm restored.',
      primaryGoal: 'Increase Sales',
      measurableGoals: ['Document 12 studio migrations', 'Achieve 15 enterprise referrals'],
      ageRange: '30–55',
      location: 'North America',
      industry: 'Design & Media',
      interests: 'Studio operations, Design systems',
      occupation: 'Managing Directors',
      audienceType: 'Agency Owners',
      audienceDescription: 'Leaders considering migrating their entire agency stack.',
      budgetType: 'total',
      budgetAmount: '1,100',
      resources: ['Case study monographs', 'Client interviews'],
      startDate: 'January 10, 2026',
      endDate: 'March 15, 2026',
      milestones: ['Monograph publication', 'Video testimonials', 'Executive briefing'],
      channels: ['LinkedIn', 'Email'],
      autoRecommendChannels: false,
      brandVoice: 'Professional',
      visualStyle: 'Corporate',
      additionalInstructions: 'Deep quantitative focus on velocity and cognitive focus.'
    })
  },
  {
    id: 'camp-10',
    name: 'Minimal Canvas Interactive Benchmark',
    objective: 'Interactive web utility measuring cognitive distraction score in modern toolchains',
    channel: 'Product Hunt + X (Twitter)',
    status: 'Draft',
    impressions: '—',
    leads: 0,
    conversion: '0.0%',
    budget: '$1,500',
    startDate: 'August 01, 2026',
    endDate: 'September 15, 2026',
    progress: 5,
    owner: 'Elena Rostova',
    blueprint: generateBlueprintFromForm({
      name: 'Minimal Canvas Interactive Benchmark',
      type: 'Brand Awareness',
      description: 'A free micro-tool allowing creative directors to calculate their team distraction quotient.',
      primaryGoal: 'Increase Brand Awareness',
      measurableGoals: ['25,000 benchmark completions', '5,000 lead captures'],
      ageRange: '22–45',
      location: 'Global',
      industry: 'Software & Creative Services',
      interests: 'Productivity calculators, Clean code',
      occupation: 'Tech Leads & Studio Founders',
      audienceType: 'General Inbound Audience',
      audienceDescription: 'Teams feeling burdened by multi-notification SaaS tool chains.',
      budgetType: 'total',
      budgetAmount: '1,500',
      resources: ['Web applet', 'Social campaign assets'],
      startDate: 'August 01, 2026',
      endDate: 'September 15, 2026',
      milestones: ['Prototype testing', 'Product Hunt launch', 'Social blitz'],
      channels: ['X', 'Other'],
      autoRecommendChannels: false,
      brandVoice: 'Inspirational',
      visualStyle: 'Minimal',
      additionalInstructions: 'Viral interactive audit tool with elegant scoring.'
    })
  }
];

export const INITIAL_GENERATED_ASSETS: GeneratedAsset[] = [
  {
    id: 'asset-img-1',
    title: '3D Spatial Atelier Key Visual',
    type: 'Hero Brief',
    platform: 'Studio 3D & Visual',
    preview: 'Octane path-traced render: Cantilevered dark smoked obsidian glass desk displaying minimal hairline telemetry graph with soft 4500K morning sunlight.',
    createdAt: 'Just now',
    tags: ['3D Key Visual', 'Octane 4K', 'Atelier'],
    imageUrl: '/src/assets/images/spatial_key_visual_1790755715787.jpg'
  },
  {
    id: 'asset-img-2',
    title: 'Machined Titanium Tactile Hardware Console',
    type: 'Product Render',
    platform: 'Studio 3D & Visual',
    preview: 'Macro studio photography: Billet titanium hardware console with micro-knurled dial, chamfered bevels, and overhead warm rim lighting.',
    createdAt: '30 mins ago',
    tags: ['Product Render', 'Macro Hardware', 'Titanium'],
    imageUrl: '/src/assets/images/titanium_studio_render_1790755733959.jpg'
  },
  {
    id: 'asset-img-3',
    title: 'Swiss International Typographic Poster',
    type: 'Brand Specimen',
    platform: 'Studio 3D & Visual',
    preview: 'Exhibition specimen sheet: 12-column asymmetric baseline grid with hairline serif scales printed on textured cotton rag paper.',
    createdAt: '1 hour ago',
    tags: ['Brand Specimen', 'Swiss Grid', 'Print'],
    imageUrl: '/src/assets/images/swiss_brand_specimen_1790755749195.jpg'
  },
  {
    id: 'asset-1',
    title: 'The Art of Unhurried Productivity',
    type: 'Email Copy',
    platform: 'Substack / Newsletter',
    preview: 'When modern suites add notification badges to your calendar, they are trading your deep tranquility for artificial urgency...',
    createdAt: '2 hours ago',
    tags: ['Brand Voice', 'Editorial', 'Long-form']
  },
  {
    id: 'asset-2',
    title: 'Zero Latency, Zero Clutter Post Thread',
    type: 'Social Post',
    platform: 'X (Twitter)',
    preview: '1/4 Why did we strip rounded cards out of our architecture? Because visual clutter slows cognition just as much as CPU latency.',
    createdAt: 'Yesterday',
    tags: ['X Thread', 'Design Philosophy', 'Viral']
  },
  {
    id: 'asset-3',
    title: 'Q2 Executive Headline Set',
    type: 'Headline Set',
    platform: 'Landing & Ads',
    preview: 'A quiet space for deliberate work · Make space for what matters · Complexity subtracted.',
    createdAt: 'May 28, 2026',
    tags: ['Headlines', 'PPC', 'A/B Testing']
  },
  {
    id: 'asset-4',
    title: 'B2B Enterprise Retainer Outreach',
    type: 'Email Copy',
    platform: 'Direct Email',
    preview: 'Julian, we noticed Vanguard Atelier’s recent expansion into Kyoto. Here is how Nexora consolidates the entire campaign cadence...',
    createdAt: 'May 27, 2026',
    tags: ['Personalized', 'Outbound', 'High-Touch']
  },
  {
    id: 'asset-5',
    title: 'Kyoto Atelier Workspace Monograph',
    type: 'Social Post',
    platform: 'Instagram / Carousel',
    preview: 'Physical workspace design directly predicts digital composure. A study of 15 timber studios in northern Kyoto...',
    createdAt: 'May 25, 2026',
    tags: ['Visual Essay', 'Spatial Design', 'Editorial']
  },
  {
    id: 'asset-6',
    title: 'Asynchronous Studio Operations Memo',
    type: 'Email Copy',
    platform: 'Substack / Newsletter',
    preview: 'Meeting zero: Why our creative directors produce 3x higher client conversion with strictly asynchronous memoranda...',
    createdAt: 'May 22, 2026',
    tags: ['Executive Memo', 'Async Work', 'Leadership']
  },
  {
    id: 'asset-7',
    title: 'Cognitive Bandwidth Headline Set',
    type: 'Headline Set',
    platform: 'X & LinkedIn Ads',
    preview: 'The silence between decisions · Build what lasts · Uncluttered computing for sovereign minds.',
    createdAt: 'May 20, 2026',
    tags: ['Headlines', 'Growth', 'Ad Copy']
  },
  {
    id: 'asset-8',
    title: 'Enterprise Studio Onboarding Letter',
    type: 'Email Copy',
    platform: 'Direct Email',
    preview: 'Elena, congratulations on initiating your studio migration to Nexora. Your dedicated lead qualifier sandbox is primed...',
    createdAt: 'May 18, 2026',
    tags: ['Onboarding', 'Customer Success', 'VIP']
  },
  {
    id: 'asset-9',
    title: 'Architecture of Stillness 30s Brand Reel',
    type: 'Ad Script',
    platform: 'Paid Social & Video',
    preview: '[00:00-00:05] Macro shot of matte titanium hardware. Voiceover: "We didn\'t subtract features to be minimal. We subtracted them so you could breathe..."',
    createdAt: 'May 15, 2026',
    tags: ['Video Script', 'Storyboard', '30-Second']
  },
  {
    id: 'asset-10',
    title: 'Kyoto Residency Visual Art Direction Brief',
    type: 'Hero Brief',
    platform: 'Design Systems & 3D',
    preview: 'Deliverable: 16:9 3D Hero Render. Aesthetic: Wabi-sabi brutalism with tactile textured cedar and razor-sharp hairline interface glow...',
    createdAt: 'May 12, 2026',
    tags: ['Art Direction', '3D Visual', 'Key Visual']
  },
  {
    id: 'asset-11',
    title: 'The Tyranny of the Unread Notification Badge',
    type: 'Thought Leadership',
    platform: 'Substack & Medium',
    preview: 'How notification badges hijacked executive dopamine cycles, and why high-output ateliers are systematically returning to asynchronous quietude...',
    createdAt: 'May 08, 2026',
    tags: ['Long-form Essay', 'Product Strategy', 'Deep Work']
  }
];

export const INITIAL_SOCIAL_ACCOUNTS: SocialAccount[] = [
  {
    id: 'soc-1',
    platform: 'LinkedIn',
    handle: 'nexora-systems',
    status: 'Connected',
    followers: '28.4K',
    engagement: '5.2%',
    lastSync: 'Just now'
  },
  {
    id: 'soc-2',
    platform: 'X (Twitter)',
    handle: '@nexora_hq',
    status: 'Connected',
    followers: '46.1K',
    engagement: '4.8%',
    lastSync: '4m ago'
  },
  {
    id: 'soc-3',
    platform: 'Substack',
    handle: 'The Quiet Horizon',
    status: 'Connected',
    followers: '14.8K',
    engagement: '42.1% Open',
    lastSync: '1h ago'
  },
  {
    id: 'soc-4',
    platform: 'Instagram',
    handle: '@nexora.atelier',
    status: 'Connected',
    followers: '19.2K',
    engagement: '3.6%',
    lastSync: '2h ago'
  }
];

export const INITIAL_SCHEDULED_POSTS: ScheduledPost[] = [
  {
    id: 'post-1',
    title: 'Why software should speak in hairlines, not badges',
    content: 'We spent two years analyzing how high-growth founders structure their workspaces. Simplicity is not an aesthetic luxury — it is an operating system for deep conviction.',
    platforms: ['LinkedIn', 'Substack'],
    scheduledTime: 'Today, 4:00 PM',
    status: 'Queued',
    tags: ['#design', '#ux', '#craft'],
    mediaCount: 1,
    mediaAttachments: [
      {
        id: 'med-1',
        name: 'hairline-design-principles.jpg',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80',
        size: '1.2 MB'
      }
    ],
    author: 'Elena Rostova',
    createdAt: '2026-09-12'
  },
  {
    id: 'post-2',
    title: 'Thread: 10 architectural principles for high-output design studios',
    content: '1. Kill unnecessary real-time notifications.\n2. Restrict container palettes to single-digit contrast shifts.\n3. Make typography do the organizational work.\n4. Design for calm conviction over transient excitement.',
    platforms: ['X (Twitter)', 'LinkedIn', 'Substack'],
    scheduledTime: 'Tomorrow, 9:30 AM',
    status: 'Approved',
    tags: ['#architecture', '#systems', '#productivity'],
    mediaCount: 3,
    mediaAttachments: [
      {
        id: 'med-2a',
        name: 'architectural-spec-1.jpg',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&auto=format&fit=crop&q=80',
        size: '2.4 MB'
      },
      {
        id: 'med-2b',
        name: 'minimalist-grid-blueprint.jpg',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
        size: '1.9 MB'
      },
      {
        id: 'med-2c',
        name: 'contrast-ratio-chart.png',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
        size: '880 KB'
      }
    ],
    author: 'Kaelen Vance',
    createdAt: '2026-09-12'
  },
  {
    id: 'post-3',
    title: 'The Quiet Horizon Vol. 14: Restoring Creative Autonomy',
    content: 'An exploration of calm interfaces and digital sovereignty. Why modern executive tools must cease begging for user attention and prioritize quiet precision.',
    platforms: ['Substack'],
    scheduledTime: 'Thursday, 11:00 AM',
    status: 'Draft Review',
    tags: ['#newsletter', '#leadership'],
    mediaCount: 1,
    mediaAttachments: [
      {
        id: 'med-3',
        name: 'quiet-horizon-vol14-cover.pdf',
        type: 'document',
        url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&auto=format&fit=crop&q=80',
        size: '3.1 MB'
      }
    ],
    author: 'Kaelen Vance',
    createdAt: '2026-09-11'
  },
  {
    id: 'post-4',
    title: 'Kyoto atelier photo essay & minimal physical workspace gallery',
    content: 'Behind the scenes at our Kyoto studio. Natural wood, linen dividers, and monochrome displays configured for sustained uninterrupted concentration.',
    platforms: ['Instagram', 'LinkedIn'],
    scheduledTime: 'Friday, 2:15 PM',
    status: 'Queued',
    tags: ['#workspace', '#studio', '#kyoto'],
    mediaCount: 2,
    mediaAttachments: [
      {
        id: 'med-4a',
        name: 'kyoto-desk-setup.jpg',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop&q=80',
        size: '2.8 MB'
      },
      {
        id: 'med-4b',
        name: 'monochrome-workspace.jpg',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&auto=format&fit=crop&q=80',
        size: '3.4 MB'
      }
    ],
    author: 'Julian Montgomery',
    createdAt: '2026-09-10'
  },
  {
    id: 'post-5',
    title: 'Deep dive into deterministic client qualification models',
    content: 'How our algorithmic scoring engine qualifies $15k+ enterprise proposals in under 120ms without manual triage delay or bloated spreadsheets.',
    platforms: ['LinkedIn', 'X (Twitter)'],
    scheduledTime: 'Saturday, 10:00 AM',
    status: 'Scheduled',
    tags: ['#enterprise', '#automation', '#data'],
    mediaCount: 0,
    mediaAttachments: [],
    author: 'Nexora Core',
    createdAt: '2026-09-09'
  },
  {
    id: 'post-6',
    title: 'Release note: Automated lead qualifier engine v2.4 rollout',
    content: 'Version 2.4 introduces cryptographic sandbox keys for prospect verification and cross-border timezone schedule optimization.',
    platforms: ['X (Twitter)', 'LinkedIn'],
    scheduledTime: 'Next Monday, 8:45 AM',
    status: 'Draft Review',
    tags: ['#changelog', '#product'],
    mediaCount: 1,
    mediaAttachments: [
      {
        id: 'med-6',
        name: 'v2.4-benchmark-report.pdf',
        type: 'document',
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
        size: '1.4 MB'
      }
    ],
    author: 'Elena Rostova',
    createdAt: '2026-09-08'
  }
];

export const INITIAL_NOTIFICATIONS: SystemNotification[] = [
  {
    id: 'notif-1',
    title: 'New High-Score Lead',
    description: 'Julian Montgomery viewed the Vanguard Atelier proposal (Score: 94).',
    time: '12m ago',
    unread: true,
    type: 'lead'
  },
  {
    id: 'notif-2',
    title: 'Campaign Reached Milestone',
    description: 'Quiet Horizon narrative crossed 140,000 organic impressions.',
    time: '45m ago',
    unread: true,
    type: 'campaign'
  },
  {
    id: 'notif-3',
    title: 'Scheduled Social Post Published',
    description: 'Minimalist Spatial Audio thread delivered across X and LinkedIn.',
    time: '2h ago',
    unread: false,
    type: 'social'
  },
  {
    id: 'notif-4',
    title: 'Automated Response Sent',
    description: 'AI-generated personalized follow-up sent to Seraphina Lin.',
    time: '4h ago',
    unread: false,
    type: 'lead'
  }
];
