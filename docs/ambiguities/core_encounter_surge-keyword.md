---
card_code: "01191"
card_name: "Exhaustion"
pack: "core_encounter"
confidence_reached: 90
blocker_category: "MISSING_ENGINE_PRIMITIVE"
date_logged: "2026-10-04"
---

# Card Ambiguity Report: Surge keyword (Exhaustion `01191` and five more)

* **MarvelCDB Link:** https://marvelcdb.com/card/01191
* **Official Printed Text:** `"Surge. When Revealed: Exhaust your identity card."`
* **Tracked in:** #218

---

## Root Cause

* The When Revealed ability is integrated (`EXHAUST` on `SELF_IDENTITY`; the previous invented "or take 2 damage" choice was removed).
* The **Surge keyword** is parsed (`card-loader.ts`) but never acted on by the engine, so the extra encounter card is not revealed. Same gap for `01121`, `01158`, `01178`, `01185`, `01193`.
* Once #218 lands, no further data change is needed for `01191`; delete this file and bump the audit stamp.
