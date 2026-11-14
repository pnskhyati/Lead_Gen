/**
 * Meta (Instagram / Facebook / WhatsApp) webhook authentication and workspace routing.
 * Webhooks arrive unauthenticated, so the payload signature is the only proof the request is from Meta.
 */
const crypto = require('crypto');

const IS_PROD = process.env.NODE_ENV === 'production';

function secrets() {
  return [
    process.env.META_APP_SECRET,
    process.env.FACEBOOK_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
    process.env.WHATSAPP_APP_SECRET,
  ].filter(Boolean);
}

function signatureMatches(secret, rawBody, header) {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verify X-Hub-Signature-256 against any configured Meta app secret.
 * Set WEBHOOK_SIGNATURE_REQUIRED=false to disable (not recommended outside local testing).
 */
function verifyMetaSignature(req) {
  if (process.env.WEBHOOK_SIGNATURE_REQUIRED === 'false') return true;
  const list = secrets();
  if (!list.length) {
    if (IS_PROD) {
      console.error('[Webhook] No Meta app secret configured — rejecting webhook in production');
      return false;
    }
    return true;
  }
  const header = req.get('x-hub-signature-256');
  if (!header || !req.rawBody) {
    console.warn('[Webhook] Missing signature or raw body — rejected');
    return false;
  }
  const ok = list.some((secret) => signatureMatches(secret, req.rawBody, header));
  if (!ok) console.warn('[Webhook] Invalid signature — rejected');
  return ok;
}

module.exports = { verifyMetaSignature, signatureMatches };
