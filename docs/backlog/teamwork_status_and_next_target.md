# MCD Backlog: Status and Work Queue

> **Last updated:** 2026-10-15 (Issue #312 UI z-axis layering delivered; queued Gate 1 issues #311, #306, and #314 "Call for Action")
> **Repository state:** `main`. Check `git log -1` and `git status` first.
> **Release gate:** Gate 1 ("Rhino Release" vertical slice: the 5 core heroes against Rhino, Standard and Expert).
> **Verification baseline:** 🟢 2,696 tests passing (0 failed, 0 skipped), 0 TypeScript diagnostics, 0 ESLint warnings, Prettier clean.
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

| #   | Issue                                                   | Item                                                                | Estimate | Notes                                               |
| :-- | :------------------------------------------------------ | :------------------------------------------------------------------ | :------- | :-------------------------------------------------- |
| 18  | [#311](https://github.com/SteveRodrigue/MCD/issues/311) | "I Object!" interrupt (01019b) not offered on villain-phase threat  | ½ day    | Dev Mode report; reporter calls it "Legal Practice" |

### 3.2 Rules gaps that affect core cards

| #   | Issue                                                   | Item                                                                     | Estimate | Notes                                          |
| :-- | :------------------------------------------------------ | :----------------------------------------------------------------------- | :------- | :--------------------------------------------- |
| 19  | [#306](https://github.com/SteveRodrigue/MCD/issues/306) | Retaliate damage goes through the damage pipeline (defeat, stage change) | 1 day    | Black Panther 01040a has Retaliate 1; see #303 |

### 3.3 Release gate: 100-game simulation (roadmap 1.4)

_None currently._

### 3.4 UI should-haves

| #   | Issue                                                   | Item                                                        | Estimate | Notes                                                     |
| :-- | :------------------------------------------------------ | :---------------------------------------------------------- | :------- | :-------------------------------------------------------- |
| 16  | [#287](https://github.com/SteveRodrigue/MCD/issues/287) | Players choose the order of simultaneous optional abilities | 1 day    | Do after #267                                             |
| 20  | [#314](https://github.com/SteveRodrigue/MCD/issues/314) | "Call for Action" from another player's tableau in coop     | 1 day    | Dev Mode report; Daily Bugle & tableau action integration |

**Gate 1 is done when** sections 3.1 to 3.4 are empty, the Gate 1 milestone has no open issue, and `npm run simulate` passes the 100-game gate.

---

## 4. Handoff protocol

Run the `next-task` skill (it reads this file). Plan anatomy and owner preferences: [README.md](README.md). Work outside Gate 1 (the other milestones) starts only when the owner asks.

---

## 5. Open decisions waiting for the owner

None. Decisions taken are recorded in the row they affect (section 3) and on the issue.
