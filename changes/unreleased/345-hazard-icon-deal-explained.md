---
type: Fixed
---

- **Fix (Engine/UI): The Deal Encounter Cards step says why it dealt more than one card per player ([Issue #345](https://github.com/SteveRodrigue/MCD/issues/345))**
  - The report ("4 cards in a 3-player game") was correct play: Breakin' & Takin' `01107` prints a Hazard icon, which adds one card (RR v1.8 Hazard Icon). The stepper and the log now read, for example, `4 encounter card(s) dealt to player threat zone(s) (3 base + 1 for Hazard (Breakin' & Takin')).`
  - Hazard is an icon, not a keyword, like Crisis (#243): it is counted from `scheme_hazard` on every card in play (main scheme, environments, villain, tableau, allies, minions and attachments, not only side schemes), and a card with two icons adds two cards. `Keyword.HAZARD`, the `hasKeyword: "Hazard"` filter option and `SideSchemeCard.hasHazard` are removed; `schema.json` is regenerated.
  - `pipeline/crisis.ts` is now `pipeline/icons.ts`: one zone walk (`collectIconsInPlay`) serves Crisis and Hazard. The two copies of the step 3 event in `advanceStepOnDraft` became one.
  - The thwart modal shows the Crisis and Hazard badges of the main scheme as well.
