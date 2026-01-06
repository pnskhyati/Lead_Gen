

export type View = 'insights' | 'campaigns' | 'lab' | 'automation' | 'chat' | 'bridal';

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

export interface SocialResponse {
  suggestedReply: string;
  productRecommendation: {
    name: string;
    reasoning: string;
    productImagePrompt: string;
    recipes: Recipe[];
  }
}

// Type for Product Showcase
export interface ProductShowcase {
  description: string;
  imagePrompt: string;
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
