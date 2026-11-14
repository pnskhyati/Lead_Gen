/**
 * Brand style: the owner uploads their previous posts, a vision model writes a style guide from them, and image
 * generation is then given that guide plus a few of the originals as references.
 *
 * Per workspace. Images live next to the planner's other media (postStore.saveImage / imagePath).
 */
const fs = require('fs');
const { Type } = require('@google/genai');
const { createWorkspaceStore } = require('../wsStore');
const path = require('path');
const postStore = require('./postStore');

const MAX_IMAGES = 12;
const MIN_TO_ANALYZE = 3;
const ANALYZE_MAX = 8; // images sent to the model in one call
const REFS_PER_IMAGE = 3; // originals passed to the image model as visual references

const store = createWorkspaceStore(path.join(__dirname, '..', 'data', 'brand-style.json'), {
  enabled: true,
  overlay: true, // add a short headline to generated images
  images: [], // [{ id, file, mime, bytes, addedAt }]
  guide: null, // see GUIDE_SCHEMA
  analyzedAt: null,
  analyzedWith: 0, // how many images the guide was built from
});

const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const HEX = /^#[0-9a-f]{6}$/i;

const GUIDE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    look: { type: Type.STRING },
    palette: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { hex: { type: Type.STRING }, role: { type: Type.STRING } }, required: ['hex', 'role'] },
    },
    composition: { type: Type.STRING },
    subjects: { type: Type.STRING },
    lighting: { type: Type.STRING },
    typography: { type: Type.STRING },
    recurringElements: { type: Type.ARRAY, items: { type: Type.STRING } },
    avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['summary', 'look', 'palette', 'composition', 'subjects', 'lighting', 'typography', 'recurringElements', 'avoid'],
};

/** Keep only what the model was asked for, with sane lengths. */
function cleanGuide(g) {
  const list = (a, n, len) => (Array.isArray(a) ? a : []).map((x) => clip(x, len)).filter(Boolean).slice(0, n);
  return {
    summary: clip(g?.summary, 400),
    look: clip(g?.look, 400),
    palette: (Array.isArray(g?.palette) ? g.palette : [])
      .map((c) => ({ hex: clip(c?.hex, 7), role: clip(c?.role, 40) }))
      .filter((c) => HEX.test(c.hex))
      .slice(0, 6),
    composition: clip(g?.composition, 400),
    subjects: clip(g?.subjects, 400),
    lighting: clip(g?.lighting, 300),
    typography: clip(g?.typography, 300),
    recurringElements: list(g?.recurringElements, 8, 120),
    avoid: list(g?.avoid, 8, 120),
  };
}

const ANALYZE_PROMPT = `These images are previous social media posts from ONE business. Describe their shared visual style so a designer
could make new images that look like they belong in the same feed. Describe only what you can SEE across several of the images; do not
guess about the business. If the images clearly differ, describe the most common look.
- summary: 1-2 sentences on the overall style.
- look: photo, illustration, flat graphic, 3D, mixed? Realism, texture, finish, editing.
- palette: 3-6 dominant colors as #RRGGBB hex with a role (background, accent, text...).
- composition: framing, layout, spacing, use of borders, shapes or overlays, text placement.
- subjects: what the images usually show (people, products, places, abstract) and how.
- lighting: light and mood.
- typography: if text appears on the images, its style (weight, case, color, placement); otherwise say "no text on images".
- recurringElements: logos, frames, shapes, icons, filters or other repeated devices.
- avoid: things that would look out of place in this feed.`;

function view(ws) {
  const s = store.read(ws);
  return {
    enabled: s.enabled !== false,
    overlay: s.overlay !== false,
    images: s.images.map((i) => ({ id: i.id, url: `/api/social/media/${i.file}`, addedAt: i.addedAt })),
    guide: s.guide,
    analyzedAt: s.analyzedAt,
    analyzedWith: s.analyzedWith,
    stale: Boolean(s.guide) && s.images.length !== s.analyzedWith,
    limits: { maxImages: MAX_IMAGES, minToAnalyze: MIN_TO_ANALYZE },
  };
}

function addImages(files, ws) {
  const room = MAX_IMAGES - store.read(ws).images.length;
  if (room <= 0) throw Object.assign(new Error(`You can keep up to ${MAX_IMAGES} example posts. Remove one to add another.`), { status: 400 });
  const added = files.slice(0, room).map(({ buffer, mime }) => {
    const img = postStore.saveImage({ buffer, mime, source: 'brand' }, ws);
    return { id: img.file.replace(/\.\w+$/, ''), file: img.file, mime, bytes: img.bytes, addedAt: new Date().toISOString() };
  });
  store.update((s) => {
    s.images = [...s.images, ...added];
  }, ws);
  return { added: added.length, skipped: files.length - added.length };
}

function removeImage(id, ws) {
  let removed = null;
  store.update((s) => {
    removed = s.images.find((i) => i.id === id) || null;
    s.images = s.images.filter((i) => i.id !== id);
  }, ws);
  if (removed) {
    const p = postStore.imagePath(removed.file, ws);
    if (p) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* already gone */
      }
    }
  }
  return Boolean(removed);
}

function loadImages(list, ws) {
  return list
    .map((i) => {
      const buf = postStore.readImage(i, ws);
      return buf ? { mimeType: i.mime, data: buf.toString('base64') } : null;
    })
    .filter(Boolean);
}

/** Spread picks evenly so the references are not all the newest uploads. */
function spread(list, n) {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, k) => list[Math.floor((k * list.length) / n)]);
}

async function analyze(vertex, ws) {
  const s = store.read(ws);
  if (s.images.length < MIN_TO_ANALYZE) {
    throw Object.assign(new Error(`Upload at least ${MIN_TO_ANALYZE} of your previous posts so the style is clear.`), { status: 400 });
  }
  if (!vertex?.describeImagesJson) throw Object.assign(new Error('AI is not configured'), { status: 503 });
  const picked = loadImages(spread(s.images, ANALYZE_MAX), ws);
  if (picked.length < MIN_TO_ANALYZE) throw Object.assign(new Error('Your uploaded images could not be read. Upload them again.'), { status: 400 });
  const raw = await vertex.describeImagesJson({ images: picked, prompt: ANALYZE_PROMPT, schema: GUIDE_SCHEMA });
  const guide = cleanGuide(raw);
  if (!guide.summary || !guide.look) throw Object.assign(new Error('The style could not be read from these images. Try clearer examples.'), { status: 422 });
  store.update((st) => {
    st.guide = guide;
    st.analyzedAt = new Date().toISOString();
    st.analyzedWith = st.images.length;
  }, ws);
  return view(ws);
}

function setOptions({ enabled, overlay }, ws) {
  store.update((s) => {
    if (enabled !== undefined) s.enabled = Boolean(enabled);
    if (overlay !== undefined) s.overlay = Boolean(overlay);
  }, ws);
  return view(ws);
}

/** Whether to put a headline on this workspace's images, and in which colors. Off when no style is set up. */
function overlaySettings(ws) {
  const s = store.read(ws);
  if (s.enabled === false || !s.guide || s.overlay === false) return { on: false };
  return { on: true, palette: s.guide.palette };
}

/** The style guide as text for an image prompt. */
function guideText(g) {
  const colors = g.palette.map((c) => `${c.hex} (${c.role})`).join(', ');
  return [
    `Overall: ${g.summary}`,
    `Look: ${g.look}`,
    colors && `Colors: ${colors}`,
    `Composition: ${g.composition}`,
    `Subjects: ${g.subjects}`,
    `Lighting: ${g.lighting}`,
    g.recurringElements.length && `Recurring elements: ${g.recurringElements.join('; ')}`,
    g.avoid.length && `Avoid: ${g.avoid.join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** What image generation needs for this workspace, or null when there is no usable style. */
function forGeneration(ws, { rotate = 0 } = {}) {
  const s = store.read(ws);
  if (s.enabled === false || !s.guide) return null;
  const pool = s.images.length ? [...s.images.slice(rotate % s.images.length), ...s.images.slice(0, rotate % s.images.length)] : [];
  return { text: guideText(s.guide), refs: loadImages(spread(pool, REFS_PER_IMAGE), ws) };
}

module.exports = { view, addImages, removeImage, analyze, setOptions, overlaySettings, forGeneration, cleanGuide, guideText, MAX_IMAGES, MIN_TO_ANALYZE };
