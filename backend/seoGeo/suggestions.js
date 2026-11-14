/**
 * AI suggestions for what to track: search phrases for Google, and questions for AI assistants.
 * Aimed at lead generation, so they favour people who are ready to buy over people just browsing.
 * Nothing here claims search volume or ranking; the model is told not to, and only the text is kept.
 */
const { Type } = require('@google/genai');

const KINDS = {
  keywords: {
    ask:
      'search phrases people type into Google when they are looking for what this business sells. Mix: (a) "ready to buy / hire" phrases such as "best X for Y", "X pricing", "X near me", "X vs Y", "hire X"; (b) problem phrases such as "how to fix ...". Each is 2 to 6 words, lower case, no punctuation.',
    max: 12,
  },
  questions: {
    ask:
      'full questions a potential customer would type into ChatGPT, Gemini or Perplexity when looking for a business like this one, written naturally in one sentence each (for example "What is the best ... for a small ... business?"). Favour questions where the person is choosing or comparing providers.',
    max: 10,
  },
};

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          why: { type: Type.STRING },
          intent: { type: Type.STRING },
        },
        required: ['text', 'why', 'intent'],
      },
    },
  },
  required: ['suggestions'],
};

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function businessBrief(profile) {
  const faqs = (profile.faqs || []).slice(0, 8).map((f) => `- ${clip(f.question || f.q, 140)}`).filter((l) => l.length > 2);
  return [
    `Business: ${profile.companyName || 'unknown'}`,
    profile.industry && `Industry: ${profile.industry}`,
    profile.tagline && `Tagline: ${clip(profile.tagline, 160)}`,
    profile.productsFocus && `What they sell: ${clip(profile.productsFocus, 1200)}`,
    profile.audience && `Who they sell to: ${clip(profile.audience, 400)}`,
    profile.location && `Location: ${profile.location}`,
    profile.websiteUrl && `Website: ${profile.websiteUrl}`,
    faqs.length && `Questions their customers already ask:\n${faqs.join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {object} vertex  needs generateJson
 * @param {{kind: 'keywords'|'questions', profile: object, existing?: string[]}} opts
 * @returns {Promise<{suggestions: {text: string, why: string, intent: 'buy'|'compare'|'learn'}[]}>}
 */
async function suggest(vertex, { kind, profile, existing = [] }) {
  const spec = KINDS[kind];
  if (!spec) throw new Error('Unknown suggestion type');
  if (!vertex?.generateJson) throw new Error('The AI assistant is not set up on this server yet.');
  if (!profile?.companyName && !profile?.productsFocus) {
    throw new Error('Tell us what your business sells first (Settings, Business details), so the suggestions fit.');
  }

  const prompt = `You help a business get more leads from search. Suggest ${spec.max} ${spec.ask}

BUSINESS
${businessBrief(profile)}

Rules:
- Base every suggestion on what this business really sells and who it sells to. Do not suggest anything it does not offer.
- Do not include the business's own name, except at most one suggestion.
- Do not state or guess search volume, difficulty or ranking.
- "intent" is one of: buy (ready to hire or purchase), compare (choosing between options), learn (researching a problem).
- At least two thirds must be intent buy or compare, because the goal is leads, not traffic.
- "why" is one plain sentence (max 20 words) saying what kind of customer this brings in. No jargon.
${existing.length ? `\nAlready tracked, do not repeat or reword these:\n${existing.slice(0, 40).map((e) => `- ${e}`).join('\n')}` : ''}`;

  const out = await vertex.generateJson(prompt, SCHEMA, 'You are a practical SEO and lead-generation advisor. Never promise rankings or traffic.', { thinkingLevel: 'LOW' });

  const seen = new Set(existing.map(norm));
  const clean = [];
  for (const s of out?.suggestions || []) {
    const text = clip(s.text, kind === 'keywords' ? 80 : 200);
    const key = norm(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    clean.push({ text, why: clip(s.why, 160), intent: ['buy', 'compare', 'learn'].includes(s.intent) ? s.intent : 'learn' });
    if (clean.length >= spec.max) break;
  }
  return { suggestions: clean };
}

module.exports = { suggest, KINDS };
