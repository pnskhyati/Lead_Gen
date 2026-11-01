
export enum WorkflowStep {
  LOGIN = 'LOGIN',
  SOURCE_SELECTION = 'SOURCE_SELECTION',
  SCHEDULING = 'SCHEDULING',
  PREFERENCES = 'PREFERENCES',
  GENERATION = 'GENERATION',
  REVIEW = 'REVIEW',
  PUBLISHING = 'PUBLISHING',
  DASHBOARD = 'DASHBOARD'
}

export type PostType = 'Thought Leadership' | 'Educational' | 'Storytelling' | 'Promotional' | 'Hiring';
export type Tone = 'Professional' | 'Conversational' | 'Inspirational' | 'Bold';
export type Length = 'Short' | 'Medium' | 'Long-form';

export type PublishPlatform = 'linkedin' | 'instagram' | 'facebook' | 'x';

export interface LinkedInUser {
  name: string;
  email: string;
  picture: string;
  urn: string;
}

export interface ContentPreferences {
  postType: PostType;
  tone: Tone;
  length: Length;
  useEmojis: boolean;
  includeCTA: boolean;
  voiceMode?: 'company' | 'preset' | 'custom';
  customTone?: string;
}

export interface PostInput {
  title: string;
  date: string;
  time: string;
  content?: string;
  imageUrl?: string;
}

export interface PlatformPublishResult {
  status: 'published' | 'failed' | 'pending';
  id?: string;
  error?: string;
  at?: string;
}

export interface GeneratedPost {
  id: string;
  headline: string;
  content: string;
  hashtags: string[];
  imageUrl?: string;
  imagePrompt: string;
  scheduledAt: string;
  status: 'pending' | 'scheduled' | 'published' | 'failed';
  source: 'manual' | 'ai-generated';
  platforms?: PublishPlatform[];
  platformResults?: Partial<Record<PublishPlatform, PlatformPublishResult>>;
}

export interface WorkflowData {
  sourceType: 'manual' | 'ai-guided';
  manualEntries: PostInput[];
  aiBrief: string;
  startDate: string;
  frequency: 7 | 15 | 30 | 'manual';
  preferredTime: string;
  preferences: ContentPreferences;
  posts: GeneratedPost[];
  history: GeneratedPost[];
  /** Default publish targets for new schedules */
  selectedPlatforms: PublishPlatform[];
}
