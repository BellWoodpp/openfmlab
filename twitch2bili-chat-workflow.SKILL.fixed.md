---
name: twitch2bili-chat-workflow
description: Persist and reuse chat/session context for the `twitch2bili` repo.
---

# twitch2bili-chat-workflow

Persist and reuse chat/session context for the `twitch2bili` repo.

## Trigger
- When the user says **“开工”** while working in `/home/lcl/Blibili/twitch2bili`, load and summarize prior logs from:
  - `/home/lcl/Blibili/twitch2bili/.codex-progress/index.md`
  - `/home/lcl/Blibili/twitch2bili/.codex-progress/latest-summary.md`
  - The most recent file in `/home/lcl/Blibili/twitch2bili/.codex-progress/logs/`
- When the user says **“收工”**, save a short session summary/transcript into:
  - `/home/lcl/Blibili/twitch2bili/.codex-progress/logs/<timestamp>.md`
  - Then update:
    - `/home/lcl/Blibili/twitch2bili/.codex-progress/index.md`
    - `/home/lcl/Blibili/twitch2bili/.codex-progress/latest-summary.md`

## Workflow
### 开工
1) Read the three sources above.
2) Output a compact status recap:
   - What we changed last time
   - What’s currently configured (timers/paths/env)
   - What the user likely wants next

### 收工
1) Write a session log:
   - Goal, findings, changes, commands run by user, next steps
2) Append one line into `index.md` under “Sessions”.
3) Replace `latest-summary.md` with the newest summary.

## Notes
- Keep logs small and actionable; avoid dumping huge transcripts.
- Prefer referencing file paths and key commands.

