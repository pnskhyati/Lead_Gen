/**
 * Deterministic SEO / Local / GEO rules — only emit findings backed by evidence.
 */
const { computePriorityScore, scoreToPriority, effortLabel } = require('./scoring');

function rec(partial) {
  const factors = partial.factors || {
    impact: 50,
    severity: 50,
    confidence: 50,
    urgency: 40,
    effort: 50,
  };
  const score = computePriorityScore(factors);
  const priority = scoreToPriority(score, { forceMinPriority: partial.forceMinPriority });
  const confirmationLevel = partial.confirmationLevel || 'heuristic';
  let status = partial.status;
  if (!status) {
    if (confirmationLevel === 'not_checked') status = 'needs_verification';
    else if (confirmationLevel === 'heuristic') status = 'needs_verification';
    else status = 'open';
  }

  return {
    id: partial.id,
    category: partial.category,
    title: partial.title,
    priority,
    score,
    status,
    confirmationLevel,
    evidence: partial.evidence || [],
    affectedUrls: partial.affectedUrls || [],
    businessImpact: partial.businessImpact || '',
    recommendedAction: partial.recommendedAction || '',
    verificationMethod: partial.verificationMethod || '',
    effort: partial.effort || effortLabel(factors.effort),
    detectedAt: partial.detectedAt || new Date().toISOString(),
    factors,
  };
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits.slice(-10);
}

function extractPhones(text) {
  const matches = String(text || '').match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  return [...new Set(matches.map(normalizePhone).filter(Boolean))];
}

function countFaqSignals(text) {
  const lower = text.toLowerCase();
  let score = 0;
  if (/\bfaq\b/.test(lower)) score += 2;
  if (/frequently asked/.test(lower)) score += 2;
  if (/(^|\n)\s*q[:.)]\s/mi.test(text)) score += 2;
  if (/answer-first|how to|what is|how much|pricing/i.test(text)) score += 1;
  return score;
}

function nameInCorpus(companyName, text) {
  const name = String(companyName || '').trim();
  if (!name || name.length < 2) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

function runRules(ctx) {
  const { profile, crawl, combined, docCount, docBodies } = ctx;
  const legacyManual = ctx.legacyManual || {};
  const out = [];
  const site = String(profile.websiteUrl || '').trim();
  const origin = crawl?.origin;

  // --- Technical SEO (Google Search) ---
  if (!site) {
    out.push(
      rec({
        id: 'tech-no-website-url',
        category: 'technical_seo',
        confirmationLevel: 'confirmed',
        factors: { impact: 75, severity: 70, confidence: 100, urgency: 50, effort: 15 },
        title: 'Add your public website URL',
        evidence: ['Brand profile has no website URL — crawls and indexing checks cannot run.'],
        businessImpact: 'Search engines and AI crawlers need a canonical site to discover your services.',
        recommendedAction: 'Add your website URL under Settings → Brand → Public & local SEO facts.',
        verificationMethod: 'Re-run audit after saving the URL; homepage should return HTTP 200.',
        effort: 'low',
      })
    );
  } else if (!crawl?.homepage?.ok) {
    out.push(
      rec({
        id: 'tech-homepage-unreachable',
        category: 'technical_seo',
        confirmationLevel: crawl?.homepage?.error ? 'confirmed' : 'heuristic',
        forceMinPriority: crawl?.homepage?.status === 0 ? 'P1' : 'P1',
        factors: {
          impact: 90,
          severity: 90,
          confidence: crawl?.homepage?.status ? 95 : 70,
          urgency: 85,
          effort: 45,
        },
        title: 'Homepage is not reachable for crawlers',
        evidence: [
          `Requested: ${origin || site}`,
          crawl?.homepage?.status ? `HTTP status: ${crawl.homepage.status}` : `Fetch error: ${crawl?.homepage?.error || crawl?.error || 'unknown'}`,
        ],
        affectedUrls: [origin || site],
        businessImpact: 'If the homepage fails, important pages may not be indexed or cited.',
        recommendedAction: 'Fix DNS, TLS, redirects, or server errors so the homepage returns HTTP 200.',
        verificationMethod: 'Re-run audit or curl the URL; confirm 200 and valid HTML.',
      })
    );
  }

  if (crawl?.robots?.fetched && crawl.robots.disallowAll) {
    out.push(
      rec({
        id: 'tech-robots-blocks-all',
        category: 'technical_seo',
        confirmationLevel: 'confirmed',
        forceMinPriority: 'P0',
        factors: { impact: 95, severity: 98, confidence: 98, urgency: 90, effort: 25 },
        title: 'robots.txt appears to block all crawling',
        evidence: [
          `robots.txt URL: ${crawl.robots.url}`,
          'User-agent: * with Disallow: / (or equivalent) detected.',
        ],
        affectedUrls: [crawl.robots.url],
        businessImpact: 'Blocking all crawlers can prevent indexing of valuable content.',
        recommendedAction: 'Review robots.txt; remove unintended global Disallow rules for public pages.',
        verificationMethod: 'Re-fetch robots.txt and re-run audit; confirm allow rules for key paths.',
      })
    );
  }

  const sig = crawl?.signals;
  if (sig && crawl.homepage?.ok) {
    if (!sig.title) {
      out.push(
        rec({
          id: 'tech-missing-title',
          category: 'technical_seo',
          confirmationLevel: 'confirmed',
          factors: { impact: 70, severity: 65, confidence: 92, urgency: 55, effort: 20 },
          title: 'Homepage is missing a <title> tag',
          evidence: [`Crawled: ${sig.pageUrl}`, 'No <title> element found in HTML response.'],
          affectedUrls: [sig.pageUrl],
          businessImpact: 'Titles help search understand page relevance for queries.',
          recommendedAction: 'Add a unique, descriptive <title> (brand + primary service).',
          verificationMethod: 'Re-crawl homepage and view page source or Search Console URL inspection.',
        })
      );
    }
    if (!sig.metaDescription) {
      out.push(
        rec({
          id: 'tech-missing-meta-description',
          category: 'technical_seo',
          confirmationLevel: 'confirmed',
          factors: { impact: 55, severity: 50, confidence: 90, urgency: 40, effort: 20 },
          title: 'Homepage meta description is missing',
          evidence: [`Crawled: ${sig.pageUrl}`, 'No meta name="description" found.'],
          affectedUrls: [sig.pageUrl],
          businessImpact: 'Snippets may be less compelling in search results.',
          recommendedAction: 'Add a concise meta description summarizing services and location.',
          verificationMethod: 'Re-crawl and confirm meta description in HTML.',
        })
      );
    }
    if (sig.robotsMeta.includes('noindex')) {
      out.push(
        rec({
          id: 'tech-noindex-homepage',
          category: 'technical_seo',
          confirmationLevel: 'confirmed',
          forceMinPriority: 'P0',
          factors: { impact: 92, severity: 95, confidence: 95, urgency: 88, effort: 30 },
          title: 'Homepage has a noindex directive',
          evidence: [`Crawled: ${sig.pageUrl}`, `meta robots: ${sig.robotsMeta}`],
          affectedUrls: [sig.pageUrl],
          businessImpact: 'noindex can exclude the homepage from Google Search.',
          recommendedAction: 'Remove noindex from the homepage unless intentionally private.',
          verificationMethod: 'Re-crawl; confirm robots meta allows index,follow.',
        })
      );
    }
    if (!sig.jsonLdValid || sig.jsonLdBlocks.length === 0) {
      out.push(
        rec({
          id: 'tech-missing-structured-data',
          category: 'technical_seo',
          confirmationLevel: sig ? 'confirmed' : 'heuristic',
          factors: { impact: 50, severity: 45, confidence: sig ? 88 : 50, urgency: 35, effort: 55 },
          title: 'Structured data (JSON-LD) not detected on homepage',
          evidence: [
            `Crawled: ${sig.pageUrl}`,
            sig?.jsonLdBlocks?.length
              ? 'JSON-LD blocks present but failed to parse — fix syntax.'
              : 'No application/ld+json script blocks found.',
          ],
          affectedUrls: [sig.pageUrl],
          businessImpact: 'Valid schema supports eligible search features; it does not guarantee rankings.',
          recommendedAction: 'Add appropriate JSON-LD (Organization or LocalBusiness + FAQPage where relevant).',
          verificationMethod: 'Validate with Google Rich Results Test after publishing.',
        })
      );
    } else {
      const hasLocal = sig.jsonLdTypes.some((t) => /localbusiness|organization/i.test(t));
      if (!hasLocal) {
        out.push(
          rec({
            id: 'tech-schema-type-gap',
            category: 'technical_seo',
            confirmationLevel: 'heuristic',
            factors: { impact: 45, severity: 40, confidence: 75, urgency: 30, effort: 45 },
            title: 'Consider LocalBusiness or Organization schema',
            evidence: [
              `Crawled: ${sig.pageUrl}`,
              `Detected @types: ${sig.jsonLdTypes.join(', ') || 'none'}`,
            ],
            affectedUrls: [sig.pageUrl],
            businessImpact: 'Clear entity markup helps search understand who you are.',
            recommendedAction: 'Add Organization or LocalBusiness JSON-LD aligned with visible NAP.',
            verificationMethod: 'Rich Results Test + re-audit.',
          })
        );
      }
    }
  }

  if (origin && crawl?.sitemap && !crawl.sitemap.ok) {
    out.push(
      rec({
        id: 'tech-sitemap-missing',
        category: 'technical_seo',
        confirmationLevel: 'heuristic',
        factors: { impact: 45, severity: 40, confidence: 70, urgency: 35, effort: 40 },
        title: 'Sitemap could not be fetched',
        evidence: [
          `Tried: ${crawl.sitemap.url}`,
          crawl.sitemap.status ? `HTTP ${crawl.sitemap.status}` : crawl.sitemap.error || 'Not found',
        ],
        affectedUrls: [crawl.sitemap.url],
        businessImpact: 'Sitemaps help discovery of important URLs.',
        recommendedAction: 'Publish sitemap.xml and reference it in robots.txt.',
        verificationMethod: 'Open sitemap URL in browser; re-run audit.',
      })
    );
  }

  // --- Local SEO ---
  const nameOk = Boolean(String(profile.companyName || '').trim());
  const phoneProfile = normalizePhone(profile.businessPhone);
  const phonesInDocs = extractPhones(combined);
  const addressOk = String(profile.businessAddress || '').trim().length >= 8;
  const gbpUrl = String(profile.googleBusinessProfileUrl || '').trim();

  if (!gbpUrl.startsWith('http') && legacyManual.gbp !== 'passed') {
    out.push(
      rec({
        id: 'local-gbp-not-linked',
        category: 'local_seo',
        confirmationLevel: 'not_checked',
        factors: { impact: 70, severity: 60, confidence: 40, urgency: 50, effort: 35 },
        title: 'Google Business Profile not linked (authorization not verified)',
        evidence: [
          'No GBP URL saved in brand profile.',
          'Nexora does not verify GBP ownership until a profile link or API integration is connected.',
        ],
        businessImpact: 'Local pack visibility depends on a complete, accurate Business Profile.',
        recommendedAction: 'Claim GBP, complete categories/hours/services, add the profile URL in Brand settings.',
        verificationMethod: 'Save GBP URL and re-audit; connect GBP API when available in Nexora.',
        status: 'needs_verification',
      })
    );
  }

  const napEvidence = [];
  if (!nameOk) napEvidence.push('Business name missing in brand profile.');
  else napEvidence.push(`Name on file: ${profile.companyName.trim()}`);
  if (!phoneProfile && !phonesInDocs.length) napEvidence.push('No phone in profile or knowledge docs.');
  if (!addressOk) napEvidence.push('Business address not set in brand profile.');
  const uniquePhones = [...new Set(phoneProfile ? [phoneProfile, ...phonesInDocs] : phonesInDocs)];
  if (uniquePhones.length > 1) {
    napEvidence.push('Multiple different phone numbers detected in records.');
  }

  if (!nameOk || !addressOk || !phoneProfile || uniquePhones.length > 1) {
    out.push(
      rec({
        id: 'local-nap-incomplete',
        category: 'local_seo',
        confirmationLevel: uniquePhones.length > 1 ? 'confirmed' : 'heuristic',
        factors: {
          impact: 80,
          severity: 75,
          confidence: uniquePhones.length > 1 ? 90 : 75,
          urgency: 60,
          effort: 35,
        },
        title: 'Business NAP is incomplete or inconsistent',
        evidence: napEvidence,
        businessImpact: 'Inconsistent NAP hurts local relevance and trust across Google and directories.',
        recommendedAction: 'Set phone and address in Brand settings; align with website footer and GBP.',
        verificationMethod: 'Compare live site, GBP, and Nexora profile after updates; re-audit.',
      })
    );
  }

  if (legacyManual.reviews !== 'passed') {
    out.push(
      rec({
        id: 'local-review-cadence',
        category: 'local_seo',
        confirmationLevel: 'not_checked',
        factors: { impact: 55, severity: 45, confidence: 35, urgency: 40, effort: 40 },
        title: 'Review collection cadence not verified',
        evidence: ['Review workflow cannot be measured without GBP integration or manual confirmation.'],
        businessImpact: 'Reviews support prominence and trust in local results.',
        recommendedAction: 'Implement a post-service review ask; respond weekly to new reviews.',
        verificationMethod: 'Mark verified in Nexora after cadence is running, or connect GBP when available.',
        status: 'needs_verification',
      })
    );
  }

  // --- GEO ---
  const faqScore = countFaqSignals(combined);
  const servicesOk = String(profile.productsFocus || '').trim().length >= 24;
  if (!servicesOk || faqScore < 3) {
    out.push(
      rec({
        id: 'geo-service-faq-coverage',
        category: 'geo',
        confirmationLevel: docCount > 0 ? 'heuristic' : 'not_checked',
        factors: { impact: 75, severity: 65, confidence: docCount ? 72 : 45, urgency: 55, effort: 50 },
        title: 'Service pages do not clearly answer customer questions',
        evidence: [
          servicesOk ? 'Products/focus field is populated.' : 'Products/focus field is thin or empty.',
          faqScore >= 3
            ? 'Some FAQ patterns found in knowledge.'
            : 'Limited FAQ / Q&A patterns in approved knowledge (upload service + FAQ copy).',
          docCount ? `${docCount} knowledge document(s) on file.` : 'No knowledge documents uploaded.',
        ],
        businessImpact: 'Clear, factual answers improve usefulness for AI-powered search experiences.',
        recommendedAction:
          'Add answer-first FAQ and service pages; upload them to the brand brain for consistency checks.',
        verificationMethod: 'Re-audit after content update; optionally re-crawl key service URLs.',
      })
    );
  }

  if (docCount === 0 || !nameOk || !nameInCorpus(profile.companyName, combined)) {
    out.push(
      rec({
        id: 'geo-knowledge-alignment',
        category: 'geo',
        confirmationLevel: docCount ? 'heuristic' : 'confirmed',
        factors: { impact: 70, severity: 60, confidence: docCount ? 80 : 95, urgency: 50, effort: 45 },
        title: 'Approved knowledge may not match public business facts',
        evidence: [
          docCount ? `${docCount} document(s) uploaded.` : 'No approved knowledge documents.',
          nameOk
            ? nameInCorpus(profile.companyName, combined)
              ? `Company name appears in corpus.`
              : `Company name “${profile.companyName}” not found in uploaded docs.`
            : 'Company name not set.',
        ],
        businessImpact: 'Contradictory facts reduce trust when AI systems synthesize answers.',
        recommendedAction: 'Upload live service/FAQ pages; fix conflicting prices, hours, or policies.',
        verificationMethod: 'Re-audit knowledge alignment after doc upload.',
      })
    );
  }

  // Crawl vs knowledge schema mention gap
  if (sig?.jsonLdValid && docBodies.length) {
    const docMentionsSchema = /schema\.org|json-ld|localbusiness/i.test(combined);
    if (!docMentionsSchema) {
      out.push(
        rec({
          id: 'geo-schema-docs-gap',
          category: 'geo',
          confirmationLevel: 'heuristic',
          factors: { impact: 40, severity: 35, confidence: 65, urgency: 25, effort: 35 },
          title: 'Internal knowledge does not reference structured data strategy',
          evidence: [
            'Homepage has JSON-LD, but uploaded knowledge does not mention schema implementation.',
            'Optional: document schema types in internal playbooks for team alignment.',
          ],
          businessImpact: 'Low severity — mainly documentation consistency for teams.',
          recommendedAction: 'Add a short internal note on which schema types you publish and where.',
          verificationMethod: 'Upload updated internal doc; re-audit.',
        })
      );
    }
  }

  return out.sort((a, b) => b.score - a.score);
}

module.exports = {
  runRules,
  rec,
};
