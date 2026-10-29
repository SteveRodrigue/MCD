---
type: Added
---

- **Encounter & Combat: Radioactive Man (01129) random hand discard attack response and boost ([Issue #496](https://github.com/SteveRodrigue/MCD/issues/496))**
  - Validated `MINION_ATTACKED` Forced Response discarding 1 random card from defending player's hand across undefended, ally defense, and cross-table defense.
  - Validated `BOOST` ability discarding 1 random card from defending player's hand during enemy attack.
  - Promoted supplemental confidence for Radioactive Man (01129) to 100%.
  - Simplified redundant `isMinionEngaged` check in `combat-pipeline.ts`.
