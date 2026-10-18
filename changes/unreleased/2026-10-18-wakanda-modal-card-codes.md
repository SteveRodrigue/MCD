---
type: Fixed
---

- **Fix (UI / Engine): Match Wakanda Forever! modal upgrades by card code (`AUD-20261017-232534 R1`)**
  - Populated `cardCode: u.card.code` on decision prompt options in `src/engine/specials/wakanda-forever.ts`.
  - Replaced `UPGRADE_CONFIGS` name-substring matching in `src/ui/components/board/WakandaForeverModal.tsx` with `UPGRADE_STYLES` keyed by `cardCode`, deriving display names from `opt.label` so Vibranium Suit (`01049`) renders its styled tile and icon instead of falling back due to the hardcoded `"Panther Suit"` string.
