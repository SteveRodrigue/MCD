# MCD Backlog: Status and Work Queue

> **Last updated:** 2026-11-06 (Gates 1 and 2 have no open issue; #618 delivered)
> **Repository state:** `main`. Check `git log -1` and `git status` first.
> **Active gate:** the open `Gate N` milestone with the lowest N that still has open issues (today Gate 3, Green Goblin).
> **Verification baseline:** run `npm run verify` (tests, types, lint, format, build). The pre-push hook enforces 0 failed and 0 skipped tests; no test count is recorded here because it goes stale with every commit.
> **This file is the entry point for anyone (person or agent) picking the work up.** Run the `next-task` skill: it takes the first open row of section 3, or falls back on the active gate milestone when the queue is empty.

---

## 1. Where we are

The Gate 1 and Gate 2 milestones have no open issue. The only open issue in Gate 3 is #291.

Open work lives in **GitHub milestones**, one per release gate. Every open issue belongs to exactly one:

| Milestone                                                                                    | Scope                                                                       |
| :------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| [Gate 1 — Rhino Release](https://github.com/SteveRodrigue/MCD/milestone/2)                   | Core heroes vs Rhino, rules-verified, 100-game simulation. No open issue    |
| [Gate 2 — Klaw & Ultron](https://github.com/SteveRodrigue/MCD/milestone/3)                   | Klaw, Ultron, 4 Core modular sets, Scenario Plug-In & Editor overhaul. No open issue |
| [Gate 3 — Green Goblin (MC02)](https://github.com/SteveRodrigue/MCD/milestone/4)             | **Active.** MC02 double-sided villain form flip (#470), Risky Business, Mutagen Formula |
| [Gate 4 — Wrecking Crew (MC03)](https://github.com/SteveRodrigue/MCD/milestone/5)            | MC03 multi-villain scenario, per-villain decks/schemes, active counter      |
| [Gate 5 — Expansions & Advanced Mechanics](https://github.com/SteveRodrigue/MCD/milestone/7) | Advanced mechanics not yet implemented or incomplete                        |
| [Tech Debt & Tooling](https://github.com/SteveRodrigue/MCD/milestone/6)                      | Refactors, guards, tooling; no gate depends on them                         |
| [Undetermined — Multiplayer Co-op](https://github.com/SteveRodrigue/MCD/milestone/8)         | Far future: 2–4 player tabletop, Alliance, Team-Up, cross-player triggers   |
| [UI theming](https://github.com/SteveRodrigue/MCD/milestone/9)                               | Theme follow-ups: font choice, naming, thumbnail frame                      |

New issues get a milestone at triage.

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
10. **After each item:** add a changelog fragment `changes/unreleased/<issue>-<slug>.md` (format: `changes/README.md`; never edit `CHANGELOG.md`), delete the plan file in the same commit, and update this file: remove the finished row from section 3 (do not keep a "done" list here; the commit and changelog are the record).
11. **Delivery** runs when the owner asks, or automatically once an approved plan is implemented and verified. `main` is protected: branch, commit, push, pull request, CI, squash-merge (the `commit-and-push` skill does the chain). Conventional Commits, one commit per issue where possible, `Fixes #N` only when the issue is fully done (`Refs #N` otherwise), end with the `Co-Authored-By` line used in recent commits. Verify the issue state after the merge.

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

## 3. Work queue (ordered; the first open row is the next task)

Every row needs a plan file and the owner's approval before code (rule 1). Rows marked **owner decision** wait for an answer in chat (section 5). Chores outside the gates (Dependabot alerts, dependency updates) are not tracked here.

No open row. `next-task` falls back on the active gate milestone.

---

## 4. Handoff protocol

Run the `next-task` skill (it reads this file). Plan anatomy and owner preferences: [README.md](README.md). Work outside the active gate starts only when the owner asks.

---

## 5. Open decisions waiting for the owner

Nothing is waiting for your answer.

Decisions taken are recorded in the row they affect (section 3) and on the issue.

### Filed outside the active gate (not queued)

Milestone Undetermined — Multiplayer Co-op, simulation follow-ups: [#309](https://github.com/SteveRodrigue/MCD/issues/309) further win-rate tuning beyond the two 4-iteration passes (`02a57dbd`; pass results in `git show f617608f:docs/backlog/plan_issue_309_strategic_player_bot.md`, sections 9 to 11).

Milestone Tech Debt & Tooling, from the legality gate review (ADR-0090): all delivered (#365 to #367, #457 and #370 to #372).

Milestone UI theming: [#374](https://github.com/SteveRodrigue/MCD/issues/374) player font choice (N7; earlier analysis in `git show c2f517f6:docs/templates/modals/PLAN_fonts.md` and `PLAN_game_integration.md`); [#375](https://github.com/SteveRodrigue/MCD/issues/375) rename `ModalStyle` to `ThemeStyle`; [#376](https://github.com/SteveRodrigue/MCD/issues/376) `CardArtThumbnail` frame follows the theme.

Milestone Gate 5:

Missing triggers removed as dead code in `a6c5542` (Card Editor re-architecture, #319). Each issue lists the candidate cards, a recommended evidence card and the engine work; restore the old dispatch sites with `git show a6c5542`. Milestone: Gate 5.

- [#320](https://github.com/SteveRodrigue/MCD/issues/320) `CARD_DISCARDED` ("After X is discarded"): evidence card Digging Deep 40060.
- [#321](https://github.com/SteveRodrigue/MCD/issues/321) `WHEN_BOOST_CARD_REVEALED` ("When a boost card is turned faceup"): evidence card Target Acquired 08024.
- [#322](https://github.com/SteveRodrigue/MCD/issues/322) `CARD_LEFT_PLAY` ("When X leaves play"): evidence card Cosmo 21180b.
