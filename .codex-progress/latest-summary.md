# Latest summary (openfmvideo)

## Where we left off

- Project: `/home/lcl/openfmvideo` (Next.js + TypeScript).
- Switched TTS provider from OpenAI to **Google Cloud Text-to-Speech** (service account via `GOOGLE_APPLICATION_CREDENTIALS`).
- Added cost-aware voice ordering: voices list sorted cheapest-first (`standard → wavenet → neural2 → studio → chirp3-hd → unknown`).
- Enforced “must enter text before generating audio”.
- Generate MP3 once and reuse it for playback/download (avoid double billing when possible).

## Key endpoints

- `GET /api/generate?...` returns audio (supports `format=mp3`) and includes `X-TTS-*` headers.
- `GET /api/tts/voices?lang=...` lists voices (sorted cheapest-first).
- `GET /api/tts/languages` lists available language codes (63 on this account).
- `GET /api/tts/meta?...` returns resolved billing/voice/tone parameters (used for console logging).

## Key UI behaviors

- Voice picker uses card UI with a generated placeholder avatar (no manual asset collection).
- “Auto pick” mode shows a ✔ when active; selected voice shows ✔ badge.
- “Playback speed” uses browser `audio.playbackRate` (strict playback scaling).

## Recent fix

- Fixed runtime error `Cannot access 'voice_0' before initialization` by removing an inner `voice` re-declare inside `PlayButton.tsx` (it was shadowing and causing a TDZ error in the compiled bundle).

## Verification

- `pnpm exec next build` succeeded after the fix.

## Open TODOs

- Final polish on UI spacing/layout to match screenshots (if requested).
- Confirm Download UX: Download should only occur via `Download` button (no auto-download on Play).
