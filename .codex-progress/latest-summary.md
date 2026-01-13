# Latest summary (openfmvideo)

## Where we left off

- Project: `/home/lcl/openfmvideo` (Next.js + TypeScript, App Router).
- Brand: **RTVox** (AI Text-to-Speech, Google voices). Voice cloning is **temporarily hidden** unless `NEXT_PUBLIC_VOICE_CLONING_ENABLED=1`.
- Main TTS page: `/podcast-mvp` (and `/{locale}/podcast-mvp`).
- Podcast MVP i18n (recent):
  - Voice picker `Language` dropdown now shows native/endonym labels (and includes region + BCP-47 code).
  - Voice picker status lines (“Current voice…”, tier, “Found … voices…”, tier counts) are localized.
  - History UI (“Generated History”, retention/quota copy, Total duration/Loading, Download/Delete, delete confirmations) is localized.
  - Playback note + “Why might it not feel like 4x?” explanation block is localized.
- Creem subscription + membership:
  - Webhook verification + subscription sync/backfill (membership state doesn’t depend on “success-page navigation”).
  - Membership “Upgrade Plan” behaves like Pricing (actionable upgrade), and Pricing “Current plan” is disabled/grey.
  - Orders support soft-delete (`metadata.hidden=true`) with a red Delete button to keep lists manageable.
- Orders list (recent):
  - Status filter supports multi-select (pending/paid/cancelled/failed/refunded) and sits next to the search input inside the orders card.
  - Pagination uses numeric page links via the shared `Pagination` component.
  - API `pagination.total` is now accurate (`count(*)`), and the UI shows “X–Y of TOTAL” correctly.
- UI loading:
  - Tokens and membership badge no longer flash `0`/leaf → crown; a spinner is shown while loading.
- Locale persistence: language switcher writes `rtvox_locale` cookie; middleware redirects to the preferred locale on return visits.
- Podcast MVP: optional “Custom audio name” toggle near Upload File and near Share; saved as `tts_generations.title` and used for filenames.
- Customer dashboard: `/{locale}/dashboard` shows token-centric stats and hides the footer.
- Homepage has a TTS input mock:
  - Localized intro text + placeholder (EN/ZH/JA).
  - After clearing, clicking any voice repopulates the localized intro text.
  - Includes a purple `GENERATE` button linking to `/podcast-mvp`.
  - Demo voice preview prefers local sample MP3s; falls back to browser `speechSynthesis`.
- Homepage hero + feature sections copy now follows locale switching (badge/hero/tagline/section copy/CTAs).
- Homepage TTS mock UI chrome labels (“Text to Speech”, “Select a Voice”, “Public”, “Language”, “Generate”, char/token count) now follows locale switching.
- `/podcast-mvp` Tone picker includes a `?` help dialog describing tone types.
- Avatars:
  - Homepage sample cards use user-generated PNGs under `public/avator/{English|Chinese|Japanese}` (fallback to generated SVG).
  - `/podcast-mvp` voice cards do **not** reuse homepage人物图片; they use per-voice generated avatars (fallback placeholder).
- Profile page: removed non-functional “Edit Profile / Change Password” buttons.
- Skeleton loading: `profile`, `membership`, `orders`, `blogs`, and blog detail use `loading.tsx` skeleton UIs while data loads.
- Admin blogs language switching: `/{locale}/admin/blogs` routes exist and internal admin navigation keeps the locale.

## Pricing / payments

- Pricing cards: Free + Professional + “积分加油站/points” (credits top-up) now renders as a third card.
- Billing UI: monthly/yearly only (one-time payment toggle removed).
- Payments API expects `{ product_id, period }` and creates subscription orders; set `CREEM_PRODUCTS` keys like `professional:monthly` / `professional:yearly`.
- The `points` CTA is currently disabled (no checkout/redirect yet).

## Membership

- Membership page is customer-facing and token/usage oriented (plus a “积分加油站” disabled card with localized “Coming soon/即将上线”).

## Docs / help

- `/docs` and `/help` content rewritten for RTVox + Google Text-to-Speech guidance (EN/ZH/JA).
- Help “Popular Articles” cards are clickable, and internal links are locale-prefixed.

## openfmlab migration

- `/home/lcl/下载/openfmlab` contained unresolved merge conflict markers in several page TSX files + locale JSON; extracted the **HEAD/RTVox** version and migrated:
  - `src/app/[locale]/{pricing,integrations,contact,status,privacy,terms,cookies}/page.tsx` (metadata suffixes)
  - `src/i18n/locales/*.json` `pages.*` content for those pages across locales
  - Fixed typo `RTXox` → `RTVox` across locales

## Key endpoints

- `GET /api/tokens` — current user token balance.
- `POST /api/tts/generate` — generates audio + saves history + charges tokens (returns `402` on insufficient tokens).
- `GET /api/tts/history` — generation history with paging.
- `GET /api/tts/audio/[id]` — audio streaming (supports `Range`).
- `GET /api/tts/voices` — available voices.
- Dev only: `GET /api/dev/set-tokens?tokens=...` — set current user tokens for testing.

## Verification

- `pnpm exec tsc -p tsconfig.json --noEmit` passes.
- `pnpm build` can fail to start if `next dev` is running and holds the `.next` lock (stop dev or try again).

## Next time “开工”

- Confirm Creem product mapping for `monthly/yearly` keys before testing paid upgrades.
- Decide the desired flow for `points` top-up (a dedicated top-up page vs. direct provider checkout) and then implement it.
- If you need strict multi-language SEO, decide whether to invest in per-locale `<html lang>` (current setup keeps pages static-friendly on Vercel free tier).
- Optionally add a real OpenGraph image and wire it into `openGraph.images`.
