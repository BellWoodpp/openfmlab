# Latest summary (openfmvideo)

## Where we left off

- Project: `/home/lcl/openfmvideo` (Next.js + TypeScript, App Router).
- TTS tool lives at `/podcast-mvp` (and `/{locale}/podcast-mvp`).
- Added a Token system (internal credits) and hooked it to TTS generation.

## Key endpoints

- `GET /api/tokens` — current user token balance (defaults to 500 if unavailable).
- `POST /api/tts/generate` — generates audio + saves history + **charges tokens**; returns `402` on insufficient tokens.
- `GET /api/tts/history?limit=...&offset=...` — history paging + retention info.
- `GET /api/tts/audio/[id]` — audio streaming (supports `Range` for playback + duration).
- `GET /api/tts/meta?...` — provider/model/tier metadata (good for debugging usage/cost).
- Dev only: `GET /api/dev/set-tokens?tokens=3` — set current user tokens for testing.

## Key UI behaviors

- Header shows token balance (icon + number) next to GitHub.
- Text area shows `X / 5000 characters · Y tokens` estimation.
- Generate button shows 3-step progress text: generating → saving → loading.
- Insufficient tokens shows a modal “积分不足” with a “充值会员” link to Pricing.
- Generated History has pagination (6 per page, page buttons 1/2/3…).
- Voice picker has Public/Private tabs; Private hides provider voices (only clones).
- Voice Cloning remains in code but is gated as “即将上线” (click shows “正在上线中” modal).

## Verification

- `pnpm build` succeeds (note: blog SSG can occasionally fail with transient DB `ECONNRESET`; rerun usually passes).

## Next time “开工” (model usage + switching)

- Check current provider/model: open `GET /api/tts/meta` and confirm `provider` + (OpenAI) `model`.
- Switch provider by `.env.local` `TTS_PROVIDER` and restart `pnpm dev`.
- Check billing tier for Google voices via `billingTier` in `/api/tts/meta` (standard/wavenet/neural2/studio/chirp3-hd).
- Check internal tokens: Header + `GET /api/tokens`; test insufficient flow via `GET /api/dev/set-tokens?tokens=3` (dev only).
