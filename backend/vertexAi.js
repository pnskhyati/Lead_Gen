/**
 * Google Vertex AI client for Nexora.
 * Prefers ADC (project + location). Falls back to Vertex Express API key if set.
 */
const { GoogleGenAI, Type, Modality } = require('@google/genai');

const TEXT_MODEL = process.env.VERTEX_TEXT_MODEL || 'gemini-2.5-flash';
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL || 'gemini-2.5-flash-image';
const VIDEO_MODEL = process.env.VERTEX_VIDEO_MODEL || 'veo-3.1-fast-generate-preview';
const LOCATION = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const PROJECT = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
const API_KEY = process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY || '';

let client = null;

function getClient() {
  if (client) return client;

  if (PROJECT) {
    client = new GoogleGenAI({
      vertexai: true,
      project: PROJECT,
      location: LOCATION,
    });
    console.log(`[Vertex] Using project=${PROJECT} location=${LOCATION}`);
    return client;
  }

  if (API_KEY) {
    client = new GoogleGenAI({
      vertexai: true,
      apiKey: API_KEY,
    });
    console.log('[Vertex] Using API key (express) mode');
    return client;
  }

  throw new Error(
    'Vertex AI is not configured. Set VERTEX_PROJECT_ID (+ ADC / GOOGLE_APPLICATION_CREDENTIALS) or VERTEX_API_KEY.'
  );
}

function extractText(response) {
  if (response?.text) return String(response.text).trim();
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find((p) => p.text);
  return (textPart?.text || '').trim();
}

function getCompanyVoice(opts) {
  try {
    const ck = require('./companyKnowledge');
    if (opts && (opts.voiceMode || opts.tone || opts.customTone)) {
      return ck.getVoiceForGeneration(opts);
    }
    return ck.buildVoiceInstruction();
  } catch {
    return '';
  }
}

function extractImageDataUrl(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'image/png';
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

async function generateText(prompt, { systemInstruction, responseSchema, tools } = {}) {
  const ai = getClient();
  const config = {};
  if (systemInstruction) config.systemInstruction = systemInstruction;
  if (responseSchema) {
    config.responseMimeType = 'application/json';
    config.responseSchema = responseSchema;
  }
  if (tools) config.tools = tools;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config,
  });
  return { response, text: extractText(response) };
}

async function generateJson(prompt, responseSchema, systemInstruction) {
  const { text } = await generateText(prompt, { responseSchema, systemInstruction });
  if (!text) throw new Error('Empty AI response');
  return JSON.parse(text);
}

async function generateImage(prompt) {
  const ai = getClient();
  const fullPrompt = `Create a high-quality marketing visual. ${prompt}`;
  // Vertex image models require an explicit Content role (user | model).
  const contents = [{ role: 'user', parts: [{ text: fullPrompt }] }];

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents,
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });
    const dataUrl = extractImageDataUrl(response);
    if (dataUrl) return dataUrl;
    console.warn('[Vertex] Image model returned no image parts');
  } catch (err) {
    console.warn('[Vertex] Image model generateContent failed, trying Imagen:', err.message);
  }

  const imagenModels = [
    process.env.VERTEX_IMAGEN_MODEL,
    'imagen-4.0-generate-001',
    'imagen-3.0-generate-002',
  ].filter(Boolean);

  for (const model of imagenModels) {
    try {
      const imagen = await ai.models.generateImages({
        model,
        prompt: fullPrompt,
        config: { numberOfImages: 1 },
      });
      const bytes = imagen?.generatedImages?.[0]?.image?.imageBytes;
      if (bytes) return `data:image/png;base64,${bytes}`;
    } catch (err) {
      console.error(`[Vertex] Imagen (${model}) failed:`, err.message);
    }
  }

  throw new Error('Failed to generate image via Vertex AI');
}

async function generatePromoVideo(textPrompt, imagePrompt) {
  const ai = getClient();
  const imageUrl = await generateImage(imagePrompt);
  const base64ImageData = imageUrl.split(',')[1];

  let operation = await ai.models.generateVideos({
    model: VIDEO_MODEL,
    prompt: textPrompt,
    image: {
      imageBytes: base64ImageData,
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9',
    },
  });

  while (!operation.done) {
    await new Promise((r) => setTimeout(r, 8000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (video?.videoBytes) {
    return `data:video/mp4;base64,${video.videoBytes}`;
  }
  if (video?.uri) {
    return video.uri;
  }
  throw new Error('Video generation completed but no video payload was returned');
}

const contentGenerationSchema = {
  type: Type.OBJECT,
  properties: {
    captions: { type: Type.ARRAY, items: { type: Type.STRING } },
    imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
    videoScript: { type: Type.STRING },
  },
  required: ['captions', 'imagePrompts', 'videoScript'],
};

async function generateContentIdeas(details) {
  const platformInstruction =
    details.platform === 'LinkedIn Post'
      ? `For the 'captions' field, generate 3 complete, professional LinkedIn posts.`
      : `For the 'captions' field, generate 3 concise captions for ${details.platform}.`;

  const voice = getCompanyVoice({
    voiceMode: details.voiceMode || 'company',
    tone: details.tone,
    customTone: details.customTone,
  });

  const prompt = `You are an expert marketing content creator.
${voice}

Campaign Details:
- Product: ${details.product}
- Goal: ${details.goal}
- Target Audience: ${details.audience}
- Platform: ${details.platform}
${platformInstruction}

CRITICAL: Every caption must follow the WRITING / COMPANY BRAND VOICE block above.
Also provide 2 imagePrompts and a short videoScript.`;

  return generateJson(prompt, contentGenerationSchema);
}

const socialReplySchema = {
  type: Type.OBJECT,
  properties: {
    suggestedReply: { type: Type.STRING },
    productRecommendation: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        reasoning: { type: Type.STRING },
        productImagePrompt: { type: Type.STRING },
        recipes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['name', 'ingredients'],
          },
        },
      },
      required: ['name', 'reasoning', 'productImagePrompt', 'recipes'],
    },
    leadTemperature: { type: Type.STRING, enum: ['hot', 'warm', 'cold'] },
    leadScore: { type: Type.NUMBER },
    intentSummary: { type: Type.STRING },
  },
  required: ['suggestedReply', 'productRecommendation', 'leadTemperature', 'leadScore', 'intentSummary'],
};

async function generateSocialReply(details) {
  const voice = getCompanyVoice({
    voiceMode: details.voiceMode || 'company',
    tone: details.tone,
    customTone: details.customTone,
  });

  const prompt = `You are a Social Media + Lead Gen Manager.
${voice}

Customer comment / DM on ${details.platform}:
"""${details.customerComment}"""

1) Craft a helpful brand reply that STRICTLY matches the voice block above.
2) Recommend a product, image prompt, and 3 cocktail recipes (or relevant serves).
3) Score this as a sales lead for lead generation:
   - leadTemperature: "hot" = clear buy/try intent, asking where to buy, price, availability, ready to purchase soon;
     "warm" = interested / comparing / asking for suggestions but not ready yet;
     "cold" = casual praise, meme, general chat, low purchase intent.
   - leadScore: integer 0–100 (hot usually 75–100, warm 40–74, cold 0–39).
   - intentSummary: one short sentence explaining the score.`;
  return generateJson(prompt, socialReplySchema);
}

const productShowcaseSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING },
    imagePrompt: { type: Type.STRING },
  },
  required: ['description', 'imagePrompt'],
};

async function generateProductShowcase(productName) {
  const prompt = `For Nexora product "${productName}", return a short premium description and a luxury studio imagePrompt.`;
  return generateJson(prompt, productShowcaseSchema);
}

const campaignPlanSchema = {
  type: Type.OBJECT,
  properties: {
    campaignTitle: { type: Type.STRING },
    slogan: { type: Type.STRING },
    personas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          motivations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['name', 'description', 'motivations'],
      },
    },
    messagingPillars: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pillar: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['pillar', 'description'],
      },
    },
    rolloutPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          phase: { type: Type.STRING },
          duration: { type: Type.STRING },
          objective: { type: Type.STRING },
          platforms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                platform: { type: Type.STRING },
                contentIdeas: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['platform', 'contentIdeas'],
            },
          },
        },
        required: ['phase', 'duration', 'objective', 'platforms'],
      },
    },
    kpis: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['campaignTitle', 'slogan', 'personas', 'messagingPillars', 'rolloutPlan', 'kpis'],
};

async function generateCampaignPlan(brief) {
  const prompt = `You are a marketing strategist.
${getCompanyVoice()}

Brief: "${brief}".
Build a full digital campaign plan (title, slogan, personas, messaging pillars, 3-phase rollout, KPIs) in the company brand voice.`;
  return generateJson(prompt, campaignPlanSchema);
}

async function chatWithCopilot(history, newMessage) {
  const ai = getClient();
  const systemInstruction = `You are "Catalyst AI," an elite marketing intelligence assistant.
${getCompanyVoice()}

Give precise, structured answers that match the company voice above.
For comparisons, include clear Markdown analysis.
If useful, call displayChart with title + data [{name, value}].`;

  const displayChartFunctionDeclaration = {
    name: 'displayChart',
    description: 'Displays a chart for visualizing comparison data.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        data: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              value: { type: Type.NUMBER },
            },
            required: ['name', 'value'],
          },
        },
      },
      required: ['title', 'data'],
    },
  };

  const contents = (history || []).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));
  contents.push({ role: 'user', parts: [{ text: newMessage }] });

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents,
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [displayChartFunctionDeclaration] }],
    },
  });

  const textPart = response.candidates?.[0]?.content?.parts?.find((p) => p.text);
  let textReply = textPart?.text || extractText(response) || '';
  let chartData;

  const functionCalls = response.functionCalls;
  if (functionCalls?.length) {
    const call = functionCalls[0];
    if (call.name === 'displayChart') {
      chartData = call.args;
      if (!textReply) textReply = `Here is a chart for: ${chartData?.title || 'comparison'}`;
    }
  }

  return { textReply, sources: [], chartData };
}

async function generateLinkedInPosts({ sourceType, data, preferences, postCount, voiceMode, customTone }) {
  const postSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        headline: { type: Type.STRING },
        content: { type: Type.STRING },
        hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        imagePrompt: { type: Type.STRING },
      },
      required: ['headline', 'content', 'hashtags', 'imagePrompt'],
    },
  };

  const voice = getCompanyVoice({
    voiceMode: voiceMode || preferences?.voiceMode || 'company',
    tone: preferences?.tone,
    customTone: customTone || preferences?.customTone,
  });

  const systemInstruction = `You are a world-class LinkedIn growth strategist.
${voice}
Write posts with strong hooks, clear sections, and hashtags.
CRITICAL: Match the voice block above on every post.
Always include a detailed imagePrompt for an infographic (flowchart, mindmap, or comparison).`;

  const prompt =
    sourceType === 'ai-guided'
      ? `Generate ${postCount} diverse LinkedIn posts for: "${data?.brief || ''}". Preferences: ${JSON.stringify(preferences || {})}. ${data?.customInstructions || ''}`
      : `Rewrite these entries into polished LinkedIn posts:\n${(data?.manualEntries || [])
          .map((m) => `- TOPIC: ${m.title}${m.content ? ` | CONTENT: ${m.content}` : ''}`)
          .join('\n')}\nPreferences: ${JSON.stringify(preferences || {})}`;

  const parsed = await generateJson(prompt, postSchema, systemInstruction);
  return (Array.isArray(parsed) ? parsed : []).slice(0, postCount);
}

async function generateLinkedInImage(imagePrompt) {
  return generateImage(
    `Professional LinkedIn infographic. TYPE: ${imagePrompt}. Clean corporate aesthetic, legible text, no LinkedIn logos or brand watermarks.`
  );
}

async function generateInsights(posts) {
  const postSummaries = (posts || [])
    .map((p) => `- ${p.headline}: ${(p.content || '').substring(0, 80)}...`)
    .join('\n');
  const schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      tips: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['summary', 'tips'],
  };
  const prompt = `Based on these LinkedIn posts, provide Brand Insights JSON with summary and exactly 3 tips.
Posts:\n${postSummaries}`;
  return generateJson(prompt, schema);
}

function getStatus() {
  return {
    configured: Boolean(PROJECT || API_KEY),
    mode: PROJECT ? 'vertex-adc' : API_KEY ? 'vertex-api-key' : 'unconfigured',
    project: PROJECT || null,
    location: LOCATION,
    textModel: TEXT_MODEL,
    imageModel: IMAGE_MODEL,
  };
}

module.exports = {
  getStatus,
  generateText,
  generateJson,
  generateImage,
  generatePromoVideo,
  generateContentIdeas,
  generateSocialReply,
  generateProductShowcase,
  generateCampaignPlan,
  chatWithCopilot,
  generateLinkedInPosts,
  generateLinkedInImage,
  generateInsights,
};
