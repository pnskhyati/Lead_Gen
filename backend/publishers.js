/**
 * Multi-platform publishers: LinkedIn, Instagram, Facebook Page.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const igStore = require('./instagramStore');

const GRAPH = 'https://graph.facebook.com/v21.0';
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
const PUBLIC_BASE =
  process.env.PUBLIC_BASE_URL ||
  process.env.FRONTEND_URL ||
  'http://localhost:3000';

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function captionFromPost(post) {
  const tags = (post.hashtags || [])
    .map((t) => (String(t).startsWith('#') ? t : `#${t}`))
    .join(' ');
  return [post.headline, post.content, tags].filter(Boolean).join('\n\n').trim();
}

/** Persist data-URL image and return a relative /media/:id path + absolute URL */
function materializeImage(imageUrl, idHint = 'img') {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) {
    return { absoluteUrl: imageUrl, localPath: null, buffer: null, mime: null };
  }
  const match = String(imageUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  ensureUploadDir();
  const mime = match[1];
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const id = `${idHint}-${Date.now()}.${ext}`;
  const localPath = path.join(UPLOAD_DIR, id);
  const buffer = Buffer.from(match[2], 'base64');
  fs.writeFileSync(localPath, buffer);
  return {
    absoluteUrl: `${PUBLIC_BASE.replace(/\/$/, '')}/media/${id}`,
    localPath,
    buffer,
    mime,
    fileName: id,
  };
}

async function publishFacebook(post) {
  const account = igStore.getAccount();
  if (!account?.pageId || !account?.pageAccessToken) {
    throw new Error('Connect Instagram/Facebook (Meta) first — Facebook Page token missing');
  }

  const message = captionFromPost(post);
  const media = materializeImage(post.imageUrl, post.id || 'fb');

  if (media?.buffer) {
    const form = new FormData();
    form.append('message', message);
    form.append('access_token', account.pageAccessToken);
    form.append('source', media.buffer, {
      filename: media.fileName || 'photo.jpg',
      contentType: media.mime || 'image/jpeg',
    });
    const { data } = await axios.post(`${GRAPH}/${account.pageId}/photos`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
    });
    return { id: data.id || data.post_id, platform: 'facebook' };
  }

  if (media?.absoluteUrl && /^https?:\/\//i.test(media.absoluteUrl) && !media.absoluteUrl.includes('localhost')) {
    const { data } = await axios.post(`${GRAPH}/${account.pageId}/photos`, null, {
      params: {
        url: media.absoluteUrl,
        caption: message,
        access_token: account.pageAccessToken,
      },
    });
    return { id: data.id || data.post_id, platform: 'facebook' };
  }

  const { data } = await axios.post(`${GRAPH}/${account.pageId}/feed`, null, {
    params: {
      message,
      access_token: account.pageAccessToken,
    },
  });
  return { id: data.id, platform: 'facebook' };
}

async function publishInstagram(post) {
  const account = igStore.getAccount();
  if (!account?.igUserId || !account?.pageAccessToken) {
    throw new Error('Connect Instagram first');
  }

  const caption = captionFromPost(post);
  const media = materializeImage(post.imageUrl, post.id || 'ig');

  let imageUrl = media?.absoluteUrl;
  if (!imageUrl || imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
    // Instagram Graph requires a publicly reachable HTTPS image URL (Meta servers fetch it).
    if (!post.imageUrl || String(post.imageUrl).startsWith('data:')) {
      throw new Error(
        'Instagram needs a public image URL. Set PUBLIC_BASE_URL to an https tunnel (e.g. ngrok) or use an https imageUrl.'
      );
    }
    imageUrl = post.imageUrl;
  }

  const createRes = await axios.post(`${GRAPH}/${account.igUserId}/media`, null, {
    params: {
      image_url: imageUrl,
      caption,
      access_token: account.pageAccessToken,
    },
  });
  const creationId = createRes.data.id;
  if (!creationId) throw new Error('Instagram media container was not created');

  // Brief wait helps when Meta is still processing the container
  await new Promise((r) => setTimeout(r, 2500));

  const publishRes = await axios.post(`${GRAPH}/${account.igUserId}/media_publish`, null, {
    params: {
      creation_id: creationId,
      access_token: account.pageAccessToken,
    },
  });

  return { id: publishRes.data.id, platform: 'instagram' };
}

/**
 * Dispatch publish for one platform. linkedinPublishFn injected to avoid circular requires.
 */
async function publishToPlatform(platform, post, { linkedinPublishFn, userUrn }) {
  if (platform === 'linkedin') {
    if (!linkedinPublishFn) throw new Error('LinkedIn publisher unavailable');
    const id = await linkedinPublishFn(post, userUrn);
    return { id, platform: 'linkedin' };
  }
  if (platform === 'facebook') return publishFacebook(post);
  if (platform === 'instagram') return publishInstagram(post);
  throw new Error(`Unknown platform: ${platform}`);
}

async function publishPostToPlatforms(post, { linkedinPublishFn, userUrn }) {
  const platforms = Array.isArray(post.platforms) && post.platforms.length
    ? post.platforms
    : ['linkedin'];

  const platformResults = { ...(post.platformResults || {}) };
  const errors = [];

  for (const platform of platforms) {
    try {
      const result = await publishToPlatform(platform, post, { linkedinPublishFn, userUrn });
      platformResults[platform] = {
        status: 'published',
        id: result.id,
        at: new Date().toISOString(),
      };
    } catch (err) {
      const message = err.response?.data?.error?.message || err.message;
      platformResults[platform] = {
        status: 'failed',
        error: message,
        at: new Date().toISOString(),
      };
      errors.push(`${platform}: ${message}`);
      console.error(`[Publish:${platform}]`, message);
    }
  }

  const statuses = Object.values(platformResults).map((r) => r.status);
  const allOk = statuses.length > 0 && statuses.every((s) => s === 'published');
  const anyOk = statuses.some((s) => s === 'published');

  return {
    platformResults,
    status: allOk ? 'published' : anyOk ? 'published' : 'failed',
    error: errors.length ? errors.join(' | ') : undefined,
    linkedinId: platformResults.linkedin?.id,
    instagramId: platformResults.instagram?.id,
    facebookId: platformResults.facebook?.id,
  };
}

function serveMedia(app) {
  ensureUploadDir();
  app.get('/media/:file', (req, res) => {
    const safe = path.basename(req.params.file);
    const filePath = path.join(UPLOAD_DIR, safe);
    if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
    res.sendFile(filePath);
  });
}

module.exports = {
  publishPostToPlatforms,
  publishFacebook,
  publishInstagram,
  materializeImage,
  serveMedia,
  captionFromPost,
};
