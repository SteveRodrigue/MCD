---
type: Fixed
---

- **Fix (UI / Engine): Show Wakanda Forever! upgrade effects from the card data (`AUD-20261017-232534 R1` review)**
  - The Wakanda Forever! modal no longer hardcodes rules text per card code. Energy Daggers (`01046`) no longer claims its finisher hits "all enemies"; each tile shows the card's own text and the amounts from its Special.
  - `src/engine/specials/wakanda-forever.ts` adds the Special's effect type, amount, and finisher amount to each prompt option. Badges and icons come from the effect type, so new or reprinted upgrades are styled without a code table.
  - The card text is rendered as formatted HTML instead of raw `<b>` / `<i>` markup. The modal state resets when a new prompt opens.
