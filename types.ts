

export type View = 'insights' | 'campaigns' | 'lab' | 'automation' | 'chat' | 'linkedin';

/** Draft posts handed from Creative Lab / Campaigns into LinkedIn Hub */
export interface LinkedInDraft {
  headline: string;
  content: string;
  hashtags?: string[];
  imageUrl?: string;
  imagePrompt?: string;
  scheduledAt?: string;
  source?: 'manual' | 'ai-generated';
}

export interface CampaignDetails {
  product: string;
  goal: string;
  audience: string;
  platform: string;
  tone: string;
}

export interface GeneratedContent {
  captions: string[];
  imagePrompts: string[];
  videoScript: string;
}

export interface Source {
  title: string;
  uri: string;
}

export interface ChartData {
  title: string;
  data: { name: string; value: number }[];
};

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: Source[];
  chartData?: ChartData;
}

export interface CopilotResponse {
  textReply: string;
  sources: Source[];
  chartData?: ChartData;
}

// Types for Social Commerce Engine
export interface SocialInteraction {
  platform: string;
  customerComment: string;
}

export interface Recipe {
  name: string;
  ingredients: string[];
}

export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface SocialResponse {
  suggestedReply: string;
  productRecommendation: {
    name: string;
    reasoning: string;
    productImagePrompt: string;
    recipes: Recipe[];
  };
  /** Purchase / conversion intent for lead gen */
  leadTemperature: LeadTemperature;
  leadScore: number;
  intentSummary: string;
}

export interface Lead {
  id: string;
  platform: string;
  customerComment: string;
  temperature: LeadTemperature;
  score: number;
  intentSummary: string;
  recommendedProduct?: string;
  suggestedReply?: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  createdAt: string;
  externalId?: string;
  source?: 'manual' | 'instagram' | string;
  author?: string;
  mediaPermalink?: string;
}

// Type for Product Showcase
export interface ProductShowcase {
  description: string;
  imagePrompt: string;
  imageUrl?: string | null;
}

// Types for AI Campaign Planner
export interface AudiencePersona {
  name: string;
  description: string;
  motivations: string[];
}

export interface MessagingPillar {
  pillar: string;
  description: string;
}

export interface CampaignPhase {
  phase: string;
  duration: string;
  objective: string;
  platforms: {
    platform: string;
    contentIdeas: string[];
  }[];
}

export interface CampaignPlan {
  campaignTitle: string;
  slogan: string;
  personas: AudiencePersona[];
  // FIX: Corrected typo from 'messagingPillers' to 'messagingPillars'.
  messagingPillars: MessagingPillar[];
  rolloutPlan: CampaignPhase[];
  kpis: string[];
}
