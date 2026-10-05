# Handoff prompt (paste to a new agent or send to a developer)

Last reviewed 2026-10-05. If the repository has moved on, trust `git log` and the status file over this text.

---

## Short version (paste this)

```text
Continue work on Marvel Champions Digital in C:\Users\steve\repos\MCD (branch main).

1. Run `git pull`, `git status`, `npm test` (baseline: 1,838 tests green; #217 is a known flaky test, rerun it).
2. Read in order: AGENTS.md, docs/backlog/README.md, docs/backlog/teamwork_status_and_next_target.md.
3. Take the first READY item of section 3 of the status file that nobody else has claimed (3.1 first: cards that
   misplay today; then the engine prerequisites). Say which item you took.
4. Write docs/backlog/plan_<topic>.md (follow plan_issue_222_self_hero_selector.md) and STOP for my approval.
   For cards: follow the card-integration-protocol skill (printed text, original data, proposed data, why).
5. After approval: failing test first, then the fix, then docs (spec, ADR/addendum, Card Editor when the schema
   changes), CHANGELOG.md [Unreleased], the plan status, the two living trackers and the status file.

Rules that are easy to miss:
- Read cards literally. "Your hero" = SELF_HERO (never the alter-ego); "you"/"take damage" = SELF_IDENTITY.
  Official errata (references/rules/appendices/05_card_errata.md) beat the printed text. Never touch audit.comment.
- Use `npm run rule -- <term>` / references/rules/, never the raw PDF.
- Engine primitives are generic (no card names, ADR-0021); card behaviour stays declarative in src/data/supplemental/.
- A schema change also updates schema.ts, `npm run schema:generate`, the spec in docs/specifications/supplemental/,
  the Card Editor registry (src/ui/components/editor/) and a test.
- If a card cannot be modelled faithfully: strip its ability, lower audit.confidence, write docs/ambiguities/<file>.md,
  set audit.ambiguityFile, file the engine issue. Never ship a placeholder that contradicts the printed text.
- File a GitHub issue for every gap you find that is out of scope.
- Format only the files you changed with Prettier (never whole folders). Write multi-line files with the file tool,
  not shell heredocs with apostrophes. Pack JSON files use CRLF: edit textually or round-trip with indent=2,
  ensure_ascii=False, trailing newline, original line endings; check `git diff --stat` stays small.
- Gates before reporting: npm test, npm run typecheck, npm run lint,
  npx prettier --check "src/**/*.{ts,tsx}" "tests/**/*.{ts,tsx}"; npm run report:declarations after data changes.
- Commit and push ONLY when I explicitly ask. Conventional Commits, `Fixes #N` only when the issue is fully done
  (`Refs #N` otherwise), end with the Co-Authored-By line used in recent commits, verify the issue state afterwards.

Be concise. Lead with the next action, number multi-step work, and ask me one question at a time.
```

---

## Where to find things

| Need | Where |
| :-- | :-- |
| What to do next, in order | `docs/backlog/teamwork_status_and_next_target.md` section 3 |
| Plan template by example | `docs/backlog/plan_issue_222_self_hero_selector.md`, `plan_issue_218_surge_keyword.md` |
| The two living trackers | `plan_core_player_cards_review.md`, `plan_effect_params_remediation.md` |
| Why `effectParams` keys are risky | `docs/reports/effect_params_orphan_audit.md` |
| Schema and effect specifications | `docs/specifications/supplemental/` (03 targets, 05 to 08 effects, 09 formulas, 10 gates and prompts) |
| Design decisions | `docs/decisions/` (ADR-0021 no card names, ADR-0049 conditions and gates, ADR-0058 taxonomy, ADR-0020 triggers) |
| Blocked cards and why | `docs/ambiguities/` |
| Open work | GitHub issues of `SteveRodrigue/MCD` |

## Good first items for a new person (all independent, all small)

1. [#244](https://github.com/SteveRodrigue/MCD/issues/244): Weapons Runner `01121` has no supplemental entry (`01158` is done; `01185` waits on #209).
2. Triage the in-app bug reports [#233](https://github.com/SteveRodrigue/MCD/issues/233) to [#240](https://github.com/SteveRodrigue/MCD/issues/240) with the `problem-report-triage` skill and deduplicate them.
3. [#221](https://github.com/SteveRodrigue/MCD/issues/221) (damage gate) or [#223](https://github.com/SteveRodrigue/MCD/issues/223) (named minion attack): self-contained engine primitives, each unblocks one stripped card.

## Pending questions for the owner

Listed in section 5 of the status file (B4, C9, C10, C13, Repulsor Blast, scheduling of the data read-through and #243).
