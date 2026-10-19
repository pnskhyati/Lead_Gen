

export type View = 'insights' | 'campaigns' | 'lab' | 'automation' | 'chat' | 'linkedin' | 'agents' | 'admin';

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
  /** company = saved brand voice; preset = dropdown; custom = freeform */
  voiceMode?: 'company' | 'preset' | 'custom';
  customTone?: string;
}

export interface SocialInteraction {
  platform: string;
  customerComment: string;
  voiceMode?: 'company' | 'preset' | 'custom';
  tone?: string;
  customTone?: string;
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
  note?: string;
}

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
export interface Recipe {
  name: string;
  ingredients: string[];
}

export type LeadTemperature = 'hot' | 'warm' | 'cold';
export type LeadScoreBand = 'cold' | 'warm' | 'hot' | 'very_hot';
export type ConversationState =
  | 'AI_ACTIVE'
  | 'AI_WAITING'
  | 'HUMAN_REQUIRED'
  | 'HUMAN_ACTIVE'
  | 'AI_PAUSED'
  | 'CLOSED';

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
  intent?: string | null;
  intentConfidence?: number | null;
  scoreBand?: LeadScoreBand | null;
  nextBestAction?: string | null;
  conversationState?: ConversationState;
  scoreExplanation?: string | null;
  scoringVersion?: string | null;
  recommendedProduct?: string;
  suggestedReply?: string;
  status: 'new' | 'contacted' | 'qualified' | 'closed' | 'handed_off';
  createdAt: string;
  lastMessageAt?: string;
  externalId?: string;
  source?: 'manual' | 'instagram' | 'whatsapp' | 'web' | string;
  channel?: 'web' | 'instagram' | 'facebook' | 'whatsapp' | 'manual';
  author?: string;
  mediaPermalink?: string;
  phone?: string;
  igScopedId?: string;
  autoReplyPaused?: boolean;
  handoffReason?: string;
  handoffEmail?: string;
}

export interface LeadMessage {
  id: string;
  leadId: string;
  role: 'customer' | 'agent' | 'human';
  text: string;
  channelMessageId?: string;
  createdAt: string;
}

export interface LeadHandoffPackage {
  email: string;
  subject: string;
  body: string;
  waLink: string | null;
  igLink: string | null;
  transcript: string;
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
