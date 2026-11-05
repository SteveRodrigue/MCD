---
type: Fixed
---

- **Fix (UI): Display engaged player on minion rows in AttackTargetModal**
  - Updated `EnemyTarget` in `src/ui/components/board/attack-target-utils.ts` to include `engagedPlayerId` and `engagedPlayerName`.
  - In `AttackTargetModal`, minion options now display `• Engaged with <Hero>` in the detail row alongside hit points so players can clearly distinguish which player each minion is engaged with.
