const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const IS_PROD = process.env.NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-fallback-secret-key' || JWT_SECRET === 'nexora-dev-secret') {
    if (IS_PROD) {
        console.error('[Fatal] Set a strong JWT_SECRET in production.');
        process.exit(1);
    }
    console.warn('[Auth] Using insecure development JWT_SECRET — set JWT_SECRET before production.');
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'nexora-dev-only-change-me';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nexora';
const REQUIRE_MONGO = process.env.REQUIRE_MONGO === 'true';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        if (REQUIRE_MONGO) {
            console.error('[Fatal] MongoDB is required (REQUIRE_MONGO=true).');
            process.exit(1);
        }
        if (IS_PROD) {
            console.warn('[Mongo] Running without Mongo — LinkedIn scheduler/history unavailable; CRM uses file store.');
        }
    });

if (REQUIRE_MONGO) {
    setTimeout(() => {
        if (mongoose.connection.readyState !== 1) {
            console.error('[Fatal] MongoDB not connected within timeout.');
            process.exit(1);
        }
    }, 15000);
}

// Models
const AccountSchema = new mongoose.Schema({
    urn: { type: String, required: true, unique: true },
    accessToken: String,
    user: {
        name: String,
        email: String,
        picture: String,
        urn: String
    },
    isActive: { type: Boolean, default: false }
});

const PostSchema = new mongoose.Schema({
    id: String,
    headline: String,
    content: String,
    imageUrl: String,
    hashtags: [String],
    status: { type: String, enum: ['scheduled', 'published', 'failed', 'pending'], default: 'scheduled' },
    scheduledAt: Date,
    publishedAt: Date,
    linkedinId: String,
    instagramId: String,
    facebookId: String,
    xId: String,
    platforms: [{ type: String, enum: ['linkedin', 'instagram', 'facebook', 'x'] }],
    platformResults: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: String,
    userUrn: String
});

const Account = mongoose.model('Account', AccountSchema);
const Post = mongoose.model('Post', PostSchema);

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const allowedOrigins = IS_PROD
    ? [FRONTEND_URL].filter(Boolean)
    : [
        FRONTEND_URL,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'https://localhost:3000',
        'https://127.0.0.1:3000',
      ].filter(Boolean);

const appAuth = require('./appAuth');

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(cors({
    origin: function (origin, callback) {
        if (IS_PROD) {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        }
        if (
            !origin ||
            allowedOrigins.includes(origin) ||
            /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
        ) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
console.log('CORS Allowed Origins:', allowedOrigins);
app.use(express.json({ limit: IS_PROD ? '2mb' : '12mb' }));
app.use(morgan(IS_PROD ? 'combined' : 'dev'));

appAuth.mountRoutes(app, { jwtSecret: EFFECTIVE_JWT_SECRET });
void appAuth.bootstrapAdmin().catch((err) => {
    console.error('[Auth] bootstrap failed:', err.message);
    if (IS_PROD) process.exit(1);
});

const requireApp = appAuth.requireAppAuth(EFFECTIVE_JWT_SECRET);
const loginLimiter = appAuth.rateLimit({ windowMs: 15 * 60_000, max: 40, key: 'login' });
const aiLimiter = appAuth.rateLimit({ windowMs: 60_000, max: IS_PROD ? 30 : 120, key: 'ai' });

app.use('/api/app/login', loginLimiter);
app.use('/api/app/register', loginLimiter);

// LinkedIn Auth Middleware (LinkedIn OAuth cookie — separate from app session)
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Connect LinkedIn first' });

    try {
        const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
        req.userUrn = decoded.urn;
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid LinkedIn session' });
    }
};

// Persistence logic replaced by Mongoose models

// --- LinkedIn Auth Routes ---

app.get('/auth/linkedin', (req, res) => {
    const scope = 'w_member_social profile openid email';
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}`;
    res.redirect(authUrl);
});

app.get('/auth/linkedin/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=no_code');

    try {
        const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const accessToken = tokenResponse.data.access_token;

        const profileResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const profile = profileResponse.data;
        const personUrn = `urn:li:person:${profile.sub}`;

        const userData = {
            name: profile.name,
            email: profile.email,
            picture: profile.picture,
            urn: personUrn
        };

        // Update or create account in MongoDB
        await Account.findOneAndUpdate(
            { urn: personUrn },
            {
                accessToken,
                user: userData,
                isActive: true
            },
            { upsert: true, new: true }
        );

        // Deactivate others
        // (REMOVED: This was causing session leakage in multi-user environments)

        // Generate JWT (LinkedIn identity — same secret, different payload shape)
        const token = jwt.sign({ urn: personUrn }, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });

        // Set Cookie (Lax + non-secure for local Vite proxy; secure in production)
        res.cookie('token', token, {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: IS_PROD ? 'lax' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        const targetOrigin = JSON.stringify(FRONTEND_URL);
        res.send(`
            <script>
                window.opener.postMessage({ type: 'LINKEDIN_AUTH_SUCCESS', user: ${JSON.stringify(userData)} }, ${targetOrigin});
                window.close();
            </script>
        `);
    } catch (error) {
        console.error('LinkedIn Auth Error:', error.response?.data || error.message);
        const targetOrigin = JSON.stringify(FRONTEND_URL);
        res.send(`<script>window.opener.postMessage({ type: 'LINKEDIN_AUTH_ERROR' }, ${targetOrigin}); window.close();</script>`);
    }
});

app.get('/api/auth/status', requireApp, authenticateToken, async (req, res) => {
    try {
        const urn = req.userUrn;
        const account = await Account.findOne({ urn });

        res.json({
            connected: !!account,
            user: account ? account.user : null,
            activeUrn: urn
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/auth/accounts', requireApp, authenticateToken, async (req, res) => {
    try {
        // In a true multi-user system, we might only allow switching within related accounts,
        // but for now, we'll return all for the authenticated user (though LinkedIn only has one per login)
        const accounts = await Account.find({ urn: req.userUrn });
        res.json({ accounts: accounts.map(a => a.user) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/switch', requireApp, authenticateToken, async (req, res) => {
    try {
        const { urn } = req.body;
        const account = await Account.findOne({ urn });
        if (account) {
            await Account.updateMany({}, { isActive: false });
            account.isActive = true;
            await account.save();
            res.json({ success: true, user: account.user });
        } else {
            res.status(404).json({ error: 'Account not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: IS_PROD ? 'None' : 'Lax'
    });
    res.json({ success: true });
});

// --- History & Schedule Sync ---

app.get('/api/history', requireApp, authenticateToken, async (req, res) => {
    try {
        const urn = req.userUrn;
        const history = await Post.find({ userUrn: urn }).sort({ scheduledAt: -1 });
        res.json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/history/sync', requireApp, authenticateToken, async (req, res) => {
    try {
        const urn = req.userUrn;
        const { history } = req.body;
        if (!history) return res.status(400).json({ error: 'History is required' });

        for (const post of history) {
            await Post.findOneAndUpdate(
                { id: post.id, userUrn: urn },
                { ...post, userUrn: urn },
                { upsert: true }
            );
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Publishing Logic ---

async function uploadImageToLinkedIn(base64Image, targetUrn) {
    const account = await Account.findOne({ urn: targetUrn });
    if (!account) {
        throw new Error('LinkedIn account not connected for ' + targetUrn);
    }
    const token = account.accessToken;
    const urn = account.urn;

    try {
        const registerResponse = await axios.post(
            'https://api.linkedin.com/v2/assets?action=registerUpload',
            {
                registerUploadRequest: {
                    recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                    owner: urn,
                    serviceRelationships: [
                        {
                            relationshipType: 'OWNER',
                            identifier: 'urn:li:userGeneratedContent',
                        },
                    ],
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        const asset = registerResponse.data.value.asset;
        const buffer = Buffer.from(base64Image.split(',')[1], 'base64');

        await axios.put(uploadUrl, buffer, {
            headers: {
                'Content-Type': 'application/octet-stream',
            },
        });

        return asset;
    } catch (error) {
        console.error('LinkedIn Image Upload Error:', error.response?.data || error.message);
        throw error;
    }
}

async function performPublish(post, targetUrn) {
    const account = await Account.findOne({ urn: targetUrn });
    if (!account) throw new Error('Account not found');

    const urn = account.urn;
    const token = account.accessToken;

    let mediaAsset = null;
    if (post.imageUrl && post.imageUrl.startsWith('data:image')) {
        mediaAsset = await uploadImageToLinkedIn(post.imageUrl, targetUrn);
    }

    const shareCommentary = `${post.headline}\n\n${post.content}\n\n${post.hashtags ? post.hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ') : ''}`;

    const publishBody = {
        author: urn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
            'com.linkedin.ugc.ShareContent': {
                shareCommentary: {
                    text: shareCommentary,
                },
                shareMediaCategory: mediaAsset ? 'IMAGE' : 'NONE',
                media: mediaAsset ? [{
                    status: 'READY',
                    description: { text: post.headline },
                    media: mediaAsset,
                    title: { text: post.headline }
                }] : undefined
            },
        },
        visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
        },
    };

    const response = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        publishBody,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
        }
    );

    return response.data.id;
}

const publishers = require('./publishers');
publishers.serveMedia(app);

app.post('/api/publish/linkedin', requireApp, authenticateToken, async (req, res) => {
    const { headline, content, imageUrl, hashtags, platforms } = req.body;
    const targetUrn = req.userUrn;

    try {
        const result = await publishers.publishPostToPlatforms(
            { headline, content, imageUrl, hashtags, platforms: platforms || ['linkedin'] },
            { linkedinPublishFn: performPublish, userUrn: targetUrn }
        );
        res.json({
            success: result.status === 'published',
            ...result,
            url: result.linkedinId ? `https://www.linkedin.com/feed/update/${result.linkedinId}` : undefined,
        });
    } catch (error) {
        console.error('Publish Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.message || error.message
        });
    }
});

app.post('/api/publish', requireApp, authenticateToken, async (req, res) => {
    const { headline, content, imageUrl, hashtags, platforms } = req.body;
    try {
        const result = await publishers.publishPostToPlatforms(
            { headline, content, imageUrl, hashtags, platforms: platforms || ['linkedin'] },
            { linkedinPublishFn: performPublish, userUrn: req.userUrn }
        );
        res.json({ success: result.status === 'published', data: result });
    } catch (error) {
        console.error('Multi-publish Error:', error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Background Job ---
setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return; // skip while Mongo is down
    const now = new Date();
    try {
        const pendingPosts = await Post.find({
            status: 'scheduled',
            scheduledAt: { $lte: now }
        });

        for (const post of pendingPosts) {
            const targets = (post.platforms && post.platforms.length) ? post.platforms : ['linkedin'];
            console.log(`[Scheduler] Publishing due post: "${post.headline}" → ${targets.join(', ')}`);
            try {
                const result = await publishers.publishPostToPlatforms(post, {
                    linkedinPublishFn: performPublish,
                    userUrn: post.userUrn,
                });
                post.platformResults = result.platformResults;
                post.linkedinId = result.linkedinId || post.linkedinId;
                post.instagramId = result.instagramId || post.instagramId;
                post.facebookId = result.facebookId || post.facebookId;
                post.xId = result.xId || post.xId;
                post.status = result.status;
                post.error = result.error;
                if (result.status === 'published') post.publishedAt = new Date();
                await post.save();
                console.log(`[Scheduler] Done (${result.status}):`, JSON.stringify(result.platformResults));
            } catch (err) {
                console.error(`[Scheduler] Failed to publish post ${post.id}:`, err.message);
                post.status = 'failed';
                post.error = err.message;
                await post.save();
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error in background job:', error.message);
    }
}, 30000); // Check every 30 seconds

app.post('/api/ai/insights', requireApp, aiLimiter, async (req, res) => {
    try {
        const vertex = require('./vertexAi');
        const result = await vertex.generateInsights(req.body.posts || []);
        res.json(result);
    } catch (error) {
        console.error('[Vertex] insights error:', error.message);
        res.status(503).json({
            success: false,
            error: error.message || 'Insights unavailable',
        });
    }
});

// --- Vertex AI generation routes (used by Nexora frontend) ---
const vertex = require('./vertexAi');

const wrapAi = (handler) => async (req, res) => {
    try {
        const data = await handler(req);
        res.json({ success: true, data });
    } catch (error) {
        console.error('[Vertex] route error:', error.message);
        res.status(500).json({ success: false, error: error.message || 'Vertex AI request failed' });
    }
};

app.get('/api/ai/status', requireApp, (_req, res) => {
    res.json(vertex.getStatus());
});

app.post('/api/ai/content-ideas', requireApp, aiLimiter, wrapAi((req) => vertex.generateContentIdeas(req.body.details || req.body)));
app.post('/api/ai/topic-social-pack', requireApp, aiLimiter, wrapAi((req) => {
    const b = req.body.details || req.body;
    return vertex.generateTopicSocialPack(b);
}));
app.post('/api/ai/image', requireApp, aiLimiter, wrapAi(async (req) => ({ imageUrl: await vertex.generateImage(req.body.prompt || '') })));
app.post('/api/ai/video', requireApp, aiLimiter, wrapAi(async (req) => ({
    videoUrl: await vertex.generatePromoVideo(req.body.textPrompt || '', req.body.imagePrompt || '')
})));
app.post('/api/ai/chat', requireApp, aiLimiter, wrapAi((req) => vertex.chatWithCopilot(req.body.history || [], req.body.message || '')));
app.post('/api/ai/social-reply', requireApp, aiLimiter, wrapAi((req) => vertex.generateSocialReply(req.body.details || req.body)));
app.post('/api/ai/product-showcase', requireApp, aiLimiter, wrapAi(async (req) => {
    const showcase = await vertex.generateProductShowcase(req.body.productName || '');
    let imageUrl = null;
    try {
        imageUrl = await vertex.generateImage(showcase.imagePrompt || req.body.productName || 'product');
    } catch (err) {
        console.warn('[Vertex] product showcase image skipped:', err.message);
    }
    return { ...showcase, imageUrl };
}));
app.post('/api/ai/campaign-plan', requireApp, aiLimiter, wrapAi((req) => vertex.generateCampaignPlan(req.body.brief || '')));
app.post('/api/ai/linkedin/posts', requireApp, aiLimiter, wrapAi((req) => vertex.generateLinkedInPosts(req.body)));
app.post('/api/ai/linkedin/image', requireApp, aiLimiter, wrapAi(async (req) => ({
    imageUrl: await vertex.generateLinkedInImage(req.body.imagePrompt || '')
})));

// --- Unified Leads CRM ---
const leadsCrm = require('./leadsCrm');
leadsCrm.mountRoutes(app, { requireAuth: requireApp });

// --- Company knowledge / brand voice (Admin Console) ---
const companyKnowledge = require('./companyKnowledge');
companyKnowledge.mountRoutes(app, { requireAuth: requireApp, vertex });

const seoGeo = require('./seoGeo');
seoGeo.mountRoutes(app, { requireAuth: requireApp, vertex });

// --- Instagram Graph API (comments + DMs) ---
const instagram = require('./instagram');

// --- RAG lead agent (human-like, knowledge-limited, email handoff) ---
const leadAgent = require('./leadAgent');
leadAgent.mountRoutes(app, { vertex, requireAuth: requireApp, aiLimiter });

instagram.mountRoutes(app, { vertex, leadAgent, requireAuth: requireApp });

// --- WhatsApp Cloud API ---
const whatsapp = require('./whatsapp');
whatsapp.mountRoutes(app, { vertex, leadAgent, requireAuth: requireApp });

// --- Facebook Page (publish + comment leads) ---
const facebook = require('./facebook');
facebook.mountRoutes(app, { vertex, requireAuth: requireApp });

const xChannel = require('./x');
xChannel.mountRoutes(app, { vertex, requireAuth: requireApp });

// --- Email (SMTP inbound webhook + outbound) ---
const emailChannel = require('./email');
emailChannel.mountRoutes(app, { vertex, leadAgent, requireAuth: requireApp });

// --- Google Ads lead forms, ads landing (UTM), Sheets export ---
const googleAds = require('./googleAds');
const googleSheets = require('./googleSheets');
const adsLanding = require('./adsLanding');
adsLanding.mountRoutes(app);
googleAds.mountRoutes(app, { vertex, leadAgent, requireAuth: requireApp });
googleSheets.mountRoutes(app, requireApp);
app.use('/l', express.static(path.join(__dirname, 'public')));

// --- Dual agents: Competitor Intelligence + Lead Growth ---
const competitorAgent = require('./competitorAgent');
const leadGrowthAgent = require('./leadGrowthAgent');
competitorAgent.mountRoutes(app, { vertex, requireAuth: requireApp, aiLimiter });
leadGrowthAgent.mountRoutes(app, { vertex, requireAuth: requireApp, aiLimiter });

leadsCrm.setReplyDeps({ whatsapp, instagram, email: emailChannel });

const leadLifecycle = require('./leadLifecycle');
const LIFECYCLE_TICK_MS = Number(process.env.LEAD_LIFECYCLE_TICK_MS) || 5 * 60 * 1000;
setInterval(async () => {
  try {
    await leadLifecycle.scanAllLeads(leadsCrm);
    await leadLifecycle.processDueFollowUps(leadsCrm);
  } catch (err) {
    console.warn('[Lifecycle] tick', err.message);
  }
}, LIFECYCLE_TICK_MS);

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        server: 'Nexora Backend',
        env: IS_PROD ? 'production' : 'development',
        vertex: vertex.getStatus(),
        instagram: instagram.getStatus(),
        facebook: facebook.getStatus(),
        x: xChannel.getStatus(),
        linkedin: {
            configured: Boolean(CLIENT_ID && CLIENT_SECRET),
        },
        whatsapp: whatsapp.getStatus(),
        email: emailChannel.getStatus(),
        googleAds: googleAds.getStatus(),
        googleSheets: googleSheets.getStatus(),
        adsLanding: adsLanding.getStatus(),
        leadsCrm: { mongo: leadsCrm.mongoReady() },
        company: companyKnowledge.getStatus(),
        mongo: mongoose.connection.readyState === 1,
        leadAgent: {
            handoffEmail: leadAgent.HANDOFF_EMAIL,
        },
    });
});

// Serve built SPA in production only — in dev, use Vite on :3000 so you never get a stale dist bundle.
const distDir = path.join(__dirname, '..', 'dist');
if (IS_PROD && fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    app.get('*', (req, res, next) => {
        if (
            req.path.startsWith('/api') ||
            req.path.startsWith('/auth') ||
            req.path.startsWith('/media')
        ) {
            return next();
        }
        res.sendFile(path.join(distDir, 'index.html'), (err) => {
            if (err) next();
        });
    });
} else if (!IS_PROD) {
    app.get('/', (_req, res) => {
        res.type('html').send(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Nexora API</title></head><body style="font-family:system-ui;padding:2rem">' +
            '<h1>Nexora API is running</h1>' +
            '<p>Open the app at <a href="https://localhost:3000">https://localhost:3000</a> (run <code>npm run dev</code> from the Nexora folder).</p>' +
            '<p>Do not use port 4000 for the UI in development — it would serve an old production build.</p>' +
            '</body></html>'
        );
    });
} else {
    app.get('/', (_req, res) => {
        res.send('<h1>Nexora API</h1><p>Build the UI with <code>npm run build</code> to serve the SPA from this process.</p>');
    });
}

app.listen(PORT, () => {
    console.log(`Nexora backend running on http://localhost:${PORT} (${IS_PROD ? 'production' : 'development'})`);
    try {
        console.log('[Vertex] status:', JSON.stringify(vertex.getStatus()));
    } catch (e) {
        console.warn('[Vertex] not ready:', e.message);
    }
    try {
        console.log('[Instagram] status:', JSON.stringify(instagram.getStatus()));
    } catch (e) {
        console.warn('[Instagram] not ready:', e.message);
    }
    try {
        console.log('[WhatsApp] status:', JSON.stringify(whatsapp.getStatus()));
    } catch (e) {
        console.warn('[WhatsApp] not ready:', e.message);
    }
    try {
        console.log('[Facebook] status:', JSON.stringify(facebook.getStatus()));
    } catch (e) {
        console.warn('[Facebook] not ready:', e.message);
    }
    try {
        console.log('[X] status:', JSON.stringify(xChannel.getStatus()));
    } catch (e) {
        console.warn('[X] not ready:', e.message);
    }
});
