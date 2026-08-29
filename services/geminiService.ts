import type {
  CampaignDetails,
  ChatMessage,
  CopilotResponse,
  ProductShowcase,
  SocialInteraction,
  SocialResponse,
  CampaignPlan,
  GeneratedContent,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function postAi<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Vertex AI request failed (${res.status})`);
  }
  return (json.data ?? json) as T;
}

export const generateContentIdeas = async (details: CampaignDetails): Promise<GeneratedContent> => {
  return postAi<GeneratedContent>('/api/ai/content-ideas', { details });
};

export const generateImage = async (prompt: string): Promise<string> => {
  const data = await postAi<{ imageUrl: string }>('/api/ai/image', { prompt });
  return data.imageUrl;
};

export const generatePromoVideo = async (textPrompt: string, imagePrompt: string): Promise<string> => {
  const data = await postAi<{ videoUrl: string }>('/api/ai/video', { textPrompt, imagePrompt });
  return data.videoUrl;
};

export const chatWithCopilot = async (
  history: Omit<ChatMessage, 'sources' | 'chartData'>[],
  newMessage: string
): Promise<CopilotResponse> => {
  return postAi('/api/ai/chat', { history, message: newMessage });
};

export const generateSocialReply = async (details: SocialInteraction): Promise<SocialResponse> => {
  return postAi('/api/ai/social-reply', { details });
};

export const generateProductShowcase = async (productName: string): Promise<ProductShowcase> => {
  return postAi('/api/ai/product-showcase', { productName });
};

export const generateCampaignPlan = async (brief: string): Promise<CampaignPlan> => {
  return postAi('/api/ai/campaign-plan', { brief });
};
