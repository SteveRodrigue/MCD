# Handover — content folder refactor (next: M5c)

**Written:** 2026-11-01, at the end of M5b. For the next session or agent that continues the work. Nothing here is a decision; the decisions live in the documents it points to.

## 1. Where things stand

| Milestone | State | PR |
| --- | --- | --- |
| M0 ADR-0092, M1 audit, M2 pack format | merged | #518, #521, #522 |
| M4 content move, M4b sync CLI, M3 runtime loader | merged | #531, #535, #536 |
| M5a hooks and Wakanda Forever | merged | #538 |
| M5b main scheme abilities, Klaw as data, environments | **open, CI green** | #540 |
| Plans, as-built notes, Klaw review, this handover | **open, CI green** | #539 |
| **M5c** scenarios from packs, Ultron as the one script, delete `built-in/` | **next** (approved, not started) | |
| **M5d** defaults and literals (`'rhino'`, `'core'`) | after M5c (approved) | |
| M6 image cache per pack, M6b Tauri scaffold, M7 empty-shell UI, M8 leak guard and untracking `references/`, M9 editor on the storage driver, M10 docs split, M11 browser driver and distribution, M12 optional Core removal | roadmap only, see `plan_content_folder_refactor.md` | |

If #539 and #540 are merged when you start, `main` has everything below; if not, M5c needs #540's code, so branch from `feat/main-scheme-abilities` or wait for the merge.

## 2. Read first, in this order

1. [`AGENTS.md`](../../AGENTS.md) and the files it links (shared quality gates, coding and testing rules).
2. [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md): the architecture.
3. [`plan_content_m5_scenarios_and_hooks.md`](plan_content_m5_scenarios_and_hooks.md): sections 13 (as built) and 14 (checklist for M5c and M5d) are what you implement.
4. [`klaw_setup_as_data_review.md`](klaw_setup_as_data_review.md): why Klaw is data and the evidence method.
5. [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md): the decision log (Q1 to Q49) and the roadmap.
6. Only if needed: the M3 and M4 plans, whose "As built" sections list deviations.

## 3. Decisions to respect

- **Uniqueness decides where code lives (Q49).** What the existing effect primitives and the engine's concepts can express is data; one-off logic is a script in its pack (Wakanda Forever, Ultron's facedown Drone step). The Vision pack reproduces the Drone concept later and gets its own code then. Evidence beats opinion: count the cards across `content/packs/*/cards` before calling something unique.
- **Environments are an engine concept**, not scenario code. A revealed environment simply enters play like any other card type; do not add retention rules, other effects remove it.
- **A card cannot be created from nothing.** No fallback that fabricates a card; a search that finds nothing finds nothing.
- **Rules come from the Rules Reference** via `npm run rule -- <term>` (never open the PDF unless asked). The Search rule shuffles any searched deck; the Find rule excludes facedown encounter cards in in-play areas.
- **Accepted behavior changes (M5b):** shuffle after a deck search, Klaw's stage 2A reveal resolves on advance, the correct Defense Network (`01125`), revealed environments enter play. Anything beyond these needs a decision.
- **No tech debt, no dual paths, no shims.** Fix debt in the path of the change in the same change, delete what a change makes obsolete, merge similar functions.
- Official hook scripts may import any `@engine` module (build time, trusted). User packs are JSON-only until a sandbox ADR.
- Pack ids match `^[a-z][a-z0-9_-]{1,31}$`; the enabled packs are listed in `content/config.json`; the card catalog is filled once at boot by `bootContent`.

## 4. How the user wants to work

- **Plan first, then stop for approval** before changing source (AGENTS.md). M5c and M5d are approved; anything new needs a plan.
- **Delivery only on an explicit request** in the current message ("commit and push", "merge"). `main` is protected: work on a branch, open a PR, wait for CI, squash-merge only when asked. Check `gh pr list --state open` before pushing and before merging.
- **One worktree per task** (`git worktree add -b <branch> ../MCD-<name> origin/main`), with `node_modules` as a directory junction to the main checkout. **Remove the junction first** (PowerShell: `[System.IO.Directory]::Delete(path)`) before removing a worktree, or the delete can follow the link. Stop any dev server you started (find it by port).
- Stage files **by name**; a hook blocks `git add -A`/`.`. Commit and pre-push hooks run typecheck, lint, `docs:check` and the full test suite, and regenerate `docs/reports/supplemental_data`. Never bypass them.
- Short answers, lead with the action, numbered steps, one concrete next step. Ask only for decisions that are the user's.
- The user corrects over-engineering and unproven claims quickly. State what you verified and how; when wrong, say so and fix the document, not just the code.

## 5. Verification recipe (per PR, after the last edit)

```bash
npm run schema:generate          # also rebuilds the pack hook map
npx tsc --noEmit
npm run lint && npm run format:check
npm run docs:check && npm run deadcode
npm run pack:validate -- content/packs
npx vitest run                   # full suite (the pre-push hook runs it too)
npm run simulate -- --no-stats   # compare with a clean `main` run, byte for byte
```

- **Parity baseline:** run `simulate --no-stats` on a clean `origin/main` worktree first and keep `logs/simulations/replay_catalog.json` and `simulation_summary.md`; `git checkout -- logs/simulations` afterwards (those files are tracked). Without `--no-stats` a local `stats/` file steers the Gauntlet and runs differ.
- **Digests:** `tests/engine/scenario-setup-digests.test.ts` (12 golden digests) must stay unchanged in M5c and M5d.
- **Browser check** for UI-visible changes: start `npx vite --port <free port> --strictPort` from the worktree, drive the real app (select a scenario, start the mission, confirm the setup), read the console, then stop the server.

## 6. Gotchas learned

- A supplemental entry that fails schema validation disables the whole Core pack silently in the app; the test setup now throws. `SETUP` abilities have no `trigger`.
- The card data hash in the `simulate` summary is a `JSON.stringify` of every Core ability: key order matters, and adding abilities changes it (so "byte-identical" holds only when the ability inventory is unchanged).
- Vite serves JSON imported from `content/` at `/content/...`; the loader's endpoint is `/__content/`.
- `docs:check` checks relative links and (outside `docs/backlog`, `docs/reports`, ADR bodies) backticked paths; a doc must be linked from another doc or be an ADR or backlog file. Do not link to files that exist only on an unmerged branch.
- In this harness's bash tool, long heredocs with backslashes can be mangled (a `\n` becomes a real newline); write files with the Write tool or a script file.
- A `git worktree remove` of a folder that still holds a running dev server or an open terminal fails on Windows; stop the process first.

## 7. Open items outside M5c and M5d

- **#534:** `npm run simulate -- --balance` crashes at game 39 (ally attack scans triggers with no players); Gate 1; independent of the refactor.
- Gate 2 plug-in work (#275): the facedown-minion concept (Ultron's villain stages, Vision), later main scheme stages of Ultron, the `ScenarioSelector` empty state is M7.
- M3 leftovers: the two `knip` ignore entries (`src/data/index.ts`, `src/data/card-loader.ts`) were not reviewed; the test suite is about 10% slower because the supplemental schema is imported into each test file.
- M12 (removing the Core pack from the repository) stays optional and parked; Q1 and Q2 of the roadmap (where official supplemental data would live, git history) reopen only with it.

## 8. Prompt for the next session

```text
You are continuing the "content folder refactor" of Marvel Champions Digital (repository
SteveRodrigue/MCD). Your task is milestone M5c, then M5d. The approved plan is in the repository;
do not redesign it.

1. Read, in order: AGENTS.md (and the rules it links), docs/backlog/handover_content_refactor.md
   (the whole file, including sections 3 to 6), docs/decisions/0092-content-packs-and-runtime-loading.md,
   docs/backlog/plan_content_m5_scenarios_and_hooks.md (sections 3.2, 3.3, 3.5, 13 and 14),
   docs/backlog/klaw_setup_as_data_review.md.
2. Check the state: `git fetch`, `gh pr list --state open`, and whether PRs #539 and #540 are
   merged. If #540 is not merged, say so before doing anything and ask whether to wait or to
   branch from feat/main-scheme-abilities.
3. Create a worktree from the up-to-date main (node_modules as a junction), capture the parity
   baseline (`npm run simulate -- --no-stats` on a clean main, save replay_catalog.json and
   simulation_summary.md, then `git checkout -- logs/simulations`).
4. Implement M5c exactly as section 14 of the plan says: listDirs, scenario loading in the
   content loader, setupOnomatopoeia in the definition schema and the three definition.json
   files, PackHooks.scenarioHooks with ScenarioHooks.resolveStage1BReveal, a single
   DeclarativeScenarioPlugin(definition, hooks?), the Ultron script in
   content/packs/core/scripts/scenarios/ultron.ts, applyContent/resetContent registering and
   clearing scenarios, deletion of src/engine/scenarios/built-in/ and the import-time
   registration, tests, and the rewrite of docs/guidelines/scenario_creation_guide.md.
   The 12 digests in tests/engine/scenario-setup-digests.test.ts must not change, and
   `simulate --no-stats` must be byte-identical to main.
5. Verify with the recipe in section 5 of the handover, including a browser check that the
   scenario selector lists Rhino, Klaw and Ultron in that order and a game starts for each.
6. Stop and report. Do not commit, push, open a PR or merge until the user says so in a message.
   When asked, stage files by name, open the PR from the PR template, and wait for CI.
7. M5d (section 3.5 and 14 of the plan) is a separate PR after M5c is merged.

Working rules that matter: evidence over opinion (count the upstream cards before calling
something unique), no card created from nothing, no tech debt or dual paths, rules questions via
`npm run rule -- <term>`, short answers that lead with the next action. Record deviations from the
plan in section 13 of the plan in the same PR, and keep the handover current.
```
