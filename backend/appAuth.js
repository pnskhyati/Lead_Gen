/**
 * Nexora app authentication — email/password + httpOnly JWT session.
 * Uses Node crypto (scrypt); Mongo when available, file store otherwise.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_PATH = path.join(DATA_DIR, 'users.json');
const COOKIE_NAME = 'nexora_session';
const IS_PROD = process.env.NODE_ENV === 'production';

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

let User;
try {
  User = mongoose.models.AppUser || mongoose.model('AppUser', UserSchema);
} catch {
  User = mongoose.model('AppUser', UserSchema);
}

function mongoReady() {
  return mongoose.connection.readyState === 1;
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, JSON.stringify({ users: [] }, null, 2));
  }
}

function readUsersFile() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  } catch {
    return { users: [] };
  }
}

function writeUsersFile(data) {
  ensureFile();
  fs.writeFileSync(USERS_PATH, JSON.stringify(data, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const verify = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'));
  } catch {
    return false;
  }
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name || '',
    role: u.role || 'member',
  };
}

async function findByEmail(email) {
  const normalized = String(email || '').toLowerCase().trim();
  if (!normalized) return null;
  if (mongoReady()) {
    return User.findOne({ email: normalized }).lean();
  }
  return readUsersFile().users.find((u) => u.email === normalized) || null;
}

async function countUsers() {
  if (mongoReady()) return User.countDocuments();
  return readUsersFile().users.length;
}

async function createUser({ email, password, name, role = 'member' }) {
  const normalized = String(email).toLowerCase().trim();
  if (!normalized || !password || password.length < 8) {
    throw new Error('Email and password (min 8 chars) required');
  }
  if (await findByEmail(normalized)) {
    throw new Error('An account with this email already exists');
  }
  const user = {
    id: `user-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    email: normalized,
    passwordHash: hashPassword(password),
    name: name || normalized.split('@')[0],
    role,
    createdAt: new Date().toISOString(),
  };

  if (mongoReady()) {
    await User.create(user);
  } else {
    const store = readUsersFile();
    store.users.push(user);
    writeUsersFile(store);
  }
  return publicUser(user);
}

function signSession(user, jwtSecret) {
  return jwt.sign(
    { typ: 'app', sub: user.id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'lax' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    path: '/',
  });
}

function requireAppAuth(jwtSecret) {
  return (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ success: false, error: 'Sign in required' });
    }
    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (decoded.typ !== 'app') {
        return res.status(401).json({ success: false, error: 'Sign in required' });
      }
      req.appUser = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
      };
      next();
    } catch {
      return res.status(401).json({ success: false, error: 'Session expired — sign in again' });
    }
  };
}

/** Soft auth: attach user if cookie present, never block (for optional personalization). */
function optionalAppAuth(jwtSecret) {
  return (req, _res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();
    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (decoded.typ === 'app') {
        req.appUser = { id: decoded.sub, email: decoded.email, role: decoded.role };
      }
    } catch {
      /* ignore */
    }
    next();
  };
}

async function bootstrapAdmin() {
  const count = await countUsers();
  if (count > 0) return { created: false, count };

  const email = process.env.APP_ADMIN_EMAIL || (!IS_PROD ? 'demo@nexora.com' : '');
  const password = process.env.APP_ADMIN_PASSWORD || (!IS_PROD ? 'password123' : '');

  if (!email || !password) {
    if (IS_PROD) {
      console.warn(
        '[Auth] No users and APP_ADMIN_EMAIL/APP_ADMIN_PASSWORD not set. Create the first user via POST /api/app/register.'
      );
    }
    return { created: false, count: 0 };
  }

  if (password.length < 8) {
    throw new Error('APP_ADMIN_PASSWORD must be at least 8 characters');
  }

  await createUser({
    email,
    password,
    name: 'Admin',
    role: 'admin',
  });
  console.log(`[Auth] Bootstrapped admin user: ${email}`);
  return { created: true, email, count: 1 };
}

function mountRoutes(app, { jwtSecret }) {
  const allowRegister =
    process.env.APP_ALLOW_REGISTER === 'true' || process.env.APP_ALLOW_REGISTER === '1';

  app.get('/api/app/status', async (_req, res) => {
    try {
      const count = await countUsers();
      const demoLogin =
        !IS_PROD || process.env.DEMO_LOGIN === 'true' || process.env.DEMO_LOGIN === '1';
      res.json({
        success: true,
        data: {
          hasUsers: count > 0,
          allowRegister: allowRegister || count === 0,
          demoLogin,
          demoEmail: demoLogin
            ? (process.env.APP_ADMIN_EMAIL || 'demo@nexora.com').toLowerCase()
            : null,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/app/register', async (req, res) => {
    try {
      const count = await countUsers();
      if (!allowRegister && count > 0) {
        return res.status(403).json({ success: false, error: 'Registration is closed' });
      }
      const { email, password, name } = req.body || {};
      const user = await createUser({
        email,
        password,
        name,
        role: count === 0 ? 'admin' : 'member',
      });
      const token = signSession(user, jwtSecret);
      setSessionCookie(res, token);
      res.json({ success: true, data: { user } });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/app/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const user = await findByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }
      const pub = publicUser(user);
      const token = signSession(pub, jwtSecret);
      setSessionCookie(res, token);
      res.json({ success: true, data: { user: pub } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /** One-click demo login — disabled in production unless DEMO_LOGIN=true */
  app.post('/api/app/demo-login', async (req, res) => {
    try {
      const allowed =
        !IS_PROD || process.env.DEMO_LOGIN === 'true' || process.env.DEMO_LOGIN === '1';
      if (!allowed) {
        return res.status(403).json({ success: false, error: 'Demo login is disabled' });
      }

      const email = (process.env.APP_ADMIN_EMAIL || 'demo@nexora.com').toLowerCase().trim();
      const password = process.env.APP_ADMIN_PASSWORD || 'password123';

      let user = await findByEmail(email);
      if (!user) {
        await createUser({
          email,
          password,
          name: 'Demo',
          role: 'admin',
        });
        user = await findByEmail(email);
      }

      const pub = publicUser(user);
      const token = signSession(pub, jwtSecret);
      setSessionCookie(res, token);
      res.json({
        success: true,
        data: {
          user: pub,
          demo: { email, hint: 'Demo workspace' },
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/app/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ success: true });
  });

  app.get('/api/app/me', requireAppAuth(jwtSecret), (req, res) => {
    res.json({ success: true, data: { user: req.appUser } });
  });
}

/**
 * Very small in-memory rate limiter (per IP + key).
 * Enough to blunt abuse on AI/login; not a substitute for edge WAF.
 */
function rateLimit({ windowMs = 60_000, max = 60, key = 'default' } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const bucketKey = `${key}:${ip}`;
    const now = Date.now();
    let entry = hits.get(bucketKey);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      hits.set(bucketKey, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ success: false, error: 'Too many requests — try again shortly' });
    }
    next();
  };
}

module.exports = {
  COOKIE_NAME,
  mountRoutes,
  requireAppAuth,
  optionalAppAuth,
  bootstrapAdmin,
  rateLimit,
  createUser,
  findByEmail,
};
