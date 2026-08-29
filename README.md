# Nexora

One application: marketing copilot (frontend) + LinkedIn scheduler + **Google Vertex AI** backend.

## Structure

```
Nexora/
  components/     # Insights, Campaigns, Creative Lab, …
  linkedin/       # LinkedIn Hub UI
  backend/        # Express API (OAuth, schedule, Vertex AI)
  App.tsx
```

## Vertex AI setup

All image/text/video generation goes through the backend (`/api/ai/*`), not a browser API key.

**Option A (recommended)** — GCP project + credentials:

1. Create/select a GCP project and enable **Vertex AI API**
2. Auth locally with either:
   - `gcloud auth application-default login`, or
   - set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON path
3. In `.env.local` / `backend/.env`:

```
VERTEX_PROJECT_ID=your-gcp-project-id
VERTEX_LOCATION=us-central1
```

**Option B** — Vertex Express / API key:

```
VERTEX_API_KEY=your_key
```

Check status: `GET http://localhost:4000/api/ai/status`

## Setup

```bash
cd Nexora
npm run install:all
```

Copy `.env.example` → `.env.local` and fill Vertex + LinkedIn + Mongo settings.

LinkedIn redirect URI:

`http://localhost:3000/auth/linkedin/callback`

## Run

```bash
npm run dev
```

- Web: http://localhost:3000  
- API: http://localhost:4000 (`/api` and `/auth` are proxied from the UI)
