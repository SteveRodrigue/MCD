---
type: Added
---

- **Tooling: Private assets synchronization and backup CLI (`npm run assets:pull`, `assets:push`, `assets:status`) (#622)**
  - Manages copyrighted official reference PDFs (`references/rulesheets/`, `mc_rulesreference_v18_compressed.pdf`) and cosmetic art packs (`content/art-packs/`) via the private repository `SteveRodrigue/mcd-private-content`.
  - Links assets into local checkouts and git worktrees using zero-copy directory junctions and hardlinks, preventing ~450 MB data duplication and avoiding accidental data loss across cleanups or fresh worktrees.
