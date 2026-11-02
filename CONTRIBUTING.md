# Contributing to Marvel Champions Digital (MCD)

Thank you for your interest in contributing to **Marvel Champions Digital**! As an open-source fan project, community contributions are essential to expanding the card library, improving rule precision, and polishing the comic presentation.

---

## 📜 Principles & Standards

Before writing any code, please review our comprehensive **[Coding Guidelines & Best Practices](docs/engine/coding_guidelines.md)**.

1. **Decoupled Architecture ([ADR-0002](docs/decisions/0002-decoupled-headless-rules-engine.md)):**
   - All game rules, card abilities, and trigger logic must reside strictly in `src/engine/` without any dependency on React, DOM, or browser APIs.
   - UI components in `src/ui/` should only render state and dispatch actions to the engine.

2. **Test-Driven Development (TDD):**
   - Every card ability, keyword, or rule mechanic must be accompanied by automated unit tests in `tests/`.
   - Pull requests modifying rules logic without tests will not be merged.

3. **Architecture Decisions ([ADR-0001](docs/decisions/0001-record-architecture-decisions.md)):**
   - Any major architectural or design direction shift must be documented with an **Architecture Decision Record (ADR)** in `docs/decisions/`.

---

## 🚀 Quickstart: How to Implement a New Card in 3 Steps

Here is the recommended workflow to implement any Hero, Ally, Event, Upgrade, or Encounter Card ability:

### Step 1: Verify the Card in Upstream JSON (`content/`)

All official card metadata (stats, traits, cost, text, resource icons) lives in `content/packs/*/cards/*.json`. Ensure the card is loaded in [`src/engine/decks/starter-decks.ts`](src/engine/decks/starter-decks.ts) or in a scenario `definition.json` under `content/packs/*/scenarios/`.

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

    expect(getActiveVillain(nextState).health).toBe(getActiveVillain(state).health - 8);
  });
});
```

### Step 3: Implement the Ability Effect in `src/engine/`

Add the effect handler in `src/engine/effects/handlers/` (register it in the matching `*_HANDLERS` map), or pipeline logic in `src/engine/pipeline/`. Run `npm test` to verify your test turns green!

---

## 🧰 Setup & Commands

**Prerequisites:** Node.js >= 18 (20 or 22 LTS recommended), npm >= 9, Git >= 2.30, and the GitHub CLI (`gh`) for the issue and `next-task` tooling.

```bash
git clone https://github.com/SteveRodrigue/MCD.git
cd MCD
npm install
npm run dev        # http://localhost:3000/ (strictPort; override with: npm run dev -- --port 3001)
```

`npm run dev` also mirrors Vite output to the newest 10 logs in `logs/dev-server/`. Cards are read from `content/` (official data), `content/packs/*/supplemental/*.json` (declarative rules) and `src/engine/` (rules engine).

| Task                   | Command                                             | Notes                                                                                             |
| :--------------------- | :-------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| Run all tests          | `npm test`                                          | `npm run test:watch` for watch mode, `npm run test:coverage`                                      |
| Run one test file      | `npx vitest run tests/engine/villain-phase.test.ts` | Prefer targeted runs while implementing                                                           |
| Refresh shard timings  | `npm run test:timings`                              | When CI warns "Unbalanced test shards": commit the updated `tests/shard-timings.json`             |
| Type check / lint      | `npm run typecheck`, `npm run lint`                 | Lint must report 0 warnings                                                                       |
| Format                 | `npm run format`, `npm run format:check`            |                                                                                                   |
| Build / preview        | `npm run build`, `npm run preview`                  | `preview` serves a build and has no editor write endpoints                                        |
| Headless simulation    | `npm run simulate`                                  | 100-game gate for the release                                                                     |
| Parse card text        | `npm run parse:card -- --code 01001b`               | Options: [docs/engine/tools/card_text_parser.md](docs/engine/tools/card_text_parser.md)                         |
| Declarations report    | `npm run report:declarations`                       | Schema usage and parity report; the pre-commit hook regenerates `docs/reports/supplemental_data/` |
| Export schema          | `npm run schema:generate`                           | Writes `src/data/supplemental/schema.json`                                                        |
| Look up a rule         | `npm run rule -- <term>`                            | Reads `references/rules/`                                                                         |
| Check for leaked files | `npm run leak:check`                                | Fails on tracked PDFs, images, caches, files over 5 MB (pre-commit, `verify`, CI)                 |
| Full check             | `npm run verify`                                    | Format, lint, typecheck, tests, coverage, build                                                   |

### Windows troubleshooting

- **`npm` or `gh` is not recognized** (installed while the terminal was open): `$env:Path += ";C:\Program Files\nodejs;C:\Program Files\GitHub CLI"` for this session; add the same folders (and `%APPDATA%\npm`) to your user `Path` in `sysdm.cpl` to keep them.
- **"Running scripts is disabled on this system":** `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`.
- **Agents hang on `git push` or `gh` (credential prompt with no terminal):** set `git config --global credential.helper manager`, run `git fetch origin` once in an interactive terminal and authorize, then `gh auth login` (GitHub.com, HTTPS, browser). Verify with `git ls-remote --exit-code origin` and `gh auth status`; both must return immediately.

Recommended VS Code extensions are listed in `.vscode/extensions.json` (ESLint, Prettier, Tailwind CSS IntelliSense, Vitest).

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
   **Claude Code only:** skills live in `.agents/skills/`, but Claude Code reads `.claude/skills/`. Link them once per clone (the link is not committed):
   ```powershell
   New-Item -ItemType Junction -Path .claude\skills -Target .agents\skills   # Windows, no admin needed
   ```
   ```bash
   ln -s ../.agents/skills .claude/skills                                    # macOS / Linux
   ```
3. **Commit Messages:**
   Follow Conventional Commits:
   - `feat: add Peter Parker scientist resource generation`
   - `fix: prevent thwarting when Patrol keyword is active`
   - `docs: add ADR for deckbuilder state persistence`
   - `test: add unit tests for Rhino charge attachment`

4. **Pull Request Checklist:**
   - [ ] All unit tests pass (`npm test`).
   - [ ] Type checking passes with 0 errors (`npm run typecheck`).
   - [ ] Linter passes (`npm run lint`).
   - [ ] Code adheres strictly to the decoupled engine architecture.
   - [ ] A changelog fragment is added in `changes/unreleased/` (compiled into releases via `npm run changelog:release`).
