/**
 * Tecavy Agent Safety helpers — delegates scoring/policy to policyEngine (Guardrails v2.0).
 */
const policyEngine = require('./policyEngine');

const INTENTS = [
  'GENERAL_QUERY',
  'SOCIAL_ENGAGEMENT',
  'PRODUCT_QUERY',
  'SERVICE_QUERY',
  'PRICE_QUERY',
  'AVAILABILITY',
  'LOCATION',
  'BOOKING_INTENT',
  'PURCHASE_INTENT',
  'COMPLAINT',
  'SUPPORT',
  'LEAD_INTEREST',
  'HUMAN_REQUEST',
  'UNKNOWN',
];

const CONVERSATION_STATES = {
  AI_ACTIVE: 'AI_ACTIVE',
  AI_WAITING: 'AI_WAITING',
  HUMAN_REQUIRED: 'HUMAN_REQUIRED',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
  AI_PAUSED: 'AI_PAUSED',
  CLOSED: 'CLOSED',
};

const HANDOFF_INTENTS = new Set(['COMPLAINT', 'HUMAN_REQUEST', 'SUPPORT']);

const COMPLAINT_PATTERN =
  /\b(complaint|refund|chargeback|fraud|lawyer|legal|sue|manager|supervisor|speak to (a )?human|talk to (a )?person|nobody helped|worst service|cancel my order)\b/i;

const PRAISE_PATTERN = /^(nice|love|great|awesome|fire|🔥|❤️|amazing)\b/i;

function buildSafetySystemBlock(opts) {
  return policyEngine.buildSystemPolicyBlock(opts);
}

function buildResponseSchema(Type) {
  return {
    type: Type.OBJECT,
    properties: {
      reply: { type: Type.STRING },
      intent: { type: Type.STRING, enum: INTENTS },
      intentConfidence: { type: Type.NUMBER },
      needsHandoff: { type: Type.BOOLEAN },
      handoffReason: { type: Type.STRING },
      captureLead: { type: Type.BOOLEAN },
      leadTemperature: { type: Type.STRING, enum: ['hot', 'warm', 'cold'] },
      leadScore: { type: Type.NUMBER },
      scoreBand: { type: Type.STRING, enum: ['cold', 'warm', 'hot', 'very_hot'] },
      intentSummary: { type: Type.STRING },
      nextBestAction: { type: Type.STRING },
      emailSubject: { type: Type.STRING },
      emailBody: { type: Type.STRING },
      usedDocIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: [
      'reply',
      'intent',
      'intentConfidence',
      'needsHandoff',
      'handoffReason',
      'captureLead',
      'leadTemperature',
      'leadScore',
      'scoreBand',
      'intentSummary',
      'nextBestAction',
      'emailSubject',
      'emailBody',
      'usedDocIds',
    ],
  };
}

function detectSignals(message, history = []) {
  return policyEngine.detectScoreSignals(message, history);
}

function calculateRuleScore({ signals, previousScore = 0 }) {
  return policyEngine.computeExplainableScore({ signals, previousScore }).score;
}

function scoreBandFromScore(score) {
  const n = Number(score) || 0;
  if (n >= 81) return 'very_hot';
  if (n >= 61) return 'hot';
  if (n >= 31) return 'warm';
  return 'cold';
}

function temperatureFromScore(score) {
  const band = scoreBandFromScore(score);
  if (band === 'very_hot' || band === 'hot') return 'hot';
  if (band === 'warm') return 'warm';
  return 'cold';
}

function shouldCaptureLead({ intent, message, signals, confidence = 0 }) {
  const i = String(intent || '').toUpperCase();
  if (['BOOKING_INTENT', 'PURCHASE_INTENT', 'LEAD_INTEREST'].includes(i) && confidence >= 0.5) {
    return true;
  }
  if (HANDOFF_INTENTS.has(i)) return true;
  if (PRAISE_PATTERN.test(String(message || '').trim()) && signals.length <= 1) return false;
  if (['GENERAL_QUERY', 'SOCIAL_ENGAGEMENT'].includes(i) && confidence >= 0.6) return false;
  return false;
}

function enforceAgentDecision(opts) {
  return policyEngine.decideInboundAction(opts);
}

module.exports = {
  INTENTS,
  CONVERSATION_STATES,
  buildSafetySystemBlock,
  buildResponseSchema,
  detectSignals,
  calculateRuleScore,
  scoreBandFromScore,
  temperatureFromScore,
  shouldCaptureLead,
  enforceAgentDecision,
  COMPLAINT_PATTERN,
  PRAISE_PATTERN,
  HANDOFF_INTENTS,
};
