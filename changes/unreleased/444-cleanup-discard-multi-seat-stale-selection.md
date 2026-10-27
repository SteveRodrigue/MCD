---
type: Fixed
---

- **End of Player Phase discard no longer gets stuck for the second player (Fixes #444)**
  - The multi-select modal kept the previous player's chosen cards when the next player's prompt appeared, so the counter was wrong and confirming sent card ids that were not in that player's hand. Each decision prompt now mounts its modal fresh (`key={prompt.promptId}`), including the distribution and simultaneous-ability modals.
