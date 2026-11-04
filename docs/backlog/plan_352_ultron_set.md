# Plan #352: Ultron set supplemental entries (22 cards), Drone-first

Status: **approved as recommended (2026-11-03), including closing #272 once PR B is merged.** Branch `fix/352-ultron-supplemental` (from `main` at `fa0ba2b`). Saved locally as `docs/backlog/plan_352_ultron_set.md`.

The whole set hangs on one action: _"put the top card of your deck into play facedown, engaged with you as a Drone minion"_ (11 cards create Drones, 6 more read them). That action stays in the Ultron scenario script (M5 decision 4) and becomes callable from card data, so every card goes through the same code.

---

## 1. In-Game Scenarios

### S1. Creating a Drone (the core)

**Setup:** Spider-Man and Captain Marvel vs Ultron (Standard). The Crimson Cowl 1B is revealed at setup.

**Player does:** Nothing. Each player puts the top card of their deck into play facedown as a Drone.

**Today:** The script replaces the deck card with a fake card `drone_01005`. The real card is gone for good. When the Drone dies, the fake card goes to the **encounter** discard pile, and it can get shuffled into the encounter deck later. Only stage 1B makes Drones. Assault on NORAD 2A, Countdown 3A, Android Efficiency, Drone Factory, Ultron's Imperative and the other creators do nothing.

**After this change:** Every creator card makes a Drone through the same script action. A Drone is a plain minion named "Drone" (SCH 1 / ATK 1 / HP 1, Drone trait) with the real deck card **tucked underneath it** facedown, owned by its player. It is the same model as any card with a card placed under it.

**Why (rules):** Card text plus 01140 (base stats 1/1/1). RR "Ownership and Control": the card's owner is the player whose deck it came from. FAQ (Steve Rogers): a card in play as a Drone is not in the deck or discard, so searches can't find it.

**Also covers:** 01137b, 01138a, 01139a, 01148, 01150 (first player, 2 Drones), 01144a/b/c When Revealed, 01143 (engaged player, on defeat), 01147 (fallback), 01134 / 01138b (one branch of a choice), 01135.

### S1-edge. Empty deck

**Setup:** Captain Marvel has 0 cards in her deck when Assault on NORAD 2A is revealed.

**Today:** The script skips her silently.

**After:** The normal empty-deck rule runs (shuffle the discard into a new deck, take an encounter card), then she puts the new top card into play as a Drone.

**Why:** RR "Deck" / player deck exhaustion: the deck runs out, it is not skipped.

### S2. Drone defeated → owner's discard

**Setup:** A Drone (really Spider-Man's _Web-Shooter_) is engaged with Spider-Man. Spider-Man attacks it for 1.

**Today:** A fake card lands in the encounter discard. Web-Shooter is lost.

**After:** The Drone is defeated. Web-Shooter, the card tucked under it, goes to **Spider-Man's** discard pile through the existing tucked-card cleanup, and the Drone shell itself just disappears, because it is not a real card. Being discarded by an effect works the same way.

**Why:** 01140 Forced Response, and RR Ownership (cards go to their owner's pile).

### S3. Drones get stronger (auras)

**Setup:** Ultron (III) in play, one Upgraded Drones attached to Ultron Drones, one facedown Drone and one Advanced Ultron Drone (4 HP) engaged.

**Today:** No card in the engine can buff minions it is not attached to. Drones stay 1/1/1.

**After:** The facedown Drone is ATK 3 / HP 3 (base 1, +1 from Ultron III, +1 from Upgraded Drones). The Advanced Ultron Drone is ATK 2 / HP 5: Ultron III applies to every Drone, Upgraded Drones only to facedown ones.

**Why:** Printed text. "Each [[Drone]] minion" is a trait match. "Each facedown [[Drone]] minion" also needs the card to be facedown.

### S4. Ultron (III) can't be hurt while a Drone is in play

**Setup:** Ultron (III), one Drone engaged with Captain Marvel. Spider-Man attacks Ultron.

**Today:** Ultron takes the damage.

**After:** No damage. Ultron is not a valid target for damage-only abilities while any Drone minion is in play (RR "Targets").

### S5. Cards that count Drones

- **Repair Sequence:** 2 Drones engaged with you → Ultron heals 4. 0 Drones → nothing healed → surge. As a boost it heals 1 per Drone.
- **Swarm Attack:** each Drone engaged with your hero attacks you. No Drone → you create one.
- **Drone Factory:** each player creates a Drone, then 1 threat goes on the scheme per Drone in play, counted once (the Drone action loops over the players itself, so no #272 work).
- **Ultron (II):** when he attacks you, you create a Drone first. Then he gets +1 ATK per Drone engaged with **you** (the player he attacked) until the attack ends. Per the FAQ, the count stays tied to you even if another player defends, and it updates if your Drone count changes during the attack.

### S6. Choices

- **Ultron (I)**, after he attacks you: choose "1 threat on the main scheme" or "create a Drone".
- **Assault on NORAD 2B**, after step-one threat: each player chooses "2 threat here" or "create a Drone".
- **Android Efficiency boost:** choose "spend an [energy] / [mental] / [physical] resource" or "create a Drone". If you can't pay, you must create the Drone.

### S7. The cards with no Drones

- **Countdown to Oblivion 3B:** no effect can remove threat from it. Completing it loses the game (already engine behaviour for the last stage).
- **Program Transmitter:** attaches to Ultron. After Ultron schemes, 1 threat goes on each side scheme. Hero Action: exhaust your hero and spend `M M` to discard it.
- **Rage of Ultron:** in alter-ego, Ultron schemes and you discard 1 deck card per threat placed. In hero form, Ultron attacks you and you discard 1 per damage dealt.
- **Invasive AI:** each player discards the top 3 cards of their deck.
- **Ultron (III) When Revealed:** search the encounter deck and discard for Ultron's Imperative, reveal it, shuffle.

### S8. Wakanda Forever! vs Drones (cross-mechanic)

**Setup:** Black Panther (hero) and Spider-Man vs Ultron. Black Panther controls Panther Claws and Energy Daggers. Spider-Man has 2 Drones engaged, both from his own deck (Drones engage with the player whose deck they came from): one is really _Web-Shooter_, the other _Swinging Web Kick_.

**Player does:** Black Panther plays Wakanda Forever! and picks the order: Panther Claws first, then Energy Daggers last (the final step, so double damage). Panther Claws hits a Drone for 2. Energy Daggers targets Spider-Man.

**Today:** Drones are fake cards. A defeated Drone sends a fake card to the encounter discard, and Web-Shooter is lost.

**After:**

1. Panther Claws (2 damage) defeats Drone 1. Its real card goes face up to **Spider-Man's** discard, not Black Panther's and not the encounter discard.
2. Energy Daggers (final, 2 damage) hits Ultron for 2 and defeats Drone 2. Its real card also goes to Spider-Man's discard.

**Edge S8-a, a Black Panther upgrade became a Drone:** Black Panther's top card was _Panther Claws_ when 1B made Drones, so Claws is now a facedown Drone engaged with Black Panther. Energy Daggers is the only upgrade in his tableau. Wakanda Forever! resolves **only** Energy Daggers (single upgrade, so it is the final step: 2 damage). Energy Daggers hits his own engaged Drone, defeats it, and Panther Claws returns face up to **his discard**, not his tableau. If Claws had been his only Black Panther upgrade, Wakanda Forever! would be unplayable: a facedown card has no title or traits.

**Edge S8-b, Ultron (III) with Drones in play (PR B):** Energy Daggers is the only step (2 damage), choosing Spider-Man, who has 1 Drone. Ultron takes **0**: the Drone is still in play when the damage is dealt, because it is one effect dealing to all targets at once. The Drone is defeated. Second line: if Panther Claws resolves first and kills the last Drone, Energy Daggers then hits Ultron (III) for 2.

**Why (rules):** "Special" + "Sequence" (Wakanda Forever!); RR Ownership; Ultron III text; RR "Targets": Ultron is not a valid target for Panther Claws' damage-only Special while a Drone is in play, so it must target a Drone.

---

## 2. Rules and spec analysis

| Topic                                                      | Reading                                                                                                                                                                                                                                                                                      | Confidence               |
| :--------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------- |
| A facedown Drone has the Drone trait                       | "Each [[Drone]] minion" counts facedown ones; 01140 calls them "facedown [[Drone]] minion".                                                                                                                                                                                                  | 98                       |
| Owner and where it goes                                    | RR Ownership; 01140 Forced Response.                                                                                                                                                                                                                                                         | 99                       |
| Hidden identity                                            | FAQ (Steve Rogers): searches don't find it. It must not match its real code, name or traits.                                                                                                                                                                                                 | 99                       |
| Ultron (II) ATK bonus                                      | FAQ #135: it's a lasting effect on the original target that updates as the count changes.                                                                                                                                                                                                    | 97                       |
| **Android Efficiency boost: "the top card of _the_ deck"** | It doesn't say "your deck". Reading 1: the boosted player's deck (same as every other Drone card). Reading 2: the encounter deck.                                                                                                                                                            | **80 → open decision 3** |
| Energy Daggers vs Ultron (III) with Drones                 | One effect deals damage to the villain and each engaged enemy. Immunity is checked when damage is dealt, while the Drones are still in play, so Ultron takes 0. The engine already lists the villain first (`ENGAGED_ENEMIES`), which matches. The test pins it so a reorder can't break it. | 95                       |
| 01140 Forced Response vs the generic rule                  | Same result whether the engine always sends player cards to their owner's discard or 01140 does it.                                                                                                                                                                                          | 96 → open decision 2     |

## 3. Simplification & Refactor Check

- **Reuse `EXECUTE_SPECIAL` + `SpecialAbilityHandler`** (the Wakanda Forever path). The Ultron script exports a `ULTRON_DRONE` handler instead of being a one-off hook. No new engine primitive.
- **Delete `ScenarioHooks.resolveStage1BReveal`** and its call in `declarative-plugin.ts`. 01137b's When Revealed becomes data and runs through the existing main scheme ability step. One path instead of two.
- **Merge the stat loops in `stat-calculator.ts`.** ATK and SCH repeat the same loop twice each, and HP ignores the minion's own constants. One `sumMinionConstantModifiers(state, minion, stat)` will read: the minion itself, its attachments, and (new) auras from in-play villains, environments and their attachments.
- **A Drone is a minion with a tucked card (`cardsUnderneath`), not a new concept.** Already in place and reused:
  - Defeat (`resolveMinionDefeat` → `processHostDefeated`) and discard (`discardCardInstance`) both send tucked cards to their **owner's** discard (`discardHostAttachmentsAndTuckedCards`).
  - `getAllCardInstances` already lists a minion's tucked cards, so state checks stay consistent.
  - Tucked cards are out of play: deck and discard searches can't see them (the FAQ case), and Wakanda Forever! only reads the tableau.
  - The only new rule: a **shell** (a minion with no physical card of its own) is removed instead of piled when it leaves play. That is one check, `isShell(card)`, in the single shared routing helper used by `moveDefeatedCardToPile` and `discardCardInstance`.
- **The script shrinks to about 30 lines:** take the top card, tuck it under a Drone shell, engage the shell, log it. No identity swapping, no restore code.
- **Take the top card with `drawPlayerCard`**, which already handles deck exhaustion, instead of `deck.shift()`.
- **Extend the `IF_CARD_IN_PLAY` gate with an optional `filter`** instead of adding a new gate (for 01136).

## 4. Debt Removed

1. A Drone's real card vanished, and a fake card polluted the encounter discard and deck (S2).
2. An empty deck silently skipped Drone creation (S1-edge).
3. A hook that existed only for one card (`resolveStage1BReveal`).
4. Duplicated ATK/SCH loops, and HP ignoring the minion's own constants.
5. The log key `scenario.setup.drone` means "setup" but now fires during play → renamed `minion.drone.created` (en/fr).
6. `docs/creators/scenarios.md` describes the old script → rewritten.

## 5. File changes

| File                                                                        | Change                                                                                                                                                                                                                                                                                                                                                      | Scenario    |
| :-------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------- |
| `content/packs/core/scripts/scenarios/ultron.ts`                            | [MODIFY] Drop the hook. Export the `ultronDroneSpecialHandler` (`ULTRON_DRONE`, params `target` = `SELF`/`ALL_PLAYERS`/`FIRST_PLAYER`/`ENGAGED_PLAYER`, `count`). Build a Drone shell (`isShell`), tuck the top deck card under it (`cardsUnderneath`, `ownerId` set), engage it, log it, and return `value` = Drones created (so 01147/01148 can test it). | S1, S1-edge |
| `content/packs/core/scripts/index.ts`                                       | [MODIFY] Register the handler. `scenarioHooks.ultron` goes away (open decision 1).                                                                                                                                                                                                                                                                          | S1          |
| `src/engine/scenarios/types.ts`, `declarative-plugin.ts`                    | [MODIFY] Remove `resolveStage1BReveal`.                                                                                                                                                                                                                                                                                                                     | S1          |
| `src/engine/models/state.ts`                                                | [MODIFY] `CardInstance.isShell?: true`: a stand-in minion with no physical card.                                                                                                                                                                                                                                                                            | S1, S2      |
| `src/engine/state/card-discard.ts`, `effects/index.ts`                      | [MODIFY] Merge the routing in `moveDefeatedCardToPile` and `discardCardInstance` into one helper that drops a shell instead of piling it. Tucked-card routing is untouched (already sends to the owner).                                                                                                                                                    | S2          |
| `src/data/supplemental/effect-params.ts` (+ schema.json)                    | [MODIFY] `EXECUTE_SPECIAL` adds `target`, `count`. A new `ATTACK` value in `DurationSchema`.                                                                                                                                                                                                                                                                | S1, S5      |
| `src/data/supplemental/gate-params.ts`, gate evaluator                      | [MODIFY] `IF_CARD_IN_PLAY.filter`.                                                                                                                                                                                                                                                                                                                          | S4          |
| `src/engine/filters/card-filter.ts` + `UniversalCardFilterSchema`           | [MODIFY] Add `isFacedown`: true for a shell with a facedown tucked card. The filter only sees the shell's face ("Drone"), never the tucked card.                                                                                                                                                                                                            | S3, FAQ     |
| `src/engine/pipeline/stat-calculator.ts`                                    | [MODIFY] Merged loop plus auras (`target: ALL_MINIONS` + `filter`).                                                                                                                                                                                                                                                                                         | S3          |
| `src/engine/pipeline/...` remove-threat path                                | [MODIFY] CONSTANT `THREAT_CANNOT_BE_REMOVED`, enforced in the legality gate / `checkAbilityTargets` (ADR-0090), never in callers.                                                                                                                                                                                                                           | S7          |
| `content/packs/core/supplemental/core_encounter.json`                       | [MODIFY] Entries for all 22 cards, `01134`–`01150`.                                                                                                                                                                                                                                                                                                         | all         |
| `tests/data/card-loader.test.ts`                                            | [MODIFY] Add `ultron` to `scannedEncounterSets`.                                                                                                                                                                                                                                                                                                            | acceptance  |
| `src/engine/models/log-events.ts`, `src/locales/{en,fr}/combat-log.json`    | [MODIFY] Rename the log key.                                                                                                                                                                                                                                                                                                                                | S1          |
| `docs/creators/scenarios.md`, supplemental-reference `08`/`QUICK_REFERENCE` | [MODIFY] Docs for the Drone script and the new params.                                                                                                                                                                                                                                                                                                      | —           |
| `changes/unreleased/352-ultron-set.md`                                      | [NEW]                                                                                                                                                                                                                                                                                                                                                       | —           |

## 6. UI and Card Editor

- **Board:** a Drone renders from its synthesized face, so it shows as "Drone" 1/1/1 with no extra code. I'll add a card-back look (pop-art "DRONE" back) in `HeroZone` minion rendering, plus a test that the real card name never appears in the DOM.
- **Card Editor:** new fields appear through the schema introspector (`EXECUTE_SPECIAL.target/count`, `IF_CARD_IN_PLAY.filter`, `isFacedown`, `ATTACK` duration). Editor test: the fields render.

## 7. Tests (named after the scenarios, real reveal / boost / activation paths)

- `tests/engine/ultron-drones.test.ts` [NEW]:
  - `S1: Crimson Cowl 1B gives each player a Drone that hides its real card`
  - `S1: Assault on NORAD 2A / Countdown 3A / Drone Factory / Ultron's Imperative create Drones on reveal`
  - `S1-edge: an empty deck is reshuffled before the Drone is taken`
  - `S2: a defeated Drone goes to its owner's discard face up`
  - `S2: a search for Captain America's Shield does not find it as a Drone`
  - `S3: Ultron III and Upgraded Drones stack on facedown Drones; Advanced Drone gets only Ultron III`
  - `S4: Ultron III takes no damage while a Drone is in play`
  - `S5: Repair Sequence heals 2 per Drone, surges when nothing healed`; `Swarm Attack ...`; `Drone Factory places threat once per Drone in play`; `Ultron II ATK follows the attacked player's Drone count`
  - `S6: Ultron I / NORAD 2B / Android Efficiency boost choices`
- `tests/engine/ultron-wakanda-forever-drones.test.ts` [NEW]: a real Ultron game (`setupGame`, `scenarioId: 'ultron'`), with Wakanda Forever! played through `EXECUTE_SPECIAL` and the order/player prompts answered via `RESOLVE_DECISION_PROMPT`, as in `energy-daggers-chosen-player.test.ts`:
  - `S8: Panther Claws then Energy Daggers defeat both Drones and their real cards go to the owner's discard` (PR A)
  - `S8-a: a Black Panther upgrade turned into a Drone is not resolved by Wakanda Forever and returns to discard when killed` (PR A)
  - `S8-a: Wakanda Forever is unplayable when the only Black Panther upgrade is a facedown Drone` (PR A)
  - `S8-b: Energy Daggers deals 0 to Ultron III while a Drone is in play; Claws first then Daggers hits him for 2` (added in PR B, when the immunity exists)
- `tests/engine/ultron-scenario-hooks.test.ts` → renamed `ultron-scenario-script.test.ts`, asserting the handler is registered and there is no hook. The stage-1B test stays and passes unchanged.
- `tests/engine/scenario-setup-digests.test.ts`: Ultron digests are **re-recorded on purpose** (the Drone now keeps its real card). Rhino and Klaw stay identical.
- Card loader scan, quick-reference sync, schema tests.

## 8. Delivery

The work splits into 3 PRs (open decision 5). Each one is green on its own.

| PR               | Contents                                                                                                           | Estimate |
| :--------------- | :----------------------------------------------------------------------------------------------------------------- | :------- |
| A, Drone core    | S1, S1-edge, S2, S8, S8-a, the creator cards (01137b, 01138a, 01139a, 01140, 01143, 01144 WR, 01150), hook removal | ~3–4 h   |
| B, Drone readers | S3–S6, S8-b: 01134, 01135, 01136, 01138b, 01142, 01144 boost, 01146, 01147, 01148                                  | ~5–7 h   |
| C, the rest      | S7: 01139b, 01141, 01145, 01149, 01136 WR; scan + #265 list                                                        | ~3–4 h   |

## 9. Open decisions (recommendation first)

1. **Where Drone creation lives:** **(Rec.)** the Ultron script as a `ULTRON_DRONE` special handler, called from card data. Alternative: a generic engine effect `PUT_INTO_PLAY_FACEDOWN_AS_MINION`. That's cleaner for Vision later, but it reverses M5 decision 4.
2. **01140's Forced Response:** **(Rec.)** it is already done by the existing tucked-card cleanup (tucked cards go to their owner's discard when the host leaves play). 01140's entry records the clause as resolved by that rule (`audit.confidence` 100). Alternative: a data Forced Response on 01140 doing the move. Same result, but the card would move twice.
3. **Android Efficiency boost "the deck":** **(Rec.)** the boosted player's own deck, like every other Drone card. Write `docs/ambiguities/core_01144_android-efficiency.md`. Alternative: the encounter deck. In-game effect: an encounter card becomes a Drone and leaves the encounter deck.
4. **#272 (per-player + run-once) is not needed.** The Drone action takes `target: ALL_PLAYERS` and loops over the players itself (first player first, RR "Each Player"). So Drone Factory is two plain run-once steps: create Drones for all players, then add threat equal to `ENTITY_COUNT` of Drone minions in play (`ALL_MINIONS` + trait filter). **(Rec.)** Model 01148 this way in PR B and close #272 with a comment, since 01148 is the only card it names. Alternative: keep #272 open for a future non-Drone card (none found).
5. **Split into 3 PRs:** **(Rec.)** yes, as in §8. Alternative: one PR, about 14 h, hard to review.
