import type { StructuredFormsState } from './StructuredBriefForms';
import type { GeneratedVariation } from './OutputWorkspace';
import type { CategoryType } from './CategoryNav';
import type { BrandContext } from './BrandContextBanner';

export function buildHeroImagePrompt(formsState: StructuredFormsState): string {
  const b = formsState.heroBriefForm;
  const lines = [
    b.focalSubject ? `Subject: ${b.focalSubject}.` : '',
    b.aesthetic ? `Art direction: ${b.aesthetic}.` : '',
    b.lightingMood ? `Lighting: ${b.lightingMood}.` : '',
    b.composition ? `Composition: ${b.composition}.` : '',
    b.colorPalette ? `Color palette: ${b.colorPalette}.` : '',
    b.materials ? `Materials: ${b.materials}.` : '',
    b.cameraDirection ? `Camera: ${b.cameraDirection}.` : '',
    b.additionalConstraints ? `Constraints: ${b.additionalConstraints}.` : '',
  ].filter(Boolean);
  return lines.join(' ');
}

/** Merges campaign topic + AI visual direction (preferred) + optional form fields. */
export function composeAdImagePrompt(input: {
  topic: string;
  product: string;
  audience?: string;
  aiVisualDirection?: string;
  formPrompt?: string;
}): string {
  const direction = (input.aiVisualDirection || input.formPrompt || '').trim();
  return [
    'Single photorealistic frame for a paid social ad. Aspect ratio 16:9 landscape.',
    input.product ? `Business / brand: ${input.product}.` : '',
    input.topic ? `Campaign: ${input.topic}.` : '',
    input.audience ? `Target audience: ${input.audience}.` : '',
    direction ? `Render this scene accurately (highest priority):\n${direction}` : '',
    'Premium advertising photography, coherent perspective, realistic materials and lighting.',
    'Leave uncluttered space for headline text if the scene is an interior or desk setup.',
    'No text or slogans rendered in the image (headlines go in the post caption only).',
    'If a monitor appears, show abstract data viz only — no readable brand names on screen.',
    'No watermarks, no UI chrome, no misspelled typography overlays.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildHeroBriefCopy(formsState: StructuredFormsState): string {
  const b = formsState.heroBriefForm;
  return `[CREATIVE ART DIRECTION BRIEF · ${(b.deliverable || 'Hero visual').toUpperCase()}]
Aesthetic Paradigm: ${b.aesthetic || '—'}
Format: ${b.aspectRatio || '16:9 Landscape'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CONCEPT & FOCAL SUBJECT
${b.focalSubject || '—'}

2. LIGHTING & ATMOSPHERE
${b.lightingMood || '—'}

3. COLOR PALETTE
${b.colorPalette || '—'}

4. COMPOSITION & SAFE MARGINS
${b.composition || '—'}

5. MATERIALS & CONSTRAINTS
${b.materials || '—'}
${b.additionalConstraints ? `\n${b.additionalConstraints}` : ''}`;
}

export function buildVisualBriefVariations(
  category: CategoryType,
  formsState: StructuredFormsState,
  count: number,
  brand: BrandContext
): GeneratedVariation[] {
  const imagePrompt = buildHeroImagePrompt(formsState);
  const content = buildHeroBriefCopy(formsState);
  const brandLine = brand.productName ? `\n\nBrand / product context: ${brand.productName}.` : '';

  const list: GeneratedVariation[] = [
    {
      id: `var-${Date.now()}-1`,
      versionLabel: 'VERSION 01 — HERO BRIEF',
      imagePrompt,
      content: content + brandLine,
    },
  ];

  if (count >= 2) {
    list.push({
      id: `var-${Date.now()}-2`,
      versionLabel: 'VERSION 02 — ALT COMPOSITION',
      imagePrompt: `${imagePrompt} Alternate angle: wider shot, emphasize negative space for ad headline.`,
      content: content + '\n\n[Variation 02: Wider framing for paid social crop tests.]' + brandLine,
    });
  }
  if (count >= 3) {
    list.push({
      id: `var-${Date.now()}-3`,
      versionLabel: 'VERSION 03 — MACRO DETAIL',
      imagePrompt: `${imagePrompt} Macro detail shot of materials and CRM graph element, shallow depth of field.`,
      content: content + '\n\n[Variation 03: Macro detail for carousel slide 2.]' + brandLine,
    });
  }

  if (category === 'Product Render') {
    list[0].versionLabel = 'VERSION 01 — PRODUCT RENDER';
    list[0].imagePrompt = `Macro studio product photography. ${imagePrompt}`;
  }
  if (category === 'Brand Specimen') {
    list[0].versionLabel = 'VERSION 01 — BRAND SPECIMEN';
    list[0].imagePrompt = `Editorial brand specimen layout on paper or board. ${imagePrompt}`;
  }

  return list.slice(0, Math.max(1, count));
}
