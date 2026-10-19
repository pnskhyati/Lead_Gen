/**
 * Competitor Social Intelligence Agent
 * 1) Research competitors' public social presence (Google Search grounding)
 * 2) Analyze themes / formats that get engagement
 * 3) Generate brand posts inspired by what works — in your voice
 */
const { Type } = require('@google/genai');
const agentAudit = require('./agentAudit');
const policyEngine = require('./policyEngine');

function brandContext() {
  try {
    const ck = require('./companyKnowledge');
    const p = ck.getProfile();
    return {
      companyName: p.companyName || 'Our company',
      industry: p.industry || '',
      tagline: p.tagline || '',
      voice: ck.buildVoiceInstruction() || '',
      products: (p.products || []).slice(0, 8),
    };
  } catch {
    return { companyName: 'Our company', industry: '', tagline: '', voice: '', products: [] };
  }
}

const socialIntelSchema = {
  type: Type.OBJECT,
  properties: {
    competitors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          profiles: {
            type: Type.OBJECT,
            properties: {
              instagram: { type: Type.STRING },
              linkedin: { type: Type.STRING },
              x: { type: Type.STRING },
              facebook: { type: Type.STRING },
              website: { type: Type.STRING },
            },
          },
          whyTheyCompete: { type: Type.STRING },
          contentThemes: { type: Type.ARRAY, items: { type: Type.STRING } },
          formatsThatWork: { type: Type.ARRAY, items: { type: Type.STRING } },
          toneAndHooks: { type: Type.ARRAY, items: { type: Type.STRING } },
          highEngagementPatterns: { type: Type.ARRAY, items: { type: Type.STRING } },
          postsPeopleLike: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                platform: { type: Type.STRING },
                summary: { type: Type.STRING },
                whyItWorks: { type: Type.STRING },
                engagementSignal: { type: Type.STRING },
              },
              required: ['platform', 'summary', 'whyItWorks', 'engagementSignal'],
            },
          },
          gapsWeCanExploit: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'name',
          'whyTheyCompete',
          'contentThemes',
          'formatsThatWork',
          'highEngagementPatterns',
          'postsPeopleLike',
          'gapsWeCanExploit',
        ],
      },
    },
    winningPatterns: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pattern: { type: Type.STRING },
          platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
          whyAudienceLikesIt: { type: Type.STRING },
          howWeAdapt: { type: Type.STRING },
        },
        required: ['pattern', 'platforms', 'whyAudienceLikesIt', 'howWeAdapt'],
      },
    },
    brandingRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    contentPillars: { type: Type.ARRAY, items: { type: Type.STRING } },
    marketGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    summary: { type: Type.STRING },
    researchNotes: { type: Type.STRING },
    dataConfidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
  },
  required: [
    'competitors',
    'winningPatterns',
    'brandingRecommendations',
    'contentPillars',
    'marketGaps',
    'summary',
    'researchNotes',
    'dataConfidence',
  ],
};

const contentPackSchema = {
  type: Type.OBJECT,
  properties: {
    brandingAngle: { type: Type.STRING },
    weeklyPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          platform: { type: Type.STRING },
          goal: { type: Type.STRING },
          hook: { type: Type.STRING },
          post: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          cta: { type: Type.STRING },
          inspiredByPattern: { type: Type.STRING },
        },
        required: ['day', 'platform', 'goal', 'hook', 'post', 'hashtags', 'cta', 'inspiredByPattern'],
      },
    },
    heroPosts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          platform: { type: Type.STRING },
          headline: { type: Type.STRING },
          body: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          cta: { type: Type.STRING },
          whyItShouldPerform: { type: Type.STRING },
        },
        required: ['platform', 'headline', 'body', 'hashtags', 'cta', 'whyItShouldPerform'],
      },
    },
  },
  required: ['brandingAngle', 'weeklyPlan', 'heroPosts'],
};

const rewriteSchema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    body: { type: Type.STRING },
    hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
    cta: { type: Type.STRING },
    whyBetter: { type: Type.STRING },
    competitorCounters: { type: Type.ARRAY, items: { type: Type.STRING } },
    inspiredByPattern: { type: Type.STRING },
    variants: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          angle: { type: Type.STRING },
          post: { type: Type.STRING },
        },
        required: ['angle', 'post'],
      },
    },
  },
  required: [
    'headline',
    'body',
    'hashtags',
    'cta',
    'whyBetter',
    'competitorCounters',
    'inspiredByPattern',
    'variants',
  ],
};

function parseKnownCompetitors(input) {
  if (Array.isArray(input.knownCompetitors)) {
    return input.knownCompetitors.map(String).filter(Boolean);
  }
  return String(input.competitorsText || '')
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSocialProfiles(input) {
  if (Array.isArray(input.socialProfiles)) return input.socialProfiles;
  const text = String(input.socialProfilesText || '').trim();
  if (!text) return [];
  // Lines like: Clove Dental | ig:@clovedental | li:linkedin.com/company/clove | x:@clove
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      const row = { name: parts[0] || 'Competitor' };
      for (const p of parts.slice(1)) {
        const lower = p.toLowerCase();
        if (lower.includes('instagram') || lower.startsWith('ig:')) row.instagram = p.replace(/^[^:]+:\s*/i, '');
        else if (lower.includes('linkedin') || lower.startsWith('li:')) row.linkedin = p.replace(/^[^:]+:\s*/i, '');
        else if (lower.startsWith('x:') || lower.includes('twitter')) row.x = p.replace(/^[^:]+:\s*/i, '');
        else if (lower.includes('facebook') || lower.startsWith('fb:')) row.facebook = p.replace(/^[^:]+:\s*/i, '');
        else if (lower.startsWith('http')) row.website = p;
      }
      return row;
    });
}

/**
 * Step 1: live web research via Google Search grounding (when Vertex allows it).
 */
async function researchSocialWeb(vertex, { company, industry, region, known, profiles, samplePosts }) {
  const profileBlock = profiles.length
    ? profiles
        .map(
          (p) =>
            `${p.name}: IG=${p.instagram || '?'} LI=${p.linkedin || '?'} X=${p.x || '?'} FB=${p.facebook || '?'}`
        )
        .join('\n')
    : 'none provided';

  const sampleBlock = String(samplePosts || '').trim()
    ? `\nUser-pasted competitor posts / captions to analyze:\n"""\n${String(samplePosts).slice(0, 12000)}\n"""\n`
    : '';

  const prompt = `Research public social media content for competitors of ${company} (${industry || 'industry'}${
    region ? `, ${region}` : ''
  }).

Known competitors: ${known.length ? known.join(', ') : 'discover relevant ones'}
Known social profiles:
${profileBlock}
${sampleBlock}

For Instagram, LinkedIn, X/Twitter, and Facebook where public info exists:
- What topics/formats get engagement (likes, comments, shares, saves)?
- Common hooks, CTAs, visual styles, posting cadence if mentioned
- Specific example posts or campaign themes people respond to
- Gaps our brand can own

Prefer recent public evidence. Cite competitor names and platforms clearly.
If exact like counts are unavailable, infer engagement patterns from public discussion / viral themes / platform norms and label confidence.`;

  try {
    const { text, response } = await vertex.generateText(prompt, {
      systemInstruction:
        'You are a social competitive intelligence researcher. Use Google Search to find public competitor social posts and engagement patterns. Be concrete. Do not invent exact metrics.',
      tools: [{ googleSearch: {} }],
    });
    const grounding = response?.candidates?.[0]?.groundingMetadata || null;
    return {
      researchText: text || '',
      grounding,
      usedSearch: true,
    };
  } catch (err) {
    console.warn('[CompetitorAgent] Google Search research failed, falling back:', err.message);
    // Fallback without search — still use samples + model knowledge
    const { text } = await vertex.generateText(prompt, {
      systemInstruction:
        'Social competitive researcher. Search unavailable — use provided samples and cautious general market knowledge. Label uncertainty.',
    });
    return { researchText: text || '', grounding: null, usedSearch: false };
  }
}

async function analyzeCompetitors(vertex, input = {}) {
  const brand = brandContext();
  const company = String(input.companyName || brand.companyName).trim();
  const industry = String(input.industry || brand.industry).trim();
  const region = String(input.region || '').trim();
  const known = parseKnownCompetitors(input);
  const profiles = parseSocialProfiles(input);
  const samplePosts = String(input.samplePosts || '').trim();

  const web = await researchSocialWeb(vertex, {
    company,
    industry,
    region,
    known,
    profiles,
    samplePosts,
  });

  const systemInstruction = `You are Tecavy Competitor Social Intelligence Agent.
Turn raw research into structured social insights for ${company}.
Focus on WHAT CONTENT PEOPLE ENGAGE WITH on Instagram, LinkedIn, X, Facebook — not just a competitor name list.
Never invent precise like counts. Prefer patterns, formats, hooks.
Brand voice for later adaptation:
${brand.voice || 'Clear, helpful, trustworthy.'}`;

  const prompt = `Structure this competitor SOCIAL media intelligence.

Company: ${company}
Industry: ${industry || 'n/a'}
Region: ${region || 'n/a'}
Products: ${JSON.stringify(brand.products)}
Known competitors: ${known.join(', ') || 'n/a'}
Profiles provided: ${JSON.stringify(profiles)}
Sample posts provided: ${samplePosts ? 'yes' : 'no'}
Web research usedSearch=${web.usedSearch}

RAW RESEARCH:
"""
${web.researchText.slice(0, 24000)}
"""

Return competitors with postsPeopleLike, highEngagementPatterns, winningPatterns across platforms, brandingRecommendations, and contentPillars.`;

  const data = await vertex.generateJson(prompt, socialIntelSchema, systemInstruction);

  agentAudit.appendAudit({
    action: 'competitor_social_analyze',
    resource_type: 'competitor_intel',
    agent_name: 'Competitor Social Intelligence',
    result: {
      summary: data.summary,
      competitor_count: (data.competitors || []).length,
      used_search: web.usedSearch,
      data_confidence: data.dataConfidence,
    },
  });

  return {
    ...data,
    company,
    industry,
    region,
    usedSearch: web.usedSearch,
    agent: 'competitor_social_intelligence',
  };
}

async function generateContentPack(vertex, input = {}) {
  const brand = brandContext();
  let intel = input.competitorIntel || null;
  if (!intel) {
    intel = await analyzeCompetitors(vertex, input);
  }

  const platforms = Array.isArray(input.platforms) && input.platforms.length
    ? input.platforms
    : ['Instagram', 'LinkedIn', 'Facebook'];

  const systemInstruction = `You are Tecavy Competitor Social Intelligence Agent — Content Generator.
Create posts for ${brand.companyName} inspired by competitor patterns that audiences like — but ORIGINAL and on-brand.
Do not copy competitor wording. Adapt winning patterns.
No invented prices or medical claims.
Voice:
${brand.voice || 'Friendly, professional, concise.'}`;

  const prompt = `Generate a social content pack.

Platforms: ${platforms.join(', ')}
Brand: ${brand.companyName} (${intel.industry || brand.industry})
Tagline: ${brand.tagline || 'n/a'}

Competitor summary: ${intel.summary}
Winning patterns: ${JSON.stringify(intel.winningPatterns || [])}
Content pillars: ${(intel.contentPillars || []).join('; ')}
Branding recommendations: ${(intel.brandingRecommendations || []).join('; ')}
Gaps: ${(intel.marketGaps || []).join('; ')}

Return:
- brandingAngle
- weeklyPlan (7 items across platforms)
- heroPosts (4 strong posts) each explaining whyItShouldPerform based on competitor engagement patterns.`;

  const pack = await vertex.generateJson(prompt, contentPackSchema, systemInstruction);

  agentAudit.appendAudit({
    action: 'competitor_content_pack',
    resource_type: 'social_content',
    agent_name: 'Competitor Social Intelligence',
    result: {
      weekly: (pack.weeklyPlan || []).length,
      heroes: (pack.heroPosts || []).length,
    },
  });

  return {
    ...pack,
    competitorIntel: {
      summary: intel.summary,
      winningPatterns: intel.winningPatterns,
      contentPillars: intel.contentPillars,
      brandingRecommendations: intel.brandingRecommendations,
      competitors: (intel.competitors || []).map((c) => ({
        name: c.name,
        highEngagementPatterns: c.highEngagementPatterns,
        postsPeopleLike: c.postsPeopleLike,
      })),
    },
    agent: 'competitor_social_intelligence',
  };
}

async function rewritePost(vertex, input = {}) {
  const brand = brandContext();
  const draft = String(input.draft || input.post || '').trim();
  if (!draft) throw new Error('draft post text is required');

  const platform = String(input.platform || 'LinkedIn').trim();
  let intel = input.competitorIntel || null;
  if (!intel) {
    intel = await analyzeCompetitors(vertex, input);
  }

  const systemInstruction = `You rewrite social posts using competitor engagement patterns for ${brand.companyName}.
Keep original intent, improve hook/CTA using what audiences liked on rival channels.
Do not copy competitors. Stay truthful.
Voice:
${brand.voice || 'Clear and confident.'}`;

  const prompt = `Rewrite this ${platform} draft using social competitive intelligence.

Draft:
"""
${draft}
"""

Winning patterns: ${JSON.stringify((intel.winningPatterns || []).slice(0, 6))}
Differentiation / branding: ${(intel.brandingRecommendations || []).join('; ')}
Rival posts people like: ${JSON.stringify(
    (intel.competitors || [])
      .flatMap((c) => (c.postsPeopleLike || []).map((p) => ({ competitor: c.name, ...p })))
      .slice(0, 8)
  )}

Return improved post + variants + inspiredByPattern.`;

  const rewritten = await vertex.generateJson(prompt, rewriteSchema, systemInstruction);

  agentAudit.appendAudit({
    action: 'competitor_social_rewrite',
    resource_type: 'social_post',
    agent_name: 'Competitor Social Intelligence',
    result: { platform, pattern: rewritten.inspiredByPattern },
  });

  return {
    ...rewritten,
    platform,
    originalDraft: draft,
    competitorIntel: {
      summary: intel.summary,
      winningPatterns: intel.winningPatterns,
      brandingRecommendations: intel.brandingRecommendations,
    },
    agent: 'competitor_social_intelligence',
  };
}

function mountRoutes(app, { vertex, requireAuth, aiLimiter } = {}) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();
  const limit = typeof aiLimiter === 'function' ? aiLimiter : (_req, _res, next) => next();

  app.get('/api/agents/competitor/status', guard, (_req, res) => {
    const brand = brandContext();
    res.json({
      ok: true,
      agent: 'competitor_social_intelligence',
      mode: 'social_post_engagement_analysis',
      company: brand.companyName,
      industry: brand.industry,
      version: policyEngine.AGENT_VERSION,
    });
  });

  app.post('/api/agents/competitor/analyze', guard, limit, async (req, res) => {
    try {
      const data = await analyzeCompetitors(vertex, req.body || {});
      res.json({ success: true, data });
    } catch (err) {
      console.error('[CompetitorAgent] analyze', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/agents/competitor/generate', guard, limit, async (req, res) => {
    try {
      const data = await generateContentPack(vertex, req.body || {});
      res.json({ success: true, data });
    } catch (err) {
      console.error('[CompetitorAgent] generate', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/agents/competitor/rewrite', guard, limit, async (req, res) => {
    try {
      const data = await rewritePost(vertex, req.body || {});
      res.json({ success: true, data });
    } catch (err) {
      console.error('[CompetitorAgent] rewrite', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  analyzeCompetitors,
  generateContentPack,
  rewritePost,
  mountRoutes,
};
