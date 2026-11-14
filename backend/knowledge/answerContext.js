/**
 * Everything an agent needs from the knowledge base for one customer message:
 * retrieved context, safety notes for the prompt, and the feedback-loop bookkeeping.
 */
const rag = require('../rag');
const gaps = require('./gaps');

const NOT_COVERED_NOTE =
  'NOTE: The approved knowledge does NOT cover this question. Do not state prices, hours, policies or other business facts. ' +
  'Say you will check with the team, ask one clarifying question, and set needsHandoff=true if the customer needs a factual answer.';

const AUTHORITY_NOTE =
  'SOURCE AUTHORITY: entries written as "Q: … A: …" are the owner\'s own FAQ answers. If an FAQ and a document disagree, the FAQ is correct.';

function conflictNote(topics) {
  return (
    `NOTE: The approved knowledge contains CONFLICTING statements about: ${topics.join('; ')}. ` +
    'Do not state either version as fact. Tell the customer you will confirm with the team and set needsHandoff=true.'
  );
}

/**
 * @param {string} message sanitized customer message
 * @param {{ workspaceId?: string, channel?: string, track?: boolean }} opts
 */
async function prepareKnowledge(message, { workspaceId, channel = 'chat', track = true } = {}) {
  const retrieval = await rag.search(message, { topK: 5, ws: workspaceId });
  const topics = retrieval.conflicts.map((c) => c.topic);
  const usable = retrieval.grounded && !retrieval.conflict;

  if (track) {
    if (!retrieval.grounded) {
      void gaps.recordGap({ question: message, channel, kind: 'missing' }, workspaceId);
    } else if (retrieval.conflict) {
      void gaps.recordGap({ question: message, channel, kind: 'conflict', detail: topics.join('; ') }, workspaceId);
    }
  }

  const notes = [AUTHORITY_NOTE];
  if (!retrieval.grounded) notes.push(NOT_COVERED_NOTE);
  if (retrieval.conflict) notes.push(conflictNote(topics));

  return {
    retrieval,
    chunks: retrieval.chunks,
    context: rag.formatContext(retrieval.chunks),
    notes,
    usable,
    /** What the policy engine should treat as "approved facts available" (0 blocks price/fact claims). */
    retrievedCount: usable ? retrieval.chunks.length : 0,
  };
}

// Handoffs that are about the person or the commercial terms, not about missing knowledge.
const NON_KNOWLEDGE_INTENTS = new Set(['COMPLAINT', 'HUMAN_REQUEST', 'SUPPORT']);
const NON_KNOWLEDGE_MESSAGE = /\b(complaint|refund|chargeback|fraud|lawyer|legal|manager|supervisor|human|person|discount|negotiate|cheaper|match price)\b/i;

/**
 * Retrieval can look fine (a passage on the right topic) while the passage does not actually contain the
 * fact the customer asked for; the agent then says it does not know. That is still a knowledge gap, so
 * record it. Cases already logged at retrieval time (not covered, or conflicting) are skipped.
 */
function noteAgentDeferral(message, { knowledge, decided, workspaceId, channel = 'chat', track = true }) {
  if (!track || !knowledge || !decided?.needsHandoff) return;
  if (!knowledge.retrieval.grounded || knowledge.retrieval.conflict) return;
  if (NON_KNOWLEDGE_INTENTS.has(String(decided.intent || ''))) return;
  if (NON_KNOWLEDGE_MESSAGE.test(message)) return;
  void gaps.recordGap(
    { question: message, channel, kind: 'missing', detail: 'Related content was found, but it did not answer this question.' },
    workspaceId
  );
}

module.exports = { prepareKnowledge, noteAgentDeferral, NOT_COVERED_NOTE };
