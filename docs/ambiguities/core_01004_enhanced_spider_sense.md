---
card_code: "01004"
card_name: "Enhanced Spider-Sense"
pack: "core"
confidence_reached: 80
blocker_category: "INTERCEPTOR_CANCEL_WHEN_REVEALED"
date_logged: "2026-08-28T09:27"
---

# Card Ambiguity Report: Enhanced Spider-Sense (`#01004`)

* **MarvelCDB Link:** [https://marvelcdb.com/card/01004](https://marvelcdb.com/card/01004)
* **Official Printed Text:** `<b>Hero Interrupt</b>: When a treachery card is revealed from the encounter deck, cancel its "<b>When Revealed</b>" effects.`

---

## 🔍 Why Code-Level Implementation Audit (Step 6) Fails
* **Trigger Window:** `HERO_INTERRUPT` when a treachery card is revealed from the encounter deck.
* **Blocker Reason:** Requires `CANCEL_WHEN_REVEALED` interceptor in `step5_revealEncounterCards` (ADR-0020).
* **Current Confidence:** 80% (Tier 3 Gate Fired).
