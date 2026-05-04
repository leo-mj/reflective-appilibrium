# Assistive Equilibrium — Web App

A React + Vite visualisation tool for wide reflective equilibrium (RE) in ethics.

## Getting started

```bash
npm install
npm run dev
```

For AI features, the FastAPI backend must also be running (see the root README).

## Build targets

| Command | Environment | LLM / Backend | Intended use |
|---|---|---|---|
| `npm run dev` | `.env` | enabled (BYOK) | Local development |
| `npm run build` | `.env.production` | disabled | Public static deploy |
| `npm run build:byok` | `.env.byok` | enabled (BYOK) | Public deploy with user-supplied keys |
| `npm run build:local` | `.env.local` | enabled (backend) | Local build with server-side keys |

### Public build (no LLM)

```bash
npm run build
```

Produces a static site with all tabs present. LLM-dependent features (Assist workflow
tabs, coherence matrix) fall back to pre-set dummy data and show a "No LLM API
connection" banner. Deploy the `dist/` folder to any static host.

### BYOK build (user-supplied key)

```bash
npm run build:byok
```

Includes all LLM features. Users enter their own API key and choose a provider in the
LLM settings modal. The key is forwarded as an `x-api-key` header to the backend,
which proxies the request to the provider — the key is never stored server-side.

Create `app/.env.byok` (already present in the repo as a template):

```env
VITE_BYOK_ENABLED=true
VITE_BACKEND_URL=https://<your-deployed-backend>
VITE_DEFAULT_PROVIDER=openai
VITE_DEFAULT_MODEL=gpt-4o-mini
```

### Local build (server-side keys)

```bash
npm run build:local
```

Uses the local FastAPI backend for all LLM calls. API keys live entirely server-side.
Create `app/.env.local`:

```env
VITE_APP_ENV=dev
```

## Feature flags

LLM features are controlled by two `VITE_*` variables:

| Variable | Values | Effect |
|---|---|---|
| `VITE_APP_ENV` | `dev` / `prod` | `dev` enables LLM + backend |
| `VITE_BYOK_ENABLED` | `true` / `false` | also enables LLM + backend |

`LLM_ENABLED` is `true` when either `VITE_APP_ENV === "dev"` or `VITE_BYOK_ENABLED === "true"`.

## Security

API keys are **never stored in the frontend bundle**. There is no `VITE_OPENAI_API_KEY` or
equivalent — doing so would expose the key to anyone who downloads the page.

All LLM calls go through the FastAPI backend at `VITE_BACKEND_URL`. The browser never
contacts a provider directly.

- **Server-side keys** (dev / local build): keys live in `backend/.env`. The backend
  rejects LLM requests from non-localhost clients that do not include an `x-api-key` header.
- **BYOK**: the user enters a key in the LLM settings modal. It is held in `sessionStorage`
  and forwarded as an `x-api-key` header on each request to the backend. Never persisted
  server-side.

## Tests

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```
