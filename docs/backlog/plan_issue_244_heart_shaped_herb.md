# Plan: #244 (first row), Heart-Shaped Herb `01158` replaces its invented placeholder

> **Status:** implemented 2026-10-05 (approved with option A: `trigger: "BOOST"`; not committed yet). Tier 1 (data only, no engine or schema change). Queue item 1 of section 3.1 in [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).
> **Scope:** only `01158`. The other rows of #244 (`01185` Biomechanical Upgrades, needs #209; `01121` Weapons Runner) stay open, so the commit says `Refs #244`.
> **UI / Card Editor impact:** none (no new selector, effect, gate or parameter).

## 1. Printed card text

[Heart-Shaped Herb] (01158), treachery, Black Panther nemesis set, boost 1 plus a star:

> Surge *(After this card resolves, reveal 1 additional encounter card)*
> **When Revealed**: Give the villain and each minion engaged with you a tough status card.
> [star] **Boost**: Give the villain a tough status card.

## 2. Original supplemental data

```json
"01158": {
  "abilities": [
    {
      "id": "heart_shaped_herb",
      "timing": "FORCED_RESPONSE",
      "trigger": "WHEN_REVEALED",
      "steps": [
        { "effect": "HEAL_DAMAGE", "effectParams": { "amount": 2, "target": "VILLAIN" } }
      ]
    }
  ],
  "audit": {
    "updatedAt": "2026-09-14T18:37:00Z",
    "reviewedAt": "2026-09-14T18:37:00Z",
    "reviewedBy": "antigravity",
    "rulesVersion": "v1.8",
    "originalText": "<printed text>"
  }
}
```

## 3. Proposed supplemental data

```json
"01158": {
  "abilities": [
    {
      "id": "heart_shaped_herb_when_revealed",
      "timing": "WHEN_REVEALED",
      "trigger": "WHEN_REVEALED",
      "steps": [
        { "effect": "ADD_STATUS", "effectParams": { "status": "TOUGH", "target": "ENGAGED_ENEMIES" } }
      ]
    },
    {
      "id": "heart_shaped_herb_boost",
      "timing": "BOOST",
      "trigger": "BOOST",
      "steps": [
        { "effect": "ADD_STATUS", "effectParams": { "status": "TOUGH", "target": "VILLAIN" } }
      ]
    }
  ],
  "audit": {
    "updatedAt": "<now>",
    "reviewedAt": "<now>",
    "reviewedBy": "claude",
    "rulesVersion": "v1.8",
    "confidence": 98,
    "originalText": "<printed text, unchanged>"
  }
}
```

Surge stays out of the data: the importer tags the printed keyword and the shared surge path (#218) applies it after the card resolves.

## 4. Why

1. **The current ability is invented.** "Heal the villain 2" is not on the card. The card heals nothing. It gives tough status cards.
2. **The When Revealed was never modelled.** `ENGAGED_ENEMIES` (`target-resolver.ts` L731) resolves to the active villain plus the minions engaged with the resolving player. That is exactly "the villain and each minion engaged with you". During a reveal the resolving player is the revealing player, which is the same path `SELF_HERO` relies on for `01168`. Minions engaged with other players are not touched.
3. **The boost was missing.** `combat-pipeline.ts` L753 and `villain-phase.ts` L179/L331 run every ability with `timing: BOOST` when the card has `boostStar`. The importer sets that flag from upstream `boost_star: true` (`card-loader.ts` L241).
4. **Status card limits are already right.** RR v1.8 *Status Cards* says "a character cannot have more than one status card of each type at a time". `ADD_STATUS` caps tough at 1 and logs "already applied" (`effects/index.ts` L3270). Steady and Stalwart only concern stunned and confused, so a villain or minion that is already tough keeps exactly one. Unlike Rhino's `01105`, this card has no "already tough" surge clause, so no gate is needed.
5. **Canonical timing.** The When Revealed pair is `WHEN_REVEALED`/`WHEN_REVEALED`, the same as `01105` and `01173`. The legacy `FORCED_RESPONSE` timing worked only because the reveal path matches on either field.
6. **Audit.** The new behaviour uses only implemented primitives (`ADD_STATUS`, `ENGAGED_ENEMIES`, `VILLAIN`, the `BOOST` timing), so confidence is 98. `createdAt` is unknown and stays absent. `audit.comment` is not touched.

Decompiled round trip: "When revealed: give a tough status card to the active villain and to each minion engaged with the revealing player. Boost (star): give the active villain a tough status card. (Surge: printed keyword.)" This matches the printed text.

## 5. Tests (written first, seen failing)

New file `tests/engine/heart-shaped-herb.test.ts`, real reveal path (`step4_revealEncounterCards`, as in `surge-keyword.test.ts`):

1. Reveal with one minion engaged with p1: the villain and that minion each get one tough, and the villain is **not** healed (damage before = damage after). Fails today (it heals 2 and gives no tough).
2. Two players with a minion each, p1 reveals: only p1's minion gets tough, p2's does not.
3. The villain is already tough: it still has exactly one tough after the reveal.
4. Surge still happens (one extra card revealed). This is already covered by `surge-keyword.test.ts` L104 and is kept unchanged.
5. Boost: a villain attack whose boost card is `01158` gives the villain a tough status card (the `executeEnemyAttackSynchronously` path, as in `kree-manipulator-boost.test.ts`). Fails today.

The schema test (`tests/data/supplemental-schema.test.ts`) and the selector membership test validate the new shape.

## 6. Files

- `src/data/supplemental/pack/core_encounter.json` (`01158` only, textual edit, CRLF preserved)
- `tests/engine/heart-shaped-herb.test.ts` (new)
- `docs/reports/supplemental_declarations_usage_report.md` (regenerated by `npm run report:declarations`)
- `CHANGELOG.md` `[Unreleased]`
- This plan's status line, [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md) (queue item 1 narrowed to `01185`/`01121`), [handoff_prompt.md](handoff_prompt.md) (good-first-item 2 done)

## 7. Open decisions

Resolved: the boost uses `trigger: "BOOST"` (option A, owner decision 2026-10-05). It is the same pattern as When Revealed, RR v1.8 *Boost* ("resolve the Boost ability when the card is turned face up"). `BOOST_STAR_RESOLVED` on `01178` is never dispatched and is recorded for cleanup under WP7 (#232).

## 8. Implementation notes (2026-10-05)

- Three of the four new tests failed before the data change (no tough given). The "already tough" test passed on both sides, so it pins the existing cap.
- Gates: 1,834 tests green, typecheck, lint and Prettier clean; declarations report regenerated.
