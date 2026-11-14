/**
 * A live chat with one person on a social platform: the agent answers for the company from its knowledge,
 * keeps the conversation going, and works toward getting their contact details so the team can follow up.
 * Used for Facebook Messenger; Instagram messages have their own copy of the same flow in instagram.js.
 */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;

/** Contact details a person typed in a message, if any. */
function extractContact(text) {
  const s = String(text || '');
  const email = s.match(EMAIL)?.[0] || null;
  const phoneRaw = s.replace(EMAIL, ' ').match(PHONE)?.[0] || null;
  const digits = phoneRaw ? phoneRaw.replace(/\D/g, '') : '';
  const phone = digits.length >= 8 && digits.length <= 15 ? phoneRaw.trim() : null;
  return { email, phone };
}

async function handleDirectMessage({
  vertex,
  leadAgent,
  leads,
  profile,
  channel, // lead channel value, e.g. 'facebook'
  platformLabel, // e.g. 'Facebook Messenger'
  idPrefix, // e.g. 'fbdm'
  senderId,
  senderName,
  text,
  messageId,
  send, // async (text) => void
  botName = 'Alex',
  autoReplyEnabled = true,
}) {
  const externalId = `${idPrefix}:${senderId}`;
  const contact = extractContact(text);
  const base = { channel, platform: platformLabel, externalId, author: senderName || senderId, customerComment: text };
  if (contact.email) base.email = contact.email;
  if (contact.phone) base.phone = contact.phone;

  const lead = await leads.upsertLead(base);
  await leads.addMessage({ leadId: lead.id, role: 'customer', text, channelMessageId: messageId });
  try {
    require('../growth/appointments').noteBookingIntent({ lead, text });
  } catch {
    /* booking is optional */
  }

  if (!autoReplyEnabled) return { lead, skipped: true, reason: 'auto_reply_disabled' };
  if (lead.autoReplyPaused || lead.status === 'handed_off') return { lead, skipped: true, reason: 'handoff' };

  const all = await leads.getMessages(lead.id);
  const history = all.slice(-12, -1).map((m) => ({ role: m.role === 'customer' ? 'user' : 'model', text: m.text }));
  const agentResult = await leadAgent.chat(vertex, {
    message: text,
    history,
    visitorName: senderName || senderId,
    previousScore: lead.score || 0,
    channel,
  });

  let replyText = agentResult.reply;
  const firstTurn = all.filter((m) => m.role === 'customer').length <= 1;
  if (firstTurn && !new RegExp(botName, 'i').test(replyText)) replyText = `Hi, I'm ${botName} from ${profile?.companyName || 'our team'}. ${replyText}`;

  const hasContact = Boolean(contact.email || contact.phone || lead.email || lead.phone);
  const updated = await leads.upsertLead({
    ...base,
    id: lead.id,
    temperature: agentResult.leadTemperature,
    score: agentResult.leadScore,
    scoreBand: agentResult.scoreBand,
    intent: agentResult.intent,
    intentConfidence: agentResult.intentConfidence,
    intentSummary: agentResult.intentSummary,
    nextBestAction: hasContact ? 'Contact details received: follow up personally' : agentResult.nextBestAction,
    scoreExplanation: agentResult.scoreExplanation,
    conversationState: agentResult.conversationState,
    suggestedReply: replyText,
    handoffReason: agentResult.handoffReason,
    handoffEmail: agentResult.handoffEmail,
    status: agentResult.needsHandoff ? 'handed_off' : hasContact || agentResult.captureLead || agentResult.leadScore >= 70 ? 'qualified' : 'contacted',
    autoReplyPaused: agentResult.needsHandoff,
    lifecycleStage: 'engaged',
  });
  await leads.addMessage({ leadId: lead.id, role: 'agent', text: replyText });

  let sent = false;
  let sendError = null;
  try {
    await send(replyText);
    sent = true;
  } catch (err) {
    sendError = err?.response?.data?.error?.message || err.message;
  }
  return { lead: updated, agentResult: { ...agentResult, reply: replyText }, sent, sendError, contact };
}

module.exports = { handleDirectMessage, extractContact };
