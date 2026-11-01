import { Campaign, CampaignBlueprint } from '../types';

export interface CampaignFormData {
  name: string;
  type: string;
  description: string;
  primaryGoal: string;
  measurableGoals: string[];
  ageRange: string;
  location: string;
  industry: string;
  interests: string;
  occupation: string;
  audienceType: string;
  audienceDescription: string;
  budgetType: 'total' | 'daily' | 'none';
  budgetAmount: string;
  resources: string[];
  startDate: string;
  endDate: string;
  milestones: string[];
  channels: string[];
  autoRecommendChannels: boolean;
  brandVoice: string;
  visualStyle: string;
  additionalInstructions: string;
}

export function generateBlueprintFromForm(data: CampaignFormData): CampaignBlueprint {
  const chosenChannels = data.autoRecommendChannels || data.channels.length === 0
    ? ['LinkedIn', 'Instagram', 'Email', 'Website']
    : data.channels;

  const coreMessage = data.type === 'Product Launch'
    ? 'Make productivity feel effortless and distraction-free.'
    : data.type === 'Brand Awareness'
    ? 'The quiet standard for modern sovereign operators.'
    : data.type === 'Lead Generation'
    ? 'Reclaim 14 hours every week with intelligent automation.'
    : `Elevate your workflow with ${data.name}.`;

  return {
    id: `bp-${Date.now()}`,
    campaignId: `camp-${Date.now()}`,
    campaignName: data.name || 'Untitled Campaign',
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),

    // A. Campaign Overview
    overview: {
      objective: data.primaryGoal || 'Acquire high-intent inbound prospects and establish market leadership.',
      targetAudience: `${data.audienceType || 'Decision Makers'} in ${data.industry || 'Technology'} (${data.location || 'Global'}, ${data.ageRange || '25–45'})`,
      timeline: `${data.startDate || 'Immediate'} &rarr; ${data.endDate || '60 Days'}`,
      budget: data.budgetType === 'none' ? 'Discretionary / No fixed cap' : `${data.budgetType === 'daily' ? 'Daily' : 'Total'}: $${data.budgetAmount || '5,000'}`,
      primaryChannels: chosenChannels,
      successMetrics: data.measurableGoals.length > 0
        ? data.measurableGoals
        : ['Generate 500 qualified leads', 'Achieve >60% conversion velocity', 'Reach 50,000 targeted professionals']
    },

    // B. Campaign Strategy
    strategy: {
      coreObjective: `Establish ${data.name} as the undisputed category benchmark while driving predictable conversion pipelines.`,
      positioning: `A refined alternative to bloated legacy workflows—crafted specifically for discerning ${data.industry || 'modern'} teams.`,
      audienceStrategy: `Focus on high-conviction ${data.occupation || 'operators'} seeking quiet elegance and frictionless velocity. Address cognitive overload directly.`,
      keyMessage: coreMessage,
      campaignAngle: `Contrast chaotic, notification-heavy tools with Nexora's serene, deliberate architectural execution.`,
      recommendedApproach: `Deploy a 3-act cadence: (1) Provocative thought leadership identifying systemic industry fatigue, (2) Deep interactive product revelations, (3) High-touch VIP onboarding sequences.`
    },

    // C. Campaign Roadmap (All 7 Phases)
    roadmap: [
      {
        id: 'phase-1',
        name: 'DISCOVERY',
        objective: 'Audit competitive positioning, calibrate audience pain points, and define key personas.',
        tasks: [
          'Run audience persona alignment with intent signals',
          'Conduct competitor messaging and whitespace analysis',
          'Consolidate initial value propositions and copy pillars'
        ],
        deliverables: ['Positioning Brief', 'Persona Manifest', 'Whitespace Opportunity Map'],
        suggestedTimeline: 'Week 1 · Days 1–5',
        responsible: 'Strategy Lead'
      },
      {
        id: 'phase-2',
        name: 'STRATEGY',
        objective: 'Finalize distribution architecture, channel weightings, and conversion funnel geometry.',
        tasks: [
          'Design multichannel attribution and capture architecture',
          'Map multi-touch conversion journeys across selected touchpoints',
          'Establish baseline KPI targets and milestone check-ins'
        ],
        deliverables: ['Channel Distribution Blueprint', 'Journey Map Specification', 'Attribution Model'],
        suggestedTimeline: 'Week 2 · Days 6–10',
        responsible: 'Campaign Strategist'
      },
      {
        id: 'phase-3',
        name: 'CONTENT CREATION',
        objective: 'Produce high-fidelity creative assets, editorial essays, and conversion collateral.',
        tasks: [
          'Draft executive thought leadership series and newsletter essays',
          'Generate high-contrast social visual carousels and demo snippets',
          'Prepare automated email cadence sequences and response templates'
        ],
        deliverables: ['Editorial Content Library', 'Visual Asset Deck', 'Nurture Email Cadence'],
        suggestedTimeline: 'Weeks 3–4 · Days 11–20',
        responsible: 'Creative Studio & Copywriter'
      },
      {
        id: 'phase-4',
        name: 'PRE-LAUNCH',
        objective: 'Seed narrative with VIP advisors, warm initial audience segments, and run technical QA.',
        tasks: [
          'Deploy private embargo previews to key industry influencers',
          'Validate lead intake webhooks and CRM automation flows',
          'Warm email sending domains and configure tracking pixels'
        ],
        deliverables: ['Private Beta Waitlist', 'Automation Health Check', 'Seed Feedback Report'],
        suggestedTimeline: 'Week 5 · Days 21–25',
        responsible: 'Growth Operations'
      },
      {
        id: 'phase-5',
        name: 'LAUNCH',
        objective: 'Simultaneous coordinated broadcast across all primary channels with live command monitoring.',
        tasks: [
          'Trigger synchronous announcement across LinkedIn, X, and Email',
          'Activate high-intent lead capture landing experiences',
          'Deploy real-time live lead triage and conversational response routing'
        ],
        deliverables: ['Public Announcement Broadcast', 'Live Inbound Stream', 'Day-1 Traction Memo'],
        suggestedTimeline: 'Week 6 · Days 26–30',
        responsible: 'Full Marketing & Sales Command'
      },
      {
        id: 'phase-6',
        name: 'OPTIMIZATION',
        objective: 'Analyze initial cohort responses, reallocate channel budgets, and iterate creative copy.',
        tasks: [
          'A/B test top-performing hook variations and visual assets',
          'Double down on highest-yield inbound channels (e.g. LinkedIn)',
          'Refine lead qualification thresholds and automated follow-up cadences'
        ],
        deliverables: ['Mid-Campaign Optimization Audit', 'Retargeting Segment Build', 'Budget Reallocation Plan'],
        suggestedTimeline: 'Weeks 7–8 · Days 31–45',
        responsible: 'Performance Analyst'
      },
      {
        id: 'phase-7',
        name: 'ANALYSIS',
        objective: 'Synthesize pipeline velocity, calculate full customer acquisition cost, and archive learnings.',
        tasks: [
          'Conduct comprehensive pipeline conversion and CAC analysis',
          'Interview top converted accounts for case study material',
          'Document playbook recommendations for subsequent seasonal campaigns'
        ],
        deliverables: ['Executive Performance Post-Mortem', 'Client Case Study Asset', 'Playbook Archive'],
        suggestedTimeline: 'Week 9 · Days 46–50',
        responsible: 'Head of Growth'
      }
    ],

    // D. Execution Blueprint (6 Workstreams)
    execution: {
      strategy: [
        'Define core market positioning against incumbent friction points',
        'Finalize master value narrative and tone boundaries',
        'Define segmented audience personas and qualification parameters',
        'Map out cross-channel customer conversion journey'
      ],
      creative: [
        'Create high-contrast campaign visuals with muted sage accents',
        'Generate 12 multichannel social post variations via Creative Lab',
        'Draft high-conversion landing page copy and executive brief',
        'Prepare interactive product demo animations and asset deck'
      ],
      social: [
        'Prepare 30-day editorial publishing calendar across channels',
        'Schedule priority broadcast posts via Social Hub scheduler',
        'Establish founder thought leadership commentary cadences',
        'Engage actively in target community threads and replies'
      ],
      leadGeneration: [
        'Create frictionless zero-resistance lead capture mechanisms',
        'Prepare structured intake questionnaires with instant qualification',
        'Configure automated lead scoring and pipeline routing rules',
        'Deploy personalized auto-response templates in Nexora Leads'
      ],
      launch: [
        'Execute synchronized multichannel broadcast at peak engagement hours',
        'Monitor incoming live leads with real-time response alerts',
        'Amplify organic momentum through partner and employee shares',
        'Track early engagement velocity and conversion friction points'
      ],
      optimization: [
        'Analyze 7-day cohort conversion and cost per qualified lead',
        'Identify top 20% creative variants and reallocate ad/content resources',
        'Refine audience targeting parameters to eliminate low-intent clicks',
        'Iterate on email subject lines to sustain open rates above 45%'
      ]
    },

    // E. Content Plan
    contentPlan: [
      {
        id: 'cp-1',
        contentType: 'Launch Teaser Essay',
        platform: 'LinkedIn & Newsletter',
        purpose: 'Awareness & Intellectual Curiosity',
        timing: 'Day 1 (Morning)',
        cta: 'Request Early Access'
      },
      {
        id: 'cp-2',
        contentType: 'Interactive Demo Showcase',
        platform: 'LinkedIn & X',
        purpose: 'Education & Product Proof',
        timing: 'Day 3 (Midday)',
        cta: 'Explore Workspace Live'
      },
      {
        id: 'cp-3',
        contentType: 'Customer Transformation Story',
        platform: 'Instagram & LinkedIn',
        purpose: 'Trust & Social Validation',
        timing: 'Day 5 (Afternoon)',
        cta: 'Read Full Case Study'
      },
      {
        id: 'cp-4',
        contentType: 'Executive Launch Announcement',
        platform: 'All Platforms',
        purpose: 'Direct Conversion & Onboarding',
        timing: 'Day 7 (Peak Cadence)',
        cta: 'Claim Founder Retainer'
      },
      {
        id: 'cp-5',
        contentType: 'Behind-The-Architecture Deep Dive',
        platform: 'Substack / X Longform',
        purpose: 'Authority & Engineering Credibility',
        timing: 'Day 12 (Weekend Special)',
        cta: 'Join Private Community'
      }
    ],

    // F. Social Media Plan
    socialPlan: {
      postingFrequency: '4–5 high-signal posts weekly per primary channel (Zero fluff policy)',
      contentThemes: [
        'The Cost of Operational Noise in Modern Work',
        'Architectural Principles: Designing for Serenity',
        'Live Workflow Walkthroughs & Teardowns',
        'Client Milestones & Performance Benchmark Studies'
      ],
      postIdeas: [
        'Side-by-side comparison: 14 messy browser tabs vs. 1 unified Nexora workspace',
        'The 3 metrics modern founders obsess over—and the 1 they ignore at their peril',
        'Why we removed notifications and increased team output by 38%'
      ],
      bestFormats: ['High-contrast 1080x1350 text slides', '15-second silent screen capture loops', 'Markdown-styled text threads'],
      ctas: ['Reserve your spot', 'Inspect the live sandbox', 'Comment "ROADMAP" for private brief'],
      engagementStrategy: 'Respond to all qualified executive comments within 12 minutes with personalized contextual insights.'
    },

    // G. Lead Strategy
    leadStrategy: {
      captureStrategy: 'Two-tier progressive profiling: light initial email entry followed by conversational qualification in the sandbox.',
      qualification: 'Automated intent score based on role seniority, team scale, current software stack, and immediate timeline urgency.',
      followUp: 'Automated bespoke executive briefing sent within 4 minutes; follow-up calendar invitation delivered at hour 18.',
      responseStrategy: 'Contextual AI-drafted responses referencing the prospect company and stated operational bottleneck.',
      automationOpportunities: [
        'Instant enrichment via company domain inspection',
        'Automated scoring trigger routing leads >90 directly to founder schedule',
        'Slack/Webhook notification pipeline for urgent inbound signals'
      ]
    },

    // H. KPIs & Success Metrics
    kpis: [
      { id: 'kpi-1', name: 'Qualified Inbound Leads', target: '500', current: '86', unit: 'leads' },
      { id: 'kpi-2', name: 'Pipeline Conversion Rate', target: '64.0%', current: '58.2%', unit: '%' },
      { id: 'kpi-3', name: 'Verified Executive Reach', target: '75,000', current: '42,800', unit: 'people' },
      { id: 'kpi-4', name: 'Audience Engagement Ratio', target: '5.2%', current: '4.8%', unit: '%' },
      { id: 'kpi-5', name: 'Effective Cost Per Lead', target: '$18.50', current: '$16.20', unit: 'USD' },
      { id: 'kpi-6', name: 'Estimated Contract Value', target: '$250,000', current: '$148,000', unit: 'USD' }
    ],

    // I. Risks & Recommendations
    risks: [
      {
        id: 'risk-1',
        risk: 'Audience fatigue from standard SaaS promotional rhetoric.',
        recommendation: 'Strictly adhere to the quiet, editorial brand voice. Never use hyperbolic claims; let architectural screenshots and hard data speak.',
        severity: 'High'
      },
      {
        id: 'risk-2',
        risk: 'Inbound conversion lag due to high perceived switching costs.',
        recommendation: 'Emphasize non-destructive 60-second migration and zero-overhead parallel sandbox testing.',
        severity: 'Medium'
      },
      {
        id: 'risk-3',
        risk: 'Algorithmic reach compression on third-party social networks.',
        recommendation: 'Anchor all top-of-funnel social traffic into sovereign email newsletter subscribers on Day 1.',
        severity: 'Medium'
      },
      {
        id: 'risk-4',
        risk: 'Lead triage bottlenecks if inbound surges above 100/day.',
        recommendation: 'Activate Nexora Lead Automation with pre-configured AI qualification responses before launching.',
        severity: 'Low'
      }
    ],

    // J. Next Steps
    nextSteps: [
      {
        number: '01',
        title: 'Generate Launch Content',
        description: 'Open Creative Lab to draft the teaser essays, headline variants, and announcement posts.',
        actionKey: 'content'
      },
      {
        number: '02',
        title: 'Set Up Lead Automation',
        description: 'Configure automated scoring thresholds and intake response templates in Leads.',
        actionKey: 'leads'
      },
      {
        number: '03',
        title: 'Connect Social Accounts',
        description: 'Ensure LinkedIn and X accounts are connected with active sync credentials in Social Hub.',
        actionKey: 'social'
      },
      {
        number: '04',
        title: 'Schedule Campaign Posts',
        description: 'Load the 30-day posting cadence into the Social Hub calendar queue.',
        actionKey: 'schedule'
      },
      {
        number: '05',
        title: 'Launch Campaign',
        description: 'Transition status from Planning to Active and activate live inbound tracking.',
        actionKey: 'launch'
      }
    ]
  };
}

export const SAMPLE_BLUEPRINT: CampaignBlueprint = generateBlueprintFromForm({
  name: 'Summer Product Launch',
  type: 'Product Launch',
  description: 'Introducing Nexora 2.0 to visionary founders and high-growth creative studios worldwide.',
  primaryGoal: 'Generate Leads',
  measurableGoals: ['Generate 500 leads', 'Reach 50,000 people', 'Increase conversions by 20%'],
  ageRange: '25–45',
  location: 'Global / Major Tech Hubs',
  industry: 'Technology & Design',
  interests: 'Productivity, AI workflows, Minimal design',
  occupation: 'Founders, Product Directors, Marketing Leaders',
  audienceType: 'High-intent B2B Decision Makers',
  audienceDescription: 'Discerning operators fatigued by loud, cluttered enterprise software suites.',
  budgetType: 'total',
  budgetAmount: '8,500',
  resources: ['Existing social media accounts', 'Website', 'Email list', 'Design assets', 'Sales team'],
  startDate: 'June 01, 2026',
  endDate: 'July 31, 2026',
  milestones: ['Product Announcement', 'VIP Early Access Day', 'Public Sandbox Launch', 'Mid-Campaign Retrospective'],
  channels: ['LinkedIn', 'Instagram', 'Email', 'Website'],
  autoRecommendChannels: false,
  brandVoice: 'Premium',
  visualStyle: 'Minimal',
  additionalInstructions: 'Keep the campaign dark, sophisticated, and focused on calm, frictionless AI automation.'
});
