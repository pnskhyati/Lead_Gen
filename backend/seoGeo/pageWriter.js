/**
 * Drafts an answer page for one search phrase or customer question, so the business has a page that search engines
 * and AI assistants can find, read and quote. Built only from the business's own facts: the model is told not to
 * invent anything, and any number in the draft that is not in those facts is flagged for the owner to check.
 * Nothing is published here; the owner reviews the draft and puts it on their own site.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Type } = require('@google/genai');
const wsData = require('../workspaceData');

const STORE = () => wsData.companyPath('seo-geo-pages.json');

const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    metaDescription: { type: Type.STRING },
    h1: { type: Type.STRING },
    directAnswer: { type: Type.STRING },
    sections: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { heading: { type: Type.STRING }, body: { type: Type.STRING } }, required: ['heading', 'body'] },
    },
    faqs: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ['question', 'answer'] },
    },
    callToAction: { type: Type.STRING },
    needsInput: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['title', 'metaDescription', 'h1', 'directAnswer', 'sections', 'faqs', 'callToAction', 'needsInput'],
};

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(STORE(), 'utf8')).pages || [];
  } catch {
    return [];
  }
}
function writeAll(pages) {
  fs.mkdirSync(path.dirname(STORE()), { recursive: true });
  fs.writeFileSync(STORE(), JSON.stringify({ pages, updatedAt: new Date().toISOString() }, null, 2));
}

const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'page';

/** Numbers in the draft that appear nowhere in the facts it was given. */
function unverifiedNumbers(draftText, sourceText) {
  const known = new Set(String(sourceText).match(/\d[\d,.]*/g) || []);
  const found = new Set((String(draftText).match(/\d[\d,.]*%?/g) || []).map((n) => n.replace(/[.,]+$/, '')));
  return [...found].filter((n) => !known.has(n.replace('%', '')) && !known.has(n) && !/^\d$/.test(n));
}

function renderHtml(p) {
  return [
    `<h1>${esc(p.h1)}</h1>`,
    `<p>${esc(p.directAnswer)}</p>`,
    ...p.sections.map((s) => `<h2>${esc(s.heading)}</h2>\n${s.body.split(/\n{2,}/).map((para) => `<p>${esc(para)}</p>`).join('\n')}`),
    p.faqs.length ? `<h2>Frequently asked questions</h2>\n${p.faqs.map((f) => `<h3>${esc(f.question)}</h3>\n<p>${esc(f.answer)}</p>`).join('\n')}` : '',
    `<p>${esc(p.callToAction)}</p>`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function renderMarkdown(p) {
  return [
    `# ${p.h1}`,
    p.directAnswer,
    ...p.sections.map((s) => `## ${s.heading}\n\n${s.body}`),
    p.faqs.length ? `## Frequently asked questions\n\n${p.faqs.map((f) => `### ${f.question}\n\n${f.answer}`).join('\n\n')}` : '',
    p.callToAction,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Structured data that matches the visible FAQ exactly, so search engines can trust it. */
function renderSchema(p, { company, website }) {
  const graph = [{ '@type': 'Organization', name: company, ...(website ? { url: website } : {}) }];
  if (p.faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: p.faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    });
  }
  return `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)}\n</script>`;
}

async function write(vertex, { topic, kind, profile, ws }) {
  const subject = clip(topic, 200);
  if (!subject) throw new Error('Choose a search or question to write about.');
  if (!vertex?.generateJson) throw new Error('The AI assistant is not set up on this server yet.');
  if (!profile?.companyName) throw new Error('Add your business name in Settings, Business details first.');

  let facts = '';
  try {
    const found = await require('../rag').search(subject, { topK: 8, ws, verify: false });
    const useful = found.grounded ? found.chunks : found.chunks.filter((c) => c.id === 'company-facts');
    facts = useful.map((c) => clip(c.text, 900)).join('\n- ');
  } catch {
    facts = '';
  }
  const profileFacts = [
    `Business name: ${profile.companyName}`,
    profile.industry && `Industry: ${profile.industry}`,
    profile.tagline && `Tagline: ${clip(profile.tagline, 200)}`,
    profile.productsFocus && `What we offer: ${clip(profile.productsFocus, 1500)}`,
    profile.audience && `Who we serve: ${clip(profile.audience, 500)}`,
    profile.location && `Location: ${profile.location}`,
    profile.websiteUrl && `Website: ${profile.websiteUrl}`,
    ...(profile.faqs || []).slice(0, 10).map((f) => `FAQ: ${clip(f.question || f.q, 200)} -> ${clip(f.answer || f.a, 400)}`),
  ]
    .filter(Boolean)
    .join('\n');
  const approved = `${profileFacts}${facts ? `\n- ${facts}` : ''}`;

  const prompt = `Write a web page that answers this ${kind === 'question' ? 'customer question' : 'search'} for the business below, so that Google and AI assistants (ChatGPT, Gemini, Perplexity) can find and quote it, and so a visitor who is ready to buy gets in touch.

TOPIC: ${subject}

APPROVED FACTS (the ONLY facts you may use about the business):
${approved}

Write like this:
- title: under 60 characters, includes the topic and ${profile.companyName}.
- metaDescription: under 155 characters, says what the reader gets.
- h1: the topic as a clear heading.
- directAnswer: 2 to 3 plain sentences (40 to 70 words) that answer the topic directly and name ${profile.companyName} as a provider where it is true. This is the part an AI will quote, so it must stand alone.
- sections: 3 to 5 sections. Each heading is a question or a clear statement a customer would search. Each body is 60 to 120 words in short paragraphs separated by a blank line. Cover: what it is, who it is for, how it works with ${profile.companyName}, and how to choose a provider (honest, useful criteria, not an ad).
- faqs: 4 to 6 real questions a buyer would ask, each answered in 1 to 3 sentences.
- callToAction: one sentence telling the reader the next step to contact or book ${profile.companyName}.
- needsInput: 2 to 5 short items the owner should add to make the page stronger and that you could not take from the facts (for example "your starting price", "a real client result", "your team's years of experience"). Do not put any of these in the text.

Hard rules:
- Never invent prices, numbers, years, client names, awards, results, guarantees, team size or locations. If it is not in APPROVED FACTS, leave it out.
- Never call ${profile.companyName} leading, top, best, prominent, trusted, number one or similar. State what it does, not how good it is. No "measurable growth" or other result promises.
- Plain words, sentences under 22 words, no hype ("cutting-edge", "world-class", "revolutionary", "game-changer").
- Be genuinely helpful first. Mention ${profile.companyName} where it naturally fits, not in every paragraph.`;

  const out = await vertex.generateJson(prompt, SCHEMA, 'You are a careful SEO copywriter. You never invent facts. Return JSON only.', { thinkingLevel: 'LOW' });

  const page = {
    id: `pg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    topic: subject,
    kind: kind === 'question' ? 'question' : 'keyword',
    createdAt: new Date().toISOString(),
    title: clip(out.title, 70),
    metaDescription: clip(out.metaDescription, 170),
    slug: slugify(subject),
    h1: clip(out.h1, 140),
    directAnswer: clip(out.directAnswer, 600),
    sections: (out.sections || []).slice(0, 6).map((s) => ({ heading: clip(s.heading, 140), body: String(s.body || '').replace(/[ \t]+/g, ' ').trim().slice(0, 1500) })).filter((s) => s.heading && s.body),
    faqs: (out.faqs || []).slice(0, 7).map((f) => ({ question: clip(f.question, 200), answer: clip(f.answer, 600) })).filter((f) => f.question && f.answer),
    callToAction: clip(out.callToAction, 240),
    needsInput: (out.needsInput || []).slice(0, 6).map((n) => clip(n, 120)).filter(Boolean),
  };
  if (!page.h1 || !page.directAnswer || !page.sections.length) throw new Error('The assistant did not return a usable page. Please try again.');

  const draftText = [page.title, page.metaDescription, page.h1, page.directAnswer, ...page.sections.map((s) => s.body), ...page.faqs.map((f) => f.answer), page.callToAction].join(' ');
  page.checkNumbers = unverifiedNumbers(draftText, `${approved} ${subject}`);
  page.html = renderHtml(page);
  page.markdown = renderMarkdown(page);
  page.schema = renderSchema(page, { company: profile.companyName, website: profile.websiteUrl });

  writeAll([page, ...readAll()].slice(0, 100));
  return page;
}

const list = () => readAll();
const remove = (id) => writeAll(readAll().filter((p) => p.id !== id));

module.exports = { write, list, remove, unverifiedNumbers, slugify };
