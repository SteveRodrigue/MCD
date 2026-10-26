---
type: Fixed
---

- **Fix (UI & Engine): Render effective dynamic minion attack and scheme values in HeroZone ([Issue #386](https://github.com/SteveRodrigue/MCD/issues/386))**
  - Fix engaged minion badges in `HeroZone.tsx` to display dynamic attack via `getEffectiveMinionAttack` and scheme via `getEffectiveMinionScheme` with dash (`–`) support, preventing Titania (`01162`) from rendering `-1` ATK.
  - Add `getEffectiveMinionScheme` in `stat-calculator.ts` and unify dynamic minion stat evaluation across attachments, active stat modifiers, and dash powers.
  - Fix `readCardAttribute` for `REMAINING_HIT_POINTS` to account for damage stored directly on instance properties.
  - Refactor `villain-phase.ts` and `player-bot.ts` to use `getEffectiveMinionScheme`.
