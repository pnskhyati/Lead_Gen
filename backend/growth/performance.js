/**
 * What is working and what is not: leads grouped by where they came from, with how many were qualified, booked and won.
 * Only counts what really happened. Advice appears only when there are enough leads to compare, and always says so.
 */
const MIN_SAMPLE = 5; // a group needs this many enquiries before it is compared with another
const GAP_POINTS = 15; // and the qualified rates must differ by this many points

const CHANNEL_LABEL = { whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', x: 'X', linkedin: 'LinkedIn', web: 'Website chat', email: 'Email', google_ads: 'Google Ads', manual: 'Manual' };

const isQualified = (l) => l.status === 'qualified' || l.status === 'closed' || (Number(l.score) >= 70 && l.status !== 'new');

function sourceOf(lead) {
  const a = lead.attribution || {};
  const campaign = a.utm_campaign || a.campaign || a.campaignName;
  const medium = a.utm_source || a.source || a.gclid ? (a.utm_source || (a.gclid ? 'google' : a.source)) : '';
  const channel = CHANNEL_LABEL[String(lead.channel)] || String(lead.channel || 'Other');
  if (campaign) return { key: `campaign:${campaign}`, label: `${medium ? `${medium} · ` : ''}${campaign}`, kind: 'campaign' };
  return { key: `channel:${lead.channel}`, label: channel, kind: 'channel' };
}

function computePerformance({ leads = [], requests = [], since = 0 }) {
  const confirmedLeadIds = new Set(requests.filter((r) => r.status === 'confirmed' && r.leadId).map((r) => r.leadId));
  const inScope = leads.filter((l) => new Date(l.createdAt).getTime() >= since);
  const groups = new Map();
  for (const l of inScope) {
    const s = sourceOf(l);
    const g = groups.get(s.key) || { key: s.key, label: s.label, kind: s.kind, enquiries: 0, qualified: 0, booked: 0, won: 0 };
    g.enquiries += 1;
    if (isQualified(l)) g.qualified += 1;
    if (confirmedLeadIds.has(l.id)) g.booked += 1;
    if (l.status === 'closed') g.won += 1;
    groups.set(s.key, g);
  }
  const rows = [...groups.values()]
    .map((g) => ({ ...g, qualifiedRate: g.enquiries ? Math.round((g.qualified / g.enquiries) * 100) : 0, bookedRate: g.enquiries ? Math.round((g.booked / g.enquiries) * 100) : 0 }))
    .sort((a, b) => b.enquiries - a.enquiries);

  const insights = [];
  const comparable = rows.filter((r) => r.enquiries >= MIN_SAMPLE);
  if (comparable.length >= 2) {
    const byRate = [...comparable].sort((a, b) => b.qualifiedRate - a.qualifiedRate);
    const best = byRate[0];
    const worst = byRate[byRate.length - 1];
    if (best.qualifiedRate - worst.qualifiedRate >= GAP_POINTS) {
      const more = comparable.slice().sort((a, b) => b.enquiries - a.enquiries)[0];
      insights.push({
        id: `gap:${best.key}:${worst.key}`,
        text:
          more.key !== best.key
            ? `${more.label} brings the most enquiries (${more.enquiries}), but ${best.label} qualifies more of them: ${best.qualifiedRate}% against ${worst.qualifiedRate}% for ${worst.label}.`
            : `${best.label} brings the most enquiries (${best.enquiries}) and also qualifies the most: ${best.qualifiedRate}% against ${worst.qualifiedRate}% for ${worst.label}.`,
        suggestion: `Try a small, controlled test: move a little effort from ${worst.label} to ${best.label} for two weeks and compare the qualified rate again before changing more.`,
        evidence: { best, worst },
      });
    }
  } else if (inScope.length > 0) {
    insights.push({
      id: 'need-more-data',
      text: `Not enough leads yet to compare where they come from. Each source needs at least ${MIN_SAMPLE} enquiries, and you have ${inScope.length} in total.`,
      suggestion: null,
      evidence: null,
    });
  }

  return {
    total: inScope.length,
    qualified: inScope.filter(isQualified).length,
    booked: inScope.filter((l) => confirmedLeadIds.has(l.id)).length,
    won: inScope.filter((l) => l.status === 'closed').length,
    rows,
    insights,
    note: 'Counts only leads this app captured. Ad spend and cost per lead are not included because no ad account is connected.',
  };
}

module.exports = { computePerformance, MIN_SAMPLE, GAP_POINTS, sourceOf };
