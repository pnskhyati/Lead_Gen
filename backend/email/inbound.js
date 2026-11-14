/**
 * Turning a raw email into something the agent may answer, and refusing the ones it must never answer
 * (newsletters, auto-replies, bounces, our own mail). Answering those is how mail loops and spam complaints start.
 */
const NO_REPLY_LOCAL = /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|mailer-daemon|postmaster|bounce[sd]?|bounces|notifications?|noreply|alerts?|newsletter|news|marketing|automated|system)([+._-].*)?$/i;
const AUTO_SUBJECT = /^(auto(matic)?[ -]?(reply|response)|out of office|undeliverable|delivery (status|failure)|mail delivery|returned mail|failure notice)/i;

const header = (parsed, name) => {
  const v = parsed.headers?.get(name);
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (v.text) return String(v.text);
  if (v.value) return Array.isArray(v.value) ? v.value.map((x) => x.address || x).join(',') : String(v.value);
  return String(v);
};

/** @returns {{ automated: boolean, reason?: string }} */
function classify(parsed, ownAddress) {
  const from = String(parsed.from?.value?.[0]?.address || '').toLowerCase();
  if (!from || !from.includes('@')) return { automated: true, reason: 'no_sender' };
  if (from === String(ownAddress).toLowerCase()) return { automated: true, reason: 'own_mail' };
  if (NO_REPLY_LOCAL.test(from.split('@')[0])) return { automated: true, reason: 'no_reply_sender' };

  const autoSubmitted = header(parsed, 'auto-submitted').toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') return { automated: true, reason: 'auto_submitted' };
  if (/^(bulk|junk|list|auto_reply)$/i.test(header(parsed, 'precedence').trim())) return { automated: true, reason: 'bulk_precedence' };
  // mailparser files every List-* header (List-Id, List-Unsubscribe, ...) under one grouped "list" key
  if (parsed.headers?.get('list') || header(parsed, 'list-id') || header(parsed, 'list-unsubscribe')) return { automated: true, reason: 'mailing_list' };
  if (header(parsed, 'x-autoreply') || header(parsed, 'x-autorespond') || header(parsed, 'x-auto-response-suppress') || header(parsed, 'x-failed-recipients')) {
    return { automated: true, reason: 'auto_reply' };
  }
  if (/multipart\/report/i.test(header(parsed, 'content-type'))) return { automated: true, reason: 'delivery_report' };
  if (AUTO_SUBJECT.test(String(parsed.subject || '').trim())) return { automated: true, reason: 'auto_subject' };
  return { automated: false };
}

const stripHtml = (html) =>
  String(html || '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ');

/** Just what the sender wrote: no quoted earlier messages, no signature chains, capped in length. */
function cleanBody(parsed, max = 4000) {
  let text = String(parsed.text || '').trim() || stripHtml(parsed.html || parsed.textAsHtml || '');
  const cut = text.search(/^\s*(On .{5,200}wrote:|-{2,}\s*Original Message\s*-{2,}|From:\s.+\n\s*(Sent|Date):\s)/im);
  if (cut > 0) text = text.slice(0, cut);
  text = text
    .split('\n')
    .filter((l) => !l.trim().startsWith('>'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, max);
}

/** Parse a fetched message into the shape the lead agent pipeline takes. Returns null if there is nothing to answer. */
async function toInbound(source, simpleParser, ownAddress) {
  const parsed = await simpleParser(source);
  const verdict = classify(parsed, ownAddress);
  if (verdict.automated) return { skip: verdict.reason };
  const text = cleanBody(parsed);
  if (!text) return { skip: 'empty' };
  const sender = parsed.from.value[0];
  return {
    inbound: {
      from: sender.name ? `${sender.name} <${sender.address}>` : sender.address,
      subject: String(parsed.subject || '(no subject)').slice(0, 200),
      text,
      messageId: parsed.messageId || null,
      references: [].concat(parsed.references || []).join(' ') || null,
    },
  };
}

module.exports = { classify, cleanBody, toInbound, stripHtml };
