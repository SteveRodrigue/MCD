# MCD Backlog: Status and Work Queue

> **Last updated:** 2026-10-10 (backlog reorganized by release gate; done items purged, history is in `git log` and `CHANGELOG.md`)
> **Repository state:** `main`, everything through #297 (`c588ed4`) committed and pushed. Check `git log -1` and `git status` first.
> **Release gate:** Gate 1 ("Rhino Release" vertical slice: the 5 core heroes against Rhino, Standard and Expert).
> **Verification baseline:** 🟢 2,523 tests passing (0 failed, 0 skipped), 0 TypeScript diagnostics, 0 ESLint warnings, Prettier clean.
> **This file is the entry point for anyone (person or agent) picking the work up.** Run the `next-task` skill: it takes the first open row of section 3, or falls back on the active gate milestone when the queue is empty.

---

## 1. Where we are

Phases 1 to 5 track A (combat flow, ability legality, shared gating, audit cleanups, reported card bugs) and the core card reviews (`effectParams` audit, core player cards Tier 1 and 2, core encounter read-through) are done. What is left of Gate 1 is listed in section 3, in order.

Open work lives in **GitHub milestones**, one per release gate. Every open issue belongs to exactly one:

| Milestone                                                                                    | Scope                                                                 |
| :------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| [Gate 1 — Rhino Release](https://github.com/SteveRodrigue/MCD/milestone/2)                   | **Active.** Core heroes vs Rhino, rules-verified, 100-game simulation |
| [Gate 2 — Klaw & Ultron](https://github.com/SteveRodrigue/MCD/milestone/3)                   | Klaw, Ultron, their modular sets, scenario packaging                  |
| [Gate 3 — Multiplayer Co-op](https://github.com/SteveRodrigue/MCD/milestone/4)               | Alliance, Team-Up, cross-player triggers                              |
| [Gate 4 — Expansions & Advanced Mechanics](https://github.com/SteveRodrigue/MCD/milestone/5) | Expansion packs and the mechanics only they need                      |
| [Tech Debt & Tooling](https://github.com/SteveRodrigue/MCD/milestone/6)                      | Refactors, guards, tooling; no gate depends on them                   |

New issues get a milestone at triage. Scope rule (roadmap): Gate 1 work targets only Core Set player cards and Rhino encounter cards (Rhino, Standard, Expert, Bomb Scare, the 5 core nemesis sets).

---

## 2. Rules of this repository (digest; the sources are authoritative)

Sources: [AGENTS.md](../../AGENTS.md), `.agents/rules/*.md` (shared quality gates, command execution, RTK, post-task checklist), the skills in `.claude/skills/` (`card-integration-protocol`, `bug-fix`, `feature-delivery`, `commit-and-push`, `next-task`, `problem-report-triage`).

1. **Plan first, stop for approval.** For any change to `src/`, `tests/`, supplemental data, dependencies or config: write `docs/backlog/plan_<topic>.md` (rules analysis, printed text, original data, proposed data, why, tests, files, open decisions, UI/Card Editor impact) and wait for the owner's approval. A plan may be pre-authorised for follow-ups only when the owner says so.
2. **TDD.** Write the failing test first and watch it fail for the right reason. Never add skipped or todo tests.
3. **Cards are read literally.** "Your hero" is never the alter-ego (selector `SELF_HERO`); "take damage" or "you" is the identity in either form (`SELF_IDENTITY`). Never interpret card text. **Never add or edit `audit.comment`.**
4. **Official errata beat the printed text** (`references/rules/appendices/05_card_errata.md`). Do not open the raw PDF; use `npm run rule -- <term>` or `references/rules/`.
5. **Engine stays headless; card behaviour stays declarative.** Engine primitives are generic, never named after a card (ADR-0021). No legacy shims or aliases.
6. **Schema change rule.** Any new or renamed effect, condition, gate, selector, filter or parameter updates in the same change: `schema.ts`, regenerated `schema.json` (`npm run schema:generate`), the spec in `docs/specifications/supplemental/`, the Card Editor (`src/ui/components/editor/`, mainly `effect-parameter-registry.ts`), and a test. Add an ADR or ADR addendum for design decisions.
7. **Circuit-breaker.** If a card cannot be modelled faithfully (missing primitive, ambiguity), strip its executable ability, set `audit.confidence` below 95, write `docs/ambiguities/<pack>_<code>_<slug>.md`, set `audit.ambiguityFile`, and file the engine issue. Never ship a placeholder that contradicts the printed text.
8. **Out-of-scope gaps become GitHub issues** (with printed text, evidence, acceptance criteria and a milestone), not silent notes.
9. **Gates before reporting done:** `npm test`, `npm run typecheck`, `npm run lint`, `npx prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}"` (all green), then `npm run report:declarations` after any supplemental change.
10. **After each item:** update `CHANGELOG.md` `[Unreleased]`, delete the plan file in the same commit, and update this file: remove the finished row from section 3 (do not keep a "done" list here; the commit and changelog are the record).
11. **Commit and push only when the owner asks.** Conventional Commits, one commit per issue where possible, `Fixes #N` only when the issue is fully done (`Refs #N` otherwise), end with the `Co-Authored-By` line used in recent commits. Verify the issue state after pushing.

### Practical pitfalls

Formatting, CRLF pack JSON, deterministic tests and commit mechanics are in `.agents/rules/coding-and-testing-rules.md`; PowerShell syntax in `.agents/rules/command-execution.md`.

- Shell commands start with `rtk` where the RTK policy applies (`rtk git status`, `rtk npm test`).
- Heredocs that contain apostrophes can break in the shell tool. Write multi-line files and scripts with the file-writing tool.
- A supplemental `target` must be a member of `TargetSelectorSchema`, and every `effectParams` key must be in `src/data/supplemental/effect-params.ts` (guard `tests/data/effect-params-keys.test.ts`). The reverse check (every key the engine reads is in the table) does not exist yet (#285), so verify by hand that the engine really reads a key you use.
- Every schema member needs a reader in code and a test (`tests/data/schema-member-coverage.test.ts`; temporary exceptions in `KNOWN_GAPS` of `tools/audit/schema-member-coverage.ts`).
- Keyword tags come only from printed keywords (`hasPrintedKeyword`, `getPrintedKeywordValue`); Crisis is an icon count, not a keyword.
- Quick data lookups: `npm run card:get -- <code>` (upstream plus supplemental), `npm run rule -- <term>`.
- Test helpers worth reusing: reveal path `step4_revealEncounterCards` (see `tests/engine/self-hero-cards.test.ts`), attack path `executeEnemyAttackSynchronously` (see `tests/engine/kree-manipulator-boost.test.ts`), ability use `dispatchAction({ type: 'USE_CARD_ABILITY' })` (see `tests/engine/mark-v-helmet.test.ts`).

---

## 3. Gate 1 work queue (ordered; the first open row is the next task)

Every row needs a plan file and the owner's approval before code (rule 1). Rows marked **owner decision** wait for an answer in chat (section 5). Chores outside the gates (Dependabot alerts, dependency updates) are not tracked here. Estimates are for one plan + TDD + gates cycle.

### 3.1 Bugs seen in real Rhino games (do first)

| #   | Issue                                                   | Item                                                                                                              | Estimate | Notes                                                                                                                                                                         |
| :-- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | [#303](https://github.com/SteveRodrigue/MCD/issues/303) | Villain stage change: same title keeps attachments, status cards, counters; HP from card data; activation resumes | 1 day    | Rhino I→II loses Charge / Armored Rhino Suit / Ivory Horn today; keep it generic (Klaw, Ultron reuse it)                                                                      |
| 5   | [#264](https://github.com/SteveRodrigue/MCD/issues/264) | Villain attack may not resume after declining Spider-Sense `01001a` (stepped villain phase)                       | ½ day    | Not reproduced yet: the first step is a failing test                                                                                                                          |
| 6   | [#233](https://github.com/SteveRodrigue/MCD/issues/233) | Caught Off Guard `01188`: no choice prompt for the upgrade to discard                                             | ½ day    | Owner 2026-10-10: tests prove a choice modal whenever 2+ upgrades / supports could be discarded, and a combat log entry names the discarded card; reproduce from the snapshot |

### 3.2 Rules gaps that affect core cards

| #   | Issue                                                   | Item                                                                                                      | Estimate | Notes                                                                                                                                                                                     |
| :-- | :------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------- | :------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | [#270](https://github.com/SteveRodrigue/MCD/issues/270) | `THWART` / `DEFENSE` ability labels and the status cancel (Confused cancels a thwart, Stunned an attack)  | 1 day    | 8 core cards carry a label (Backflip defense; Crisis Interdiction, Legal Practice, Mark V Helmet, Tactical Genius, Chase Them Down, For Justice!, Emergency thwart); False Alarm confuses |
| 8   | [#267](https://github.com/SteveRodrigue/MCD/issues/267) | Hand reactions: every eligible card of every player, starting with the first player (non-threat triggers) | 1 day    | #266 already fixed the threat window                                                                                                                                                      |
| 9   | [#273](https://github.com/SteveRodrigue/MCD/issues/273) | Empty player deck resets immediately and deals 1 encounter card; empty discard pile case                  | ½ day    |                                                                                                                                                                                           |
| 10  | [#206](https://github.com/SteveRodrigue/MCD/issues/206) | Identity printed traits are the union of both sides regardless of form                                    | ½ day    | Owner 2026-10-10: only visible traits count, so traits follow the current form plus traits granted by cards (e.g. Rocket Boots Aerial); the union tests change                            |
| 11  | [#271](https://github.com/SteveRodrigue/MCD/issues/271) | Events go to the discard pile intrinsically; remove `cost.discardSelf` from event data                    | ½ day    | Supplemental change on core events (owner approval)                                                                                                                                       |

### 3.3 Release gate: 100-game simulation (roadmap 1.4)

| #   | Issue                                                   | Item                                                                                             | Estimate | Notes                                                        |
| :-- | :------------------------------------------------------ | :----------------------------------------------------------------------------------------------- | :------- | :----------------------------------------------------------- |
| 12  | [#252](https://github.com/SteveRodrigue/MCD/issues/252) | Seeded, injectable RNG instead of `Math.random` (about 20 call sites, biased `sort` shuffles)    | 1 day    | Prerequisite of #304; also makes Dev Mode reports replayable |
| 13  | [#304](https://github.com/SteveRodrigue/MCD/issues/304) | 100 headless games, 5 core heroes vs Rhino, Standard and Expert, through the real scenario setup | 1–2 days | Today: 3 games, Spider-Man only, Standard only               |

### 3.4 UI should-haves

| #   | Issue                                                   | Item                                                                       | Estimate | Notes            |
| :-- | :------------------------------------------------------ | :------------------------------------------------------------------------- | :------- | :--------------- |
| 14  | [#301](https://github.com/SteveRodrigue/MCD/issues/301) | Top bar wraps to 2 lines on smaller screens and hides the top of the board | ½ day    | Dev Mode report  |
| 15  | [#282](https://github.com/SteveRodrigue/MCD/issues/282) | Visible "removed from game" pile                                           | ½ day    | Dev Mode request |
| 16  | [#287](https://github.com/SteveRodrigue/MCD/issues/287) | Players choose the order of simultaneous optional abilities                | 1 day    | Do after #267    |

**Gate 1 is done when** sections 3.1 to 3.4 are empty, the Gate 1 milestone has no open issue, and `npm run simulate` passes the 100-game gate.

---

## 4. Handoff protocol

Run the `next-task` skill (it reads this file). Plan anatomy and owner preferences: [README.md](README.md). Work outside Gate 1 (the other milestones) starts only when the owner asks.

---

## 5. Open decisions waiting for the owner

None. Decisions taken are recorded in the row they affect (section 3) and on the issue.
