/**
 * How each platform's posts are built, and the owner's choices about it.
 *
 * Formats are structures that tend to hold attention and start conversations. Nothing here can promise reach: it only
 * makes the writing follow a shape that suits the platform, and never uses engagement bait ("comment YES", "tag a friend"),
 * which the platforms demote.
 */
const { Type } = require('@google/genai');

const clip = (v, n) => String(v ?? '').trim().slice(0, n);

const FORMATS = {
  linkedin: [
    {
      id: 'hook_story',
      label: 'Punchline, two paragraphs, question',
      blurb: 'A one-line hook, two short paragraphs (the problem or insight, then what to do about it), and a specific closing question.',
      structure:
        'Line 1: a punchline hook under 100 characters that states a surprising truth, a sharp contrast or a real pain. It is all that shows before "see more".\n' +
        'Blank line. Paragraph 1 (2-3 short sentences): the problem or insight, grounded in one concrete example or fact from APPROVED FACTS.\n' +
        'Blank line. Paragraph 2 (2-3 short sentences): the takeaway, what to do about it, how the business helps (lightly, not an ad).\n' +
        'Blank line. Last line: one specific question that people can answer from their own experience in a sentence.',
      words: { short: '70-110', standard: '110-170', long: '170-260' },
    },
    {
      id: 'numbered',
      label: 'Numbered takeaways',
      blurb: 'A hook that promises a number of lessons, 3-5 short numbered points, and a question asking for theirs.',
      structure:
        'Line 1: a hook that promises specific value ("3 things that ..."). Blank line.\n' +
        'Then 3-5 numbered points, each one line (two at most), concrete and different from each other. Blank line.\n' +
        'Last line: a question asking which point they agree with or what they would add.',
      words: { short: '60-100', standard: '100-160', long: '160-240' },
    },
    {
      id: 'bold_take',
      label: 'Bold opinion',
      blurb: 'A confident, slightly contrarian statement, the reasoning, then a question inviting disagreement.',
      structure:
        'Line 1: a bold opinion the target customer will react to (something true and defensible, never an attack on a person or competitor). Blank line.\n' +
        'Paragraph: why you believe it, with one example or fact. Blank line.\n' +
        'Paragraph: what to do instead. Blank line.\n' +
        'Last line: a question asking whether they see it differently.',
      words: { short: '70-110', standard: '110-170', long: '170-250' },
    },
    {
      id: 'short_note',
      label: 'Short and simple',
      blurb: 'Three or four lines: a hook, one idea, a question. Quick to read, good for busy feeds.',
      structure: 'Line 1: a hook. Blank line. 1-2 sentences with the one idea. Blank line. A short question.',
      words: { short: '30-60', standard: '50-90', long: '90-130' },
    },
  ],
  instagram: [
    {
      id: 'hook_value',
      label: 'Hook, value, save-worthy tip',
      blurb: 'A scroll-stopping first line, 2-4 short lines of real value, and a reason to save or share.',
      structure:
        'Line 1: a scroll-stopping hook (shows before "more"). Blank line.\n' +
        '2-4 short lines with line breaks, each carrying one useful point or detail. Blank line.\n' +
        'Last line: a call to action that fits the goal (save this, share with someone who needs it, or a question to answer in the comments).',
      words: { short: '30-60', standard: '50-110', long: '110-180' },
    },
    {
      id: 'carousel',
      label: 'Carousel caption',
      blurb: 'A caption written for a swipeable multi-slide post: a hook, what is inside, a prompt to swipe and save.',
      structure:
        'Line 1: a hook that promises what the slides reveal. Blank line.\n' +
        'One or two lines saying what is inside and why it matters. Blank line.\n' +
        'Last line: tell them to swipe and save it, or ask which slide helped most.',
      words: { short: '30-60', standard: '50-100', long: '100-160' },
    },
    {
      id: 'story_moment',
      label: 'Personal moment',
      blurb: 'A human, behind-the-scenes caption with a feeling, a small story and a question.',
      structure: 'Line 1: a line that pulls people into a moment. Blank line. 2-3 short lines telling it in a human voice. Blank line. A friendly question.',
      words: { short: '30-60', standard: '50-100', long: '100-160' },
    },
  ],
  facebook: [
    {
      id: 'conversation',
      label: 'Friendly question',
      blurb: 'A warm, plain-language post that ends by asking the community something easy to answer.',
      structure:
        'Line 1: a friendly, relatable opening. Blank line. 2-4 short sentences in plain language with one useful point. Blank line. An easy question or an invitation to reply.',
      words: { short: '25-50', standard: '40-90', long: '90-150' },
    },
    {
      id: 'announcement',
      label: 'Clear announcement',
      blurb: 'What is new or on offer, who it is for, and exactly how to take part.',
      structure: 'Line 1: what is happening, plainly. Blank line. Who it is for and why it matters (1-2 sentences). Blank line. How to take part, then a light question.',
      words: { short: '25-50', standard: '40-90', long: '90-150' },
    },
  ],
  x: [
    {
      id: 'punchy',
      label: 'One punchy line',
      blurb: 'A single sharp idea that stands alone.',
      structure: 'One post: a direct hook and one idea. Optionally one short follow-on line.',
      words: { short: '10-20', standard: '15-35', long: '25-40' },
    },
    {
      id: 'hot_take_question',
      label: 'Take plus question',
      blurb: 'A short opinion that ends with a question people want to answer.',
      structure: 'One post: a short, confident opinion, then a question in the same post. The post MUST end with a question mark.',
      words: { short: '10-20', standard: '15-35', long: '25-40' },
    },
  ],
};

const DEFAULTS = {
  linkedin: { format: 'hook_story', length: 'standard', emoji: 'none', goal: 'comments', notes: '' },
  instagram: { format: 'hook_value', length: 'standard', emoji: 'few', goal: 'saves', notes: '' },
  facebook: { format: 'conversation', length: 'standard', emoji: 'few', goal: 'comments', notes: '' },
  x: { format: 'hot_take_question', length: 'standard', emoji: 'none', goal: 'comments', notes: '' },
};

const LENGTHS = ['short', 'standard', 'long'];
const EMOJIS = ['none', 'few'];
const GOALS = ['comments', 'clicks', 'leads', 'saves'];

const GOAL_LINE = {
  comments: 'Goal: conversation. The closing question must be specific and easy to answer from personal experience (not "Thoughts?" or "Agree?"). Make people want to answer.',
  clicks: 'Goal: visits. Give one clear reason to open the link or visit the website, and say what they will find.',
  leads: 'Goal: enquiries. Make the next step obvious and low-effort (message us, book a call), and say what happens next.',
  saves: 'Goal: saves and shares. Include something genuinely useful that people will want to keep or send to someone.',
};

const ENGAGEMENT_RULES = `ENGAGEMENT RULES (apply to every post):
- The first line must earn the next one. No "Excited to announce", "In today's fast-paced world", "Game-changer" or other filler openers.
- Specific beats general: use a concrete detail, example or fact from APPROVED FACTS rather than a claim.
- Write like a person talking to one customer: plain words, sentences under 20 words. No consulting jargon (silos, synergy, enablement, workflow transformation, ecosystem, leverage).
- Short lines and short paragraphs. Blank lines between blocks. No walls of text.
- Never beg for engagement ("comment YES", "like and share", "tag a friend", "follow for more"). Ask a real question instead.
- No fake urgency, invented numbers, testimonials or guarantees.`;

const formatsFor = (platform) => FORMATS[platform] || [];
const formatOf = (platform, id) => formatsFor(platform).find((f) => f.id === id) || formatsFor(platform).find((f) => f.id === DEFAULTS[platform]?.format);

/** Keep only valid choices; anything missing falls back to the platform default. */
function sanitizePrefs(input, base = DEFAULTS) {
  const out = {};
  for (const p of Object.keys(DEFAULTS)) {
    const given = input?.[p] || {};
    const prev = base[p] || DEFAULTS[p];
    out[p] = {
      format: formatsFor(p).some((f) => f.id === given.format) ? given.format : prev.format,
      length: LENGTHS.includes(given.length) ? given.length : prev.length,
      emoji: EMOJIS.includes(given.emoji) ? given.emoji : prev.emoji,
      goal: GOALS.includes(given.goal) ? given.goal : prev.goal,
      notes: given.notes === undefined ? prev.notes || '' : clip(given.notes, 300).replace(/\s+/g, ' '),
    };
  }
  return out;
}

/** The part of the writing prompt that describes this platform's chosen format. */
function promptFor(platform, prefs) {
  const p = { ...DEFAULTS[platform], ...(prefs || {}) };
  const f = formatOf(platform, p.format);
  if (!f) return '';
  return `POST FORMAT (follow this structure exactly; it overrides the STYLE line wherever they differ): ${f.label}
${f.structure}
Length: about ${f.words[p.length] || f.words.standard} words.
Emoji: ${p.emoji === 'none' ? 'none' : 'one or two at most, only where they fit'}.
${GOAL_LINE[p.goal] || GOAL_LINE.comments}
${p.notes ? `OWNER'S EXTRA STYLE NOTES (about tone and style only; they never override the fact rules): ${clip(p.notes, 300)}\n` : ''}${ENGAGEMENT_RULES}`;
}

const SUGGEST_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          platform: { type: Type.STRING },
          format: { type: Type.STRING },
          length: { type: Type.STRING },
          goal: { type: Type.STRING },
          why: { type: Type.STRING },
        },
        required: ['platform', 'format', 'length', 'goal', 'why'],
      },
    },
  },
  required: ['suggestions'],
};

/** Recommend a format for each platform for this business. Falls back to the defaults if the model is unavailable. */
async function suggest(vertex, { brand, platforms }) {
  const fallback = () => platforms.map((p) => ({ platform: p, ...DEFAULTS[p], why: 'A proven default for this platform.' }));
  if (!vertex?.generateJson) return { ai: false, suggestions: fallback() };
  const options = platforms.map((p) => `${p}: ${formatsFor(p).map((f) => `${f.id} (${f.label}: ${f.blurb})`).join('; ')}`).join('\n');
  const prompt = `Recommend how this business should write its posts on each platform to earn attention and conversation from the right customers.

BUSINESS:
${brand}

Choose, for each platform, ONE format from these options (use the id exactly):
${options}

Also choose length (short, standard or long) and goal (comments, clicks, leads or saves). Think about who the customers are, what they respond to on that platform (B2B buyers on LinkedIn, visual discovery on Instagram...), and what the business sells. For "why", write one plain sentence (max 25 words) the owner will read, with no jargon.`;
  try {
    const out = await vertex.generateJson(prompt, SUGGEST_SCHEMA, 'You advise small businesses on social media. Be practical and honest; never promise results.', { thinkingLevel: 'LOW' });
    const byPlatform = new Map((out.suggestions || []).map((s) => [String(s.platform).toLowerCase(), s]));
    const clean = sanitizePrefs(Object.fromEntries(platforms.map((p) => [p, byPlatform.get(p) || {}])));
    return { ai: true, suggestions: platforms.map((p) => ({ platform: p, ...clean[p], notes: undefined, why: clip(byPlatform.get(p)?.why, 200) || 'A good fit for this platform.' })) };
  } catch (err) {
    console.warn('[PostFormats] suggestion failed:', err.message);
    return { ai: false, suggestions: fallback() };
  }
}

/** What the client needs to draw the choices. */
function catalog() {
  return Object.fromEntries(Object.entries(FORMATS).map(([p, list]) => [p, list.map(({ id, label, blurb }) => ({ id, label, blurb }))]));
}

module.exports = { FORMATS, DEFAULTS, sanitizePrefs, promptFor, suggest, catalog, formatOf, ENGAGEMENT_RULES };
