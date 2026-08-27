# Contributing to Marvel Champions Digital (MCD)

Thank you for your interest in contributing to **Marvel Champions Digital**! As an open-source fan project, community contributions are essential to expanding the card library, improving rule precision, and polishing the comic presentation.

---

## 📜 Principles & Standards

Before writing any code, please review our comprehensive **[Coding Guidelines & Best Practices](docs/coding_guidelines.md)**.

1. **Decoupled Architecture ([ADR-0002](docs/decisions/0002-decoupled-headless-rules-engine.md)):**
   * All game rules, card abilities, and trigger logic must reside strictly in `src/engine/` without any dependency on React, DOM, or browser APIs.
   * UI components in `src/ui/` should only render state and dispatch actions to the engine.

2. **Test-Driven Development (TDD):**
   * Every card ability, keyword, or rule mechanic must be accompanied by automated unit tests in `tests/`.
   * Pull requests modifying rules logic without tests will not be merged.

3. **Architecture Decisions ([ADR-0001](docs/decisions/0001-record-architecture-decisions.md)):**
   * Any major architectural or design direction shift must be documented with an **Architecture Decision Record (ADR)** in `docs/decisions/`.

---

## 🚀 Quickstart: How to Implement a New Card in 3 Steps

Here is the recommended workflow to implement any Hero, Ally, Event, Upgrade, or Encounter Card ability:

### Step 1: Verify the Card in Upstream JSON (`data/upstream/`)
All official card metadata (stats, traits, cost, text, resource icons) lives in `data/upstream/pack/*.json`. Ensure the card is loaded in [`src/engine/decks/starter-decks.ts`](src/engine/decks/starter-decks.ts) or [`src/engine/scenarios/catalog.ts`](src/engine/scenarios/catalog.ts).

### Step 2: Write a Failing Unit Test in `tests/engine/`
Follow strict Test-Driven Development (TDD). Write an automated test describing the expected card effect according to the **Rules Reference (RR v1.8)**:

```typescript
// tests/engine/my-new-card.test.ts
import { describe, it, expect } from 'vitest';
import { setupGame, dispatchAction } from '../../src/engine';

describe('Card: Swinging Web Kick', () => {
  it('should deal 8 damage to the villain when played as Hero', () => {
    const state = createInitialGameState();
    const nextState = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'player_1',
      cardInstanceId: 'inst_swinging_web_kick',
    });

    expect(nextState.villain.health).toBe(state.villain.health - 8);
  });
});
```

### Step 3: Implement the Ability Effect in `src/engine/`
Add the declarative effect hook or action reducer in `src/engine/pipeline/` or `src/engine/state/reducers/`. Run `npm test` to verify your test turns green!

---

## 🛠️ Development Workflow

1. **Fork & Branch:**
   ```bash
   git checkout -b feat/spider-man-web-shooter
   ```
2. **Install & Run Tests:**
   ```bash
   npm install
   npm test
   ```
3. **Commit Messages:**
   Follow Conventional Commits:
   * `feat: add Peter Parker scientist resource generation`
   * `fix: prevent thwarting when Patrol keyword is active`
   * `docs: add ADR for deckbuilder state persistence`
   * `test: add unit tests for Rhino charge attachment`

4. **Pull Request Checklist:**
   * [ ] All unit tests pass (`npm test`).
   * [ ] Type checking passes with 0 errors (`npm run typecheck`).
   * [ ] Linter passes (`npm run lint`).
   * [ ] Code adheres strictly to the decoupled engine architecture.
