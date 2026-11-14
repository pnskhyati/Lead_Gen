/**
 * What each platform allows, and how a post will actually be assembled when published.
 * Validation here is what stops a post from being approved if it would fail or be cut off on the platform.
 */

const PLATFORMS = ['linkedin', 'instagram', 'facebook', 'x'];

const RULES = {
  linkedin: {
    label: 'LinkedIn',
    maxChars: 3000,
    maxHashtags: 5,
    image: 'optional',
    style:
      'Professional, insight-led. A strong first line (it is all that shows before "see more"), short paragraphs separated by blank lines, ' +
      'a concrete takeaway or example, and a closing question or call to action. 120-220 words. At most 3-5 hashtags, at the end. No emoji spam (0-2).',
  },
  instagram: {
    label: 'Instagram',
    maxChars: 2200,
    maxHashtags: 12,
    image: 'required',
    style:
      'Visual-first caption. A scroll-stopping first line, then 2-4 short lines with line breaks, friendly and human, a clear call to action ' +
      '(save, share, DM, book). 40-120 words. 5-10 relevant hashtags at the end. A few fitting emoji are fine.',
  },
  facebook: {
    label: 'Facebook',
    maxChars: 5000,
    maxHashtags: 3,
    image: 'optional',
    style:
      'Warm, conversational, community-oriented. 40-100 words, plain language, a question or invitation to respond or visit. 0-3 hashtags. 0-2 emoji.',
  },
  x: {
    label: 'X',
    maxChars: 280,
    maxHashtags: 2,
    image: 'optional',
    style:
      'One punchy post that stands alone, ABSOLUTELY under 250 characters including hashtags. Direct hook, one idea, optional 1-2 hashtags. No threads.',
  },
};

const normalize = (p) => {
  const k = String(p || '').toLowerCase();
  return k === 'twitter' ? 'x' : k;
};

const isSupported = (p) => PLATFORMS.includes(normalize(p));
const rulesFor = (p) => RULES[normalize(p)];

const hashtagText = (tags) =>
  (tags || [])
    .map((t) => String(t).trim().replace(/^#+/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(' ');

/** The exact text that will be sent to the platform (matches how publishers.js assembles captions). */
function finalText(post) {
  return [post.text, hashtagText(post.hashtags)].filter(Boolean).join('\n\n').trim();
}

/** Cut at a sentence/word boundary so nothing ends mid-word. */
function trimToLimit(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('\n'));
  const base = sentence > max * 0.6 ? cut.slice(0, sentence + 1) : cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max - 1);
  return `${base.trim()}${sentence > max * 0.6 ? '' : '…'}`;
}

/** Make a draft fit its platform: normalise hashtags and shorten the text only if it must be. */
function fitToPlatform(platform, post) {
  const rules = rulesFor(platform);
  const tags = (post.hashtags || [])
    .map((t) => String(t).trim().replace(/^#+/, '').replace(/\s+/g, ''))
    .filter(Boolean)
    .slice(0, rules.maxHashtags);
  let text = String(post.text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const tagLen = tags.length ? hashtagText(tags).length + 2 : 0;
  text = trimToLimit(text, rules.maxChars - tagLen);
  return { ...post, text, hashtags: tags };
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Does the text mention this calendar date ("15 November", "Nov 15", "15th Nov")? */
function mentionsDate(text, ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return false;
  const day = Number(m[3]);
  const mon = MONTHS[Number(m[2]) - 1];
  const full = new RegExp(`\\b${day}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${mon}[a-z]*\\b|\\b${mon}[a-z]*\\.?\\s+${day}(?:st|nd|rd|th)?\\b`, 'i');
  return full.test(String(text || ''));
}

const URGENCY_WORDS = /\b(today|tonight|last day|final day|final call|ends? (?:today|tonight)|hurry)\b/i;

/**
 * Problems that would stop (error) or degrade (warning) a post.
 * @param {object} post
 * @param {{ connected?: Record<string, boolean>, now?: number }} ctx
 */
function validatePost(post, { connected = {}, now = Date.now() } = {}) {
  const issues = [];
  const platform = normalize(post.platform);
  const rules = rulesFor(platform);
  if (!rules) return [{ code: 'platform', severity: 'error', message: `Unsupported platform "${post.platform}"` }];

  const text = String(post.text || '').trim();
  if (!text) issues.push({ code: 'empty', severity: 'error', message: 'The post has no text.' });
  const len = finalText({ ...post, platform }).length;
  if (len > rules.maxChars) {
    issues.push({ code: 'too_long', severity: 'error', message: `${rules.label} allows ${rules.maxChars} characters; this post is ${len}.` });
  }
  if ((post.hashtags || []).length > rules.maxHashtags) {
    issues.push({ code: 'hashtags', severity: 'warning', message: `${rules.label} works best with at most ${rules.maxHashtags} hashtags.` });
  }
  if (rules.image === 'required' && !post.image) {
    issues.push({ code: 'image_required', severity: 'error', message: `${rules.label} posts need an image. Generate or upload one.` });
  }
  if (connected && platform in connected && !connected[platform]) {
    issues.push({ code: 'not_connected', severity: 'error', message: `${rules.label} is not connected. Connect it in Channels before approving.` });
  }
  // A time-limited offer must not be promoted after it ends, nor described as "today" on the wrong day.
  if (post.offerEndDate && post.dayKey) {
    if (post.dayKey > post.offerEndDate && mentionsDate(text, post.offerEndDate)) {
      issues.push({ code: 'offer_expired', severity: 'error', message: `This post mentions an offer that ended on ${post.offerEndDate}, before the post goes out. Edit it or move it earlier.` });
    } else if (post.dayKey !== post.offerEndDate && URGENCY_WORDS.test(text) && /offer|free|until|discount/i.test(text)) {
      issues.push({ code: 'offer_timing', severity: 'warning', message: `This post uses "today / last day" wording, but the offer ends on ${post.offerEndDate}. Check the wording fits the posting date.` });
    }
  }
  const at = new Date(post.scheduledAt).getTime();
  if (!Number.isFinite(at)) issues.push({ code: 'time', severity: 'error', message: 'The post has no valid schedule time.' });
  else if (at < now + 2 * 60_000) issues.push({ code: 'past', severity: 'error', message: 'The scheduled time is in the past.' });
  return issues;
}

module.exports = { PLATFORMS, RULES, mentionsDate, normalize, isSupported, rulesFor, finalText, hashtagText, fitToPlatform, validatePost, trimToLimit };
