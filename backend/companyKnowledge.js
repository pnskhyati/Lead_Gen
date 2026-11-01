/**
 * Company knowledge & brand voice — uploaded docs + derived tone profile.
 * Feeds RAG and AI system prompts across Lead Agent / Catalyst / content gen.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data', 'company');
const PROFILE_PATH = path.join(DATA_DIR, 'profile.json');
const DOCS_PATH = path.join(DATA_DIR, 'documents.json');

const DEFAULT_PROFILE = {
  companyName: '',
  industry: '',
  tagline: '',
  botName: '',
  instagramAutoReply: true,
  whatsappAutoReply: true,
  emailAutoReply: true,
  voiceTone: '',
  writingStyle: '',
  vocabulary: [],
  avoid: [],
  audience: '',
  productsFocus: '',
  extraGuidelines: '',
  websiteUrl: '',
  businessPhone: '',
  businessAddress: '',
  googleBusinessProfileUrl: '',
  updatedAt: null,
  derivedFromDocs: false,
  setupCompletedAt: null,
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, fallback) {
  ensureDir();
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getProfile() {
  return { ...DEFAULT_PROFILE, ...readJson(PROFILE_PATH, {}) };
}

/** Required brand fields before the workspace unlocks */
function getSetupMissing(profile = getProfile()) {
  const missing = [];
  if (!String(profile.companyName || '').trim()) missing.push('companyName');
  if (!String(profile.botName || '').trim()) missing.push('botName');
  if (!String(profile.voiceTone || '').trim()) missing.push('voiceTone');
  if (!String(profile.writingStyle || '').trim()) missing.push('writingStyle');
  return missing;
}

function isSetupComplete(profile = getProfile()) {
  return getSetupMissing(profile).length === 0;
}

function getBotName() {
  const name = String(getProfile().botName || '').trim();
  return name || 'Assistant';
}

function isChannelAutoReplyEnabled(channel) {
  const p = getProfile();
  if (channel === 'instagram') return p.instagramAutoReply !== false;
  if (channel === 'whatsapp') return p.whatsappAutoReply !== false;
  if (channel === 'email') return p.emailAutoReply !== false;
  return true;
}

function saveProfile(patch) {
  const next = {
    ...getProfile(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (isSetupComplete(next) && !next.setupCompletedAt) {
    next.setupCompletedAt = new Date().toISOString();
  }
  writeJson(PROFILE_PATH, next);
  return next;
}

function listDocuments() {
  const store = readJson(DOCS_PATH, { documents: [] });
  return (store.documents || []).map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    mimeType: d.mimeType,
    charCount: (d.text || '').length,
    chunkCount: (d.chunks || []).length,
    tags: d.tags || [],
    uploadedAt: d.uploadedAt,
    uploadedBy: d.uploadedBy,
  }));
}

function getDocument(id) {
  const store = readJson(DOCS_PATH, { documents: [] });
  return (store.documents || []).find((d) => d.id === id) || null;
}

/** Split long text into RAG-friendly chunks */
function chunkText(text, { maxLen = 900 } = {}) {
  const clean = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n\n+/);
  const chunks = [];
  let buf = '';

  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = '';
  };

  for (const p of paragraphs) {
    if ((buf + '\n\n' + p).length > maxLen && buf) {
      flush();
    }
    if (p.length > maxLen) {
      // hard-split long paragraphs
      let i = 0;
      while (i < p.length) {
        chunks.push(p.slice(i, i + maxLen).trim());
        i += maxLen;
      }
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  flush();
  return chunks.filter(Boolean);
}

function addDocument({ title, fileName, mimeType, text, tags = [], uploadedBy }) {
  const body = String(text || '').trim();
  if (!body || body.length < 20) {
    throw new Error('Document text is too short (min ~20 characters)');
  }
  if (body.length > 400_000) {
    throw new Error('Document too large (max ~400k characters). Split it and upload again.');
  }

  const id = `doc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const chunks = chunkText(body).map((chunk, i) => ({
    id: `${id}-c${i + 1}`,
    title: `${title || fileName || 'Company doc'} (${i + 1})`,
    tags: ['company', 'uploaded', ...(tags || [])],
    text: chunk,
    sourceDocId: id,
  }));

  const store = readJson(DOCS_PATH, { documents: [] });
  const doc = {
    id,
    title: title || fileName || 'Untitled document',
    fileName: fileName || 'paste.txt',
    mimeType: mimeType || 'text/plain',
    text: body,
    chunks,
    tags: tags || [],
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy || null,
  };
  store.documents = [doc, ...(store.documents || [])].slice(0, 80);
  writeJson(DOCS_PATH, store);
  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    chunkCount: chunks.length,
    charCount: body.length,
    uploadedAt: doc.uploadedAt,
  };
}

function deleteDocument(id) {
  const store = readJson(DOCS_PATH, { documents: [] });
  const before = store.documents.length;
  store.documents = (store.documents || []).filter((d) => d.id !== id);
  writeJson(DOCS_PATH, store);
  return before !== store.documents.length;
}

/** All company RAG chunks for merging into retrieval */
function getCompanyChunks() {
  const store = readJson(DOCS_PATH, { documents: [] });
  const chunks = [];
  for (const doc of store.documents || []) {
    if (Array.isArray(doc.chunks) && doc.chunks.length) {
      chunks.push(...doc.chunks);
    } else if (doc.text) {
      chunkText(doc.text).forEach((text, i) => {
        chunks.push({
          id: `${doc.id}-c${i + 1}`,
          title: doc.title,
          tags: ['company', ...(doc.tags || [])],
          text,
          sourceDocId: doc.id,
        });
      });
    }
  }

  const profile = getProfile();
  if (profile.companyName || profile.voiceTone) {
    chunks.unshift({
      id: 'company-voice-profile',
      title: `${profile.companyName || 'Company'} brand voice`,
      tags: ['company', 'voice', 'tone', 'brand'],
      text: [
        profile.companyName ? `Company: ${profile.companyName}` : null,
        profile.industry ? `Industry: ${profile.industry}` : null,
        profile.tagline ? `Tagline: ${profile.tagline}` : null,
        profile.audience ? `Audience: ${profile.audience}` : null,
        profile.productsFocus ? `Products / focus: ${profile.productsFocus}` : null,
        `Voice & tone: ${profile.voiceTone}`,
        `Writing style: ${profile.writingStyle}`,
        profile.vocabulary?.length ? `Preferred vocabulary: ${profile.vocabulary.join(', ')}` : null,
        profile.avoid?.length ? `Avoid: ${profile.avoid.join(', ')}` : null,
        profile.extraGuidelines ? `Extra guidelines: ${profile.extraGuidelines}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  return chunks;
}

function buildVoiceInstruction(opts = {}) {
  const p = getProfile();
  if (!isSetupComplete(p)) {
    return `
BRAND SETUP INCOMPLETE:
Do not invent a brand voice. Ask the workspace admin to finish brand setup (company name, bot name, tone, writing style) before generating customer-facing copy.
`.trim();
  }
  const name = p.companyName || 'the company';
  const mode = opts.mode || 'company'; // company | custom | preset
  const overrideTone = String(opts.toneOverride || opts.customTone || '').trim();

  if (mode === 'custom' && overrideTone) {
    return `
WRITING VOICE (user-selected custom for this generation — follow strictly):
- Company context: ${p.companyName || 'this brand'} (${p.industry || 'general'})
- Custom tone for this output: ${overrideTone}
- Still respect brand avoid-list: ${(p.avoid || []).join(', ') || 'generic AI filler'}
- Prefer brand vocabulary when natural: ${(p.vocabulary || []).join(', ') || 'natural language'}
Write all copy in this custom tone while staying on-brand for ${name}.
`.trim();
  }

  if (mode === 'preset' && overrideTone) {
    return `
WRITING VOICE:
- Use preset tone: ${overrideTone}
- Soften/adapt it to fit company "${p.companyName || 'brand'}" if company voice exists.
- Company baseline tone: ${p.voiceTone || 'clear and helpful'}
- Avoid: ${(p.avoid || []).join(', ') || 'generic AI filler'}
`.trim();
  }

  // Default: full company brand voice
  return `
COMPANY BRAND VOICE (follow strictly — this overrides generic tone labels):
- Company: ${p.companyName || 'Tecavy workspace'}
- Industry: ${p.industry || 'n/a'}
- Tone: ${p.voiceTone}
- Style: ${p.writingStyle}
- Audience: ${p.audience || 'customers and prospects'}
- Product focus: ${p.productsFocus || 'n/a'}
- Prefer words: ${(p.vocabulary || []).join(', ') || 'natural brand language'}
- Never use: ${(p.avoid || []).join(', ') || 'generic AI filler'}
${p.extraGuidelines ? `- Extra: ${p.extraGuidelines}` : ''}
${overrideTone ? `- Session note (secondary): ${overrideTone}` : ''}
Every post, caption, and reply must sound like ${name} wrote it.
`.trim();
}

function getVoiceForGeneration({ voiceMode, tone, customTone } = {}) {
  const mode = voiceMode || 'company';
  if (mode === 'custom') {
    return buildVoiceInstruction({ mode: 'custom', toneOverride: customTone || tone });
  }
  if (mode === 'preset') {
    return buildVoiceInstruction({ mode: 'preset', toneOverride: tone });
  }
  return buildVoiceInstruction({ mode: 'company', toneOverride: tone });
}

async function deriveVoiceFromDocs(vertex) {
  const docs = readJson(DOCS_PATH, { documents: [] }).documents || [];
  if (!docs.length) {
    throw new Error('Upload at least one company document before deriving voice');
  }

  const sample = docs
    .slice(0, 6)
    .map((d) => `### ${d.title}\n${String(d.text).slice(0, 3500)}`)
    .join('\n\n');

  const { Type } = require('@google/genai');
  const schema = {
    type: Type.OBJECT,
    properties: {
      companyName: { type: Type.STRING },
      industry: { type: Type.STRING },
      tagline: { type: Type.STRING },
      voiceTone: { type: Type.STRING },
      writingStyle: { type: Type.STRING },
      vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } },
      avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
      audience: { type: Type.STRING },
      productsFocus: { type: Type.STRING },
      extraGuidelines: { type: Type.STRING },
    },
    required: ['voiceTone', 'writingStyle'],
  };

  const prompt = `Analyze these company documents and extract a practical brand voice profile for an AI assistant that will write customer chats, social posts, and campaign copy.

Return JSON only with:
- companyName, industry, tagline
- voiceTone (2-3 sentences describing how the brand should sound)
- writingStyle (sentence length, formality, structure)
- vocabulary (8-15 preferred words/phrases)
- avoid (words/phrases/clichés to ban)
- audience
- productsFocus
- extraGuidelines (do's and don'ts)

DOCUMENTS:
${sample}`;

  const parsed = await vertex.generateJson(prompt, schema, 'You are a brand strategist. Infer voice only from the documents.');
  const saved = saveProfile({
    ...parsed,
    derivedFromDocs: true,
  });
  return saved;
}

function getStatus() {
  const docs = listDocuments();
  const profile = getProfile();
  const missing = getSetupMissing(profile);
  return {
    documentCount: docs.length,
    chunkCount: getCompanyChunks().filter((c) => c.id !== 'company-voice-profile').length,
    hasVoice: Boolean(String(profile.voiceTone || '').trim()),
    companyName: profile.companyName || null,
    botName: String(profile.botName || '').trim() || null,
    instagramAutoReply: profile.instagramAutoReply !== false,
    whatsappAutoReply: profile.whatsappAutoReply !== false,
    emailAutoReply: profile.emailAutoReply !== false,
    derivedFromDocs: Boolean(profile.derivedFromDocs),
    updatedAt: profile.updatedAt,
    setupComplete: missing.length === 0,
    setupMissing: missing,
    setupCompletedAt: profile.setupCompletedAt || null,
  };
}

function requireAdmin(req, res, next) {
  if (req.appUser?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

function mountRoutes(app, { requireAuth, vertex }) {
  const guard = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();

  app.get('/api/company/status', guard, (_req, res) => {
    res.json({ success: true, data: getStatus() });
  });

  app.get('/api/company/setup', guard, (_req, res) => {
    const profile = getProfile();
    const missing = getSetupMissing(profile);
    res.json({
      success: true,
      data: {
        setupComplete: missing.length === 0,
        setupMissing: missing,
        profile,
      },
    });
  });

  // First-time brand setup: any signed-in user can complete it once.
  // After setup is complete, further edits require Admin via PUT /profile.
  app.post('/api/company/setup', guard, (req, res) => {
    try {
      if (isSetupComplete()) {
        return res.status(403).json({
          success: false,
          error: 'Brand setup already completed. Update brand details in Admin.',
        });
      }

      const body = req.body || {};
      const patch = {
        companyName: String(body.companyName || '').trim(),
        botName: String(body.botName || '').trim(),
        industry: String(body.industry || '').trim(),
        tagline: String(body.tagline || '').trim(),
        voiceTone: String(body.voiceTone || '').trim(),
        writingStyle: String(body.writingStyle || '').trim(),
        audience: String(body.audience || '').trim(),
        productsFocus: String(body.productsFocus || '').trim(),
        websiteUrl: String(body.websiteUrl || '').trim(),
        businessPhone: String(body.businessPhone || '').trim(),
        businessAddress: String(body.businessAddress || '').trim(),
        googleBusinessProfileUrl: String(body.googleBusinessProfileUrl || '').trim(),
        vocabulary: Array.isArray(body.vocabulary)
          ? body.vocabulary
          : String(body.vocabulary || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
        avoid: Array.isArray(body.avoid)
          ? body.avoid
          : String(body.avoid || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
        extraGuidelines: String(body.extraGuidelines || '').trim(),
        instagramAutoReply: body.instagramAutoReply !== false,
        whatsappAutoReply: body.whatsappAutoReply !== false,
        emailAutoReply: body.emailAutoReply !== false,
      };

      const missing = getSetupMissing(patch);
      if (missing.length) {
        return res.status(400).json({
          success: false,
          error: `Complete required fields: ${missing.join(', ')}`,
          missing,
        });
      }

      const saved = saveProfile({
        ...patch,
        setupCompletedAt: new Date().toISOString(),
      });
      try {
        require('./rag').reload();
      } catch {
        /* ignore */
      }
      res.json({ success: true, data: { profile: saved, setupComplete: true } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/company/profile', guard, (_req, res) => {
    res.json({ success: true, data: getProfile() });
  });

  app.put('/api/company/profile', guard, requireAdmin, (req, res) => {
    try {
      const allowed = [
        'companyName',
        'industry',
        'tagline',
        'botName',
        'instagramAutoReply',
        'whatsappAutoReply',
        'emailAutoReply',
        'voiceTone',
        'writingStyle',
        'vocabulary',
        'avoid',
        'audience',
        'productsFocus',
        'extraGuidelines',
        'websiteUrl',
        'businessPhone',
        'businessAddress',
        'googleBusinessProfileUrl',
      ];
      const patch = {};
      for (const key of allowed) {
        if (req.body?.[key] !== undefined) patch[key] = req.body[key];
      }
      const saved = saveProfile(patch);
      try {
        require('./rag').reload();
      } catch {
        /* ignore */
      }
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/company/documents', guard, (_req, res) => {
    res.json({ success: true, data: listDocuments() });
  });

  app.post('/api/company/documents', guard, requireAdmin, (req, res) => {
    try {
      const doc = addDocument({
        title: req.body?.title,
        fileName: req.body?.fileName,
        mimeType: req.body?.mimeType,
        text: req.body?.text,
        tags: req.body?.tags,
        uploadedBy: req.appUser?.email,
      });
      try {
        require('./rag').reload();
      } catch {
        /* ignore */
      }
      res.json({ success: true, data: doc });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/company/documents/:id', guard, requireAdmin, (req, res) => {
    const ok = deleteDocument(req.params.id);
    try {
      require('./rag').reload();
    } catch {
      /* ignore */
    }
    if (!ok) return res.status(404).json({ success: false, error: 'Document not found' });
    res.json({ success: true });
  });

  app.post('/api/company/derive-voice', guard, requireAdmin, async (req, res) => {
    try {
      if (!vertex?.generateJson) {
        return res.status(503).json({ success: false, error: 'AI is not configured' });
      }
      const profile = await deriveVoiceFromDocs(vertex);
      try {
        require('./rag').reload();
      } catch {
        /* ignore */
      }
      res.json({ success: true, data: profile });
    } catch (err) {
      console.error('[Company] derive-voice', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  mountRoutes,
  getProfile,
  saveProfile,
  listDocuments,
  addDocument,
  deleteDocument,
  getCompanyChunks,
  buildVoiceInstruction,
  getVoiceForGeneration,
  deriveVoiceFromDocs,
  getStatus,
  getBotName,
  isChannelAutoReplyEnabled,
  isSetupComplete,
  getSetupMissing,
  requireAdmin,
};
