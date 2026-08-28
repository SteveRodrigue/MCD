# Card Ambiguity & Blocker Queue (Inbox Zero)

This directory serves as the **active ambiguity queue** for cards that could not achieve $\ge 95\%$ confidence after 3 refinement iterations during the [Card Integration Protocol](../guidelines/card_integration_protocol.md).

---

## 🎯 The "Inbox Zero" Principle

* **1 File Per Blocked Card:** Every blocked card is isolated in its own file: `{pack}_{card_code}_{slug}.md` (e.g. `core_01085_emergency.md`).
* **Pruning on Resolution:** When an ambiguity is resolved, engine primitives are built, and the card is integrated with unit tests ($\ge 95\%$ confidence), its file is **deleted** from this directory.
* **Goal:** Keep this folder **completely empty** (Inbox Zero), representing 100% full rules compliance.

---

## 📄 File Template

```markdown
---
card_code: "XXXXX"
card_name: "Card Title"
pack: "pack_code"
confidence_reached: 70
blocker_category: "RULES_AMBIGUITY" # Options: RULES_AMBIGUITY | MISSING_ENGINE_PRIMITIVE | COMPLEX_TARGETING
date_logged: "YYYY-MM-DD"
---

# Card Ambiguity Report: [Card Title] (`#XXXXX`)

* **MarvelCDB Link:** https://marvelcdb.com/card/XXXXX
* **Official Printed Text:** `"<Printed card text>"`

---

## 🔍 Root Cause & Why Confidence Was Not Achieved (< 95%)
* Explain the exact ambiguity, conflicting rule, or missing engine feature.

---

## 🛠️ Attempted Schema Iterations
* Document Iterations 1, 2, and 3 with failure rationales.

---

## 🎯 Proposed Resolution Steps
* Outline concrete next actions required to unblock and integrate the card.
```
