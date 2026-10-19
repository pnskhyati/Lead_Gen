const API_BASE = import.meta.env.VITE_API_URL || '';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return (json.data ?? json) as T;
}

export interface LikedPost {
  platform: string;
  summary: string;
  whyItWorks: string;
  engagementSignal: string;
}

export interface Competitor {
  name: string;
  whyTheyCompete: string;
  profiles?: {
    instagram?: string;
    linkedin?: string;
    x?: string;
    facebook?: string;
    website?: string;
  };
  contentThemes?: string[];
  formatsThatWork?: string[];
  toneAndHooks?: string[];
  highEngagementPatterns?: string[];
  postsPeopleLike?: LikedPost[];
  gapsWeCanExploit?: string[];
  strengths?: string[];
  weaknesses?: string[];
  messagingAngles?: string[];
}

export interface WinningPattern {
  pattern: string;
  platforms: string[];
  whyAudienceLikesIt: string;
  howWeAdapt: string;
}

export interface CompetitorIntel {
  competitors: Competitor[];
  winningPatterns?: WinningPattern[];
  brandingRecommendations?: string[];
  contentPillars?: string[];
  marketGaps: string[];
  differentiationPillars?: string[];
  contentOpportunities?: string[];
  summary: string;
  researchNotes?: string;
  dataConfidence?: 'high' | 'medium' | 'low';
  usedSearch?: boolean;
  company?: string;
  industry?: string;
}

export interface ContentPack {
  brandingAngle: string;
  weeklyPlan: {
    day: string;
    platform: string;
    goal: string;
    hook: string;
    post: string;
    hashtags: string[];
    cta: string;
    inspiredByPattern: string;
  }[];
  heroPosts: {
    platform: string;
    headline: string;
    body: string;
    hashtags: string[];
    cta: string;
    whyItShouldPerform: string;
  }[];
  competitorIntel?: CompetitorIntel;
}

export interface RewrittenPost {
  headline: string;
  body: string;
  hashtags: string[];
  cta: string;
  whyBetter: string;
  competitorCounters: string[];
  inspiredByPattern?: string;
  variants: { angle: string; post: string }[];
  platform?: string;
  originalDraft?: string;
  competitorIntel?: CompetitorIntel;
}

export interface LeadGrowthMessage {
  role: 'user' | 'model';
  text: string;
}

export interface LeadGrowthReply {
  reply: string;
  captureLead: boolean;
  leadTemperature: 'hot' | 'warm' | 'cold';
  leadScore: number;
  scoreBand?: string;
  intentSummary: string;
  nextBestAction: string;
  askedFor?: string[];
  missingFields?: string[];
  ctaUsed?: string;
  needsHandoff?: boolean;
  handoffReason?: string;
  leadId?: string;
}

export type CompetitorAnalyzeInput = {
  companyName?: string;
  industry?: string;
  region?: string;
  competitorsText?: string;
  socialProfilesText?: string;
  samplePosts?: string;
};

export function analyzeCompetitors(input: CompetitorAnalyzeInput) {
  return postJson<CompetitorIntel>('/api/agents/competitor/analyze', input);
}

export function generateCompetitorContent(input: CompetitorAnalyzeInput & { platforms?: string[] }) {
  return postJson<ContentPack>('/api/agents/competitor/generate', input);
}

export function rewriteWithCompetitors(
  input: CompetitorAnalyzeInput & {
    draft: string;
    platform?: string;
    goal?: string;
    competitorIntel?: CompetitorIntel;
  }
) {
  return postJson<RewrittenPost>('/api/agents/competitor/rewrite', input);
}

export function chatLeadGrowth(input: {
  message: string;
  history?: LeadGrowthMessage[];
  visitorName?: string;
  channel?: string;
  persist?: boolean;
  sessionId?: string;
}) {
  return postJson<LeadGrowthReply>('/api/agents/lead-growth/chat', input);
}
