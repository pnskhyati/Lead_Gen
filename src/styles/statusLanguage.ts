/**
 * Unified Status Language Token System
 * Based on the visual tokens and component foundations specification:
 * 
 * Lead label       | Visual family               | Meaning to preserve
 * ---------------- | --------------------------- | -------------------------------------
 * Hot              | Pink or red with readable   | High intent; not a system error
 * Qualified        | Cyan                        | Meets the qualification criteria
 * Warm / Nurture   | Amber / slate               | Engaged / requires continued nurturing
 * Converted / Lost | Green / muted red           | Completed conversion / closed opportunity
 *
 * Keep lifecycle state, intent score and error severity separate.
 * Render existing domain values with one shared status mapping.
 */

export interface StatusVisualDefinition {
  label: string;
  badgeClass: string;
  dotClass: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
}

export function getLeadStageVisual(stage: string): StatusVisualDefinition {
  const normalized = (stage || '').toLowerCase().trim();

  // Qualified
  if (normalized.includes('qualif')) {
    return {
      label: stage,
      badgeClass: 'status-badge-qualified border text-[11px] font-medium font-mono',
      dotClass: 'bg-[var(--status-qualified)]',
      textClass: 'text-[var(--status-qualified)]',
      borderClass: 'border-[var(--status-qualified-border)]',
      bgClass: 'bg-[var(--status-qualified-bg)]'
    };
  }

  // Converted / Won / Deal closed
  if (normalized.includes('won') || normalized.includes('convert') || (normalized.includes('closed') && !normalized.includes('lost'))) {
    return {
      label: stage,
      badgeClass: 'status-badge-converted border text-[11px] font-medium font-mono',
      dotClass: 'bg-[var(--status-converted)]',
      textClass: 'text-[var(--status-converted)]',
      borderClass: 'border-[var(--status-converted-border)]',
      bgClass: 'bg-[var(--status-converted-bg)]'
    };
  }

  // Lost
  if (normalized.includes('lost')) {
    return {
      label: stage,
      badgeClass: 'status-badge-lost border text-[11px] font-medium font-mono',
      dotClass: 'bg-[var(--status-lost)]',
      textClass: 'text-[var(--status-lost)]',
      borderClass: 'border-[var(--status-lost-border)]',
      bgClass: 'bg-[var(--status-lost-bg)]'
    };
  }

  // Warm / Nurture: Engaged, Proposal, Contacted, Negotiation, Offer sent
  if (normalized.includes('engage') || normalized.includes('propos') || normalized.includes('negotiat') || normalized.includes('offer')) {
    return {
      label: stage,
      badgeClass: 'status-badge-warm border text-[11px] font-medium font-mono',
      dotClass: 'bg-[var(--status-warm)]',
      textClass: 'text-[var(--status-warm)]',
      borderClass: 'border-[var(--status-warm-border)]',
      bgClass: 'bg-[var(--status-warm-bg)]'
    };
  }

  // Slate / Nurture fallback (New, Contacted, default)
  return {
    label: stage || 'New',
    badgeClass: 'status-badge-nurture border text-[11px] font-medium font-mono',
    dotClass: 'bg-[var(--status-nurture)]',
    textClass: 'text-[var(--status-nurture)]',
    borderClass: 'border-[var(--status-nurture-border)]',
    bgClass: 'bg-[var(--status-nurture-bg)]'
  };
}

export function getTemperatureVisual(temperature: 'HOT' | 'WARM' | 'COLD' | string): StatusVisualDefinition {
  const norm = (temperature || '').toUpperCase();

  if (norm === 'HOT') {
    return {
      label: 'HOT',
      badgeClass: 'status-badge-hot border text-[11px] font-medium font-mono',
      dotClass: 'bg-[var(--status-hot)]',
      textClass: 'text-[var(--status-hot)]',
      borderClass: 'border-[var(--status-hot-border)]',
      bgClass: 'bg-[var(--status-hot-bg)]'
    };
  }

  if (norm === 'WARM') {
    return {
      label: 'WARM',
      badgeClass: 'status-badge-warm border text-[11px] font-medium font-mono',
      dotClass: 'bg-[var(--status-warm)]',
      textClass: 'text-[var(--status-warm)]',
      borderClass: 'border-[var(--status-warm-border)]',
      bgClass: 'bg-[var(--status-warm-bg)]'
    };
  }

  return {
    label: 'COLD',
    badgeClass: 'status-badge-nurture border text-[11px] font-medium font-mono',
    dotClass: 'bg-[var(--status-nurture)]',
    textClass: 'text-[var(--status-nurture)]',
    borderClass: 'border-[var(--status-nurture-border)]',
    bgClass: 'bg-[var(--status-nurture-bg)]'
  };
}
