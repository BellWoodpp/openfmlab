# OpenFMVideo (ShipBase + Podcast MVP)

This repo is based on the ShipBase SaaS template, plus an added minimal “podcast generator” MVP for content creators.

## Podcast MVP

- UI: `http://localhost:3000/podcast-mvp`
- Script API: `POST /api/podcast/script`
- Render API: `POST /api/podcast/render` (exports a single WAV)

### Required env

- `OPENAI_API_KEY`

Optional:
- `OPENAI_MODEL_TEXT` (default `gpt-4o-mini`)
- `OPENAI_MODEL_TTS` (default `gpt-4o-mini-tts`)

## Setup

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Notes

- The podcast export is WAV only in the MVP (no ffmpeg required).
- If you deploy publicly, add auth + stronger rate limiting to avoid API key abuse.
