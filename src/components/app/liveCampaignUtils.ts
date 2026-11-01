import type { CampaignBlueprint, CampaignKPI, ContentPlanItem, RoadmapPhase } from '../../types';
import type { CampaignPlan } from '../../legacy/types';
import { generateBlueprintFromForm, type CampaignFormData } from '../../data/campaignBlueprintGenerator';

const PHASE_NAMES: RoadmapPhase['name'][] = [
  'DISCOVERY',
  'STRATEGY',
  'CONTENT CREATION',
  'PRE-LAUNCH',
  'LAUNCH',
  'OPTIMIZATION',
  'ANALYSIS',
];

/** Merge Vertex campaign-plan output into the shell blueprint shape. */
export function blueprintFromLivePlan(form: CampaignFormData, plan: CampaignPlan): CampaignBlueprint {
  const base = generateBlueprintFromForm(form);
  const personaSummary = (plan.personas || [])
    .map((p) => `${p.name}: ${p.description || ''}`.trim())
    .filter(Boolean)
    .join(' · ');

  const pillars = (plan.messagingPillars || [])
    .map((p) => [p.pillar, p.description].filter(Boolean).join(' — '))
    .filter(Boolean);

  const roadmap: RoadmapPhase[] = (plan.rolloutPlan || []).slice(0, 7).map((phase, idx) => {
    const platforms = (phase.platforms || []).map((p) => p.platform).filter(Boolean);
    const ideas = (phase.platforms || []).flatMap((p) => p.contentIdeas || []).slice(0, 6);
    return {
      id: `phase-live-${idx + 1}`,
      name: PHASE_NAMES[idx] || 'LAUNCH',
      objective: phase.objective || phase.phase || `Phase ${idx + 1}`,
      tasks: ideas.length
        ? ideas
        : [`Execute ${phase.phase || 'rollout'} on ${platforms.join(', ') || 'selected channels'}`],
      deliverables: platforms.length ? platforms.map((p) => `${p} assets`) : ['Channel kit'],
      suggestedTimeline: phase.duration || `${idx + 1} week`,
      responsible: 'Marketing + AI',
    };
  });

  const contentPlan: ContentPlanItem[] = (plan.rolloutPlan || [])
    .flatMap((phase, pi) =>
      (phase.platforms || []).flatMap((plat, i) =>
        (plat.contentIdeas || []).slice(0, 2).map((idea, j) => ({
          id: `cp-${pi}-${i}-${j}`,
          contentType: 'Social / editorial',
          platform: plat.platform || 'Multi',
          purpose: idea,
          timing: phase.duration || phase.phase || 'During campaign',
          cta: form.primaryGoal || 'Learn more',
        }))
      )
    )
    .slice(0, 12);

  const kpis: CampaignKPI[] = (plan.kpis || []).map((k, i) => ({
    id: `kpi-${i}`,
    name: k,
    target: 'Track in Analytics',
    current: '—',
  }));

  const channelsFromPlan = Array.from(
    new Set(
      (plan.rolloutPlan || []).flatMap((ph) => (ph.platforms || []).map((p) => p.platform)).filter(Boolean)
    )
  );

  return {
    ...base,
    campaignName: plan.campaignTitle || form.name || base.campaignName,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    overview: {
      ...base.overview,
      objective: plan.slogan || form.primaryGoal || base.overview.objective,
      targetAudience: personaSummary || base.overview.targetAudience,
      primaryChannels: channelsFromPlan.length ? channelsFromPlan : base.overview.primaryChannels,
      successMetrics: kpis.length ? kpis.map((k) => k.name) : base.overview.successMetrics,
    },
    strategy: {
      ...base.strategy,
      coreObjective: plan.slogan || base.strategy.coreObjective,
      keyMessage: pillars[0] || base.strategy.keyMessage,
      campaignAngle: pillars.slice(0, 3).join(' · ') || base.strategy.campaignAngle,
      positioning: plan.slogan || base.strategy.positioning,
      audienceStrategy: personaSummary || base.strategy.audienceStrategy,
    },
    roadmap: roadmap.length ? roadmap : base.roadmap,
    contentPlan: contentPlan.length ? contentPlan : base.contentPlan,
    socialPlan: {
      ...base.socialPlan,
      contentThemes: pillars.length ? pillars : base.socialPlan.contentThemes,
      postIdeas: contentPlan.map((c) => c.purpose).slice(0, 8),
    },
    kpis: kpis.length ? kpis : base.kpis,
  };
}

export function buildCampaignBrief(form: CampaignFormData, companyName?: string): string {
  return [
    `Company: ${companyName || form.name}`,
    `Campaign name: ${form.name}`,
    `Type: ${form.type}`,
    `Goal: ${form.primaryGoal}`,
    `Description: ${form.description}`,
    `Audience: ${form.audienceType} — ${form.audienceDescription}`,
    `Industry: ${form.industry}; Location: ${form.location}; Ages: ${form.ageRange}`,
    `Interests: ${form.interests}; Occupation: ${form.occupation}`,
    `Budget: ${form.budgetType} ${form.budgetAmount}`,
    `Timeline: ${form.startDate} → ${form.endDate}`,
    `Channels: ${form.channels.join(', ')}`,
    `Brand voice: ${form.brandVoice}; Visual: ${form.visualStyle}`,
    `Measurable goals: ${form.measurableGoals.join('; ')}`,
    form.additionalInstructions ? `Extra: ${form.additionalInstructions}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
