import { ContentPreferences, PostInput, GeneratedPost } from './types';

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

export const generatePostsText = async (
  sourceType: 'manual' | 'ai-guided',
  data: { brief?: string; manualEntries?: PostInput[]; customInstructions?: string },
  prefs: ContentPreferences,
  postCount: number
): Promise<Partial<GeneratedPost>[]> => {
  try {
    const posts = await postAi<Partial<GeneratedPost>[]>('/api/ai/linkedin/posts', {
      sourceType,
      data,
      preferences: prefs,
      postCount,
      voiceMode: prefs.voiceMode || 'company',
      customTone: prefs.customTone,
    });
    return Array.isArray(posts) ? posts : [];
  } catch (e) {
    console.error('Vertex LinkedIn text gen error:', e);
    return [];
  }
};

export const generatePostImage = async (imagePrompt: string): Promise<string> => {
  try {
    const data = await postAi<{ imageUrl: string }>('/api/ai/linkedin/image', { imagePrompt });
    if (data.imageUrl) return data.imageUrl;
  } catch (e) {
    console.warn('Vertex LinkedIn image gen failed, using placeholder', e);
  }

  const cleanPrompt = imagePrompt.replace(/LinkedIn|Logos|Branding/gi, '');
  const keywords = encodeURIComponent(cleanPrompt.split(' ').slice(0, 3).join(','));
  const seed = Math.abs(
    imagePrompt.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0)
  );
  return `https://loremflickr.com/1200/630/${keywords || 'abstract,business'}?lock=${seed % 1000}`;
};
