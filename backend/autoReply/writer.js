/**
 * Decides what to do with one public comment or mention, and writes the reply.
 * Rules first (spam, links, emoji-only are never answered), then the model for the judgement calls.
 * The model only sees the business's approved facts, and every reply is cleaned before it can be sent.
 */
const { Type } = require('@google/genai');

const LIMITS = { instagram: 220, facebook: 320, x: 230, linkedin: 400 };

const SPAM_RE = /\b(earn \$?\d|make money|crypto|forex|bitcoin|click (the )?link|link in bio|follow (me|back)|f4f|l4l|giveaway|whatsapp me|telegram|investment|promo)\b/i;
const ABUSE_RE = /\b(fuck|shit|bitch|bastard|idiot|stupid|scam|fraud|hate you|piss off)\b/i;
const URL_RE = /(https?:\/\/|www\.)\S+/i;

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Things we never answer, with the reason shown to the owner. Returns null when the text is fine to consider. */
function prefilter(text) {
  const t = String(text || '').trim();
  if (!/[a-z0-9À-￿]/i.test(t.replace(/[@#]\S+/g, ''))) return 'Only an emoji, tag or mention';
  if (t.replace(/[@#]\S+/g, '').replace(/[^\p{L}\p{N}]/gu, '').length < 3) return 'Too short to answer';
  if (URL_RE.test(t)) return 'Contains a link (likely spam)';
  if (SPAM_RE.test(t)) return 'Looks like spam';
  if (ABUSE_RE.test(t)) return 'Abusive or hostile, left alone';
  return null;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING },
    intent: { type: Type.STRING },
    reply: { type: Type.STRING },
    reason: { type: Type.STRING },
  },
  required: ['action', 'intent', 'reply', 'reason'],
};

function domainOf(url) {
  try {
    return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Make a reply safe to post: no hashtags, no mentions, no foreign links, within the platform limit. */
function cleanReply(text, platform, website = '') {
  const own = domainOf(website);
  let t = String(text || '')
    .replace(/[#@]\S+/g, '')
    .replace(/(https?:\/\/\S+|www\.\S+)/gi, (u) => (own && domainOf(u) === own ? u : ''))
    .replace(/\s+/g, ' ')
    .trim();
  const max = LIMITS[platform] || 220;
  if (t.length > max) {
    const cut = t.slice(0, max - 1);
    t = `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40))}…`.replace(/[,;:\s]+…$/, '…');
  }
  return t;
}

async function gatherFacts(text, ws) {
  try {
    const found = await require('../rag').search(text, { topK: 5, ws, verify: false });
    const useful = found.grounded ? found.chunks : found.chunks.filter((c) => c.id === 'company-facts');
    return useful.map((c) => clip(c.text, 600)).join('\n- ');
  } catch {
    return '';
  }
}

/**
 * @returns {{action: 'reply'|'skip'|'handoff', intent: string, text: string, reason: string}}
 */
async function decide(vertex, { platform, text, author, context }, { profile, ws }) {
  const blocked = prefilter(text);
  if (blocked) return { action: 'skip', intent: 'other', text: '', reason: blocked };
  if (!vertex?.generateJson) return { action: 'skip', intent: 'other', text: '', reason: 'The AI assistant is not available' };

  const facts = await gatherFacts(text, ws);
  const brand = [
    `Business: ${profile.companyName || 'the business'}`,
    profile.industry && `Industry: ${profile.industry}`,
    profile.productsFocus && `Offers: ${clip(profile.productsFocus, 700)}`,
    profile.websiteUrl && `Website: ${profile.websiteUrl}`,
    profile.businessHours && `Hours: ${profile.businessHours}`,
    profile.voiceTone && `Tone: ${profile.voiceTone}`,
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `A person left this public ${platform === 'x' ? 'mention' : 'comment'} on ${profile.companyName || 'our'}'s ${platform} account. Decide what to do and, if replying, write the public reply.

${context ? `THE POST IT IS ON: ${clip(context, 300)}\n` : ''}COMMENT by ${clip(author, 40) || 'a user'}: "${clip(text, 600)}"

BUSINESS
${brand}

APPROVED FACTS (the only facts you may state):
${facts ? `- ${facts}` : '(none found)'}

Choose action:
- "reply": praise or thanks (short, warm); a question you can answer from APPROVED FACTS (answer briefly); or interest in buying or pricing (be helpful, then invite them to send a direct message or visit the website if one is listed).
- "handoff": a complaint, refund, legal, safety, privacy or anything sensitive. Write NO reply; a person will handle it.
- "skip": trolling, spam, an ad, off-topic, abuse, or anything not worth answering publicly.

intent is one of: praise, question, interest, pricing, buying, complaint, other.
"interest" means the person talks about their own business problem or need that the company could help with (for example describing a pain point or asking how something would work for them), even without asking to buy. That is a potential customer.
Reply rules: ${platform} comment, under ${LIMITS[platform] || 220} characters, plain friendly words like a real person, one emoji at most (none for x). No hashtags, no @mentions, no links except the business website. Never invent prices, dates, numbers, offers or promises. If the facts do not cover the question, say you will gladly help by direct message instead of guessing. Do not start with "Thanks for your comment". Do not claim to be human or AI.
"reason" is one short plain sentence for the owner explaining your choice. Leave "reply" empty unless action is "reply".`;

  let out;
  try {
    out = await vertex.generateJson(prompt, SCHEMA, 'You manage a business social media account. You are careful, honest and brief. Return JSON only.', { thinkingLevel: 'LOW' });
  } catch (err) {
    return { action: 'skip', intent: 'other', text: '', reason: `Could not draft a reply: ${err.message}` };
  }

  const action = ['reply', 'skip', 'handoff'].includes(out?.action) ? out.action : 'skip';
  const intent = ['praise', 'question', 'interest', 'pricing', 'buying', 'complaint', 'other'].includes(out?.intent) ? out.intent : 'other';
  const reason = clip(out?.reason, 200) || (action === 'reply' ? 'A helpful reply' : 'Not answered publicly');
  if (action !== 'reply') return { action, intent, text: '', reason };

  const reply = cleanReply(out.reply, platform, profile.websiteUrl);
  if (reply.length < 3) return { action: 'skip', intent, text: '', reason: 'No usable reply was written' };
  return { action: 'reply', intent, text: reply, reason };
}

module.exports = { decide, prefilter, cleanReply, LIMITS };
