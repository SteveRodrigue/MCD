---
type: Removed
---

- **Engine: Removed the never-emitted `VILLAIN_ATTACK` and `VILLAIN_SCHEME` log keys ([Issue #336](https://github.com/SteveRodrigue/MCD/issues/336))**
  - Deleted the `LogEvents` entries, the `ALL_LOG_EVENT_KEYS` items, the en/fr templates and the comic log formatter branches. Villain attacks and schemes are logged through `VILLAIN_ATTACK_HIT` and `VILLAIN_SCHEME_THREAT`.
