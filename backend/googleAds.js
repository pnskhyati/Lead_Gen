/**
 * Google Ads lead forms → Nexora CRM (Integration step 1).
 * Webhook + simulate; optional API sync when OAuth env is set.
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const leadsCrm = require('./leadsCrm');

const WEBHOOK_SECRET = process.env.GOOGLE_ADS_WEBHOOK_SECRET || '';
const DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN || '';
const CUSTOMER_ID = String(process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');

const LOG_PATH = path.join(__dirname, 'data', 'google-ads-log.json');

function isWebhookConfigured() {
  return true;
}

function isApiConfigured() {
  return Boolean(DEVELOPER_TOKEN && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && CUSTOMER_ID);
}

function getStatus() {
  return {
    webhookReady: isWebhookConfigured(),
    apiSyncReady: isApiConfigured(),
    customerId: CUSTOMER_ID ? `${CUSTOMER_ID.slice(0, 4)}…` : null,
    webhookPath: '/api/google-ads/webhook',
  };
}

function verifyWebhook(req) {
  if (!WEBHOOK_SECRET) return true;
  const header = req.headers['x-google-ads-webhook-secret'] || req.query.secret;
  return String(header || '') === WEBHOOK_SECRET;
}

function readLog() {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  } catch {
    return { events: [] };
  }
}

function writeLog(entry) {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const log = readLog();
  log.events = [{ ...entry, at: new Date().toISOString() }, ...(log.events || [])].slice(0, 200);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function pickColumn(columns, names) {
  if (!Array.isArray(columns)) return '';
  for (const name of names) {
    const hit = columns.find(
      (c) =>
        String(c.column_name || c.columnName || c.key || '')
          .toLowerCase()
          .includes(name) ||
        String(c.column_id || '').toLowerCase().includes(name)
    );
    const val = hit?.string_value ?? hit?.stringValue ?? hit?.value;
    if (val) return String(val).trim();
  }
  return '';
}

function normalizeInbound(body) {
  if (!body || typeof body !== 'object') return null;

  if (Array.isArray(body.user_column_data) || body.userColumnData) {
    const cols = body.user_column_data || body.userColumnData;
    const email = pickColumn(cols, ['email', 'e-mail']);
    const phone = pickColumn(cols, ['phone', 'mobile', 'tel']);
    const name = pickColumn(cols, ['name', 'full', 'first']);
    const message = pickColumn(cols, ['message', 'comment', 'question', 'company']);
    return {
      email,
      phone,
      author: name || email || 'Google Ads lead',
      customerComment: message || `Google Ads lead form submission`,
      campaignId: body.campaign_id || body.campaignId,
      formId: body.form_id || body.formId || body.lead_form_id,
      leadId: body.lead_id || body.id,
      gclid: body.gclid,
    };
  }

  const fields = body.fields || body;
  return {
    email: fields.email || fields.Email || '',
    phone: fields.phone || fields.phone_number || fields.Phone || '',
    author: fields.full_name || fields.name || fields.fullName || 'Google Ads lead',
    customerComment:
      fields.message || fields.comments || fields.customerComment || 'Inbound Google Ads lead form',
    campaignId: fields.campaign_id || body.campaign_id,
    formId: fields.form_id || body.form_id,
    leadId: fields.lead_id || body.lead_id,
    gclid: fields.gclid || body.gclid,
  };
}

async function ingestLeadForm(vertex, leadAgent, normalized, { runAgent = true } = {}) {
  const externalId = normalized.leadId
    ? `gads:${normalized.leadId}`
    : `gads:${normalized.email || normalized.phone || Date.now()}`;

  let lead = await leadsCrm.upsertLead({
    channel: 'google_ads',
    platform: 'Google Ads Lead Form',
    externalId,
    author: normalized.author,
    email: normalized.email || undefined,
    phone: normalized.phone || undefined,
    customerComment: normalized.customerComment,
    lifecycleStage: 'captured',
    attribution: {
      leadSource: 'google_ads',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: normalized.campaignId ? String(normalized.campaignId) : 'ads_lead_form',
      gclid: normalized.gclid || undefined,
      googleAdsCampaignId: normalized.campaignId ? String(normalized.campaignId) : undefined,
      googleAdsFormId: normalized.formId ? String(normalized.formId) : undefined,
      googleAdsLeadId: normalized.leadId ? String(normalized.leadId) : undefined,
    },
  });

  await leadsCrm.addMessage({
    leadId: lead.id,
    role: 'customer',
    text: normalized.customerComment,
  });

  if (runAgent && leadAgent && vertex && !lead.autoReplyPaused) {
    let ck;
    try {
      ck = require('./companyKnowledge');
    } catch {
      ck = null;
    }
    if (!ck || ck.isChannelAutoReplyEnabled('google_ads')) {
      try {
        const agentResult = await leadAgent.chat(vertex, {
          message: normalized.customerComment,
          history: [],
          visitorName: normalized.author,
          previousScore: lead.score ?? 0,
        });
        lead = await leadsCrm.upsertLead({
          id: lead.id,
          channel: 'google_ads',
          temperature: agentResult.leadTemperature,
          score: agentResult.leadScore,
          scoreBand: agentResult.scoreBand,
          intent: agentResult.intent,
          intentSummary: agentResult.intentSummary,
          nextBestAction: agentResult.nextBestAction,
          suggestedReply: agentResult.reply,
          status: agentResult.needsHandoff
            ? 'handed_off'
            : agentResult.leadScore >= 70
              ? 'qualified'
              : 'contacted',
          autoReplyPaused: agentResult.needsHandoff,
          lifecycleStage: 'engaged',
        });
        await leadsCrm.addMessage({ leadId: lead.id, role: 'agent', text: agentResult.reply });
      } catch (err) {
        console.warn('[GoogleAds] agent qualify', err.message);
      }
    }
  }

  writeLog({ type: 'ingest', leadId: lead.id, campaignId: normalized.campaignId });
  return lead;
}

async function getAccessToken() {
  const { data } = await axios.post('https://oauth2.googleapis.com/token', null, {
    params: {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    },
  });
  return data.access_token;
}

async function syncLeadFormsFromApi(vertex, leadAgent) {
  if (!isApiConfigured()) {
    return { synced: 0, message: 'Set GOOGLE_ADS_* OAuth env vars or use webhook delivery in Ads UI.' };
  }
  const token = await getAccessToken();
  const query = `
    SELECT
      lead_form_submission_data.id,
      lead_form_submission_data.campaign,
      lead_form_submission_data.lead_form_submission_fields
    FROM lead_form_submission_data
    WHERE segments.date DURING LAST_7_DAYS
    LIMIT 50
  `;
  const url = `https://googleads.googleapis.com/v17/customers/${CUSTOMER_ID}/googleAds:search`;
  const { data } = await axios.post(
    url,
    { query },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': DEVELOPER_TOKEN,
        'Content-Type': 'application/json',
      },
    }
  );

  const rows = data.results || [];
  let synced = 0;
  for (const row of rows) {
    const sub = row.leadFormSubmissionData || row.lead_form_submission_data;
    if (!sub) continue;
    const fields = sub.leadFormSubmissionFields || sub.lead_form_submission_fields || [];
    const normalized = normalizeInbound({
      user_column_data: fields.map((f) => ({
        column_name: f.fieldType || f.field_type,
        string_value: f.fieldValue || f.field_value,
      })),
      lead_id: sub.id,
      campaign_id: sub.campaign,
    });
    if (!normalized) continue;
    await ingestLeadForm(vertex, leadAgent, normalized, { runAgent: true });
    synced += 1;
  }
  return { synced, fetched: rows.length };
}

function mountRoutes(app, { vertex, leadAgent, requireAuth }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();

  app.get('/api/google-ads/status', guard, (_req, res) => {
    res.json({ success: true, data: getStatus() });
  });

  app.get('/api/google-ads/log', guard, (_req, res) => {
    res.json({ success: true, data: readLog() });
  });

  app.post('/api/google-ads/webhook', async (req, res) => {
    if (!verifyWebhook(req)) {
      return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
    }
    try {
      const normalized = normalizeInbound(req.body);
      if (!normalized) {
        return res.status(400).json({ success: false, error: 'Unrecognized payload' });
      }
      const lead = await ingestLeadForm(vertex, leadAgent, normalized);
      res.json({ success: true, data: { lead } });
    } catch (err) {
      console.error('[GoogleAds] webhook', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/google-ads/simulate', guard, async (req, res) => {
    try {
      const body = req.body || {};
      const normalized = normalizeInbound({
        user_column_data: [
          { column_name: 'Full name', string_value: body.name || 'Ads Test Lead' },
          { column_name: 'Email', string_value: body.email || 'ads-lead@example.com' },
          { column_name: 'Phone', string_value: body.phone || '' },
          { column_name: 'Message', string_value: body.message || 'Interested from Google Ads test.' },
        ],
        campaign_id: body.campaignId || 'demo-campaign',
        form_id: body.formId || 'demo-form',
        lead_id: `sim-${Date.now()}`,
        gclid: body.gclid || 'demo-gclid',
      });
      const lead = await ingestLeadForm(vertex, leadAgent, normalized);
      res.json({ success: true, data: { lead } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/google-ads/sync', guard, async (_req, res) => {
    try {
      const data = await syncLeadFormsFromApi(vertex, leadAgent);
      res.json({ success: true, data });
    } catch (err) {
      console.error('[GoogleAds] sync', err.response?.data || err.message);
      res.status(500).json({
        success: false,
        error: err.response?.data?.error?.message || err.message,
      });
    }
  });
}

module.exports = {
  mountRoutes,
  getStatus,
  ingestLeadForm,
  normalizeInbound,
};
