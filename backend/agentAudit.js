/**
 * Append-only agent audit trail (Limitations §28).
 * Reconstruct decisions without storing private chain-of-thought.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const AUDIT_PATH = path.join(DATA_DIR, 'agent-audit.jsonl');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function appendAudit(event) {
  ensureDir();
  const row = {
    event_id: event.event_id || `evt-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    organization_id: event.organization_id || 'default',
    actor_type: event.actor_type || 'agent',
    actor_id: event.actor_id || null,
    agent_name: event.agent_name || 'Tecavy Engagement Agent',
    agent_version: event.agent_version || null,
    action: event.action,
    resource_type: event.resource_type || 'conversation',
    resource_id: event.resource_id || null,
    policy_decision: event.policy_decision || null,
    rule_id: event.rule_id || null,
    input_refs: event.input_refs || null,
    result: event.result || null,
    status: event.status || 'ok',
    idempotency_key: event.idempotency_key || null,
    model: event.model || null,
    prompt_version: event.prompt_version || null,
    scoring_version: event.scoring_version || null,
    cost_latency: event.cost_latency || null,
    timestamp: new Date().toISOString(),
    meta: event.meta || null,
  };
  fs.appendFileSync(AUDIT_PATH, `${JSON.stringify(row)}\n`);
  return row;
}

function recentAudits(limit = 50) {
  ensureDir();
  if (!fs.existsSync(AUDIT_PATH)) return [];
  const lines = fs.readFileSync(AUDIT_PATH, 'utf8').trim().split('\n').filter(Boolean);
  return lines
    .slice(-limit)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .reverse();
}

module.exports = { appendAudit, recentAudits, AUDIT_PATH };
