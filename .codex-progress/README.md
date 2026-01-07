# openfmvideo Codex progress (开工/收工)

This folder stores lightweight progress logs so a new Codex chat can resume work quickly.

Suggested workflow:
- Say **“开工”** in a new chat: the assistant should read `latest-summary.md`, `index.md`, and the newest file in `logs/`.
- Say **“收工”**: the assistant should write a new log in `logs/` and refresh `latest-summary.md` + `index.md`.

Note:
- In this environment the assistant can only write inside the project directory, so progress is stored here (not in a global `~/.codex/skills` skill).
