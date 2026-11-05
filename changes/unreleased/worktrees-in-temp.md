---
type: Changed
---

- **Tooling: Git worktrees now live in `temp/worktrees/<name>`**
  - `AGENTS.md` has the rule, and a Claude Code hook blocks `git worktree add` anywhere else.
  - ESLint, Prettier and the Vite watcher skip `temp/`.
