# MCD Backlog: Status and Work Queue

> **Last updated:** 2026-10-19 (code audit AUD-20261017-232534 remediated; R1–R7 delivered; remaining work R8–R16 in section 3.5)
> **Repository state:** `main`. Check `git log -1` and `git status` first.
> **Release gate:** Gate 1 ("Rhino Release" vertical slice: the 5 core heroes against Rhino, Standard and Expert).
> **Verification baseline:** 🟢 3,053 tests passing (0 failed, 0 skipped), 0 TypeScript diagnostics, 0 ESLint warnings, Prettier clean.
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

_None currently._

### 3.2 Rules gaps that affect core cards

_None currently._

### 3.3 Release gate: 100-game simulation (roadmap 1.4)

_None currently._

### 3.4 UI should-haves

_None currently._

### 3.5 Code audit AUD-20261017-232534: remaining work

The 21 findings were remediated on 2026-10-17/18 (`94ebc97..f6e470f`, pushed). What is left is one plan per row below (`plan_audit_rNN_*.md`, each with rules/spec analysis, Simplification & Refactor Check, file changes, tests, open decisions, UI impact). Every plan still needs the owner's approval before code (rule 1). Work the rows in this order; R16 runs last.

| #   | Item                                                                                             | Gate / milestone   | Tier | Estimate   | Plan                                                                                             |
| --- | ------------------------------------------------------------------------------------------------ | ------------------ | ---- | ---------- | ------------------------------------------------------------------------------------------------ |
| R8  | One game session context; UI settings out of `state.options` — **owner decision** (OQ-3)         | Tech Debt          | 2    | 1–1.5 days | [plan_audit_r08_ui_session_context.md](plan_audit_r08_ui_session_context.md)                     |
| R9  | Klaw II When Revealed at Expert setup; The "Immortal" Klaw as a side scheme — **data approval**  | Gate 2             | 2    | 3–4 h      | [plan_audit_r09_klaw_ii_setup_reveal.md](plan_audit_r09_klaw_ii_setup_reveal.md)                 |
| R10 | Inject the card catalog (F014-B); close out #275 — **owner decision**                            | Tech Debt / Gate 2 | 3    | 2–3 days   | [plan_audit_r10_catalog_injection.md](plan_audit_r10_catalog_injection.md)                       |
| R11 | Engine kernel to break the 31-module import cycle (F014-C) — **owner decision**                  | Tech Debt          | 3    | 3+ days    | [plan_audit_r11_engine_kernel.md](plan_audit_r11_engine_kernel.md)                               |
| R12 | Structural sharing for state updates (Immer?) — **owner decision**; after R8                     | Tech Debt          | 3    | 2–3 days   | [plan_audit_r12_structural_sharing.md](plan_audit_r12_structural_sharing.md)                     |
| R13 | Remove `state.villain` / `mainScheme` (F016, #215) — **deferred by owner** to multi-villain work | Gate 4             | 3    | 1 day      | [plan_audit_r13_remove_legacy_state_pointers.md](plan_audit_r13_remove_legacy_state_pointers.md) |
| R14 | Shared test fixtures; drop test-only execution frames (F013) — **deferred** (after R13)          | Tech Debt          | 1    | 1 day      | [plan_audit_r14_shared_test_fixtures.md](plan_audit_r14_shared_test_fixtures.md)                 |
| R15 | Audit open questions: log growth, art fallback CORS, bundled packs                               | Tech Debt          | 1    | 2–4 h      | [plan_audit_r15_open_questions.md](plan_audit_r15_open_questions.md)                             |
| R16 | Review all documentation (ADRs, specs, guides) against the code — **last, after R1–R15**         | Tech Debt          | 1    | 1–2 days   | [plan_audit_r16_documentation_review.md](plan_audit_r16_documentation_review.md)                 |

**Gate 1 is done when** sections 3.1 to 3.4 are empty (R2, the last Gate 1 row of section 3.5, is delivered), the Gate 1 milestone has no open issue, and `npm run simulate` passes the 100-game gate.

---

## 4. Handoff protocol

Run the `next-task` skill (it reads this file). Plan anatomy and owner preferences: [README.md](README.md). Work outside Gate 1 (the other milestones) starts only when the owner asks.

---

## 5. Open decisions waiting for the owner

From the audit plans (section 3.5); each plan states the options and a recommendation:

- R8 (OQ-3): are `autoResolveUnambiguous` / `villainPhaseStepping` UI preferences (pass per dispatch) or engine options?
- R9: approve the supplemental data change for Klaw II (01114) and The "Immortal" Klaw (01127).
- R10, R11, R12: Tier 3 design choices (catalog injection, engine kernel, structural sharing).

Decisions taken are recorded in the row they affect (section 3) and on the issue.

### Filed outside Gate 1 (not queued)

Missing triggers removed as dead code in `a6c5542` (Card Editor re-architecture, #319). Each issue lists the candidate cards, a recommended evidence card and the engine work; restore the old dispatch sites with `git show a6c5542`. Milestone: Gate 4.

- [#320](https://github.com/SteveRodrigue/MCD/issues/320) `CARD_DISCARDED` ("After X is discarded"): evidence card Digging Deep 40060.
- [#321](https://github.com/SteveRodrigue/MCD/issues/321) `WHEN_BOOST_CARD_REVEALED` ("When a boost card is turned faceup"): evidence card Target Acquired 08024.
- [#322](https://github.com/SteveRodrigue/MCD/issues/322) `CARD_LEFT_PLAY` ("When X leaves play"): evidence card Cosmo 21180b.
