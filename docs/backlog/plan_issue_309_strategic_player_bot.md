# Plan: #309 Strategic player bot (Gate 1, roadmap 1.4)

**Status:** Draft, waiting for owner approval. No code changed.
**Issue:** [#309](https://github.com/SteveRodrigue/MCD/issues/309), Gate 1, P2.
**UI / Card Editor impact:** none (engine simulation only, `src/engine/simulation/`).
**Estimate:** 1 to 2 days (diagnosis 2 h, bot rewrite 4 to 6 h, tuning 2 to 4 h).

## 1. Problem and evidence

`npm run simulate` today (2026-10-26, run on `main`): **0 wins, 100 losses, 0 timeouts**, 2 seconds total.
Round of the loss: 1 to 2 rounds in 7 games, 3 in 13, 4 in 26, 5 in 19, 6 in 24, 7+ in 11. A real Rhino game lasts 8 to 12 rounds with a competent player, so the bot loses fast. A loss in round 1 or 2 is more likely a bot defect (no defence, wrong form, wasted resources) than a strategy issue.

Causes already in the issue body, confirmed by reading [player-bot.ts](../../src/engine/simulation/player-bot.ts):

| Cause                                                                                                     | Where                                      |
| :-------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| Payment takes cards left to right, ignores card value and `resources.total` aspect/wild symbols           | lines 74-98 and 128-152 (duplicated block) |
| Thwart threshold uses `mainScheme.targetThreat / 2` and `threat >= 2`; no look-ahead to next scheme phase | lines 27-28, 158                           |
| Form changes only by current HP, ignoring incoming threat                                                 | lines 24-25, 101-124                       |
| Minion choice = `engagedMinions[0]`; no Guard / ATK / scheme-minion ranking                               | lines 169, 229                             |
| Never uses hero abilities, `ACTION` abilities on tableau cards (except one heal), or resource generation  | whole file                                 |

## 1b. UI and Card Editor

No change required. Evidence: `rg "player-bot|chooseBotAction" src/ui` finds no reader; the bot is used only by `match-simulator.ts` and `scripts/simulate-games.ts`. No schema, effect or selector is added.

## 2. Rules analysis

Gameplay rules are not changed. The bot only chooses among actions that `canPlayCard`, `canThwart`, `canAttack`, `canChangeForm`, `canBasicRecover` already allow (One Legality Gate: no parallel legality check is added).
Sources to confirm before coding: `npm run rule -- "hero phase"`, `-- "alter-ego"`, `-- "threat"`, `-- "guard"`, `-- "resource"` (cross-cutting protocol: glossary entry, `See also`, TOPIC_MAP clusters Combat & Damage, Card Economy).

## 3. Simplification and Refactor Check

- **Merge** the two copy-pasted "play a card from hand" loops (alter-ego branch and general branch) into one `choosePlay(state, player)` function. -40 lines.
- **Merge** the three "recover / flip / heal" checks of sections 1 and 6 into one form decision (`chooseFormChange`).
- **Replace** the left-to-right payment with one `choosePayment(hand, card)` that picks the cheapest-value cards whose symbols cover the cost and the aspect.
- **No** second bot, no "legacy greedy mode" flag. `chooseBotAction` keeps its signature and stays the only policy.

### Debt Removed

- Duplicated play loop in `player-bot.ts` (two copies, one function).
- Magic numbers (`0.9`, `2`, `/ 2`) replaced by named constants in one `BOT_POLICY` table at the top of the file.
- `scripts/simulate-games.ts` prints no loss cause. Add one column (`reason`: scheme out of threat, hero defeated, timeout) so a 0-win result is diagnosable without re-running by hand.

## 4. Design

Pure functions in `player-bot.ts` (split into `player-bot-evaluation.ts` only if the file passes ~400 lines), no randomness, no state mutation, deterministic (ADR-0081).

1. **Threat look-ahead.** Compute `incomingThreat` for the next villain phase: main scheme acceleration / per-round threat, plus the `SCHEME` values of engaged and unengaged minions and the side schemes. `urgent = threat + incomingThreat >= targetThreat - safetyMargin`. When `urgent`, thwart before anything else and never enter alter-ego.
2. **Card value table.** Score = `cost-efficiency + type weight` (upgrades and allies above events), plus a protected set: cards with `resources.total > 1` or wild symbols are paid last. Table is data in `BOT_POLICY`, not card codes (engine stays generic).
3. **Payment.** Pay with the lowest-value cards first, prefer the matching aspect symbol when the card needs it, never pay with a card that would be played next.
4. **Form timing.** Hero form when `urgent` or health above the damage the next attack can deal (`attack + boost`, from the villain and engaged minions). Alter-ego only when not `urgent` and damaged or when a hand-size / alter-ego card is worth the action.
5. **Target ranking.** Attack order: minions with Guard (villain cannot be attacked), then highest `ATK + SCH`, then villain. Thwart order: side scheme that would otherwise crisis-block, then main scheme.
6. **Action ordering.** Plays first only if they add to the board this round (allies, upgrades) when not `urgent`; otherwise basic action first.

## 5. Tests (written first)

New file `tests/engine/player-bot.test.ts` (pure decision tests on hand-built states, using the existing `setupGame` helpers; no `runMatch`):

1. Threat 6 of 7 with an unengaged scheme minion: bot chooses `BASIC_THWART`, not a play or attack.
2. Alter-ego with `urgent` threat: bot flips to hero instead of `BASIC_RECOVER`.
3. Payment: given a hand with a 2-resource upgrade and a 1-resource event, paying for a cost-1 card uses the event.
4. Engaged Guard minion: bot attacks it, not the villain.
5. Unchanged: still returns `END_PLAYER_TURN` once everything is exhausted.

Regression guard in `tests/engine/match-simulator.test.ts`: over a fixed small seed set (5 heroes, Standard, solo, same seeds as `simulate-games`), the bot wins at least N games and every game finishes without crash. N is set from the measured result after step 3 of section 7, not guessed now.

## 6. Files

| File                                              | Change                                               |
| :------------------------------------------------ | :--------------------------------------------------- |
| `src/engine/simulation/player-bot.ts`             | Rewrite per section 4                                |
| `scripts/simulate-games.ts`                       | Loss-reason column; unchanged matrix                 |
| `tests/engine/player-bot.test.ts`                 | New                                                  |
| `tests/engine/match-simulator.test.ts`            | Win-count guard                                      |
| `docs/roadmap_and_milestones.md`                  | Tick 1.4 second box                                  |
| `changes/unreleased/309-strategic-player-bot.md`  | Changelog fragment                                   |
| `docs/backlog/teamwork_status_and_next_target.md` | Remove row #309; delete this plan in the same commit |

An ADR is not needed (no design decision on engine behaviour). If the bot gets a pluggable policy interface, add an ADR addendum to 0081.

## 7. Work order

1. Diagnose: add the loss-reason column and run `npm run simulate`; list the real causes of the 1 to 2 round losses. **If a loss comes from an engine bug, stop and file it as an issue (and fix it in scope if small) before tuning the bot.**
2. Failing tests of section 5.
3. Implement section 4, run `npm run simulate`, record the win rate per mode and difficulty.
4. Set the guard threshold from the measured result.
5. `rtk npx vitest run tests/engine/player-bot.test.ts tests/engine/match-simulator.test.ts`, typecheck, lint, prettier.

## 7b. Hard limit on tuning (owner request)

Tuning cannot run open-ended. Limits:

- **Max 4 tuning iterations** after the first working implementation. One iteration = change the policy, run `npm run simulate`, record the win rate per mode and difficulty.
- **Max 2 retries per idea.** A strategy change that does not raise the win rate after 2 tries is dropped, not reworked.
- **Time box:** 4 hours of tuning in total.
- **Stop rule.** When the target is not met at the limit, I stop, keep the best version that passes all tests, and send you a short report: win rates per iteration, what each change did, what I think blocks the target (bot policy or an engine/rules cause). We then review strategies together. The issue stays open, with `Refs #309`, not `Fixes`.
- Diagnosis (step 1) and the engine-bug rule are outside the limit: a real engine bug found there is fixed or filed, it does not count as an iteration.

## 8. Open decisions (need your answer)

1. **Win-rate target for "done".** The issue says "realistic". Proposed: Standard solo >= 50%, Expert solo >= 25%, 2-player a few points higher. Core Rhino with the starter decks is easy for humans, so a bot that wins about half on Standard is realistic. Accept, or give another target?
2. **Stop point.** Stop at the target above, or at the hard limit of section 7b, whichever comes first. Do not chase higher.
3. **Seeds.** The 100 seeds stay as they are, so results compare with today's 0/100 baseline. OK?

## 9. Result of the first pass (2026-10-26): limit of 7b reached, target not met

Delivered in code (not committed): bot rewrite, `chooseDefenderOption` (owner approved adding it, option 1), `getVillainPhaseThreatToAdd`, `isGuardMinion`, loss reason in `simulate-games.ts`, `tests/engine/player-bot.test.ts` (9 tests).
Not done: win-rate guard in `match-simulator.test.ts` (no measured win to set it from), roadmap box 1.4, row removal. The plan file stays until the issue is fixed.

| Iteration | Change                                                                     | Wins | Losses: heroes defeated / scheme |
| :-------- | :------------------------------------------------------------------------- | :--- | :------------------------------- |
| 0         | Old bot                                                                    | 0    | 20 / 80                          |
| first     | New bot (threat look-ahead, payment, Guard first), simulator still defends | 0    | 50 / 50                          |
| 1         | Defender policy: defend only when the hit is dangerous (floor 0)           | 0    | 64 / 36                          |
| 2         | Defend floor 2, payment price share 0.5                                    | 0    | 55 / 45                          |
| 3         | Payment price share 0.2 (more plays)                                       | 0    | 57 / 43                          |
| 4         | Defence from all incoming attacks of the phase                             | 0    | 51 / 49                          |

What the data says: games last 3 to 6 rounds, Rhino ends at 2 to 15 of 14 HP (it heals through encounter cards), and the hero acts 2 to 4 times per round. The bot's heroes die or the scheme completes before enough damage lands. Not yet tried, for the strategy review: hero identity and tableau `ACTION` abilities (never used), per-hero play, defender choice with allies, and mulligan.
Engine finding filed: [#429](https://github.com/SteveRodrigue/MCD/issues/429).

## 10. Strategy review (owner ideas, 2026-10-26): proposed second pass

Status: **waiting for owner approval.** Same limit as 7b, counted again from zero: max 4 tuning iterations, max 2 retries per idea, 4 hours. The target of section 8 is unchanged. Files: `player-bot.ts` and `tests/engine/player-bot.test.ts` only.

Owner ideas and how I read them (all through the existing legality checks, no parallel gate):

| #   | Owner idea                                                 | Proposed rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| :-- | :--------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Early game: thwart as much as possible                     | While `round <= BOT_POLICY.openingRounds` (3), thwart first for every character that can (hero and allies), **side schemes before the main scheme** (owner), before any attack. This order applies whenever the bot thwarts, except when the main scheme is urgent (section 4.1): then the main scheme goes first so the game is not lost. From round 4 the pressure rule of section 4 applies again.                                                                                                                                                                       |
| 2   | Prioritize stunning the villain                            | A hand card or ability whose steps `ADD_STATUS` `STUNNED` on an enemy (core: Webbed Up `01009`, Mockingbird `01083`, `01028`) gets a play bonus, and its target is the villain. Found by reading the card's steps, never by card code. Ranks above any other play when the villain is not stunned.                                                                                                                                                                                                                                                                          |
| 3   | Fill an empty tableau                                      | When `player.tableau` is empty, the play value of upgrades and supports gets a bonus (`emptyTableauBonus`), and the payment price share drops so the bot spends hand cards to put one in play.                                                                                                                                                                                                                                                                                                                                                                              |
| 4   | Resource and draw abilities first in the turn              | Before any other action: use ready tableau and identity abilities whose steps are `DRAW_CARDS` or `GENERATE_RESOURCE`, and play hand cards with a `DRAW_CARDS` step first. (Only through `USE_CARD_ABILITY` / `PLAY_CARD` that the legality checker allows.) **Payment (owner):** resource abilities (ready tableau generators and the identity ability) always pay first; hand cards only cover what they cannot. The current `choosePayment` already does this in order, and a test locks it in (a ready generator means no hand card is discarded for a cost it covers). |
| 5   | Multiplayer: only one hero in Alter-Ego at a time, to heal | A player flips to Alter-Ego only if no other player is in Alter-Ego now and the flip is the heal move (section 4.4); the lowest-health damaged player goes first. A player who is in Alter-Ego and healed above the threshold flips back, which frees the slot.                                                                                                                                                                                                                                                                                                             |

Tests (first): opening round prefers thwart over attack with a threat of 1; a stun card ranks above a plain upgrade; empty tableau plays an upgrade that would otherwise be skipped; a draw ability is used before a play; with one player in Alter-Ego the second stays in hero form.

Open questions (answer or say "your call"):

1. ~~Rule 1: is "beginning of the game" the first 3 rounds, or until the main scheme threat is back to 0?~~ Answered: the first 3 rounds, with the goal of keeping threat at 0 (the opening rule thwarts every character first, side schemes before main).
2. Rule 4: stop at draw and resource only, or also use other tableau `ACTION` abilities (heals, attacks, thwarts) in this pass? I propose to leave those for a later pass so the iterations measure one change at a time.
3. ~~Rule 5: lowest health heals first?~~ Answered: yes.

## 11. Result of the second pass (2026-10-26): limit reached again, target not met

Delivered in code (not committed): the five ideas of section 10 (opening thwart with side schemes first, stun bonus, empty-tableau bonus, draw abilities first, one hero in Alter-Ego at a time with the most wounded first), identity-first payment locked by a test, ally-first blocking, free tableau and identity action abilities. `tests/engine/player-bot.test.ts` has 18 tests.

| Iteration | Change                                                          | Wins | Hero defeated / scheme |
| :-------- | :-------------------------------------------------------------- | :--- | :--------------------- |
| 1         | The five ideas of section 10                                    | 0    | 56 / 44                |
| 2         | Defend floor 4                                                  | 0    | 56 / 44                |
| 3         | Ally that survives the hit blocks first                         | 0    | 56 / 44                |
| 4         | Free tableau and identity action abilities (all, not only draw) | 0    | 49 / 51                |

Diagnosis (outside the limit): games last 6 rounds on average and Rhino ends at about 10 of 14 or 15 HP. Standard Rhino has two stages; about half the games reach stage II. The defend rule barely changes the result: always defending ends 54 of 54 games without a win too, and never defending is worse (81 hero defeats). So the missing damage and survival come from play quality, not from one rule.

Engine bugs found and fixed in the path (iteration 4 exposed the first):

- A prompt addressed to an eliminated player stayed in `pendingDecisionQueue` and crashed the simulation (`Do you want to use the following ability from Hawkeye?`, "Player not found"). `eliminatePlayer` now drops those prompts (test in `player-elimination.test.ts`).
- The simulator error now lists why each prompt option was rejected.
  Filed: [#429](https://github.com/SteveRodrigue/MCD/issues/429) (`ADD_STATUS` after elimination).

Not yet tried: per-hero play (aggro heroes thwart for 1, so the opening rule costs them damage), event timing, mulligan, using several actions per turn in a better order, attack versus defend with allies (Tigra blocked and died).
