/**
 * Append CRM leads to Google Sheets (Integration step 3).
 */
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const SHEET_TAB = process.env.GOOGLE_SHEETS_TAB || 'Leads';
const CREDS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

function isConfigured() {
  return Boolean(SPREADSHEET_ID && CREDS_PATH);
}

function getStatus() {
  return {
    configured: isConfigured(),
    spreadsheetId: SPREADSHEET_ID ? `${SPREADSHEET_ID.slice(0, 8)}…` : null,
    sheetTab: SHEET_TAB,
  };
}

async function getSheetsClient() {
  if (!isConfigured()) {
    throw new Error('Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_APPLICATION_CREDENTIALS');
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

function leadToRow(lead) {
  const attr = lead.attribution || {};
  return [
    new Date().toISOString(),
    lead.id,
    lead.author || '',
    lead.email || '',
    lead.phone || '',
    lead.channel || '',
    lead.platform || '',
    lead.status || '',
    lead.temperature || '',
    String(lead.score ?? ''),
    lead.intentSummary || '',
    lead.nextBestAction || '',
    attr.utmSource || '',
    attr.utmMedium || '',
    attr.utmCampaign || '',
    attr.gclid || '',
    attr.googleAdsCampaignId || '',
    attr.googleAdsFormId || '',
  ];
}

const HEADER = [
  'timestamp',
  'lead_id',
  'name',
  'email',
  'phone',
  'channel',
  'platform',
  'status',
  'temperature',
  'score',
  'intent_summary',
  'next_best_action',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'gclid',
  'google_ads_campaign_id',
  'google_ads_form_id',
];

async function ensureHeaderRow() {
  const sheets = await getSheetsClient();
  const range = `${SHEET_TAB}!A1:R1`;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  const first = existing.data.values?.[0];
  if (first && first[0] === 'timestamp') return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER] },
  });
}

async function appendLeadRow(lead) {
  if (!isConfigured() || !lead?.id) return { skipped: true, reason: 'not_configured' };
  await ensureHeaderRow();
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TAB}!A:R`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [leadToRow(lead)] },
  });
  return { appended: true, leadId: lead.id };
}

function mountRoutes(app, guard) {
  app.get('/api/google/sheets/status', guard, (_req, res) => {
    res.json({ success: true, data: getStatus() });
  });

  app.post('/api/google/sheets/test', guard, async (_req, res) => {
    try {
      const sample = {
        id: `test-${Date.now()}`,
        author: 'Sheets test',
        channel: 'manual',
        platform: 'Test',
        status: 'new',
        temperature: 'warm',
        score: 50,
        attribution: { utmSource: 'test' },
      };
      const result = await appendLeadRow(sample);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  isConfigured,
  getStatus,
  appendLeadRow,
  mountRoutes,
};
