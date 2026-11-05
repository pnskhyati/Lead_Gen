import type { TopicSocialPost } from '../../../legacy/services/geminiService';

export type TopicSocialPackMeta = {
  topicSummary?: string;
  nicheAudience?: string;
};

/** Strategy / format notes — not pasted into the scheduler. */
export function formatTopicSocialMeta(
  post: TopicSocialPost,
  meta: TopicSocialPackMeta,
  index: number
): string {
  return [
    `[${post.platform.toUpperCase()} · ${post.viralFormat}]`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    index === 0 && meta.topicSummary ? `Topic: ${meta.topicSummary}` : '',
    index === 0 && meta.nicheAudience ? `Niche audience: ${meta.nicheAudience}` : '',
    post.whyThisFormat ? `Why this layout: ${post.whyThisFormat}` : '',
    post.aspectRatio ? `Recommended aspect: ${post.aspectRatio}` : '',
    post.imagePrompt ? `Visual / asset direction:\n${post.imagePrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function platformKey(platform: string): 'x' | 'instagram' | 'other' {
  const p = platform.toLowerCase();
  if (p.includes('twitter') || p === 'x' || p.startsWith('x ')) return 'x';
  if (p.includes('instagram') || p.includes('threads')) return 'instagram';
  return 'other';
}

/** Client-side fallback if API returned legacy "Slide N:" copy. */
export function normalizeTopicSocialPostContent(platform: string, rawContent: string): string {
  let content = String(rawContent || '').trim();
  if (!content) return content;

  const slideBlocks = content.split(/\n(?=Slide\s+\d+\s*[:：])/i).filter((s) => s.trim());
  const hasSlideLabels = slideBlocks.length > 1 || /^Slide\s+\d+\s*[:：]/i.test(content);
  if (!hasSlideLabels) return content;

  const bodies = slideBlocks.map((block) =>
    block
      .replace(/^Slide\s+\d+\s*[:：]\s*/i, '')
      .replace(/\n\n(?:#[\w\u00C0-\u024F]+(?:\s+#[\w\u00C0-\u024F]+)*)\s*$/u, '')
      .trim()
  ).filter(Boolean);

  if (platformKey(platform) === 'x') {
    const total = bodies.length;
    return bodies
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
  }

  if (platformKey(platform) === 'instagram') {
    const hook = bodies[0] || '';
    return [
      'Caption:',
      bodies.length > 1
        ? `${hook}\n\nSwipe for more — save if useful.`
        : hook,
      '',
      'Cards:',
      ...bodies.map((text, i) => `${i + 1}. ${text}`),
    ].join('\n');
  }

  return content;
}

/** Copy-paste / schedule queue body — post + hashtags only. */
export function formatTopicSocialPostReady(post: TopicSocialPost): string {
  const body = normalizeTopicSocialPostContent(post.platform, String(post.content || '')).trim();
  const tags = (post.hashtags || [])
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
    .filter(Boolean);
  if (!tags.length) return body;
  const key = platformKey(post.platform);
  if (key === 'x') {
    return `${body}\n\n— Hashtags (use on last tweet or reply) —\n${tags.join(' ')}`;
  }
  if (key === 'instagram' && body.includes('Cards:')) {
    return `${body}\n\n— Hashtags (caption or first comment) —\n${tags.join(' ')}`;
  }
  return `${body}\n\n${tags.join(' ')}`;
}

export function mapTopicSocialToVariation(
  post: TopicSocialPost,
  pack: TopicSocialPackMeta,
  index: number,
  extras?: { imagePrompt?: string; imageUrl?: string; carouselImagePrompts?: string[] }
) {
  const content = formatTopicSocialPostReady(post);
  return {
    id: `live-${Date.now()}-${index}`,
    versionLabel: `${post.platform.toUpperCase()} · ${post.viralFormat}`,
    platform: post.platform,
    metaBrief: formatTopicSocialMeta(post, pack, index),
    content,
    imagePrompt: extras?.imagePrompt ?? post.imagePrompt,
    carouselImagePrompts: extras?.carouselImagePrompts ?? post.carouselImagePrompts,
    imageUrl: extras?.imageUrl,
  };
}

/** Social Hub draft: meta per platform, then clearly separated post text. */
export function formatTopicSocialPackForSchedule(
  posts: TopicSocialPost[],
  packMeta: TopicSocialPackMeta,
  platformLabels?: string[]
): string {
  return posts
    .map((post, i) => {
      const label = platformLabels?.[i] || post.platform;
      const meta = formatTopicSocialMeta(post, packMeta, i);
      const postBody = formatTopicSocialPostReady(post);
      return `=== ${label} ===\n\n${meta}\n\n— Post (copy for schedule) —\n\n${postBody}`;
    })
    .join('\n\n');
}
