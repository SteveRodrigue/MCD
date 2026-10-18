---
type: Fixed
---

- **Fix (Engine): The universal card filter reads real card fields (AUD-20261017-232534 F008)**
  - `isIdentitySpecific` matched almost every Core card (it compared a code prefix after probing upstream fields that do not exist); it now matches cards of the context player's hero set only.
  - `PLAYER_NEMESIS` matches exactly the context hero's nemesis set, and set codes match exactly instead of as substrings.
  - `isExhausted` and `hasStatus` read the card in play: callers pass the card instance (or villain), and a card definition never matches them. Before, they read the definition, where exhaustion and status cards never are.
  - `hasKeyword` uses the shared keyword helper instead of a substring search of the raw text; Piercing and Overkill on a source card use the same helper.
  - The evaluator is typed on `UniversalCardFilter` with no `any`; the alias keys the strict schema already rejected (`type`, `trait`, `set`, `targetCardCode`, ...) and the `matchCardFilter` wrapper are removed.
