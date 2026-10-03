# Plan: Core Review A1, Energy Daggers `01046`

Parent tracker: [plan_core_player_cards_review.md](plan_core_player_cards_review.md). **Status: implemented 2026-10-03, uncommitted. Deviation from plan: instead of routing through `resolveTargets`, I extracted the existing `ALL_ENEMIES` loop into a shared `dealDamageToEnemies` helper (same Tough/defeat path, no third copy).**

## 1. Printed text (`card.text`)

> **Special**: Choose a player. Deal 1 damage to the villain and to each enemy engaged with that player (2 damage instead if this is the final step of this sequence).
> *(Play the "Wakanda Forever!" event to use this ability.)*

## 2. Original supplemental data (`src/data/supplemental/pack/core.json`)

```json
"abilities": [{ "id": "energy_daggers_special", "timing": "SPECIAL",
  "steps": [{ "effect": "DEAL_DAMAGE",
    "effectParams": { "amount": 1, "finisherBonus": 1, "target": "ALL_ENEMIES" } }] }]
```

## 3. Findings

1. **Wrong target set.** `ALL_ENEMIES` is the villain plus minions engaged with *every* player (`effects/index.ts` ~L1780). The card hits the villain plus only minions engaged with the *chosen* player. This is wrong in multiplayer; solo is unaffected.
2. **"Choose a player" is never asked.** `wakanda-forever.ts` runs the SPECIAL steps with the playing player's id and no chooser.
3. **Dead, card-coded fallback.** `wakanda-forever.ts` L58–L80 has an `if (code === '01046')` branch that mutates health directly (it bypasses Tough and defeat handling, and is card-specific). It is unreachable while the ability exists (the `specialAbility` branch returns first). It is dead code and a policy violation.
4. **Selector already exists but is not wired.** `ENGAGED_ENEMIES` (villain plus the resolving player's engaged minions) is in the schema, the spec (`03`) and `target-resolver.ts` L698. `DEAL_DAMAGE` has inline branches only for `ALL_ENEMIES` and `ALL_CHARACTERS`, so I must verify whether `ENGAGED_ENEMIES` is actually executed. I believe it falls through to the single-target path.
5. **Existing coverage.** `tests/engine/wakanda-forever-sequence.test.ts` asserts "1 to villain, 1 to minion" for a single player, so it will not catch this bug.

## 4. Proposed supplemental data

```json
"abilities": [{ "id": "energy_daggers_special", "timing": "SPECIAL",
  "steps": [{ "effect": "DEAL_DAMAGE",
    "effectParams": { "amount": 1, "finisherBonus": 1,
                      "target": "ENGAGED_ENEMIES", "targetPlayer": "CHOSEN_PLAYER" } }] }]
```

Bump `audit.updatedAt` / `reviewedAt` (no `audit.comment` change). Keep the card in canonical order.

**Why:** the card's scope is "the villain and each enemy engaged with the chosen player". `ENGAGED_ENEMIES` plus a chosen-player scope models exactly that, with no card-specific names (ADR-0021). `targetPlayer` follows the Q4 convention (`SELF | CHOSEN_PLAYER | ALL_PLAYERS`).

## 5. Engine and spec changes (Tier 2, additive, card-agnostic)

1. `DEAL_DAMAGE`: handle `target: ENGAGED_ENEMIES` by resolving the player from `targetPlayer`.
   - Resolve via `resolveTargets` (`target-resolver.ts` L698) so Tough, defeat processing and triggers use the same per-target damage path as other targets. This avoids copy-pasting a third inline AoE loop.
   - Villain is hit once. Each minion engaged with that player is hit. Tough is removed instead of damage, and defeats are processed.
2. `targetPlayer: CHOSEN_PLAYER`:
   - 1 player: auto-resolve to that player, with no prompt.
   - 2 or more players: enqueue the existing "Choose a Player" decision prompt (same pattern as DRAW at `effects/index.ts` ~L1392), then resume the step with the chosen `targetPlayerId`.
   - Check that a SPECIAL step interrupted by a prompt resumes correctly inside the Wakanda Forever sequence. This is the main risk. If the sequence runner can't resume after a prompt, I will stop and report it. That would be Tier 3 and not silently expanded.
3. Remove the dead `01046` fallback branch in `wakanda-forever.ts`. Check whether the `01047`–`01049` fallbacks are equally dead. If so, **list them but don't touch them here**. They belong to a separate item, and I'll log it in the tracker.
4. Update specs: `03_costs_and_targeting.md` (`ENGAGED_ENEMIES` row: honors `targetPlayer`) and `05_effects_combat_threat.md` (`DEAL_DAMAGE` parameters). Add or update `targetPlayer` for `DEAL_DAMAGE` if undocumented. The Card Editor registry (`effect-parameter-registry.ts`) gets a `targetPlayer` field for `DEAL_DAMAGE` if not already there. **UI/Card Editor impact: one param field. No visual change to gameplay UI.**

## 6. Tests (written first, must fail before the fix)

New file `tests/engine/energy-daggers-chosen-player.test.ts`:
- 2 players, minions engaged with each: choosing P2 damages the villain and P2's minions only. P1's minion is untouched.
- Final-step bonus: 2 damage to villain and engaged minions.
- Tough minion loses Tough and takes no damage. A minion with damage equal to its HP is defeated, discarded, and defeat triggers fire.
- 1 player: no prompt, same result as today (existing `wakanda-forever-sequence` test still passes).
- Chosen player has zero engaged minions: only the villain is hit.
- Prompt resumes inside a multi-step Wakanda Forever sequence (the Energy Daggers step followed by another upgrade).

## 7. Verification

`rtk vitest run tests/engine/energy-daggers-chosen-player.test.ts tests/engine/wakanda-forever-sequence.test.ts tests/data/supplemental-schema.test.ts`, then `rtk npm run report:declarations`, then `rtk npm test; rtk npm run typecheck; rtk npm run build` (0 failed, 0 skipped). Prune nothing in `docs/ambiguities/` (none exists). Update the tracker row to Done.

## 8. Open decisions

1. Is `targetPlayer` the right param name (consistent with Q4 and the spec), or would you rather have a dedicated selector such as `ENGAGED_ENEMIES_OF_CHOSEN_PLAYER`? I recommend the param: it composes with other targets later.
2. The unreachable `01047`–`01049` fallbacks in `wakanda-forever.ts`: out of scope here (logged as a follow-up) unless you want them removed in this change.
3. If the prompt-resume check fails, would you accept a first step that only fixes targeting (correct in solo and with `SELF` resolving, with the multiplayer prompt deferred)? I'd rather not ship half of "Choose a player", so my default is to stop and report instead.
