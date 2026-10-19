/**
 * Lead Growth Communication Agent
 * Converses with prospects to maximize qualified lead capture (web / social / WhatsApp style).
 * Complements leadAgent.js with a growth-first playbook while keeping safety guardrails.
 */
const { Type } = require('@google/genai');
const rag = require('./rag');
const leadsCrm = require('./leadsCrm');
const agentFramework = require('./agentFramework');
const policyEngine = require('./policyEngine');
const agentAudit = require('./agentAudit');

const HANDOFF_EMAIL =
  process.env.LEAD_HANDOFF_EMAIL || process.env.SUPPORT_EMAIL || 'specialists@tecavy.example';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    intent: { type: Type.STRING },
    intentConfidence: { type: Type.NUMBER },
    captureLead: { type: Type.BOOLEAN },
    leadTemperature: { type: Type.STRING, enum: ['hot', 'warm', 'cold'] },
    leadScore: { type: Type.NUMBER },
    scoreBand: { type: Type.STRING, enum: ['cold', 'warm', 'hot', 'very_hot'] },
    intentSummary: { type: Type.STRING },
    nextBestAction: { type: Type.STRING },
    askedFor: { type: Type.ARRAY, items: { type: Type.STRING } },
    missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
    ctaUsed: { type: Type.STRING },
    needsHandoff: { type: Type.BOOLEAN },
    handoffReason: { type: Type.STRING },
  },
  required: [
    'reply',
    'intent',
    'intentConfidence',
    'captureLead',
    'leadTemperature',
    'leadScore',
    'scoreBand',
    'intentSummary',
    'nextBestAction',
    'askedFor',
    'missingFields',
    'ctaUsed',
    'needsHandoff',
    'handoffReason',
  ],
};

function brandBits() {
  try {
    const ck = require('./companyKnowledge');
    return {
      botName: ck.getBotName() || 'Ava',
      companyName: ck.getProfile().companyName || 'Tecavy',
      voice: ck.buildVoiceInstruction() || '',
    };
  } catch {
    return { botName: 'Ava', companyName: 'Tecavy', voice: '' };
  }
}

async function chat(vertex, { message, history = [], visitorName, channel = 'web' } = {}) {
  const runId = policyEngine.newRunId();
  const rawMessage = String(message || '').trim();
  if (!rawMessage) throw new Error('message is required');

  const input = policyEngine.inputGuardrail(rawMessage);
  const userMessage = input.sanitized;
  const chunks = rag.retrieveWithFallback(userMessage, { topK: 5 });
  const context = rag.formatContext(chunks);
  const brand = brandBits();

  const historyBlock = (history || [])
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Prospect' : 'Agent'}: ${m.text}`)
    .join('\n');

  const systemInstruction = `${policyEngine.buildSystemPolicyBlock({
    botName: brand.botName,
    companyName: brand.companyName,
    voiceBlock: brand.voice,
  })}

You are the LEAD GROWTH COMMUNICATION AGENT for ${brand.companyName}.
Primary KPI: convert conversations into qualified leads without being spammy.

PLAYBOOK:
1) Answer briefly from APPROVED KNOWLEDGE only.
2) Ask ONE high-value qualifying question at a time (need, timeline, budget band, location, contact).
3) Always leave a soft CTA (book / WhatsApp / share phone/email / demo).
4) If buying signals appear → raise leadScore, set captureLead=true, push next step.
5) Never invent prices/facts. Hand off complaints / legal / medical diagnosis.

Channel: ${channel}
Visitor: ${visitorName || 'Prospect'}

APPROVED KNOWLEDGE:
${context || '(limited — ask clarifying questions and offer human follow-up)'}
`;

  const prompt = `Conversation so far:
${historyBlock || '(new chat)'}

Prospect: ${userMessage}

Respond as ${brand.botName}. Maximize lead progress this turn.`;

  const decided = await vertex.generateJson(prompt, responseSchema, systemInstruction);
  const signals = agentFramework.detectSignals(userMessage);
  const ruleScore = agentFramework.calculateRuleScore({ signals });
  const llmScore = Number.isFinite(Number(decided.leadScore))
    ? Math.max(0, Math.min(100, Math.round(Number(decided.leadScore))))
    : 40;
  const score = Math.round(ruleScore * 0.35 + llmScore * 0.65);
  const temperature = agentFramework.temperatureFromScore(score);
  const scoreBand = agentFramework.scoreBandFromScore(score);

  const captureLead =
    Boolean(decided.captureLead) ||
    agentFramework.shouldCaptureLead({
      intent: decided.intent,
      message: userMessage,
      signals,
      confidence: decided.intentConfidence,
    }) ||
    score >= 45;

  const needsHandoff =
    Boolean(decided.needsHandoff) ||
    agentFramework.HANDOFF_INTENTS?.has?.(String(decided.intent || '')) ||
    /\b(complaint|refund|lawyer|speak to (a )?human|talk to (a )?person)\b/i.test(userMessage);

  const result = {
    reply: String(decided.reply || '').trim() || `Happy to help — what's the main thing you need from ${brand.companyName}?`,
    intent: decided.intent || 'LEAD_INTEREST',
    intentConfidence: Number(decided.intentConfidence) || 0.5,
    captureLead,
    leadTemperature: temperature,
    leadScore: score,
    scoreBand,
    intentSummary: decided.intentSummary || 'Lead growth conversation',
    nextBestAction: decided.nextBestAction || 'Ask for contact + preferred time',
    askedFor: decided.askedFor || [],
    missingFields: decided.missingFields || [],
    ctaUsed: decided.ctaUsed || '',
    needsHandoff: Boolean(needsHandoff),
    handoffReason: decided.handoffReason || '',
    handoffEmail: HANDOFF_EMAIL,
    conversationState: needsHandoff ? 'HUMAN_REQUIRED' : 'AI_ACTIVE',
    agent: 'lead_growth',
    runId,
    scoringSignals: signals,
  };

  agentAudit.appendAudit({
    action: 'lead_growth_chat',
    resource_type: 'conversation',
    agent_name: 'Lead Growth',
    result: {
      run_id: runId,
      intent: result.intent,
      capture_lead: result.captureLead,
      lead_score: result.leadScore,
      channel,
    },
  });

  return result;
}

function mountRoutes(app, { vertex, requireAuth, aiLimiter } = {}) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_req, _res, next) => next();
  const limit = typeof aiLimiter === 'function' ? aiLimiter : (_req, _res, next) => next();

  app.get('/api/agents/lead-growth/status', guard, (_req, res) => {
    const brand = brandBits();
    res.json({
      ok: true,
      agent: 'lead_growth',
      botName: brand.botName,
      company: brand.companyName,
      handoffEmail: HANDOFF_EMAIL,
    });
  });

  app.post('/api/agents/lead-growth/chat', guard, limit, async (req, res) => {
    try {
      const data = await chat(vertex, {
        message: req.body?.message,
        history: req.body?.history || [],
        visitorName: req.body?.visitorName,
        channel: req.body?.channel || 'web',
      });

      if (data.captureLead || data.needsHandoff || req.body?.persist) {
        try {
          const sessionId = req.body?.sessionId || req.body?.leadId || `growth:${req.ip || 'anon'}`;
          const lead = await leadsCrm.upsertLead({
            id: req.body?.leadId,
            channel: req.body?.channel || 'web',
            platform: 'Lead Growth Agent',
            externalId: `growth:${sessionId}`,
            author: req.body?.visitorName || 'Prospect',
            customerComment: req.body?.message,
            temperature: data.leadTemperature,
            score: data.leadScore,
            scoreBand: data.scoreBand,
            intent: data.intent,
            intentConfidence: data.intentConfidence,
            intentSummary: data.intentSummary,
            nextBestAction: data.nextBestAction,
            conversationState: data.conversationState,
            suggestedReply: data.reply,
            handoffReason: data.handoffReason,
            handoffEmail: data.handoffEmail,
            status: data.needsHandoff ? 'handed_off' : 'new',
            autoReplyPaused: data.needsHandoff,
          });
          await leadsCrm.addMessage({ leadId: lead.id, role: 'customer', text: req.body.message });
          await leadsCrm.addMessage({ leadId: lead.id, role: 'agent', text: data.reply });
          data.leadId = lead.id;
        } catch (persistErr) {
          console.warn('[LeadGrowth] persist failed:', persistErr.message);
        }
      }

      res.json({ success: true, data });
    } catch (err) {
      console.error('[LeadGrowth] chat', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  chat,
  mountRoutes,
};
