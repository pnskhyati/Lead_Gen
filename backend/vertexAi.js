/**
 * Google Vertex AI client for Nexora.
 * Prefers ADC (project + location). Falls back to Vertex Express API key if set.
 */
const { GoogleGenAI, Type, Modality } = require('@google/genai');

const LOCATION = process.env.VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const PROJECT = process.env.VERTEX_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const VERTEX_API_KEY = process.env.VERTEX_API_KEY || '';
/** Prefer Vertex (ADC) when project is set. Override with GEMINI_USE_GEMINI_API=true to use AI Studio key only. */
const USE_GEMINI_API =
  process.env.GEMINI_USE_GEMINI_API === 'true' && !process.env.GEMINI_USE_VERTEX && !process.env.VERTEX_USE_VERTEX;
const FORCE_VERTEX =
  process.env.GEMINI_USE_VERTEX === 'true' ||
  process.env.VERTEX_USE_VERTEX === 'true' ||
  (Boolean(PROJECT) && !USE_GEMINI_API);
const API_KEY = USE_GEMINI_API ? GEMINI_API_KEY : VERTEX_API_KEY || (FORCE_VERTEX ? '' : GEMINI_API_KEY);
const TEXT_MODEL =
  process.env.VERTEX_TEXT_MODEL ||
  (USE_GEMINI_API && GEMINI_API_KEY ? 'gemini-3.8-flash' : 'gemini-3-flash-preview');
const IMAGE_MODEL = process.env.VERTEX_IMAGE_MODEL || 'gemini-2.5-flash-image';

/** Google AI API (API key) model IDs differ from Vertex / Agent Platform; map retired names. */
function resolveTextModel() {
  if (USE_GEMINI_API && GEMINI_API_KEY && !FORCE_VERTEX) {
    const legacy = new Set(['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-3.8-flash']);
    return legacy.has(TEXT_MODEL) ? 'gemini-3.8-flash' : TEXT_MODEL;
  }
  // Gemini Enterprise / Agent Platform: gemini-2.5-* is not published in many projects; use global + gemini-3-flash-preview.
  const vertexUnavailable = new Set([
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-001',
  ]);
  if (vertexUnavailable.has(TEXT_MODEL)) return 'gemini-3-flash-preview';
  return TEXT_MODEL;
}
const VIDEO_MODEL = process.env.VERTEX_VIDEO_MODEL || 'veo-3.1-fast-generate-preview';

// ADC often bills against quota_project (e.g. old gcloud default) unless aligned with VERTEX_PROJECT_ID.
if (PROJECT) {
  if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
  if (!process.env.GOOGLE_CLOUD_QUOTA_PROJECT) process.env.GOOGLE_CLOUD_QUOTA_PROJECT = PROJECT;
}

let client = null;

function getClient() {
  if (client) return client;

  // Gemini Developer API (Generative Language) — optional when GEMINI_USE_GEMINI_API=true.
  if (USE_GEMINI_API && GEMINI_API_KEY) {
    client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('[Gemini] Using Google AI API key (generativelanguage.googleapis.com)');
    return client;
  }

  if (VERTEX_API_KEY && FORCE_VERTEX) {
    const opts = { vertexai: true, apiKey: VERTEX_API_KEY };
    if (PROJECT) {
      opts.project = PROJECT;
      opts.location = LOCATION;
    }
    client = new GoogleGenAI(opts);
    console.log(
      `[Vertex] Using Vertex API key${PROJECT ? ` + project=${PROJECT} location=${LOCATION}` : ''}`
    );
    return client;
  }

  if (PROJECT) {
    client = new GoogleGenAI({
      vertexai: true,
      project: PROJECT,
      location: LOCATION,
    });
    console.log(`[Vertex] Using project=${PROJECT} location=${LOCATION} (ADC)`);
    return client;
  }

  throw new Error(
    'Vertex AI is not configured. Set VERTEX_PROJECT_ID in .env.local, run gcloud auth application-default login, or set VERTEX_API_KEY.'
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
    model: resolveTextModel(),
    contents: prompt,
    config,
  });
  return { response, text: extractText(response) };
}

function stripJsonText(raw) {
  let text = String(raw || '').replace(/^\uFEFF/, '').trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenced) text = fenced[1].trim();
  return text.replace(/^\uFEFF/, '');
}

function parseModelJson(raw) {
  const text = stripJsonText(raw);
  if (!text) throw new Error('Empty AI response');
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Model returned invalid JSON: ${err.message}`);
  }
}

async function generateJson(prompt, responseSchema, systemInstruction) {
  const { text } = await generateText(prompt, { responseSchema, systemInstruction });
  return parseModelJson(text);
}

async function generateImage(prompt) {
  const ai = getClient();
  const fullPrompt = `You are generating ONE final ad hero image for a marketing campaign. Obey the scene description literally (location, objects, industry, mood, camera).

${prompt}

Requirements:
- Photorealistic, campaign-ready, 16:9 composition unless the brief says otherwise.
- Show exactly the business context in the brief (if it says dental clinic, show a believable dental consultation space; if SaaS, show the described product scene).
- Do not substitute a generic unrelated office or CRM dashboard unless the brief asks for that.
- CRITICAL: Do not render any words, letters, slogans, or headline text in the image (no captions, no "PRECISION", no brand taglines). Headlines belong in the social post, not baked into the photo.
- If a screen appears, show abstract charts/UI only — no readable logos or product names on the display.
- No watermarks, no garbled typography, no split-screen collage.`;
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

const PLATFORM_VIRAL_PLAYBOOK = `
Use the topic's industry/niche to pick formats that actually win reach there (not generic marketing fluff).

LinkedIn — pick ONE per post: document/PDF carousel slide copy (5–8 slides as numbered sections in content); contrarian hook + numbered insights + soft CTA; mini case study (problem → approach → outcome); "myth vs reality" list; poll-style opener + discussion question. B2B/regulated niches (health, fintech, gov): lead with trust, outcomes, compliance-aware wording — no reckless medical/financial claims.

Facebook (Page) — pick ONE: conversational story + question; short native video/Reels script (hook in first line); shareable listicle; community poll framing; link teaser with curiosity gap. Favor warmth and shareability over corporate jargon.

Instagram / Threads — pick ONE: Reels script (0–3s hook, beats, on-screen text cues); carousel (6 cards max); single-image caption with line breaks + save-worthy tips; before/after or myth-bust carousel. Specify square or 4:5 visual direction in imagePrompt.

X (Twitter) — pick ONE: 4–8 tweet thread; single punchy post under 280 chars; hot take + quote-tweet bait; list thread with emoji bullets sparingly. Optimize for replies and reposts.

Each post must be a DIFFERENT layout/format. Respect platform character norms. Hashtags: LinkedIn 3–5, Instagram 8–15, Facebook 2–5, X 1–3.

CONTENT SHAPE (mandatory — do not reuse the same slide deck on every platform):
- Instagram carousel: content MUST start with "Caption:" (2–4 lines for the feed — hook, value, CTA, location if relevant). Then a blank line, then "Cards:" and numbered lines "1. …" through "6. …" (short on-image text per card). Do NOT prefix lines with "Slide 1:" or "Slide 2:". Also fill carouselImagePrompts with the SAME number of entries as Cards — each prompt describes a 4:5 photoreal scene for that card (dental clinic, local context, etc.), consistent series style, NO readable text in the image.
- Instagram single-image / Reels: one flowing caption only — NO "Slide" labels, NO "Cards:" section.
- X (Twitter): NEVER use "Slide", "Card", or carousel labels. Use a thread: each paragraph starts with "1/6", "2/6", … and each block must be ≤280 characters (including the counter). Shorter, punchier lines than Instagram. Put hashtags only in the hashtags JSON field, not repeated in every tweet.
- LinkedIn / Facebook: use their native formats from the playbook above — not Instagram carousel slide scripts copied verbatim.`;

const topicSocialPackSchema = {
  type: Type.OBJECT,
  properties: {
    topicSummary: { type: Type.STRING },
    nicheAudience: { type: Type.STRING },
    posts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          platform: { type: Type.STRING },
          viralFormat: { type: Type.STRING },
          whyThisFormat: { type: Type.STRING },
          content: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          imagePrompt: { type: Type.STRING },
          aspectRatio: { type: Type.STRING },
          carouselImagePrompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              'Instagram carousel only: one image prompt per card (4:5), same visual series, scene matches card message, no text in image',
          },
        },
        required: ['platform', 'viralFormat', 'whyThisFormat', 'content', 'hashtags', 'imagePrompt'],
      },
    },
  },
  required: ['topicSummary', 'nicheAudience', 'posts'],
};

function stripTrailingHashtagBlock(text) {
  return String(text || '')
    .replace(/\n\n(?:#[\w\u00C0-\u024F]+(?:\s+#[\w\u00C0-\u024F]+)*)\s*$/u, '')
    .trim();
}

/** Fix common model mistake: same "Slide N:" carousel pasted on IG and X. */
function normalizeTopicSocialPostContent(platform, rawContent) {
  let content = String(rawContent || '').trim();
  if (!content) return content;

  const pl = String(platform || '').toLowerCase();
  const isX = pl.includes('twitter') || pl === 'x' || pl.startsWith('x ');
  const isIg = pl.includes('instagram') || pl.includes('threads');

  const slideBlocks = content.split(/\n(?=Slide\s+\d+\s*[:：])/i).filter((s) => s.trim());
  const hasSlideLabels = slideBlocks.length > 1 || /^Slide\s+\d+\s*[:：]/i.test(content);

  if (isX && hasSlideLabels) {
    const bodies = slideBlocks.map((block) =>
      stripTrailingHashtagBlock(block.replace(/^Slide\s+\d+\s*[:：]\s*/i, '').trim())
    ).filter(Boolean);
    const total = bodies.length;
    content = bodies
      .map((body, i) => {
        const prefix = `${i + 1}/${total} `;
        const max = 280;
        let line = body.replace(/\s+/g, ' ').trim();
        if (prefix.length + line.length > max) {
          line = `${line.slice(0, max - prefix.length - 1).trim()}…`;
        }
        return `${i + 1}/${total}\n${line}`;
      })
      .join('\n\n');
    return content;
  }

  if (isIg && hasSlideLabels) {
    const bodies = slideBlocks.map((block) =>
      stripTrailingHashtagBlock(block.replace(/^Slide\s+\d+\s*[:：]\s*/i, '').trim())
    ).filter(Boolean);
    const hook = bodies[0] || '';
    const lines = [
      'Caption:',
      bodies.length > 1
        ? `${hook}\n\nSwipe for more — save if useful.`
        : hook,
      '',
      'Cards:',
      ...bodies.map((text, i) => `${i + 1}. ${text}`),
    ];
    return lines.join('\n');
  }

  return content;
}

async function generateTopicSocialPack({
  topic,
  product,
  audience,
  platforms,
  postCount,
  voiceMode,
  customTone,
  tone,
  formatHint,
} = {}) {
  const voice = getCompanyVoice({
    voiceMode: voiceMode || 'company',
    tone,
    customTone,
  });

  const platformList = Array.isArray(platforms) && platforms.length
    ? platforms
    : ['LinkedIn', 'Facebook', 'Instagram', 'X (Twitter)'];

  const count = Math.min(Math.max(Number(postCount) || platformList.length, 1), 8);
  const multiChannel = platformList.length > 1;

  const taskInstruction = multiChannel
    ? `Create exactly ONE distinct post per platform in this list (do not duplicate formats across platforms): ${platformList.join(', ')}.`
    : `Create ${count} distinct posts for ${platformList[0]} only — each must use a DIFFERENT viral format/layout from the playbook.`;

  const prompt = `TOPIC / BRIEF (this drives niche, angle, and format choice):
"""${String(topic || '').trim()}"""

Brand context:
- Company / product: ${product || 'the brand'}
- Target audience: ${audience || 'target buyers'}
${formatHint ? `- Preferred format angle: ${formatHint}` : ''}

${taskInstruction}

${PLATFORM_VIRAL_PLAYBOOK}

Return JSON with topicSummary, nicheAudience, and posts[]. Each content field must be ready to paste and MUST follow CONTENT SHAPE rules for that post's platform. imagePrompt must describe visuals optimized for that platform (infographic, carousel cover, reel thumbnail, etc.). Do not invent fake statistics or regulated claims; use illustrative framing when data is not provided.`;

  const systemInstruction = `You are a multi-platform growth strategist who adapts viral organic formats to each niche.
${voice}
CRITICAL: Every post must match the brand voice block and fit the topic niche (e.g. healthcare + AI → credible, educational, trust-first).`;

  const parsed = await generateJson(prompt, topicSocialPackSchema, systemInstruction);
  const rawPosts = Array.isArray(parsed?.posts) ? parsed.posts : [];
  const posts = rawPosts.slice(0, multiChannel ? platformList.length : count).map((post) => ({
    ...post,
    content: normalizeTopicSocialPostContent(post.platform, post.content),
  }));
  return {
    topicSummary: parsed?.topicSummary || String(topic || '').slice(0, 120),
    nicheAudience: parsed?.nicheAudience || audience || '',
    posts,
  };
}

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
    model: resolveTextModel(),
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

function vertexAuthHint() {
  if (USE_GEMINI_API && GEMINI_API_KEY) return 'Using GEMINI_API_KEY (Google AI API, not Vertex predict).';
  if (VERTEX_API_KEY && FORCE_VERTEX) return 'Using VERTEX_API_KEY (Vertex express).';
  if (PROJECT) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return 'Using VERTEX_PROJECT_ID + service account file (GOOGLE_APPLICATION_CREDENTIALS).';
    }
    return 'Using VERTEX_PROJECT_ID + Application Default Credentials (gcloud auth application-default login). No JSON key required.';
  }
  return 'Set VERTEX_PROJECT_ID in .env.local and run: gcloud auth application-default login';
}

/** User-facing hint from Vertex / Google API errors (billing, IAM, ADC). */
function formatVertexError(err) {
  const raw = stripJsonText(err?.message || String(err));
  try {
    const parsed = JSON.parse(raw);
    const msg = parsed?.error?.message || raw;
    if (/billing/i.test(msg)) {
      const wrong = msg.match(/project #(\S+)/)?.[1];
      const hint =
        wrong && PROJECT && wrong !== PROJECT
          ? ` Your .env.local uses VERTEX_PROJECT_ID=${PROJECT}, but Google billed project "${wrong}" (stale ADC quota). Run: gcloud auth application-default set-quota-project ${PROJECT}`
          : ` Link billing to project "${PROJECT || 'your project'}" and enable aiplatform.googleapis.com.`;
      return `${msg}${hint}`;
    }
    if (/aiplatform\.endpoints\.predict|IAM_PERMISSION_DENIED/i.test(msg)) {
      return `${msg} If you already have Owner/Vertex AI User, complete **billing account verification** for tecavy - marketing os, then wait 15 min. Or use GEMINI_API_KEY (Google AI API) in .env.local. IAM: https://console.cloud.google.com/iam-admin/iam?project=${PROJECT || 'marketing-os-513012'}`;
    }
    if (/prepayment credits|402|"code":402/i.test(msg)) {
      return `${msg} Open https://ai.studio/projects → link billing or add prepay credits for the API key project. Until then, generation cannot run (this is billing, not Nexora code).`;
    }
    if (/no longer available|models\/gemini/i.test(msg)) {
      return `${msg} Set VERTEX_TEXT_MODEL=gemini-2.5-flash in .env.local and restart the backend.`;
    }
    if (/Publisher model.*was not found/i.test(msg)) {
      return `${msg} For Agent Platform on project "${PROJECT || 'marketing-os-513012'}", set VERTEX_LOCATION=global and VERTEX_TEXT_MODEL=gemini-3-flash-preview in .env.local, restart the backend. See https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations`;
    }
    return msg;
  } catch {
    return raw;
  }
}

/**
 * Sampled GEO citation check — same Vertex client as copilot, content ideas, lead agent.
 */
async function runGeoCitationSample(userPrompt, { companyName = 'the business', domain = '' } = {}) {
  const domainHint = domain ? ` Prefer citing ${domain} when relevant.` : '';
  const system = `You are simulating an AI search assistant. Answer the user question naturally. Include source URLs when you reference facts. Company context: ${companyName}.${domainHint} Do not invent analytics or ranking guarantees.`;
  const { text } = await generateText(String(userPrompt || '').trim(), { systemInstruction: system });
  return text;
}

function getStatus() {
  return {
    configured: Boolean(PROJECT || GEMINI_API_KEY || VERTEX_API_KEY),
    mode: USE_GEMINI_API && GEMINI_API_KEY
      ? 'gemini-api-key'
      : PROJECT
        ? 'vertex-adc'
        : VERTEX_API_KEY
          ? 'vertex-api-key'
          : 'unconfigured',
    project: PROJECT || null,
    location: LOCATION,
    textModel: resolveTextModel(),
    imageModel: IMAGE_MODEL,
    authHint: vertexAuthHint(),
  };
}

module.exports = {
  getStatus,
  formatVertexError,
  runGeoCitationSample,
  generateText,
  generateJson,
  generateImage,
  generatePromoVideo,
  generateContentIdeas,
  generateTopicSocialPack,
  generateSocialReply,
  generateProductShowcase,
  generateCampaignPlan,
  chatWithCopilot,
  generateLinkedInPosts,
  generateLinkedInImage,
  generateInsights,
};
