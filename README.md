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
   - `APP_ALLOW_REGISTER=true` to let new companies self-serve sign up. Each signup gets its own workspace (the first account keeps the legacy `default` workspace and its data).
   - Optional: `VERTEX_EMBEDDING_MODEL` (default `text-embedding-005`) for semantic search; `RAG_MIN_SIMILARITY` (0.58) / `RAG_MIN_COVERAGE` (0.40) tune when the assistant admits it does not know (see *Calibration*); `RAG_INCLUDE_BASE=true` includes the bundled demo knowledge (off by default).
   - Optional: `CHROME_PATH` (Chrome/Edge/Chromium, enables reading JavaScript-only websites; `RENDER_JS_SITES=off` disables; `CHROME_NO_SANDBOX=true` inside containers), `OCR_TIMEOUT_MS` (60000).
   - Webhooks: Meta webhooks are rejected unless `X-Hub-Signature-256` verifies against `META_APP_SECRET` / `INSTAGRAM_APP_SECRET` (`WEBHOOK_SIGNATURE_REQUIRED=false` disables, local testing only).
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

### Email (each workspace connects its own mailbox)

The assistant replies from the owner's address and reads new mail over IMAP every minute, so no public webhook is needed.
It never answers mail from before the connection, newsletters, auto-replies or no-reply senders, and sends at most 3
replies per customer per day (30 per hour per workspace). Credentials are encrypted at rest (`CREDENTIALS_KEY`, else `JWT_SECRET`).

Two ways to connect, both from Settings → Connections → Email:

- **App password** (Gmail, Zoho, Yahoo, Outlook.com or custom servers): works with no setup.
- **Sign in with Google / Microsoft** (works where app passwords are blocked). Needs an OAuth app registered once per server:
  - Redirect URI for both: `<FRONTEND_URL>/auth/email/callback` (override with `EMAIL_OAUTH_REDIRECT_URI`).
  - **Google** (Cloud Console → APIs & Services → Credentials → OAuth client, type Web): enable the Gmail API, add the scope
    `https://mail.google.com/` to the consent screen, set `EMAIL_GOOGLE_CLIENT_ID` and `EMAIL_GOOGLE_CLIENT_SECRET`.
    While the app is in *Testing* mode only listed test users can sign in and Google expires their refresh tokens after 7 days;
    going live with this restricted scope needs Google's verification and security assessment.
  - **Microsoft** (Entra ID → App registrations, multi-tenant, Web platform): add delegated permissions `IMAP.AccessAsUser.All`,
    `SMTP.Send` and `offline_access` (Office 365 Exchange Online), create a client secret, set `EMAIL_MICROSOFT_CLIENT_ID`,
    `EMAIL_MICROSOFT_CLIENT_SECRET` (and `EMAIL_MICROSOFT_TENANT` to restrict to one tenant, default `common`).
    Work accounts may need an admin to grant consent and to allow SMTP AUTH for the mailbox.

## Onboarding & company knowledge

Sign-up creates a workspace; the setup wizard then learns the business:

1. **Website** — `POST /api/company/analyze` crawls the site (SSRF-guarded, up to 6 pages) and drafts the profile, voice and FAQs. Nothing is saved until the user reviews and finishes setup.
2. **Documents** — `POST /api/company/documents/upload` accepts PDF, DOCX, TXT, MD, CSV, JSON, HTML (10 MB each).
3. **Setup** — `POST /api/company/setup` stores profile, FAQs and handoff rules. Progress autosaves via `/api/company/onboarding-draft`.

Retrieval (`backend/rag.js`) is BM25 + Vertex embeddings fused per workspace, and reports whether the question is *grounded*; agents hand off instead of guessing when it isn't. Inspect it with `GET /api/company/knowledge/health` and `POST /api/company/knowledge/search`.

Scanned PDFs and images are read with OCR (Gemini vision). JavaScript-only sites are rendered in a headless browser; every request it makes goes through the same SSRF-safe, DNS-pinned client as the plain crawler.

### Multi-tenancy

Everything a company owns is scoped to its workspace: knowledge base, leads and messages, Instagram / Facebook / X accounts, WhatsApp number, scheduled posts, SEO/GEO data and Google connection, and the agent audit log. Signed-in requests run inside the user's workspace (`backend/workspaceContext.js`); webhooks resolve the workspace from the connected account they were sent to (Instagram/Page id, WhatsApp phone number id, or a per-workspace email inbound URL with its own token) and ignore unknown accounts. OAuth connect flows use signed `state` bound to the user and workspace.

Still platform-level (shared, default workspace only): `LEAD_HANDOFF_EMAIL`, the Google Sheets and Google Ads integrations, the public ads landing pages, and the SMTP sender.

### Answer quality loop

- **Recall.** Each passage gets generated customer-style questions (embedded like queries), and borderline retrievals are checked by a model ("does a passage directly state the answer?"). Scored on 100 labelled questions from two unrelated businesses, with thresholds tuned on one business and tested on the other: 95% precision / 96% recall, against 78% / 88% for similarity + keyword coverage alone. About half of customer messages take the extra model check (roughly +2-3 s); `RAG_VERIFY=off` removes it at a cost in precision.
- **Unanswered questions.** Every question the assistant could not answer (and every question blocked by a contradiction) is logged per workspace with emails, phone numbers and links redacted, grouped with similar ones (embedding match at record time, then a model pass that merges groups asking the same thing), and shown in Admin ordered by how often it was asked. "Add answer" turns it into an owner FAQ, which is the highest-authority source.
- **Conflicts.** After each upload or website refresh, similar passages from different sources are compared; contradictions are shown for the owner to resolve ("this one is correct" / "both are correct"). Until resolved the assistant will not quote contested facts. Owner FAQs automatically beat documents; archived documents and suppressed passages are never retrieved. Uploading what looks like a newer version of an existing document offers to archive the old one.
- **Content quality.** Menus, footers and cookie banners repeated across crawled pages are stripped. Documents carry quality flags (very short, mostly boilerplate, stale, few pages read, OCR). The website is re-read automatically when its snapshot is over 7 days old (`KNOWLEDGE_REFRESH=off` disables; `KNOWLEDGE_REFRESH_CRON` and `KNOWLEDGE_REFRESH_DAYS` tune it) and on demand from Admin.

### Calibration

`npm run eval:rag --prefix backend` scores the retrieval rules on labelled questions (`backend/knowledge/eval-data/`: a dental clinic and a yoga studio) and compares four variants with cross-dataset holdout. Defaults: passage similarity >= 0.66, generated-question similarity >= 0.78, keyword-coverage shortcut off in hybrid mode (it caused every remaining false answer). The datasets are small and synthetic: re-run on your own documents and questions before changing thresholds.

### Tests

`npm test --prefix backend` runs the knowledge, hardening, tenancy and SEO/GEO suites.
