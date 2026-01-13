# RTVox (Text-to-Speech + Podcast MVP)

RTVox is a Next.js app for AI text-to-speech, plus a minimal “podcast generator” MVP for content creators.

## Podcast MVP

- UI: `http://localhost:3000/podcast-mvp`
- Script API: `POST /api/podcast/script`
- Render API: `POST /api/podcast/render` (exports a single WAV)

### Required env

- TTS 选其一：
  - OpenAI：`TTS_PROVIDER=openai` + `OPENAI_API_KEY`
  - Google Cloud TTS：`TTS_PROVIDER=google` + `GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to/service-account.json`

Optional:
- `OPENAI_MODEL_TEXT` (default `gpt-4o-mini`)
- `OPENAI_MODEL_TTS` (default `gpt-4o-mini-tts`)
- `DATABASE_URL` (enable saved TTS history + public share links; run Drizzle migration in `drizzle/`)

## Setup

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Creem (payments) smoke test

```bash
pnpm creem:smoke -- --retrieve-only
pnpm creem:smoke
```

## Notes

- The podcast export is WAV only in the MVP (no ffmpeg required).
- If you deploy publicly, add auth + stronger rate limiting to avoid API key abuse.
