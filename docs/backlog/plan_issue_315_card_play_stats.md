# Plan: Issue #315 — Card Play Stats

> **Status:** Approved and implemented; code review fixes applied.
> **Scope:** Issue [#315](https://github.com/SteveRodrigue/MCD/issues/315) only. Queue item 1 of section 3.4 in [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md). The commit will say `feat(engine): Track card plays, ability usage, and basic action stats (Fixes #315)`.
> **UI / Card Editor impact:** UI yes (right-click quick stats recap in [CardContextMenu.tsx](../../src/ui/components/cards/CardContextMenu.tsx), detailed stats inspection modal, DevMode single-card and global reset with confirm modals). Card Editor none (no schema, gate, or supplemental effect changes).

---

## 1. Requirements and Problem Statement

From Issue [#315](https://github.com/SteveRodrigue/MCD/issues/315) and owner refinements:

1. **Card plays:** Count how many times each card has been played (player cards) or revealed/entered play (encounter/villain cards).
2. **Ability usage:** Count how many times each ability on a card has been used/resolved (actions, triggered responses, interrupts, boost abilities, when revealed).
3. **Basic actions:** Count how many times basic actions were performed:
   - Hero: Attack, Thwart, Defense
   - Alter-Ego: Recover, Change Form
   - Ally: Attack, Thwart
   - Villain: Attack, Scheme
   - Minion: Attack, Scheme
4. **Scope:** Both Player cards and Villain/Encounter cards.
5. **Dual scope:** Stats must be counted both **per game** (`state.stats` in GameState) and **all-time** (persistent storage).
6. **External Storage (outside git):**
   - All-time stats must be stored outside the git repo (`stats/card_play_stats.json` added to `.gitignore`).
   - The code automatically creates the `stats/` directory and initial JSON file on first run, similar to `cache/cards/` in `cardCachePlugin`.
   - Managed via a Vite middleware plugin (`cardStatsPlugin`) with API endpoints (`/api/stats`, `/api/stats/reset`), with fallback to `localStorage` when running offline/standalone.
7. **DevMode Reset Safeguards:**
   - Single-card reset: in Dev Mode, right-clicking a card reveals a "Reset Stats for this Card" action that opens a confirmation modal before clearing.
   - All-time reset: in Dev Mode, Options Menu includes "Reset All Stats" with a confirmation modal.
   - Clear/reset controls are strictly hidden when `devMode` is false so users cannot clear stats by mistake.
8. **UI inspection:** On right-click, show a quick stats recap directly in [CardContextMenu.tsx](../../src/ui/components/cards/CardContextMenu.tsx) and allow opening a detailed inspection modal.
9. **Extensibility:** Indexed by card code and ability ID so custom cards/modular sets work out of the box without hardcoded catalogs.

---

## 2. Refactor-First & Architecture Check

- **Headless decoupling:** The engine remains headless and unaware of React, DOM, or file I/O. Per-game stats live on `GameState.stats` (`src/engine/models/stats.ts`).
- **Single mutation pathway:** Provide pure, idempotent helper functions in `src/engine/pipeline/stats.ts`:
  - `recordCardPlay(state, cardCode)`
  - `recordAbilityUsage(state, cardCode, abilityId)`
  - `recordBasicAction(state, actionType, cardCode)`
- **Universal Ability Tracking in `executeEffect`:** In `src/engine/effects/index.ts`, `executeEffect` is the single funnel through which all abilities resolve. Recording execution there captures actions, responses, interrupts, boost abilities, and when-revealed abilities uniformly. Only an ability that resolves successfully and that the source card declares (`enrichment.abilities`) is counted, so synthetic prompt abilities and step ids never create entries.
- **Server/Cache-style File Persistence:**
  - Add `stats/` to `.gitignore`.
  - In `vite.config.ts`, add `cardStatsPlugin()`:
    - Automatically creates `stats/` and `stats/card_play_stats.json` on first run if missing.
    - `GET /api/stats`: returns current all-time stats JSON.
    - `POST /api/stats`: merges incoming session deltas into `stats/card_play_stats.json`.
    - `POST /api/stats/reset`: resets a single card (`{ cardCode }`) or all stats (`{ all: true }`).
- **UI State Access:** Wrap the board hierarchy in `GameStateContext` so [CardContextMenu.tsx](../../src/ui/components/cards/CardContextMenu.tsx) accesses `useGameState()` and `useGameSettings()` without prop-drilling.

---

## 3. Engine & Model Changes

### 3.1 New Types: `src/engine/models/stats.ts`

```typescript
export interface CardUsageStats {
  played: number;
  abilitiesUsed: Record<string, number>; // abilityId -> count
  basicActions?: {
    attack?: number;
    thwart?: number;
    defense?: number;
    recover?: number;
    scheme?: number;
    changeForm?: number;
  };
}

export interface BasicActionSummary {
  heroAttack: number;
  heroThwart: number;
  heroDefense: number;
  alterEgoRecover: number;
  changeForm: number;
  allyAttack: number;
  allyThwart: number;
  villainAttack: number;
  villainScheme: number;
  minionAttack: number;
  minionScheme: number;
}

export interface GameStats {
  cards: Record<string, CardUsageStats>; // cardCode -> stats
  basicActions: BasicActionSummary;
  totalActionsExecuted: number;
}

export interface AllTimeStats {
  gamesPlayed: number;
  cards: Record<string, CardUsageStats>;
  basicActions: BasicActionSummary;
}

export function createInitialGameStats(): GameStats {
  return {
    cards: {},
    basicActions: {
      heroAttack: 0,
      heroThwart: 0,
      heroDefense: 0,
      alterEgoRecover: 0,
      changeForm: 0,
      allyAttack: 0,
      allyThwart: 0,
      villainAttack: 0,
      villainScheme: 0,
      minionAttack: 0,
      minionScheme: 0,
    },
    totalActionsExecuted: 0,
  };
}

export function createInitialAllTimeStats(): AllTimeStats {
  return {
    gamesPlayed: 0,
    cards: {},
    basicActions: {
      heroAttack: 0,
      heroThwart: 0,
      heroDefense: 0,
      alterEgoRecover: 0,
      changeForm: 0,
      allyAttack: 0,
      allyThwart: 0,
      villainAttack: 0,
      villainScheme: 0,
      minionAttack: 0,
      minionScheme: 0,
    },
  };
}
```

### 3.2 State Model: `src/engine/models/state.ts`

Add optional `stats?: GameStats` to `GameState`.
In `src/engine/state/game-setup.ts`, initialize `stats: createInitialGameStats()` in `setupGame`.

### 3.3 Engine Pipeline Recording Sites

1. **Card Play:**
   - Player card play in `src/engine/pipeline/action-dispatcher.ts` under `case 'PLAY_CARD'`: call `recordCardPlay(nextState, playedCardInstance.card.code)`.
   - Encounter card reveal in `src/engine/pipeline/villain-phase.ts` under `resolveActiveEncounterCardAfterInterrupt`: call `recordCardPlay(state, cardInstance.card.code)` unless the reveal was cancelled.
2. **Ability Usage:**
   - In `src/engine/effects/index.ts` under `executeEffect`: after a `CardAbility` resolves successfully, call `recordAbilityUsage(state, sourceCardCode, abilityId)` when the source card declares that ability id.
3. **Basic Actions:**
   - In `action-dispatcher.ts`:
     - `case 'BASIC_ATTACK'`: record on `player.activeFormCard.code` and increment `heroAttack`, after the Stunned replacement check.
     - `case 'BASIC_THWART'`: record on `player.activeFormCard.code` and increment `heroThwart`.
     - `case 'BASIC_RECOVER'`: record on `player.activeFormCard.code` and increment `alterEgoRecover`.
     - `case 'CHANGE_FORM'`: record on `player.activeFormCard.code` and increment `changeForm`.
     - `case 'ALLY_ATTACK'`: record on ally card code and increment `allyAttack`.
     - `case 'ALLY_THWART'`: record on ally card code and increment `allyThwart`.
   - In `src/engine/pipeline/combat-pipeline.ts` under `beginEnemyAttack` (the shared funnel for every enemy attack), after the Stun check:
     - Villain attack: record on villain card code and increment `villainAttack`.
     - Minion attack: record on minion card code and increment `minionAttack`.
   - In `src/engine/pipeline/villain-phase.ts`, after the Confused check:
     - Villain scheme: record on villain card code and increment `villainScheme`.
     - Minion scheme: record on minion card code and increment `minionScheme`.

---

## 4. UI & External Storage Changes

1. **Git Configuration:**
   - Add `stats/` and `/stats/` to `.gitignore`.
2. **Server Middleware Plugin (`vite.config.ts`):**
   - Add `cardStatsPlugin()`:
     - On first request, ensures directory `stats/` exists and creates `stats/card_play_stats.json` if missing.
     - Endpoints: `GET /api/stats`, `POST /api/stats` (delta merge), `POST /api/stats/reset` (`{ cardCode }` or `{ all: true }`).
3. **Storage Client Service (`src/ui/services/stats-storage-service.ts`):**
   - Asynchronously reads and syncs with `/api/stats` (falls back to `localStorage` if the dev server is unreachable).
   - Syncs deltas per game session so re-renders never double count: the sync baseline advances before the request is sent, so overlapping syncs never resend plays, and a call with nothing new returns without a request. `App` calls `resetSessionSyncTracking()` when a new game starts. `GameBoard` (not `GameTable`) runs the sync, so the final state of a game lost by elimination is still synced.
   - The merge and reset rules (`mergeDeltaIntoAllTime`, `applyStatsReset`) live in `src/engine/models/stats.ts` and are shared by the service and `cardStatsPlugin`.
   - Provides `resetCardStats(cardCode: string)` and `resetAllStats()`.
4. **Context Provider:**
   - `src/ui/context/GameStateContext.tsx` providing `gameState` to table components.
5. **Context Menu (`CardContextMenu.tsx`):**
   - Displays comic-styled stats recap under the card name header strip:
     - Plays (Game / All-time)
     - Abilities Used (Game / All-time)
     - Basic Actions (Game / All-time, if applicable)
   - Action: `📊 View Detailed Stats` (opens `CardStatsModal.tsx`).
   - If `devMode === true`:
     - Action: `🗑️ Reset Card Stats` (opens `ResetCardStatsConfirmModal.tsx`).
6. **Confirmation Modals:**
   - `ResetCardStatsConfirmModal.tsx`: Explicit confirm prompt to reset stats for a single card.
   - Options Menu Dev Tools section: "Reset All Card Stats" button with an explicit confirm modal.

---

## 5. Tests (Written First)

1. **Engine Stats Unit Tests (`tests/engine/stats/card-play-stats.test.ts`):**
   - `PLAY_CARD` increments `played` for that card code.
   - Encounter card reveal increments `played` for encounter cards.
   - `USE_CARD_ABILITY` and triggered abilities increment `abilitiesUsed[abilityId]`.
   - Basic actions increment character stats for Hero, Alter-Ego, Ally, Villain, Minion.
   - Custom/synthetic card codes work without errors.
   - `cloneGameState` preserves `state.stats`.
2. **Server Plugin & Storage Tests (`tests/ui/stats-storage-service.test.ts`):**
   - Auto-creation of initial stats file if missing.
   - Delta syncing preserves counts without duplicate accumulation.
   - Single-card reset clears only the target card's stats.
   - All-time reset clears all stats cleanly.
3. **UI Component Tests (`tests/ui/card-context-menu-stats.test.tsx`):**
   - Context menu displays stats recap.
   - In Dev Mode (`devMode=true`), "Reset Card Stats" button is present and triggers confirm modal.
   - In Non-Dev Mode (`devMode=false`), "Reset Card Stats" button is strictly absent.

---

## 6. Files Impacted

- **New Files:**
  - `src/engine/models/stats.ts`
  - `src/engine/pipeline/stats.ts`
  - `src/ui/context/GameStateContext.tsx`
  - `src/ui/services/stats-storage-service.ts`
  - `src/ui/components/cards/CardStatsModal.tsx`
  - `src/ui/components/cards/ResetCardStatsConfirmModal.tsx`
  - `tests/engine/stats/card-play-stats.test.ts`
  - `tests/ui/stats-storage-service.test.ts`
  - `tests/ui/card-context-menu-stats.test.tsx`
- **Modified Files:**
  - `.gitignore` (add `stats/`)
  - `vite.config.ts` (add `cardStatsPlugin`)
  - `src/engine/models/state.ts`
  - `src/engine/models/index.ts`
  - `src/engine/state/game-setup.ts`
  - `src/engine/pipeline/action-dispatcher.ts`
  - `src/engine/pipeline/villain-phase.ts`
  - `src/engine/effects/index.ts`
  - `src/ui/components/board/GameBoard.tsx`
  - `src/ui/components/board/OptionsMenu.tsx`
  - `src/ui/components/cards/CardContextMenu.tsx`
  - `docs/backlog/teamwork_status_and_next_target.md`
