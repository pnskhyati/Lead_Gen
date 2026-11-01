# Nexora

One application: marketing copilot + social scheduling + lead pipeline + **Google Vertex AI** backend.

## Structure

```
Nexora/
  src/                 # ManasaParuchuri100/Nexora UI shell (Marketing OS)
    components/        # Landing + app chrome (sidebar, topbar, views)
    legacy/            # Live backend-powered feature panels (CRM, agents, studio…)
  backend/             # Express API (auth, OAuth, CRM, Vertex, Meta, agents)
```

Frontend nav maps to live APIs: Overview, Inbox, Leads, Content, Campaigns, **Agents**, **Channels** (IG/FB/WhatsApp), Analytics, Admin.

## Production checklist

1. Set in `.env.local` (or host secrets):
   - `NODE_ENV=production`
   - Strong `JWT_SECRET` (not a default)
   - `FRONTEND_URL=https://your-domain.com`
   - `MONGODB_URI` (Atlas recommended) — set `REQUIRE_MONGO=true` for LinkedIn scheduling
   - `APP_ADMIN_EMAIL` / `APP_ADMIN_PASSWORD` (min 8 chars) for first admin, **or** open the app once and register when no users exist
   - Vertex: `VERTEX_PROJECT_ID` + ADC, or `VERTEX_API_KEY`
   - LinkedIn / Meta / WhatsApp credentials as needed
   - `PUBLIC_BASE_URL=https://…` for Instagram image publishing
2. Align OAuth redirect URIs with your public origin.
3. Point Meta webhooks at `https://your-domain/api/whatsapp/webhook` and `/api/instagram/webhook`.
4. Build & run a single process:

```bash
npm run install:all
npm run start
```

This builds the Vite SPA into `dist/` and serves it from Express on `PORT` (default 4000).

Health: `GET /api/health`

### Security defaults now in place

- Real app login (httpOnly `nexora_session` cookie)
- AI, CRM, Instagram sync/DM, WhatsApp send, and LinkedIn product APIs require sign-in
- Webhooks stay public (Meta verification)
- Production CORS allowlists only `FRONTEND_URL`
- Rate limits on login + AI
- OAuth `postMessage` targets `FRONTEND_URL` (not `*`)
- Demo lead seeds disabled in production builds

## Local development

```bash
cd Nexora
npm run install:all
```

Copy `.env.example` → `.env.local` and fill Vertex + LinkedIn + Mongo settings.

```bash
npm run dev
```

- Web: http://localhost:3000  
- API: http://localhost:4000 (`/api` and `/auth` are proxied)

Dev bootstrap (if no users): `demo@nexora.com` / `password123` unless you set `APP_ADMIN_*`.

## Vertex AI

All generation goes through `/api/ai/*` (authenticated).

```
VERTEX_PROJECT_ID=your-gcp-project-id
VERTEX_LOCATION=us-central1
```

Or `VERTEX_API_KEY=…`

## Lead generation pipeline

| Channel | How |
|---------|-----|
| Website | Lead Agent (after sign-in) |
| Instagram | Connect + sync / Messaging webhook |
| WhatsApp | Cloud API webhook |

CRM: Mongo when up, else `backend/data/leads-crm.json`.
