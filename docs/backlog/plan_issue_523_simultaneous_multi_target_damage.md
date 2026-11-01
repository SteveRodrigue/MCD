# Issue #523: Multi-target damage resolves target by target instead of simultaneously

**Status:** Analysis done, plan not yet written (needs owner approval before implementation).
**Milestone:** Gate 1 — Rhino Release · **Priority:** P1 · **Labels:** bug, subsystem:engine

## Origin

Found during the `/simplify` review of the engine code from #510, #513, #514 and #516. The cleanup merged the four
"all characters" damage selectors in `src/engine/effects/handlers/damage.ts` into one helper, `damageCharacters`.
As a side effect, `ALL_FRIENDLY_CHARACTERS` now damages every hero first, then every ally (before: player by
player, hero then that player's allies). Reviewing that order change against the rules exposed the real defect
below.

## Printed card text

Concussive Blast (01154), the only card using `ALL_FRIENDLY_CHARACTERS`:

> **When Revealed**: Deal 1 damage to each friendly character.
> [star] **Boost**: Deal 1 damage to each character you control.

## Rules analysis

### Rules Reference v1.8

- **Damage** (`references/rules/glossary/D.md#damage`) fixes the order of one damage event:
  1. "would deal / be dealt" abilities, 2. Tough, 3. "would take" abilities, 4. "takes" abilities, 5. place the
     damage, 6. "would be defeated" abilities, 7. "is defeated" abilities (incl. When Defeated), 8. discard the
     defeated character, 9. "after" abilities.
- **Simultaneous Resolution** (`glossary/S.md`) and **First Player** (`glossary/F.md:63-65`): when effects
  resolve at the same moment, the first player decides their order.
- **Forced** (`glossary/F.md:165-168`): forced abilities triggering at the same moment are ordered by the first
  player, whoever controls them.
- **Simultaneous Timing Priority** (`glossary/A.md:92-104`): constant, then interrupts (status forced interrupts,
  forced interrupts, interrupts), then Boost / When Revealed, then responses (forced, then optional), then
  consequential damage.
- **"Each Player"** (`glossary/E.md`) does not apply: "each friendly character" is one effect with many targets,
  not an instruction each player resolves in turn.
- **"For Each"** (`glossary/F.md#for-each`) does not apply: it covers "for each X, (choose and) deal damage",
  not "deal damage to each X".
- The full PDF (`references/mc_rulesreference_v18_compressed.pdf`) has no explicit entry for "deal damage to each
  character". Its FAQ treats multi-target damage as simultaneous: Whirlwind (`appendices/04_faq.md:150`), Wasp
  (`:393`), Dive Bomb ("deal 1 damage to each other enemy").

### Official FFG rulings (Alex Werner, FFG Game Rules Specialist)

Source: [Hall of Heroes, Latest FFG Rulings (post-RRG 1.7 & 1.8)](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/).

- **Squirrel Girl** (2 June 2026): damage dealt to several enemies by one effect is simultaneous. Resolve each
  damage step for all targets before moving to the next step. Within a step the order between targets is free,
  unless the Simultaneous Timing Priority chart puts one first (for example an interrupt before a response).
- **Valkyrie ally** (3 August 2026): every ally is at 1 hit point and an encounter card deals 1 damage to each
  ally. Valkyrie's interrupt can still save another ally, because both "would be defeated" in the same window,
  before either leaves play.
- **Starhawk** (19 November 2024, [post-RRG 1.6 page](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/)):
  an attack with overkill deals the excess simultaneously to the identity.

### Conclusion

- **The order between targets is not a rules question.** Heroes first, player by player, or any other order is
  legal; open choices belong to the first player. Keeping heroes first (same as `ALL_CHARACTERS` and
  `ALL_HEROES_AND_ALLIES`) is fine.
- **The defect is step synchronization.** One multi-target damage effect must run step 1 for every target, then
  step 2 for every target, and so on. The engine runs all nine steps on one target, including defeat and
  discard, before the next target starts.

## Evidence in the engine

- `src/engine/effects/handlers/damage.ts`, `damageCharacters`: used by `ALL_CHARACTERS`,
  `ALL_FRIENDLY_CHARACTERS`, `ALL_HEROES_AND_ALLIES`, `ALL_CONTROLLED_CHARACTERS`. It calls `applyAbilityDamage`
  once per target, in sequence.
- Each call runs the whole pipeline in `src/engine/pipeline/damage-pipeline.ts` (`applyDamageToTarget`,
  `applyDamageAndCheckDefeat`, `dispatchDefeat`).
- Overkill applies its excess as a second, separate pipeline run after the first target is fully resolved.

### Consequences

- "After … takes damage" responses fire between targets instead of after every target took its damage.
- A "would be defeated" interrupt on one target cannot see the other targets: they are already defeated and
  discarded, or not yet damaged.
- Concrete failure: with the Valkyrie ally processed first, she is defeated and discarded before the other ally's
  "would be defeated" window opens, so she cannot save it. The ruling says she can.
- Current card pool: Concussive Blast (1 damage, no interrupt in play) resolves the same under every order.
  Valkyrie is not integrated yet; this defect blocks it.

## Proposed fix (to be detailed in the plan)

1. The damage pipeline takes several targets from one effect and resolves each damage step for all of them
   before the next step.
2. Interrupts and responses of the same step open in one window per step, ordered by the first player (RR v1.8
   Simultaneous Resolution and Simultaneous Timing Priority).
3. The four `ALL_*` selectors in `damage.ts` and overkill use it. The per-target loop in `damageCharacters` goes
   away.
4. Tests first:
   - "after takes damage" responses fire only after every target took its damage;
   - a "would be defeated" interrupt on one target sees the other targets still in play (Valkyrie scenario with a
     test fixture);
   - overkill: the ally and the identity go through the steps together.

Estimate: about a day with tests, mostly in `damage-pipeline.ts`.

## Related

- #525: `ALL_CONTROLLED_CHARACTERS` differs between `damageCharacters` and `compileDistributionTargets`
  (`src/engine/effects/index.ts`). Both should read one target-scope helper; do it in whichever change lands first.
