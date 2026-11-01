/**
 * Optional AI layer — only expands verified/heuristic recommendations; never invents crawl facts.
 */
const { rec } = require('./rules');
const { computePriorityScore, scoreToPriority, effortLabel } = require('./scoring');

async function enrichWithContentAi(vertex, { profile, combined, existingRecommendations }) {
  if (!vertex?.generateJson) return [];

  const geoIssues = (existingRecommendations || []).filter(
    (r) => r.category === 'geo' && r.status !== 'verified' && r.status !== 'dismissed'
  );
  if (!geoIssues.length) return [];

  const { Type } = require('@google/genai');
  const schema = {
    type: Type.OBJECT,
    properties: {
      suggestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            recommendedAction: { type: Type.STRING },
            verificationMethod: { type: Type.STRING },
            customerQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'recommendedAction', 'verificationMethod'],
        },
      },
    },
    required: ['suggestions'],
  };

  const prompt = `You are a senior SEO/GEO content strategist. You must NOT invent technical audit results.

Given these ALREADY DETECTED issues (JSON):
${JSON.stringify(
  geoIssues.map((r) => ({ id: r.id, title: r.title, evidence: r.evidence })),
  null,
  2
)}

Company: ${profile.companyName || 'Unknown'}
Industry: ${profile.industry || 'n/a'}
Products/focus: ${profile.productsFocus || 'n/a'}

Knowledge excerpt (truncated):
${String(combined).slice(0, 6000)}

Return up to 2 practical content suggestions that help answer customer questions clearly for search and AI assistants.
Do not claim rankings or AI citation rates. Tie each suggestion to the detected issues above.`;

  try {
    const parsed = await vertex.generateJson(
      prompt,
      schema,
      'Return JSON only. No fabricated metrics or audit claims.'
    );
    const suggestions = parsed?.suggestions || [];
    return suggestions.slice(0, 2).map((s, i) => {
      const factors = { impact: 68, severity: 55, confidence: 55, urgency: 45, effort: 55 };
      const score = computePriorityScore(factors);
      return rec({
        id: `geo-ai-suggestion-${i + 1}-${Date.now()}`,
        category: 'geo',
        confirmationLevel: 'heuristic',
        factors,
        title: s.title,
        evidence: [
          'AI suggestion based on detected GEO issues and approved knowledge — not a crawl finding.',
          ...(s.customerQuestions || []).slice(0, 3).map((q) => `Question to cover: ${q}`),
        ],
        businessImpact: 'Clear answers improve usefulness for generative search experiences.',
        recommendedAction: s.recommendedAction,
        verificationMethod: s.verificationMethod,
        status: 'needs_verification',
        priority: scoreToPriority(score),
        score,
        effort: effortLabel(factors.effort),
      });
    });
  } catch (err) {
    console.warn('[SEO/GEO] content AI skipped:', err.message);
    return [];
  }
}

module.exports = { enrichWithContentAi };
