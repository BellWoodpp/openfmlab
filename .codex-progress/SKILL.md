---
name: openfmvideo-chat-workflow
description: Persist and reuse openfmvideo (RTVox) project chat history. Use when the user says
“开工/收工” while working in /home/lcl/openfmvideo to load or save session logs under /home/lcl/
openfmvideo/.codex-progress.
---

# openfmvideo Chat Workflow

## 开工

- Read `/home/lcl/openfmvideo/.codex-progress/index.md`.
- Read `/home/lcl/openfmvideo/.codex-progress/latest-summary.md`.
- Read the most recent log in `/home/lcl/openfmvideo/.codex-progress/logs/` (by mtime).
- Summarize current status, last changes, and likely next steps; then ask what to do next.

## 收工

- Summarize what was done, key decisions, and any follow-ups.
- Write a new log file to `/home/lcl/openfmvideo/.codex-progress/logs/` using `YYYY-MM-
DD_HHmm.md`.
- Update `/home/lcl/openfmvideo/.codex-progress/index.md` with a one-line entry for the new log.
- Update `/home/lcl/openfmvideo/.codex-progress/latest-summary.md` with the new summary.

## Notes

- Create `/home/lcl/openfmvideo/.codex-progress/logs/` if missing.
- Keep summaries concise and in the same language as the session.

