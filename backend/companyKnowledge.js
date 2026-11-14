/**
 * Company knowledge & brand voice — uploaded docs + derived tone profile.
 * Feeds RAG and AI system prompts across Lead Agent / Catalyst / content gen.
 *
 * Everything is scoped to a workspace. Callers without a workspace (webhooks, background
 * jobs) get the legacy "default" workspace until channels are mapped to workspaces.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const workspaceContext = require('./workspaceContext');

const DEFAULT_WORKSPACE = workspaceContext.DEFAULT_WORKSPACE;
const DATA_DIR = path.join(__dirname, 'data', 'company');

const DEFAULT_HANDOFF_RULES = {
  customerAsksPerson: true,
  aiNotSure: true,
  dealValueAbove: false,
  dealValueThreshold: '',
};

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
  usp: '',
  idealCustomer: '',
  painPoints: '',
  personas: '',
  reviews: '',
  extraGuidelines: '',
  websiteUrl: '',
  businessPhone: '',
  businessAddress: '',
  businessHours: '',
  location: '',
  handoffEmail: '',
  googleBusinessProfileUrl: '',
  faqs: [],
  handoffRules: DEFAULT_HANDOFF_RULES,
  plannedChannels: {},
  updatedAt: null,
  derivedFromDocs: false,
  setupCompletedAt: null,
};

// ---------------------------------------------------------------------------
// Storage (one folder per workspace; "default" keeps the legacy flat layout)
// ---------------------------------------------------------------------------

function wsKey(ws) {
  const id = String(ws || workspaceContext.current()).trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('Invalid workspace');
  return id;
}

function wsDir(ws) {
  const id = wsKey(ws);
  return id === DEFAULT_WORKSPACE ? DATA_DIR : path.join(DATA_DIR, 'workspaces', id);
}

const profilePath = (ws) => path.join(wsDir(ws), 'profile.json');
const docsPath = (ws) => path.join(wsDir(ws), 'documents.json');
const draftPath = (ws) => path.join(wsDir(ws), 'onboarding-draft.json');

function ensureDir(ws) {
  const dir = wsDir(ws);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function reloadRag(ws) {
  try {
    require('./rag').reload(ws);
  } catch {
    /* ignore */
  }
}

/** Re-embed in the background; keyword search keeps working while this runs or if it fails. */
function reindexInBackground(ws) {
  try {
    require('./rag')
      .indexEmbeddings(ws)
      .catch((err) => console.warn('[Company] embedding index failed:', err.message));
  } catch {
    /* ignore */
  }
}

/**
 * After new content lands: rebuild the index, embed it, then look for statements that contradict
 * existing knowledge. All best-effort and in the background; nothing here may fail a request.
 */
function reindexThenCheckConflicts(vertex, docId, ws) {
  try {
    const rag = require('./rag');
    rag.reload(ws);
    rag
      .indexEmbeddings(ws)
      .catch(() => undefined)
      .then(() => require('./knowledge/conflicts').detectConflicts(vertex, { docId }, ws))
      .then((r) => {
        if (r?.found) console.log(`[Conflicts] ${r.found} new conflict(s) found for workspace ${workspaceContext.resolve(ws)}`);
      })
      .catch((err) => console.warn('[Conflicts] check failed:', err.message));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

function getProfile(ws) {
  return { ...DEFAULT_PROFILE, ...readJson(profilePath(ws), {}) };
}

/** Required brand fields before the workspace unlocks */
function getSetupMissing(profile) {
  const p = profile || getProfile();
  const missing = [];
  if (!String(p.companyName || '').trim()) missing.push('companyName');
  if (!String(p.botName || '').trim()) missing.push('botName');
  if (!String(p.voiceTone || '').trim()) missing.push('voiceTone');
  if (!String(p.writingStyle || '').trim()) missing.push('writingStyle');
  return missing;
}

function isSetupComplete(profile) {
  return getSetupMissing(profile).length === 0;
}

function getBotName(ws) {
  const name = String(getProfile(ws).botName || '').trim();
  return name || 'Assistant';
}

function isChannelAutoReplyEnabled(channel, ws) {
  const p = getProfile(ws);
  if (channel === 'instagram') return p.instagramAutoReply !== false;
  if (channel === 'whatsapp') return p.whatsappAutoReply !== false;
  if (channel === 'email') return p.emailAutoReply !== false;
  return true;
}

function saveProfile(patch, ws) {
  const next = {
    ...getProfile(ws),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  if (isSetupComplete(next) && !next.setupCompletedAt) {
    next.setupCompletedAt = new Date().toISOString();
  }
  ensureDir(ws);
  writeJson(profilePath(ws), next);
  return next;
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);

function strList(v, { maxItems = 40, maxLen = 80 } = {}) {
  const arr = Array.isArray(v) ? v : String(v ?? '').split(',');
  return arr.map((s) => str(s, maxLen)).filter(Boolean).slice(0, maxItems);
}

function sanitizeFaqs(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((f, i) => ({
      id: str(f?.id, 40) || `faq-${i + 1}`,
      question: str(f?.question, 300),
      answer: str(f?.answer, 1500),
    }))
    .filter((f) => f.question && f.answer)
    .slice(0, 40);
}

function sanitizeHandoffRules(v) {
  const r = v && typeof v === 'object' ? v : {};
  return {
    customerAsksPerson: r.customerAsksPerson !== false,
    aiNotSure: r.aiNotSure !== false,
    dealValueAbove: r.dealValueAbove === true,
    dealValueThreshold: str(r.dealValueThreshold, 40),
  };
}

/** Validate/normalise a client-supplied profile patch; only keys that were sent are returned. */
function sanitizeProfilePatch(body) {
  const b = body || {};
  const patch = {};
  const strings = {
    companyName: 120, industry: 120, tagline: 200, botName: 40, voiceTone: 1200, writingStyle: 1200,
    audience: 600, productsFocus: 2000, usp: 600, idealCustomer: 800, painPoints: 1000, personas: 1500, reviews: 2000, extraGuidelines: 3000, websiteUrl: 300, businessPhone: 40,
    businessAddress: 400, businessHours: 400, location: 120, googleBusinessProfileUrl: 400,
  };
  for (const [key, max] of Object.entries(strings)) {
    if (b[key] !== undefined) patch[key] = str(b[key], max);
  }
  if (b.handoffEmail !== undefined) {
    const email = str(b.handoffEmail, 200);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Handoff email is not a valid address');
    patch.handoffEmail = email;
  }
  if (b.vocabulary !== undefined) patch.vocabulary = strList(b.vocabulary);
  if (b.avoid !== undefined) patch.avoid = strList(b.avoid);
  if (b.faqs !== undefined) patch.faqs = sanitizeFaqs(b.faqs);
  if (b.handoffRules !== undefined) patch.handoffRules = sanitizeHandoffRules(b.handoffRules);
  for (const key of ['instagramAutoReply', 'whatsappAutoReply', 'emailAutoReply']) {
    if (b[key] !== undefined) patch[key] = b[key] !== false;
  }
  if (b.plannedChannels && typeof b.plannedChannels === 'object') {
    patch.plannedChannels = {};
    for (const k of ['whatsapp', 'instagram', 'facebook', 'email', 'webchat']) {
      if (k in b.plannedChannels) patch.plannedChannels[k] = b.plannedChannels[k] === true;
    }
  }
  return patch;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const BOILERPLATE_LINE = /(cookie|accept all|privacy policy|terms (of|and) (service|use|conditions)|all rights reserved|subscribe to our newsletter|follow us on|sign up for (our|the))/i;
const STALE_WEBSITE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Cheap, explainable quality signals so owners can see which documents are weak. */
function documentQuality(d) {
  const flags = [];
  const text = String(d.text || '');
  if (d.status === 'archived') flags.push('archived');
  if (text.length < 300) flags.push('very_short');
  const lines = text.split('\n').filter((l) => l.trim());
  const boiler = lines.filter((l) => l.length < 200 && BOILERPLATE_LINE.test(l)).length;
  if (lines.length >= 8 && boiler / lines.length > 0.2) flags.push('boilerplate_heavy');
  if (d.ocr) flags.push('scanned_ocr');
  if (d.source === 'website') {
    const age = Date.now() - new Date(d.uploadedAt).getTime();
    if (age > STALE_WEBSITE_DAYS * DAY_MS) flags.push('stale');
    if ((text.match(/^Source: /gm) || []).length < 3) flags.push('few_pages');
  }
  return flags;
}

function listDocuments(ws) {
  const store = readJson(docsPath(ws), { documents: [] });
  return (store.documents || []).map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    mimeType: d.mimeType,
    charCount: (d.text || '').length,
    chunkCount: (d.chunks || []).length,
    tags: d.tags || [],
    source: d.source || 'upload',
    sourceUrl: d.sourceUrl || null,
    status: d.status || 'active',
    ocr: Boolean(d.ocr),
    quality: documentQuality(d),
    uploadedAt: d.uploadedAt,
    uploadedBy: d.uploadedBy,
  }));
}

function normalizeDocName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/\b(v|ver|version)?\s*\d+(\.\d+)*\b/g, ' ')
    .replace(/\b(final|copy|new|old|updated|latest|draft|rev)\b/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/** Existing documents that look like an older/newer version of this one (same name pattern or mostly the same words). */
function findSimilarDocuments(title, body, existing) {
  const { tokenize } = require('./rag');
  const name = normalizeDocName(title);
  const tokens = new Set(tokenize(body.slice(0, 3000)));
  const out = [];
  for (const d of existing) {
    if ((d.status || 'active') === 'archived') continue;
    const sameName = name.length >= 3 && normalizeDocName(d.title) === name;
    let overlap = 0;
    if (!sameName) {
      const other = new Set(tokenize(String(d.text || '').slice(0, 3000)));
      let inter = 0;
      for (const t of tokens) if (other.has(t)) inter += 1;
      overlap = inter / (tokens.size + other.size - inter || 1);
    }
    if (sameName || overlap >= 0.5) out.push({ id: d.id, title: d.title, uploadedAt: d.uploadedAt, reason: sameName ? 'same_name' : 'similar_content' });
  }
  return out;
}

function setDocumentStatus(id, status, ws) {
  if (!['active', 'archived'].includes(status)) throw new Error('status must be active or archived');
  const store = readJson(docsPath(ws), { documents: [] });
  const doc = (store.documents || []).find((d) => d.id === id);
  if (!doc) return false;
  doc.status = status;
  writeJson(docsPath(ws), store);
  return true;
}

function getDocument(id, ws) {
  const store = readJson(docsPath(ws), { documents: [] });
  return (store.documents || []).find((d) => d.id === id) || null;
}

const SENTENCE_SPLIT = /(?<=[.!?।])\s+(?=[A-Z0-9"'(₹$#])/;
const HEADING = /^(#{1,6}\s+.+|[A-Z][A-Z0-9 &/,'-]{3,60})$/;

/**
 * Split text into retrieval-sized chunks: paragraph-aware, with the nearest heading carried
 * into each chunk and a short overlap so facts that straddle a boundary stay findable.
 */
function chunkText(text, { maxLen = 900, overlap = 150 } = {}) {
  const clean = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!clean) return [];

  const pieces = [];
  for (const para of clean.split(/\n\n+/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length <= maxLen) {
      pieces.push(p);
      continue;
    }
    // Over-long paragraph: split on sentences, hard-split only as a last resort.
    let buf = '';
    for (const sentence of p.split(SENTENCE_SPLIT)) {
      if (sentence.length > maxLen) {
        if (buf) pieces.push(buf);
        buf = '';
        for (let i = 0; i < sentence.length; i += maxLen) pieces.push(sentence.slice(i, i + maxLen));
      } else if ((buf + ' ' + sentence).trim().length > maxLen) {
        pieces.push(buf);
        buf = sentence;
      } else {
        buf = `${buf} ${sentence}`.trim();
      }
    }
    if (buf) pieces.push(buf);
  }

  const chunks = [];
  let heading = '';
  let buf = '';
  let bufHeading = '';

  const flush = () => {
    const body = buf.trim();
    if (body) {
      const startsWithHeading = body.startsWith(bufHeading);
      chunks.push(bufHeading && !startsWithHeading ? `${bufHeading}\n${body}` : body);
    }
  };

  for (const piece of pieces) {
    if (HEADING.test(piece) && piece.length <= 80) {
      heading = piece.replace(/^#+\s*/, '');
      continue; // headings ride along with the paragraphs below them
    }
    if (buf && (buf + '\n\n' + piece).length > maxLen) {
      const tail = buf.length > overlap ? buf.slice(-overlap).replace(/^\S*\s/, '') : '';
      flush();
      buf = tail ? `${tail}\n\n${piece}` : piece;
      bufHeading = heading;
    } else {
      if (!buf) bufHeading = heading;
      buf = buf ? `${buf}\n\n${piece}` : piece;
    }
  }
  flush();
  return chunks.filter(Boolean);
}

function addDocument(
  { title, fileName, mimeType, text, tags = [], uploadedBy, source = 'upload', sourceUrl = null, sourceKey = null, ocr = false },
  ws
) {
  const body = String(text || '').trim();
  if (!body || body.length < 20) {
    throw new Error('Document text is too short (min ~20 characters)');
  }
  if (body.length > 400_000) {
    throw new Error('Document too large (max ~400k characters). Split it and upload again.');
  }

  const textHash = crypto.createHash('sha1').update(body).digest('hex');
  const store = readJson(docsPath(ws), { documents: [] });
  let existing = store.documents || [];

  // Re-crawling a site replaces its previous snapshot; re-uploading identical content is a no-op.
  const previous = sourceKey ? existing.find((d) => d.sourceKey === sourceKey) : null;
  if (sourceKey) existing = existing.filter((d) => d.sourceKey !== sourceKey);
  const similarTo = sourceKey ? [] : findSimilarDocuments(title || fileName || '', body, existing);
  const duplicate = existing.find((d) => d.textHash === textHash);
  if (duplicate) {
    return {
      id: duplicate.id,
      title: duplicate.title,
      fileName: duplicate.fileName,
      chunkCount: (duplicate.chunks || []).length,
      charCount: duplicate.text.length,
      uploadedAt: duplicate.uploadedAt,
      duplicate: true,
    };
  }

  const id = `doc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const chunks = chunkText(body).map((chunk, i) => ({
    id: `${id}-c${i + 1}`,
    title: `${title || fileName || 'Company doc'} (${i + 1})`,
    tags: ['company', 'uploaded', ...(tags || [])],
    text: chunk,
    sourceDocId: id,
  }));

  const doc = {
    id,
    title: title || fileName || 'Untitled document',
    fileName: fileName || 'paste.txt',
    mimeType: mimeType || 'text/plain',
    text: body,
    textHash,
    chunks,
    tags: tags || [],
    source,
    sourceUrl,
    sourceKey,
    ocr: Boolean(ocr),
    status: 'active',
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy || null,
  };
  store.documents = [doc, ...existing].slice(0, 80);
  ensureDir(ws);
  writeJson(docsPath(ws), store);
  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    chunkCount: chunks.length,
    charCount: body.length,
    uploadedAt: doc.uploadedAt,
    similarTo,
    unchanged: Boolean(previous && previous.textHash === textHash),
  };
}

function deleteDocument(id, ws) {
  const store = readJson(docsPath(ws), { documents: [] });
  const before = (store.documents || []).length;
  store.documents = (store.documents || []).filter((d) => d.id !== id);
  writeJson(docsPath(ws), store);
  return before !== store.documents.length;
}

// ---------------------------------------------------------------------------
// Knowledge chunks (documents + brand profile + FAQs + business facts)
// ---------------------------------------------------------------------------

function factsChunk(profile) {
  const lines = [
    profile.companyName ? `Business name: ${profile.companyName}` : null,
    profile.industry ? `Industry: ${profile.industry}` : null,
    profile.location ? `Location: ${profile.location}` : null,
    profile.businessAddress ? `Address: ${profile.businessAddress}` : null,
    profile.businessPhone ? `Phone: ${profile.businessPhone}` : null,
    profile.businessHours ? `Opening hours: ${profile.businessHours}` : null,
    profile.websiteUrl ? `Website: ${profile.websiteUrl}` : null,
    profile.googleBusinessProfileUrl ? `Google Business Profile: ${profile.googleBusinessProfileUrl}` : null,
    profile.productsFocus ? `What we offer: ${profile.productsFocus}` : null,
  ].filter(Boolean);
  if (lines.length < 2) return null;
  return {
    id: 'company-facts',
    title: `${profile.companyName || 'Company'} contact details, location and offerings`,
    tags: ['company', 'facts', 'contact', 'phone', 'address', 'location', 'hours', 'website', 'services', 'about'],
    text: lines.join('\n'),
  };
}

function handoffChunk(profile) {
  const r = profile.handoffRules || DEFAULT_HANDOFF_RULES;
  const rules = [
    r.customerAsksPerson ? 'the customer asks for a person' : null,
    r.aiNotSure ? 'the assistant is not sure of the answer' : null,
    r.dealValueAbove && r.dealValueThreshold ? `the deal value is above ${r.dealValueThreshold}` : null,
  ].filter(Boolean);
  if (!rules.length) return null;
  return {
    id: 'company-handoff-rules',
    title: 'When to hand a conversation to a human',
    tags: ['company', 'handoff', 'human', 'escalation'],
    text: `Hand the conversation to a human team member when: ${rules.join('; ')}.`,
  };
}

/** All company RAG chunks for a workspace */
function getCompanyChunks(ws) {
  const store = readJson(docsPath(ws), { documents: [] });
  const chunks = [];
  for (const doc of store.documents || []) {
    if ((doc.status || 'active') === 'archived') continue;
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

  const profile = getProfile(ws);

  for (const faq of profile.faqs || []) {
    chunks.unshift({
      id: `faq-${faq.id}`,
      title: faq.question,
      tags: ['company', 'faq'],
      text: `Q: ${faq.question}\nA: ${faq.answer}`,
    });
  }

  const handoff = handoffChunk(profile);
  if (handoff) chunks.unshift(handoff);
  const facts = factsChunk(profile);
  if (facts) chunks.unshift(facts);

  // Passages the owner dropped while resolving a conflict.
  let suppressed = new Set();
  try {
    suppressed = require('./knowledge/conflicts').suppressedChunkIds(ws);
  } catch {
    /* none */
  }
  if (suppressed.size) {
    for (let i = chunks.length - 1; i >= 0; i -= 1) if (suppressed.has(chunks[i].id)) chunks.splice(i, 1);
  }

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

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function buildVoiceInstruction(opts = {}, ws) {
  const p = getProfile(ws);
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
${brainLines(p)}- Prefer words: ${(p.vocabulary || []).join(', ') || 'natural brand language'}
- Never use: ${(p.avoid || []).join(', ') || 'generic AI filler'}
${p.extraGuidelines ? `- Extra: ${p.extraGuidelines}` : ''}
${overrideTone ? `- Session note (secondary): ${overrideTone}` : ''}
Every post, caption, and reply must sound like ${name} wrote it.
`.trim();
}

/** What makes the business different and who it serves. Only what the owner wrote; empty fields are left out. */
function brainLines(p) {
  const rows = [
    ['What makes us different', p.usp],
    ['Ideal customer', p.idealCustomer],
    ['Their main problems', p.painPoints],
    ['Customer types', p.personas],
    ['Real customer feedback (quote only these, never invent any)', p.reviews],
  ];
  return rows.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}
`).join('');
}

function getVoiceForGeneration({ voiceMode, tone, customTone } = {}, ws) {
  const mode = voiceMode || 'company';
  if (mode === 'custom') {
    return buildVoiceInstruction({ mode: 'custom', toneOverride: customTone || tone }, ws);
  }
  if (mode === 'preset') {
    return buildVoiceInstruction({ mode: 'preset', toneOverride: tone }, ws);
  }
  return buildVoiceInstruction({ mode: 'company', toneOverride: tone }, ws);
}

async function deriveVoiceFromDocs(vertex, ws) {
  const docs = readJson(docsPath(ws), { documents: [] }).documents || [];
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
  const saved = saveProfile(
    {
      ...sanitizeProfilePatch(parsed),
      derivedFromDocs: true,
    },
    ws
  );
  return saved;
}

// ---------------------------------------------------------------------------
// Onboarding: learn the business from its website + documents
// ---------------------------------------------------------------------------

async function analyzeBusiness(vertex, { websiteUrl, uploadedBy, onProgress, refreshOnly = false } = {}, ws) {
  const progress = (stage, detail) => {
    try {
      onProgress?.(stage, detail);
    } catch {
      /* progress is best-effort */
    }
  };
  const { crawlCompanySite, pagesToDocumentText } = require('./knowledge/websiteIngest');
  const sourceTexts = [];
  const sources = { pages: [], documents: 0 };
  let websiteDocId = null;
  let websiteUnchanged = false;

  if (websiteUrl) {
    progress('fetching');
    const site = await crawlCompanySite(websiteUrl);
    progress('reading', { pages: site.pages.length, rendered: Boolean(site.rendered) });
    const stored = addDocument(
      {
        title: `Website: ${new URL(site.origin).hostname}`,
        fileName: `${new URL(site.origin).hostname}.html`,
        mimeType: 'text/html',
        text: pagesToDocumentText(site.pages),
        tags: ['website'],
        source: 'website',
        sourceUrl: site.origin,
        sourceKey: `website:${site.origin}`,
        uploadedBy,
      },
      ws
    );
    websiteDocId = stored.id;
    websiteUnchanged = Boolean(stored.unchanged);
    sources.pages = site.pages.map((p) => p.url);
    if (refreshOnly) {
      progress('done');
      return { refreshed: true, sources, docId: websiteDocId, unchanged: websiteUnchanged, draft: null };
    }
    sourceTexts.push(...site.pages.map((p) => `### ${p.title || p.url} (${p.url})\n${p.text.slice(0, 3500)}`));
    if (site.structuredData.length) {
      sourceTexts.push(`### Structured data (schema.org)\n${JSON.stringify(site.structuredData).slice(0, 3000)}`);
    }
  }

  const otherDocs = (readJson(docsPath(ws), { documents: [] }).documents || []).filter((d) => d.source !== 'website');
  sources.documents = otherDocs.length;
  sourceTexts.push(...otherDocs.slice(0, 4).map((d) => `### ${d.title}\n${String(d.text).slice(0, 3000)}`));

  if (!sourceTexts.length) throw new Error('Add a website address or upload a document first');
  progress('learning');

  const { Type } = require('@google/genai');
  const schema = {
    type: Type.OBJECT,
    properties: {
      companyName: { type: Type.STRING },
      industry: { type: Type.STRING },
      tagline: { type: Type.STRING },
      location: { type: Type.STRING },
      whatYouSell: { type: Type.STRING },
      audience: { type: Type.STRING },
      businessPhone: { type: Type.STRING },
      businessAddress: { type: Type.STRING },
      businessHours: { type: Type.STRING },
      voiceTone: { type: Type.STRING },
      writingStyle: { type: Type.STRING },
      vocabulary: { type: Type.ARRAY, items: { type: Type.STRING } },
      avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
      suggestedFaqs: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
          required: ['question', 'answer'],
        },
      },
    },
    required: ['companyName', 'whatYouSell', 'voiceTone', 'writingStyle'],
  };

  const prompt = `Read the business material below and extract what an AI assistant needs to represent this company to customers.

RULES
- Use ONLY facts stated in the material. If something is not stated, return an empty string — never guess.
- Never invent prices, hours, phone numbers or addresses.
- whatYouSell: 1-3 sentences on products/services offered.
- voiceTone: 2 sentences describing how the brand sounds, inferred from its own wording.
- writingStyle: sentence length, formality, structure.
- suggestedFaqs: 4-8 questions real customers would ask. Each answer must be fully supported by the material; skip a question if the material does not answer it.

MATERIAL
${sourceTexts.join('\n\n').slice(0, 30000)}`;

  const draft = await vertex.generateJson(prompt, schema, 'You are a careful business analyst. Extract only what the source states.');
  const clean = {
    ...sanitizeProfilePatch({ ...draft, productsFocus: draft.whatYouSell, faqs: draft.suggestedFaqs }),
    whatYouSell: str(draft.whatYouSell, 2000),
  };
  return { draft: clean, sources, docId: websiteDocId, unchanged: websiteUnchanged };
}

// Website analysis takes 30+ seconds, so it runs as a background job the client polls.
const JOB_TTL_MS = 30 * 60_000;
const analyzeJobs = new Map();

function pruneJobs() {
  const now = Date.now();
  for (const [id, job] of analyzeJobs) {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) analyzeJobs.delete(id);
  }
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    detail: job.detail || null,
    result: job.status === 'done' ? job.result : undefined,
    error: job.status === 'error' ? job.error : undefined,
    startedAt: job.startedAt,
  };
}

/** Start (or join) the analysis job for a workspace. Only one runs at a time per workspace. */
function startAnalyzeJob(vertex, { websiteUrl, uploadedBy, refreshOnly = false }, ws) {
  pruneJobs();
  const workspace = workspaceContext.resolve(ws);
  for (const job of analyzeJobs.values()) {
    if (job.ws === workspace && job.status === 'running') return job;
  }
  const job = {
    id: `an-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
    ws: workspace,
    status: 'running',
    stage: 'queued',
    detail: null,
    startedAt: Date.now(),
  };
  analyzeJobs.set(job.id, job);

  workspaceContext
    .run(workspace, () =>
      analyzeBusiness(
        vertex,
        {
          websiteUrl,
          uploadedBy,
          refreshOnly,
          onProgress: (stage, detail) => {
            job.stage = stage;
            job.detail = detail || null;
          },
        },
        workspace
      )
    )
    .then((result) => {
      job.status = 'done';
      job.stage = 'done';
      job.result = result;
      reloadRag(workspace);
      if (result.docId && !result.unchanged) reindexThenCheckConflicts(vertex, result.docId, workspace);
      else reindexInBackground(workspace);
    })
    .catch((err) => {
      console.error('[Company] analyze job', err.message);
      job.status = 'error';
      job.error = err.message;
    })
    .finally(() => {
      job.finishedAt = Date.now();
    });
  return job;
}

function getAnalyzeJob(id, ws) {
  const job = analyzeJobs.get(String(id));
  return job && job.ws === workspaceContext.resolve(ws) ? job : null;
}

// ---------------------------------------------------------------------------
// Knowledge health
// ---------------------------------------------------------------------------

const PRICE_RE = /(₹|\brs\.?\s?\d|\$\s?\d|\busd\b|\binr\b|€|£|\bprice|\bpricing|\bcost|\bfee\b|\bstarting at\b)/i;

function getKnowledgeHealth(ws) {
  const profile = getProfile(ws);
  const chunks = getCompanyChunks(ws);
  const corpus = chunks.map((c) => c.text).join('\n');
  const docs = listDocuments(ws);
  let rag = null;
  try {
    rag = require('./rag').getStats(ws);
  } catch {
    /* ignore */
  }

  const checks = [
    { key: 'documents', label: 'Source material', ok: docs.length > 0, hint: 'Add your website or upload a brochure, price list or FAQ document.' },
    { key: 'contact', label: 'Phone or address', ok: Boolean(profile.businessPhone || profile.businessAddress), hint: 'Customers ask "where are you" and "how do I reach you" constantly.' },
    { key: 'hours', label: 'Opening hours', ok: Boolean(profile.businessHours) || /\b(mon|tue|wed|thu|fri|sat|sun)\w*\b.{0,40}\d/i.test(corpus), hint: 'Add your opening hours so the assistant can answer availability questions.' },
    { key: 'offerings', label: 'What you sell', ok: Boolean(profile.productsFocus), hint: 'Describe your products or services.' },
    { key: 'pricing', label: 'Pricing information', ok: PRICE_RE.test(corpus), hint: 'Without prices the assistant will hand off every pricing question.' },
    { key: 'faqs', label: 'At least 5 FAQs', ok: (profile.faqs || []).length >= 5, hint: `${(profile.faqs || []).length} of 5 added.` },
    { key: 'handoff', label: 'Human handoff rules', ok: Boolean(profile.handoffRules && (profile.handoffRules.customerAsksPerson || profile.handoffRules.aiNotSure)), hint: 'Decide when a person takes over.' },
  ];

  const gapSummary = require('./knowledge/gaps').summary(ws);
  const conflictSummary = require('./knowledge/conflicts').summary(ws);
  const allDocs = listDocuments(ws);
  const weakDocs = allDocs.filter((d) => d.quality.some((f) => ['very_short', 'boilerplate_heavy', 'stale', 'few_pages'].includes(f)));
  const websiteDoc = allDocs.find((d) => d.source === 'website' && d.status === 'active');

  if (profile.websiteUrl) {
    checks.push({
      key: 'website',
      label: 'Website content is current',
      ok: Boolean(websiteDoc) && !websiteDoc.quality.includes('stale') && !websiteDoc.quality.includes('few_pages'),
      hint: !websiteDoc
        ? 'Your website has not been read yet. Refresh it.'
        : websiteDoc.quality.includes('stale')
          ? 'The website snapshot is over 30 days old. Refresh it.'
          : 'Fewer than 3 pages were read — the site may be mostly scripts or images. Upload a brochure or price list too.',
      action: 'refresh_website',
    });
  }
  checks.push({
    key: 'doc_quality',
    label: 'Documents are usable',
    ok: weakDocs.length === 0,
    hint: weakDocs.length ? `${weakDocs.length} document(s) look thin, stale or mostly boilerplate: ${weakDocs.slice(0, 2).map((d) => d.title).join(', ')}.` : '',
  });
  checks.push({
    key: 'gaps',
    label: 'No unanswered customer questions',
    ok: gapSummary.open === 0,
    hint: `${gapSummary.openQuestions} customer question(s) in ${gapSummary.open} group(s) had no answer${gapSummary.top ? ` — most asked: "${gapSummary.top.question}"` : ''}.`,
    action: 'gaps',
  });
  checks.push({
    key: 'conflicts',
    label: 'Sources agree with each other',
    ok: conflictSummary.open === 0,
    hint: `${conflictSummary.open} contradiction(s) between your documents: ${conflictSummary.topics.join('; ')}. The assistant will not quote them until you choose.`,
    action: 'conflicts',
  });
  const passed = checks.filter((c) => c.ok).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    checks,
    stats: {
      documents: docs.length,
      chunks: rag ? rag.chunks : chunks.length,
      faqs: (profile.faqs || []).length,
      semanticSearch: rag ? rag.semanticSearch : false,
      embeddingModel: rag?.embeddingModel || null,
      embeddingError: rag?.embeddingError || null,
      indexing: rag?.indexing || false,
      openGaps: gapSummary.open,
      openGapQuestions: gapSummary.openQuestions,
      openConflicts: conflictSummary.open,
    },
  };
}

function getStatus(ws) {
  const docs = listDocuments(ws);
  const profile = getProfile(ws);
  const missing = getSetupMissing(profile);
  return {
    documentCount: docs.length,
    chunkCount: getCompanyChunks(ws).filter((c) => c.sourceDocId).length,
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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function requireAdmin(req, res, next) {
  if (req.appUser?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

const workspaceOf = (req) => req.appUser?.workspaceId || DEFAULT_WORKSPACE;

function mountRoutes(app, { requireAuth, vertex }) {
  const multer = require('multer');
  const { extractFileText } = require('./knowledge/textExtract');
  const { rateLimit } = require('./appAuth');
  const guard = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();
  const heavyLimiter = rateLimit({ windowMs: 10 * 60_000, max: 20, key: 'company-ingest' });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  }).array('files', 5);
  const uploadMiddleware = (req, res, next) =>
    upload(req, res, (err) => {
      if (!err) return next();
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each file must be 10MB or smaller' : err.message;
      res.status(400).json({ success: false, error: msg });
    });

  app.get('/api/company/status', guard, (req, res) => {
    res.json({ success: true, data: getStatus(workspaceOf(req)) });
  });

  app.get('/api/company/setup', guard, (req, res) => {
    const profile = getProfile(workspaceOf(req));
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

  // First-time brand setup: completed once per workspace by its owner.
  // After setup is complete, further edits require Admin via PUT /profile.
  app.post('/api/company/setup', guard, (req, res) => {
    try {
      const ws = workspaceOf(req);
      if (isSetupComplete(getProfile(ws))) {
        return res.status(403).json({
          success: false,
          error: 'Brand setup already completed. Update brand details in Admin.',
        });
      }

      const patch = sanitizeProfilePatch(req.body);
      const missing = getSetupMissing({ ...getProfile(ws), ...patch });
      if (missing.length) {
        return res.status(400).json({
          success: false,
          error: `Complete required fields: ${missing.join(', ')}`,
          missing,
        });
      }

      const saved = saveProfile({ ...patch, setupCompletedAt: new Date().toISOString() }, ws);
      try {
        fs.rmSync(draftPath(ws), { force: true });
      } catch {
        /* ignore */
      }
      reloadRag(ws);
      reindexInBackground(ws);
      res.json({ success: true, data: { profile: saved, setupComplete: true } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Onboarding progress survives refreshes / switching devices.
  app.get('/api/company/onboarding-draft', guard, (req, res) => {
    res.json({ success: true, data: readJson(draftPath(workspaceOf(req)), null) });
  });

  app.put('/api/company/onboarding-draft', guard, (req, res) => {
    try {
      const ws = workspaceOf(req);
      const draft = req.body?.draft;
      if (!draft || typeof draft !== 'object') {
        return res.status(400).json({ success: false, error: 'draft object required' });
      }
      const serialized = JSON.stringify(draft);
      if (serialized.length > 100_000) {
        return res.status(413).json({ success: false, error: 'Draft too large' });
      }
      ensureDir(ws);
      writeJson(draftPath(ws), { draft, savedAt: new Date().toISOString() });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/company/profile', guard, (req, res) => {
    res.json({ success: true, data: getProfile(workspaceOf(req)) });
  });

  app.put('/api/company/profile', guard, requireAdmin, (req, res) => {
    try {
      const ws = workspaceOf(req);
      const saved = saveProfile(sanitizeProfilePatch(req.body), ws);
      reloadRag(ws);
      reindexInBackground(ws);
      res.json({ success: true, data: saved });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.get('/api/company/documents', guard, (req, res) => {
    res.json({ success: true, data: listDocuments(workspaceOf(req)) });
  });

  app.post('/api/company/documents', guard, requireAdmin, (req, res) => {
    try {
      const ws = workspaceOf(req);
      const doc = addDocument(
        {
          title: req.body?.title,
          fileName: req.body?.fileName,
          mimeType: req.body?.mimeType,
          text: req.body?.text,
          tags: req.body?.tags,
          uploadedBy: req.appUser?.email,
          source: 'paste',
        },
        ws
      );
      reloadRag(ws);
      if (doc.duplicate) reindexInBackground(ws);
      else reindexThenCheckConflicts(vertex, doc.id, ws);
      res.json({ success: true, data: doc });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Multipart upload: PDF, DOCX, TXT, MD, CSV, JSON, HTML
  app.post('/api/company/documents/upload', guard, requireAdmin, heavyLimiter, uploadMiddleware, async (req, res) => {
    const ws = workspaceOf(req);
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, error: 'Attach at least one file' });

    const results = [];
    const newDocIds = [];
    for (const file of files) {
      try {
        const { text, mimeType, ocr } = await extractFileText({ buffer: file.buffer, fileName: file.originalname });
        const doc = addDocument(
          { title: file.originalname, fileName: file.originalname, mimeType, text, uploadedBy: req.appUser?.email, source: 'upload', ocr },
          ws
        );
        if (!doc.duplicate) newDocIds.push(doc.id);
        results.push({ ok: true, fileName: file.originalname, document: doc });
      } catch (err) {
        results.push({ ok: false, fileName: file.originalname, error: err.message });
      }
    }
    if (results.some((r) => r.ok)) {
      reloadRag(ws);
      if (newDocIds.length) newDocIds.forEach((id) => reindexThenCheckConflicts(vertex, id, ws));
      else reindexInBackground(ws);
    }
    const allFailed = results.every((r) => !r.ok);
    res.status(allFailed ? 400 : 200).json({
      success: !allFailed,
      error: allFailed ? results.map((r) => `${r.fileName}: ${r.error}`).join('; ') : undefined,
      data: results,
    });
  });

  // Archive (stop using) or restore a document without deleting it — e.g. when a newer version replaces it.
  app.post('/api/company/documents/:id/status', guard, requireAdmin, (req, res) => {
    try {
      const ws = workspaceOf(req);
      if (!setDocumentStatus(req.params.id, String(req.body?.status || ''), ws)) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }
      reloadRag(ws);
      reindexInBackground(ws);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/company/documents/:id', guard, requireAdmin, (req, res) => {
    const ws = workspaceOf(req);
    const ok = deleteDocument(req.params.id, ws);
    reloadRag(ws);
    reindexInBackground(ws);
    if (!ok) return res.status(404).json({ success: false, error: 'Document not found' });
    res.json({ success: true });
  });

  // Learn the business from its website + uploaded documents. Starts a background job (202) that the
  // client polls; the result is a draft for the user to review — nothing in the profile changes until they confirm.
  app.post('/api/company/analyze', guard, requireAdmin, heavyLimiter, (req, res) => {
    if (!vertex?.generateJson) {
      return res.status(503).json({ success: false, error: 'AI is not configured' });
    }
    const job = startAnalyzeJob(
      vertex,
      { websiteUrl: str(req.body?.websiteUrl, 300), uploadedBy: req.appUser?.email },
      workspaceOf(req)
    );
    res.status(202).json({ success: true, data: publicJob(job) });
  });

  app.get('/api/company/analyze/:jobId', guard, (req, res) => {
    const job = getAnalyzeJob(req.params.jobId, workspaceOf(req));
    if (!job) return res.status(404).json({ success: false, error: 'Analysis not found or expired' });
    res.json({ success: true, data: publicJob(job) });
  });

  // Re-read the website now (also runs on a schedule). Same job/polling mechanism as the analysis.
  app.post('/api/company/website/refresh', guard, requireAdmin, heavyLimiter, (req, res) => {
    const ws = workspaceOf(req);
    const websiteUrl = str(req.body?.websiteUrl, 300) || getProfile(ws).websiteUrl;
    if (!websiteUrl) return res.status(400).json({ success: false, error: 'No website address saved for this workspace' });
    const job = startAnalyzeJob(vertex, { websiteUrl, uploadedBy: req.appUser?.email, refreshOnly: true }, ws);
    res.status(202).json({ success: true, data: publicJob(job) });
  });

  // ---- Unanswered customer questions (feedback loop) ----
  app.get('/api/company/gaps', guard, (req, res) => {
    const gaps = require('./knowledge/gaps');
    const ws = workspaceOf(req);
    res.json({
      success: true,
      data: { summary: gaps.summary(ws), open: gaps.listGaps({ status: 'open', limit: 50 }, ws) },
    });
  });

  // Turn a gap into an owner-written FAQ (the highest-authority source) and confirm it now answers the question.
  app.post('/api/company/gaps/:id/resolve', guard, requireAdmin, async (req, res) => {
    try {
      const gaps = require('./knowledge/gaps');
      const ws = workspaceOf(req);
      const gap = gaps.getGap(req.params.id, ws);
      if (!gap) return res.status(404).json({ success: false, error: 'Question group not found' });
      const answer = str(req.body?.answer, 1500);
      const question = str(req.body?.question, 300) || gap.question;
      if (!answer) return res.status(400).json({ success: false, error: 'Write the answer customers should get' });
      const faqs = [...(getProfile(ws).faqs || [])];
      if (faqs.length >= 40) {
        return res.status(400).json({ success: false, error: 'FAQ limit reached (40). Remove or merge an older FAQ first.' });
      }
      const faqId = `faq-${Date.now().toString(36)}`;
      faqs.push({ id: faqId, question, answer });
      saveProfile({ faqs: sanitizeFaqs(faqs) }, ws);
      await gaps.markResolved(gap.id, { type: 'faq', faqId }, ws);
      reloadRag(ws);
      reindexInBackground(ws);
      const check = await require('./rag').search(question, { topK: 3, ws });
      res.json({ success: true, data: { faqId, nowCovered: check.grounded } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/company/gaps/:id/dismiss', guard, requireAdmin, async (req, res) => {
    const ok = await require('./knowledge/gaps').dismiss(req.params.id, workspaceOf(req));
    if (!ok) return res.status(404).json({ success: false, error: 'Question group not found' });
    res.json({ success: true });
  });

  // ---- Conflicting sources ----
  app.get('/api/company/conflicts', guard, (req, res) => {
    res.json({ success: true, data: require('./knowledge/conflicts').listConflicts({ status: 'open' }, workspaceOf(req)) });
  });

  app.post('/api/company/conflicts/:id/resolve', guard, requireAdmin, async (req, res) => {
    try {
      const ws = workspaceOf(req);
      const resolved = await require('./knowledge/conflicts').resolveConflict(req.params.id, String(req.body?.keep || ''), ws);
      if (!resolved) return res.status(404).json({ success: false, error: 'Conflict not found' });
      reloadRag(ws);
      reindexInBackground(ws);
      res.json({ success: true, data: resolved });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/company/derive-voice', guard, requireAdmin, async (req, res) => {
    try {
      if (!vertex?.generateJson) {
        return res.status(503).json({ success: false, error: 'AI is not configured' });
      }
      const ws = workspaceOf(req);
      const profile = await deriveVoiceFromDocs(vertex, ws);
      reloadRag(ws);
      res.json({ success: true, data: profile });
    } catch (err) {
      console.error('[Company] derive-voice', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/company/knowledge/health', guard, (req, res) => {
    res.json({ success: true, data: getKnowledgeHealth(workspaceOf(req)) });
  });

  // "What would the assistant find for this question?" — retrieval only, no model call.
  app.post('/api/company/knowledge/search', guard, async (req, res) => {
    try {
      const query = str(req.body?.query, 500);
      if (!query) return res.status(400).json({ success: false, error: 'query required' });
      const result = await require('./rag').search(query, { topK: 5, ws: workspaceOf(req) });
      res.json({
        success: true,
        data: {
          grounded: result.grounded,
          confidence: result.confidence,
          mode: result.mode,
          sources: result.chunks.map((c) => ({ id: c.id, title: c.title, score: c.score, excerpt: c.text.slice(0, 280) })),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/company/knowledge/reindex', guard, requireAdmin, heavyLimiter, async (req, res) => {
    try {
      const ws = workspaceOf(req);
      const result = await require('./rag').indexEmbeddings(ws);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  DEFAULT_WORKSPACE,
  mountRoutes,
  getProfile,
  saveProfile,
  listDocuments,
  addDocument,
  deleteDocument,
  getDocument,
  chunkText,
  getCompanyChunks,
  buildVoiceInstruction,
  getVoiceForGeneration,
  deriveVoiceFromDocs,
  analyzeBusiness,
  startAnalyzeJob,
  getAnalyzeJob,
  setDocumentStatus,
  documentQuality,
  findSimilarDocuments,
  reindexThenCheckConflicts,
  getKnowledgeHealth,
  sanitizeProfilePatch,
  getStatus,
  getBotName,
  isChannelAutoReplyEnabled,
  isSetupComplete,
  getSetupMissing,
  requireAdmin,
};
