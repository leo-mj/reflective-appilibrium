# Reflective Appilibrium — Web App

A React + Vite visualisation tool for wide reflective equilibrium (RE) in ethics.

## Getting started

```bash
npm install
npm run dev
```

For AI features, the FastAPI backend must also be running (see the root README).

## Build targets

Three environments, controlled by `VITE_APP_ENV`:

| Command                 | Mode / env file   | `VITE_APP_ENV` | Backend / LLM | Intended use               |
| ----------------------- | ----------------- | -------------- | ------------- | -------------------------- |
| `npm run dev`           | `.env`            | `dev`          | enabled       | Local development          |
| `npm run build`         | `.env.production` | `demo`         | disabled      | Public static deploy       |
| `npm run build:backend` | `.env.backend`    | `backend`      | enabled       | Public deploy with backend |

### Public demo build (no LLM)

```bash
npm run build
```

Produces a static site with all tabs present. LLM-dependent features (Assist workflow tabs, RE simulation) fall back to pre-set sample data and show a "No LLM API connection" banner. Deploy the `dist/` folder to any static host.

### Backend build (deployed backend)

```bash
npm run build:backend
```

Includes all LLM features. Users enter their own API key (BYOK) in the LLM settings modal: a backend deployed with `DEPLOYMENT=hosted` never lends its server-side keys. `.env.backend` is tracked with a placeholder address, so supply the real one in the environment at build time:

```bash
VITE_BACKEND_URL=https://<your-deployed-backend> npm run build:backend
# …or, when one host serves the site and routes /api to the backend:
VITE_BACKEND_URL=/ VITE_BASE_PATH=/ npm run build:backend
```

## Feature flags

All LLM features are controlled by a single variable:

| `VITE_APP_ENV` | Backend | LLM | BYOK | Sample data |
| -------------- | ------- | --- | ---- | ----------- |
| `dev`          | ✓       | ✓   | ✓    | toggleable  |
| `backend`      | ✓       | ✓   | ✓    | off         |
| `demo`         | ✗       | ✗   | ✗    | always on   |

`BACKEND_ENABLED` (and therefore `LLM_ENABLED`) is `true` when `VITE_APP_ENV` is `dev` or `backend`.

## Security

API keys are **never stored in the frontend bundle**. All LLM calls go through the FastAPI backend at `VITE_BACKEND_URL`. The browser never contacts a provider directly.

- **Server-side keys** (a backend in `local` mode only): keys live in `backend/.env` and are lent only to callers on localhost. A `hosted` backend never lends them.
- **BYOK**: the user enters a key in the LLM settings modal. It is held in `sessionStorage` and forwarded as an `x-api-key` header on each request to the backend. Never persisted server-side.

## Tests

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```
