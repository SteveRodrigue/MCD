# Plan: Issue #133 — Hydra Bomber (01110) damages every hero

> Status: **Awaiting approval** (reproduction test written, no source or data edits made yet)
> Roadmap: `teamwork_status_and_next_target.md`, Phase 5, Track A, step 1.
> UI / Card Editor impact: none. Tier 1 (data only, one card).

## 1. Rules

Printed text: "**When Revealed**: Choose to either take 2 damage or place 1 threat on the main scheme." (upstream `core_encounter.json`.)

- RR v1.8 *Reveal*: a minion enters play engaged with the player revealing it, and that player resolves its When Revealed ability. "You" is the revealing player.
- "Take 2 damage" is damage to the revealing player's **identity**, whatever its form (the card does not say "hero").

## 2. Verified defect (reproduced)

`src/data/supplemental/pack/core_encounter.json:495-530`: the `take_damage` option uses `DEAL_DAMAGE` with `target: "HERO"`. In `effects/index.ts` (`DEAL_DAMAGE`), `HERO` is handled like `ALL_HEROES`: it damages **every player currently in hero form** (and `03_costs_and_targeting.md` documents the strict hero-form filter for `HERO`). Two consequences, both reproduced by `tests/engine/hydra-bomber.test.ts`:

| Case | Expected | Actual (today) |
|---|---|---|
| 2 players, p2 reveals, both in hero form, p2 takes damage | p2 -2, p1 unchanged | p2 -2 **and p1 -2** (the reported bug) |
| p2 reveals while in alter-ego form | p2 -2 | p2 **takes nothing** (alter-ego immune under `HERO` gating) |

The "place 1 threat" option and the prompt owner/engagement are already correct (2 of 4 tests pass today).

## 3. Fix (data only)

Change the option's `params.target` from `"HERO"` to `"SELF_IDENTITY"` ("the player identity controlling the card", spec `03_costs_and_targeting.md`). `DEAL_DAMAGE` already has a `SELF_IDENTITY` branch that damages only the resolving player, form-independent, and handles Tough. No engine change, no new primitive.

## 4. Files

| Tag | File | Change |
|---|---|---|
| MODIFY | `src/data/supplemental/pack/core_encounter.json` | `01110` option `take_damage`: `target` HERO to SELF_IDENTITY |
| NEW | `tests/engine/hydra-bomber.test.ts` | 4 tests (already written, 2 red) |
| MODIFY | `CHANGELOG.md`, `teamwork_status_and_next_target.md` | status |

`audit.comment` is not touched (AGENTS policy). Whether to bump the card's `audit.updatedAt` follows the card-integration protocol's review step; I will do what that protocol prescribes.

## 5. TDD

1. **Red (done):** the two damage tests fail with the values above.
2. **Green:** the one-line data change.
3. **Regression:** full suite, supplemental schema tests (`tests/data/supplemental-schema.test.ts`), `typecheck`, `lint`, `format:check`. Baseline 1,667 passing.

## 6. Same pattern elsewhere (audited)

The seven other cards using `target: "HERO"` were audited card by card: [plan_hero_target_audit.md](plan_hero_target_audit.md). They are placeholders rather than scoping bugs, and none can be fixed with data alone: they depend on engine gaps (the Surge keyword is unimplemented, hand discard ignores filters and "each player", no per-player iteration, no minion-attack primitive). That document holds the per-card 4-point review, proposed data and tests, plus the recommended sequence.

## 7. Decisions needed

1. **Scope:** fix only `01110` here (recommended); the other seven are handled per `plan_hero_target_audit.md` (their data is placeholder, not just mis-scoped).
2. **Follow-up issues:** decided in `plan_hero_target_audit.md` section 3.
3. **Repro test:** keep `hydra-bomber.test.ts` as the permanent regression suite (recommended).

## 8. Estimate

About 30 minutes (data change, test run, docs). One commit: `fix(data): Scope Hydra Bomber damage to the revealing player (Fixes #133)`.
