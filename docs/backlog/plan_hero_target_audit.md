# Review: the `target: "HERO"` pattern in core encounter cards (follow-up to #133)

> Status: **Decisions approved (2026-10-04) and applied.** Placeholders stripped (`01159`, `01164` When Revealed, `01168`, `01169`, `01174`, `01179`), `01191` and `01110` corrected, issues #218-#223 created. Remaining work waits on those engine issues.
> Mode: card-integration-protocol **Batch Mode, Phase 2** (consolidated peer review gate). Parent plan: [plan_issue_133_hydra_bomber.md](plan_issue_133_hydra_bomber.md).

## 0. Headline

The seven other cards are **not** a scoping bug like Hydra Bomber. Six of them are **placeholders**: their data (`DEAL_DAMAGE 2 / HERO`, or `ADD_STATUS CONFUSED / HERO`) has nothing to do with the printed text. Correct data needs engine support that does not exist yet, so a data-only fix for any of them would be wrong.

Two cross-cutting engine gaps explain most of it:

| Gap | Evidence | Cards affected |
|---|---|---|
| **E1. The Surge keyword does nothing.** The importer adds `Keyword.SURGE` (`card-loader.ts:145`) but nothing in `src/engine` reads it. | `grep` for `Keyword.SURGE` / `'Surge'` finds only the parser and the enum. Six core encounter cards print `Surge.` (`01121`, `01158`, `01178`, `01185`, `01191`, `01193`). | `01191` here; five more outside this audit |
| **E2. Hand discard is too thin** (`executeDiscard`, `effects/index.ts:~1009-1140`). `mode: RANDOM` ignores `filter`, returns no `discardedCards` and acts on only `targetPlayers[0]` (not "each player"). Non-random hand discard takes the first N cards and also ignores `filter`. | read in code | `01179`, `01169` |
| **E3. No "for each player" iteration** inside one ability (each player discards, then that player takes damage). | no primitive found in the effect list or spec | `01174` (and `01169`) |

## 1. Per-card review (4-point format)

For each card: (1) printed text, (2) original data, (3) proposed data, (4) why, plus engine verdict and the test that will accompany the fix. All seven keep `timing: WHEN_REVEALED`/`trigger: WHEN_REVEALED` (the originals use `FORCED_RESPONSE` for the same trigger; fix while there).

### 01191 Exhaustion (treachery, set `expert`) — Tier 1 data + E1
1. **Printed:** "Surge. **When Revealed**: Exhaust your identity card."
2. **Original:** `PLAYER_CHOICE` "exhaust identity **or take 2 damage**" (invented option, `target: HERO`).
3. **Proposed:**
```json
"abilities": [{ "id": "exhaustion_when_revealed", "timing": "WHEN_REVEALED", "trigger": "WHEN_REVEALED",
  "steps": [{ "effect": "EXHAUST", "effectParams": { "target": "SELF_IDENTITY" } }] }]
```
4. **Why:** the damage option does not exist on the card, and there is no choice. Surge itself is a keyword and needs **E1**.
- **Engine:** `EXHAUST`/`SELF_IDENTITY` already works. **Tests:** reveal exhausts the revealing player's identity, no prompt, no damage; with E1, an extra card is revealed. The existing test `decision-prompts.test.ts` ("01191 Exhaustion: PLAYER_CHOICE resolves…") encodes the invented behavior and must be rewritten.

### 01168 Sweeping Swoop (treachery, `spider_man_nemesis`) — Tier 1 for When Revealed, boost blocked
1. **Printed:** "**When Revealed**: Stun your hero. If Vulture is in play, this card gains surge. ★ **Boost**: If this activation deals damage to a friendly character, stun that character."
2. **Original:** When Revealed deals 2 damage to every hero (`HERO`); boost stuns the defending character **unconditionally**.
3. **Proposed (When Revealed):**
```json
"steps": [
  { "effect": "ADD_STATUS", "effectParams": { "status": "STUNNED", "target": "SELF_IDENTITY" } },
  { "effect": "SURGE", "gate": "IF_CARD_IN_PLAY", "gateParams": { "cardCode": "01167" } }
]
```
   **Boost:** needs a gate "this activation dealt damage" that does not exist (E4, new). Until then the boost ability should be stripped with an ambiguity file, not left unconditional.
4. **Why:** placeholder damage replaced by the printed Stun; `01167` is Vulture (minion, `IF_CARD_IN_PLAY` already searches engaged minions). **Open ruling:** "your hero" while in alter-ego form (stun the identity, or nothing?).
- **Tests:** stun lands on the revealing player only; surge only when `01167` is engaged; no surge otherwise.

### 01179 Yon-Rogg's Treason (treachery, `captain_marvel_nemesis`) — Tier 2 (E2)
1. **Printed:** "**When Revealed**: Discard each [energy] resource from your hand. If you discarded no cards this way, this card gains surge."
2. **Original:** `DEAL_DAMAGE 2 / HERO`.
3. **Proposed:**
```json
"steps": [
  { "effect": "DISCARD", "effectParams": { "source": "HAND", "count": "ALL", "target": "SELF_IDENTITY",
      "filter": { "types": ["resource"], "resourceTypes": ["energy"] } } },
  { "effect": "SURGE", "gate": "IF_AMOUNT_ZERO" }
]
```
   (filter field names to be confirmed against spec `04_universal_card_filter.md`; a printed-resource filter may be a new filter field.)
4. **Why:** wrong effect entirely. Needs hand-discard `filter` support (E2) and a matching-card result for the gate.
- **Tests:** discards only energy-resource cards (events with an energy icon stay); surge when none discarded; no surge otherwise.

### 01169 The Vulture's Plans (treachery, `spider_man_nemesis`) — Tier 2/3 (E2, E3)
1. **Printed:** "**When Revealed**: Discard 1 card at random from each player's hand. Place 1 threat on the main scheme for each different resource type discarded this way."
2. **Original:** `ADD_STATUS CONFUSED / HERO`.
3. **Proposed:** `DISCARD` (`source: HAND`, `mode: RANDOM`, `count: 1`, each player) then `ADD_THREAT` with `amount: { from: "DISCARDED_CARDS", discardAttribute: "DIFFERENT_RESOURCES" }` aggregated across all players' discards.
4. **Why:** wrong effect. Needs random discard that targets every player and reports what was discarded (E2/E3).
- **Tests:** two players, known hands; threat equals distinct resource types across both discards.

### 01174 Electromagnetic Backlash (treachery, `iron_man_nemesis`) — Tier 3 (E3)
1. **Printed:** "**When Revealed**: Each player discards the top 5 cards of their deck. For each printed [energy] resource a player discards this way, that player takes 1 damage."
2. **Original:** `DEAL_DAMAGE 2 / HERO`.
3. **Proposed:** per player: `DISCARD` (`source: DECK`, `mode: TOP`, `count: 5`) then `DEAL_DAMAGE` to **that** player with `amount: { from: "DISCARDED_CARDS", discardAttribute: "RESOURCE_ICONS", resourceType: "energy" }`. The "for each player" repetition is **E3**.
4. **Why:** wrong effect; needs per-player iteration so each player's damage depends on their own discard.
- **Tests:** two players with different decks, damage per player equals own energy icons discarded.

### 01159 Ritual Combat (treachery, `black_panther_nemesis`) — Tier 2 (confirm)
1. **Printed:** "**When Revealed**: Discard the top card of the encounter deck. Then, choose to either deal X damage to your hero or place X threat on the main scheme. X is 1 more than the number of boost icons on the discarded encounter card."
2. **Original:** `DEAL_DAMAGE 2 / HERO` (no choice, fixed 2).
3. **Proposed:** `DISCARD` (`source: ENCOUNTER_DECK`, `mode: TOP`, `count: 1`) then `PLAYER_CHOICE` with options `DEAL_DAMAGE`/`SELF_IDENTITY` and `ADD_THREAT`/`MAIN_SCHEME`, both `amount: 1` plus `dynamicBonus: { from: "DISCARDED_CARDS", discardAttribute: "BOOST_ICONS" }`.
4. **Why:** placeholder. **To confirm before approving:** that option parameters in `PLAYER_CHOICE` can read `previousResult.discardedCards` when the choice resolves later (the discard happens before the prompt).
- **Tests:** discarded card with 0, 1, 2 boost icons gives X = 1, 2, 3; both options; damage only to the revealing player.

### 01164 Titania's Fury (treachery, `she_hulk_nemesis`) — Tier 3 (blocked)
1. **Printed:** "**When Revealed**: Titania attacks your hero. If Titania did not attack, heal all damage from Titania and this card gains surge. ★ **Boost**: Give the villain 1 additional boost card for this activation."
2. **Original:** `DEAL_DAMAGE 2 / HERO` plus the (correct) `GIVE_ADDITIONAL_BOOST_CARD` boost.
3. **Proposed:** keep the boost ability as is. For When Revealed there is no primitive for "a specific minion attacks a hero, branch on whether it did". Per the protocol: **circuit-breaker**, strip the When Revealed ability, add `docs/ambiguities/core_01164_titanias-fury.md` listing the missing primitive.
4. **Why:** a damage placeholder is worse than no ability; blocked on a new minion-attack primitive (and its "did not attack" result).

### 01159, 01164, 01168, 01169, 01174, 01179, 01191 summary

| Card | Verdict | Needs | Can be fixed now |
|---|---|---|---|
| 01191 Exhaustion | Tier 1 data (+E1 for Surge) | E1 for Surge only | Yes (data), Surge after E1 |
| 01168 Sweeping Swoop | Tier 1 When Revealed; boost needs new gate | E4 for boost | When Revealed yes; boost: strip |
| 01179 Yon-Rogg's Treason | Tier 2 | E2 (hand filter + result) | After E2 |
| 01159 Ritual Combat | Tier 2 | confirm choice-time `discardedCards` | After a small check |
| 01169 Vulture's Plans | Tier 2/3 | E2 + E3 | After E2, E3 |
| 01174 Electromagnetic Backlash | Tier 3 | E3 | After E3 |
| 01164 Titania's Fury | Tier 3 blocked | new minion-attack primitive | Circuit-breaker now |

## 2. Recommended sequence (you choose)

1. **Now (no engine work):** fix `01110` (#133), `01191` data and `01168` When Revealed; strip placeholder abilities on `01164` and `01168` boost into ambiguity files.
2. **Engine batch (new issues):** E1 Surge keyword (affects six cards), E2 hand-discard filter/each-player/results, E3 per-player iteration, E4 "damage dealt this activation" gate.
3. **Then:** `01179`, `01159`, `01169`, `01174` with their tests, and `01164` when its primitive exists.
4. **Fold the remaining data audit into #100** (postponed), since these primitives are exactly what #100 is waiting on.

## 3. Decisions (resolved)

1. **Placeholders:** strip now. *Approved, done.*
2. **Issues:** separate issues. *Approved, created:* E1 #218 (Surge), E2 #219 (hand discard), E3 #220 (per-player iteration), E4 #221 (damage gate), plus two blockers the audit surfaced: #222 (form-literal "your hero" selector) and #223 (named-minion attack).
3. **"Your hero":** never the alter-ego; cards are literal. *Ruling recorded in spec `03_costs_and_targeting.md`; drives #222.*
4. **Sequence:** *Approved.*

## 4. What was written (after approval)

`01110` and `01191` fixed with tests; the six blocked cards stripped with ambiguity reports and a guard test (`tests/data/blocked-placeholder-cards.test.ts`). Per-card engine tests are written with each engine issue.

## 5. Original note: why only these changes


None is data-only. Writing tests now would assert behavior the engine cannot produce (E1-E4) or pin the placeholder behavior. The tests are specified per card above and will be written red-first as each unblocked fix is approved.
