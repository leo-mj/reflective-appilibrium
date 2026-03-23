# Assistive Equilibrium — Web App

A React + Vite visualisation tool for wide reflective equilibrium (RE) in ethics.

## Getting started

```bash
npm install
npm run dev
```

## Builds

The app has two build targets:

### Public build (no LLM)

```bash
npm run build
```

Produces a static site with the Graph, Text, and History tabs. The Matrix tab and
chat panel are excluded entirely — the OpenAI SDK is tree-shaken out of the bundle.
Deploy the `dist/` folder to any static host.

### Local build (with LLM)

```bash
npm run build:local
```

Includes all LLM-dependent features (Matrix tab, chat panel). Intended for running
locally, not for public deployment — the OpenAI API key must not be exposed in a
publicly hosted build (see [Security](#security) below).

## LLM feature flag

LLM-dependent features are controlled by the `VITE_ENABLE_LLM` environment variable:

| File | `VITE_ENABLE_LLM` | Used by |
|---|---|---|
| `.env` | `true` | `npm run dev` |
| `.env.production` | `false` | `npm run build` (public) |
| `.env.local` | `true` | `npm run build:local` (create this file if it doesn't exist) |

To create `.env.local` for local builds:

```bash
echo "VITE_ENABLE_LLM=true" > .env.local
```

## Security

The OpenAI API key is stored in `.env` and read at build time by Vite. Because `VITE_*`
variables are inlined into the browser bundle, **never use `npm run build` (public) with
a real API key** — `VITE_ENABLE_LLM=false` in `.env.production` ensures the key and the
OpenAI SDK are excluded from the public build.

For local use (`npm run dev` / `npm run build:local`), set your key in `.env`:

```
OPENAI_API_KEY=sk-...
```

`.env` is gitignored and never committed.
