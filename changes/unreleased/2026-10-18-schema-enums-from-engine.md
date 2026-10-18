---
type: Fixed
---

- **Fix (Data): Card filters can target player side schemes (AUD-20261017-232534 F015)**
  - `CardTypeSchema` and `ResourceTypeSchema` now take the engine `CardType` and `ResourceType` enum values instead of hand-written copies. The copy had 15 card types and lacked `player_side_scheme`, so no filter could select a player side scheme.
  - Removed the schema's `CardType` and `ResourceType` type aliases, which shared their names with the engine enums. `schema.json` regenerated; the filter spec lists the new type.
