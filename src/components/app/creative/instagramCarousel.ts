import { composeAdImagePrompt } from './visualBriefBuilder';

export function isInstagramPlatform(platform: string): boolean {
  const p = platform.toLowerCase();
  return p.includes('instagram') || p.includes('threads');
}

/** Parse numbered lines under a "Cards:" section (post-normalized IG copy). */
export function parseInstagramCards(content: string): string[] {
  const text = String(content || '');
  const cardsMatch = text.match(
    /Cards:\s*([\s\S]*?)(?:\n\n— Hashtags|\n\n#[\w\u00C0-\u024F]|$)/i
  );
  if (!cardsMatch) return [];

  const block = cardsMatch[1].trim();
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  const cards: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+\.\s*(.+)$/);
    if (m) cards.push(m[1].trim());
  }
  return cards;
}

export function isInstagramCarouselContent(content: string): boolean {
  return parseInstagramCards(content).length >= 2;
}

export function composeInstagramCarouselSlidePrompt(input: {
  topic: string;
  product: string;
  audience?: string;
  aiVisualDirection?: string;
  cardIndex: number;
  cardTotal: number;
  cardMessage: string;
}): string {
  const series = (input.aiVisualDirection || '').trim();
  const base = composeAdImagePrompt({
    topic: input.topic,
    product: input.product,
    audience: input.audience,
    aiVisualDirection: [
      `Instagram carousel frame ${input.cardIndex} of ${input.cardTotal}. Vertical 4:5 portrait for mobile feed.`,
      series ? `Series art direction: ${series}` : '',
      `Visual story for this slide (do NOT render this copy as text in the image): ${input.cardMessage}`,
      'Consistent setting across slides (same clinic/brand environment, cohesive color grade).',
      'Generous clean margin for text overlay in Canva; scene tells the story without typography.',
    ]
      .filter(Boolean)
      .join('\n'),
  });
  return base.replace('Aspect ratio 16:9 landscape', 'Aspect ratio 4:5 vertical portrait');
}

export function buildInstagramCarouselPrompts(
  content: string,
  opts: {
    topic: string;
    product: string;
    audience?: string;
    aiVisualDirection?: string;
    fromModel?: string[];
  }
): string[] {
  const cards = parseInstagramCards(content);
  const fromModel = (opts.fromModel || []).map((p) => p.trim()).filter(Boolean);

  if (cards.length >= 2) {
    const total = cards.length;
    return cards.map((cardMessage, i) =>
      composeInstagramCarouselSlidePrompt({
        topic: opts.topic,
        product: opts.product,
        audience: opts.audience,
        aiVisualDirection: fromModel[i] || opts.aiVisualDirection,
        cardIndex: i + 1,
        cardTotal: total,
        cardMessage,
      })
    );
  }

  if (fromModel.length >= 2) {
    return fromModel.slice(0, 6).map((p, i) =>
      composeInstagramCarouselSlidePrompt({
        topic: opts.topic,
        product: opts.product,
        audience: opts.audience,
        aiVisualDirection: p,
        cardIndex: i + 1,
        cardTotal: fromModel.length,
        cardMessage: p.slice(0, 160),
      })
    );
  }

  return [];
}
