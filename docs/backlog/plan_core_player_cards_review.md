# Core Set Player Cards: Supplemental Review (Batch Mode, Phase 2 Review Gate)

> **Living tracker. Reused across sessions.** Work one item at a time; update the Status column here
> when an item is planned, approved, implemented, or dropped. Each item gets its own
> `plan_core_review_<id>_<slug>.md` when it needs a reviewable plan.

| Item | Card | Status |
| :-- | :-- | :-- |
| A1 | Energy Daggers `01046` | **Done** (2026-10-03, committed `a6c5397`): [plan](plan_core_review_a1_energy_daggers.md) |
| F1 | Dead card-coded fallbacks for `01047`–`01049` in `wakanda-forever.ts` | **Done** (2026-10-04, with #207) |
| F2 | Wakanda sequence can't pause for mid-sequence prompts | **Done** (2026-10-04, [#207](https://github.com/SteveRodrigue/MCD/issues/207), [plan](plan_issue_207_wakanda_sequence.md)) |
| A3 | Rocket Boots `01039` (= #131) | **Done** (2026-10-04, uncommitted): [plan](plan_issue_131_rocket_boots.md) |
| A2, A4–A6, B1–B8, C1–C13, D | see sections below | Not started |

**Scope:** every player card in `core` (`01001a`–`01093`, 101 entries incl. the four `01043a–d` variants).
**Method:** independent translation from upstream printed text, differential comparison against
`src/data/supplemental/pack/core.json`, then spot-verification in `src/engine/` and
`docs/specifications/supplemental/`. **Nothing has been written to disk except this file.**
`audit.comment` is untouched (ADR-0067).

Legend: **Tier** = blast radius per `shared-quality-gates.md`. **Verified** = I read the engine code;
**Suspected** = read from data only, needs a failing test before fixing.

---

## A. Likely functional bugs (data does not match printed text)

### A1. Energy Daggers `01046` — wrong target set (Verified in data, Tier 1 or 2)
- **Printed:** Choose a player. Deal 1 damage to the villain and to each enemy engaged with that player (2 instead if final step).
- **Current:** one `DEAL_DAMAGE` to `ALL_ENEMIES`. This ignores the "chosen player" and hits minions engaged with other players.
- **Proposed:** two steps (villain, then `ENGAGED_ENEMIES` scoped to a chosen player), both carrying `finisherBonus: 1`. The schema has `ENGAGED_ENEMIES`/`ENGAGED_MINIONS`. Need to confirm it can be scoped to a *chosen* player. If not, this becomes a Tier 2 generic selector.
- **Why:** rule correctness in multiplayer. Solo play is unaffected.

### A2. Counter-Punch `01077` — pays 1 resource for a cost-0 card (Verified mechanism, Tier 1)
- **Printed:** cost **0**. Response (attack): after your hero defends, deal damage to *that enemy* equal to your hero's ATK.
- **Current:** `cost.resourceCost: 1`. HAND-zone reactions pay `ability.cost` as the play cost (`trigger-dispatcher.ts` ~L700–740), so the card costs 1 instead of 0. `target: "ENEMY"` is also unspecific. It should be the attacking enemy.
- **Proposed:** drop `resourceCost`, keep `discardSelf`. Target the attacker (check for an existing `ATTACKING_ENEMY`-style selector; otherwise Tier 2).
- **Related, same family (cost mirrors printed cost, so currently correct but duplicated):** `01004`, `01024`, `01078`. Propose a spec-level note instead of changes.

### A3. Rocket Boots `01039` — Aerial grant is never applied (Verified, **Tier 2/3**)
- **Printed:** Hero Action: exhaust + spend [mental] → gain Aerial until end of phase.
- **Current:** `HERO_ACTION` step `ADD_TRAIT`. Per spec `07` and `stat-calculator.ts`, `ADD_TRAIT` is only evaluated for **CONSTANT** abilities. There is no executor for it as an action effect and no duration support, so the action pays its cost and does nothing.
- **Proposed:** add a generic temporary-trait mechanism (`ADD_TRAIT` with `duration: "PHASE"`, stored as a timed modifier), or reuse the existing phase-duration modifier path used by `MODIFY_STAT`. Then add a regression test (Rocket Boots → Crisis Interdiction / Supersonic Punch).
- **Why:** this is a real card that silently fails. It also blocks Aerial synergy for Iron Man.

### A4. Mark V Helmet `01037` — card-specific param (Verified, Tier 2)
- **Printed:** remove 1 threat from a scheme (from **each** scheme instead if you have Aerial).
- **Current:** `aerialAllSchemes: true`. This is a card-shaped parameter (ADR-0021 spirit).
- **Proposed:** `REMOVE_THREAT` to `CHOSEN_SCHEME`, plus a gated second form with `target: ALL_SCHEMES`. Use the same player-trait gate as Crisis Interdiction and the `dynamicBonus.HAS_TRAIT` pattern. Remove the bespoke param from `effects/index.ts`.

### A5. Energy Daggers/Wakanda family — card-named primitive (Verified, Tier 2)
- `EXECUTE_WAKANDA_FOREVER` (schema L213, `effects/index.ts` L5134, editor registry) is named after a card. This violates the **strict ban in ADR-0021**.
- **Proposed:** rename to a generic `RESOLVE_SPECIAL_SEQUENCE` (or similar) across schema, engine, spec, editor registry and tests. No behaviour change.
- Also: `01043a–d` are four identical entries with differing ids. Confirm all four need separate entries, or whether the catalog can alias variants.

### A6. Luke Cage `01076` — Toughness modelled as `SETUP` (Suspected, Tier 1)
- **Printed:** Toughness (enters play with a tough status card).
- **Current:** `SETUP` ability, which `game-setup.ts` only runs at **game setup**. Spec `07` says Toughness is an automatic *keyword* on entry. I only found the entry code for **minions** (`effects/index.ts` ~L4066) and `villain-phase.ts`. I did not find the ally path.
- **Proposed:** write a failing test (play Luke Cage from hand → expect a Tough status). If the keyword path covers allies, **remove the ability and set the keyword only**. If not, wire the ally entry path (Tier 2). Do not keep the SETUP ability.

---

## B. Trigger/filter precision (data is probably too broad)

| # | Card | Printed | Current | Proposed | Status |
|---|---|---|---|---|---|
| B1 | Emergency `01085` | When the **villain schemes**, reduce threat placed by 1 | `THREAT_WOULD_BE_PLACED`, no filter, so it also fires for non-villain-scheme threat | add a source filter (villain scheme step only). Needs a filter field, since `TriggerFilter` is `.strict()`; may be Tier 2 | Suspected |
| B2 | Black Widow `01075` | When **a card** is revealed from the encounter deck | `TREACHERY_REVEALED` (treacheries only) | use the broad reveal trigger (`WHEN_REVEALED` window already fires for all card types, `trigger-dispatcher.ts` L991). Check the composite `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER` handles minions/side schemes | Verified trigger gap |
| B3 | Backflip `01003` | damage **from an attack** to **you** | `DAMAGE_WOULD_BE_TAKEN`, no filter, so it can match non-attack damage | add an attack-source filter. Same missing-field issue as B1 (damage-source filters were purged in ADR-0069 as unevaluated) | Suspected |
| B4 | Chase Them Down `01052` | After **your hero** attacks and defeats an **enemy** | `DEFEATED` + `targetType: MINION` | the villain counts as an enemy, and the hero must be the attacker. Spec `02` documents `DEFEATED` as a *scheme* trigger, but `TRIGGER_EQUIVALENTS` maps it to `ENEMY_DEFEATED_BY_HERO_ATTACK`. **This needs a decision on which trigger is canonical** | Needs your call |
| B5 | Tigra `01051` | After **Tigra attacks** and defeats a minion | `CHARACTER_DEFEATED` + `targetType: MINION` | the ally guard in the dispatcher only covers `THWART_RESOLVED`/`ATTACK_RESOLVED`. Test `defeat-trigger-filtering.test.ts` covers only "ally defeated". Add a test where a *different* character defeats a minion. If it heals, add an attacker-is-self filter | Suspected (test gap) |
| B6 | Lead from the Front `01070` | **Choose a player**; each character *that player* controls | `ALL_FRIENDLY_CHARACTERS` | chosen-player scope. Also uses bespoke `atkBonus`/`thwBonus` instead of two `MODIFY_STAT` steps | Verified in data |
| B7 | Med Team `01080` | heal 2 from a **friendly** character | `CHOSEN_CHARACTER` (allows enemies) | `CHOSEN_FRIENDLY_CHARACTER` (exists in `target-resolver.ts` L526) | Verified in data |
| B8 | Superhuman Strength `01028` | After **She-Hulk** attacks, discard → stun the attacked enemy | `ATTACK_RESOLVED`, target `PREVIOUS_TARGET` | the same attacker guard question as B5, now for upgrades (the guard only covers allies). Use the attacked-enemy selector in place of `PREVIOUS_TARGET`. Audit confidence is 80 | Suspected |

---

## C. Data accuracy / consistency (low risk)

- **C1. Jessica Jones `01059`:** `maxBonus: 4` is not on the card, and `stat-calculator.ts` L99 defaults it to 4 anyway. A game with 5+ side schemes would under-count. Remove the cap or make it opt-in.
- **C2. Indomitable `01082`:** the printed timing is **Response**, but the data uses `HERO_INTERRUPT` with `ATTACK_DEFENDED`. It also has audit confidence 50. Change to `RESPONSE` (hero-form gating comes from "your hero"). Check `HERO_RESPONSE` against the printed text.
- **C3. Tony Stark Futurist `01029b`:** `promptTitle` says "Choose 1 **Tech** card". The card lets you take **any** of the top 3. Fix the UI string only.
- **C4. T'Challa `01040b`:** `promptTitle` says "King of Wakanda" (cosmetic). **Nick Fury `01084`:** option text says "active main scheme" but the target is any scheme.
- **C5. Vision `01068`:** uses `stat: "THW"/"ATK"`, while the rest of the pack uses `THWART`/`ATTACK`. Both paths exist in the engine, but normalize to the canonical enum.
- **C6. Relentless Assault `01053`:** `condition: RESOURCE_KICKER_MET` plus `overkillOnPhysical` and `overkillOnCondition` are redundant, bespoke flags. Check whether the step-level `condition` suppresses the 5 damage when kicker is *not* met. Propose a generic `grantsKeyword: OVERKILL` gated on paid-with-resource, as Photonic Blast does.
- **C7. Crisis Interdiction `01012`, Helmet `01016`:** `condition: TARGET_TRAIT_MATCH` actually checks the *player's* traits (`effects/index.ts` L828). It works, but the name is misleading. Propose renaming it to a player-trait condition (spec and schema).
- **C8. Energy Channel `01018`:** `uses.max: 5` caps counters. The card puts X counters with no cap (only the 10 damage cap). Remove `max`.
- **C9. Alpha Flight Station `01015`:** "if you are Carol Danvers" is matched only to `01010b`. In hero form you are still Carol Danvers (Captain Marvel). **Question for you:** should it match `01010a` too? I lean yes.
- **C10. Identity timing style:** the identity abilities mix qualified and unqualified timings for the same printed word. Spider-Sense uses plain `INTERRUPT`, while Jennifer Walters and She-Hulk use qualified forms. Rechannel uses `HERO_ACTION`, but the printed text says only "Action". Pick one convention in spec `02` and normalize.
- **C11. Jennifer Walters `01019b`:** the ability id `jennifer_walters_thwart` doesn't describe "I Object!". Rename to `i_object`. It is cosmetic, but ids appear in logs.
- **C12. Attach-on-play timing:** Spider-Tracer and Inspired model attach as `ACTION`, and Webbed Up as `HERO_ACTION`. Attaching happens on play, not as a separate action. Check how `ATTACH_TO_HOST` is dispatched and whether a played upgrade could show a spurious action button.
- **C13. `noSupplementalNeeded` on `01088–01090`:** their text is "Max 1 per deck." The rule says `noSupplementalNeeded` is only for **zero** rules text. `maxPerDeck` isn't encoded anywhere (also missing for the Power-of-X cards). Decide whether deck limits belong in supplemental or in deck-validation code.

---

## D. Low-confidence entries to re-verify (no change proposed yet)

Audit confidence in the data is low, so these deserve a real re-review rather than a guess:
`01023` Legal Practice (**0**), `01024` One-Two Punch (50), `01035` Arc Reactor (50),
`01069` Get Ready (50), `01082` Indomitable (50, see C2), `01028` Superhuman Strength (80, see B8),
`01019a` She-Hulk (90), `01084` Nick Fury (95).
Specific checks:
- **Legal Practice:** does `cost.discardCard.maxCount: 5` plus `PER_DISCARDED_CARD` scaling give "up to 5, 1 threat each"? Is 0 discards allowed (it shouldn't do anything)?
- **She-Hulk `01019a`:** does the response fire *after* the flip, with the new form's abilities active?
- **Ancestral Knowledge `01042`:** "up to 3 different cards" is modelled as `takeCount: 3` plus `autoSelectIfUnambiguous`. Confirm it allows fewer than 3 and doesn't auto-take.
- **Repulsor Blast `01031`:** the data discards first, then deals 1 + 2×N as **one** damage instance. The printed order is damage, then discard, then "additional" damage. Check the MarvelCDB FAQ for whether this is one hit (matters for Tough/Barrier and Retaliate). Wild icons are correctly *not* counted as energy (RR "Wild resource").

---

## E. Checked and looks correct (no change)

`01001a/b`, `01002`, `01005–01011`, `01013–01014`, `01017`, `01020–01022`, `01025–01027`, `01029a`, `01030`,
`01032–01034`, `01036`, `01038`, `01040a`, `01041`, `01044–01045`, `01047–01050`, `01054–01058`, `01060–01067`,
`01071–01074`, `01079`, `01083`, `01086–01087`, `01091–01093`.
Photonic Blast's paid-with-energy gate and Hulk's wild "all of the above" both work as written (`effects/index.ts` L748–790). The Black Cat and Daredevil self-guards exist in the dispatcher.

---

## Proposed order if approved

1. **Tier 1, data only:** A2 (partial), B7, C1–C4, C5, C8, C11, plus the Luke Cage test (A6).
2. **Tier 2, small generic helpers:** A1, A3, A4, A5, B1/B3 (new filter fields), B6, B8, C6, C7.
3. **Needs your decision first:** B4 (canonical defeat trigger), C9, C10, C13, and the Repulsor Blast FAQ question.

**UI / Card Editor impact:** A3, A4, A5, B1, B3 and C7 add or rename editor parameters (`effect-parameter-registry.ts`). All other items are data only.

**Not run:** no tests, typecheck or build (read-only audit).
