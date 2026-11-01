# Handover — content folder refactor (next: M9)

**Written:** 2026-11-01, at the end of M5b; updated the same day for the agent policy of PR #541 (autonomy and stop policy, game-first plans, delivery authorization). For the next session or agent that continues the work. Nothing here is a decision; the decisions live in the documents it points to.

## 1. Where things stand

| Milestone | State | PR |
| --- | --- | --- |
| M0 ADR-0092, M1 audit, M2 pack format | merged | #518, #521, #522 |
| M4 content move, M4b sync CLI, M3 runtime loader | merged | #531, #535, #536 |
| M5a hooks and Wakanda Forever | merged | #538 |
| M5b main scheme abilities, Klaw as data, environments | merged | #540 |
| Plans, as-built notes, Klaw review, first handover | merged | #539 |
| M5c scenarios from packs, Ultron as the one script, `built-in/` deleted | merged (see plan section 13) | #544 |
| M5d defaults and literals (`'rhino'`, `'core'`) | merged (see plan section 13) | this PR |
| M6 image cache per pack ([plan](plan_content_m6_image_cache.md)) | merged | #546 |
| M7 empty-shell UI ([plan](plan_content_m7_empty_shell_ui.md)) and M8 leak guard ([plan](plan_content_m8_leak_guard.md)): M8 merged (#551), M7 implemented (PR open) | plans only | |
| M9 editor on the storage driver, M10 docs split, M11 browser driver and distribution, M12 optional Core removal | roadmap only, see `plan_content_folder_refactor.md`. M6b (Tauri desktop app) is parked: issue #548, Q55. | |

`main` has everything above up to M6. PR #541 changed the agent rules (see section 4); read them in `AGENTS.md` and `.agents/rules/shared-quality-gates.md` (Stop policy, Plan and approval gate, In-Game Scenario, Delivery authorization), because they replace what earlier sessions did.

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

- **Follow the current policy in `AGENTS.md`, not the habits of earlier sessions.** Stop and ask only for plan approval, confidence below 95%, a plan deviation, a destructive action, or a failure that survives two fix attempts; decide everything else, list it under **Decisions I made** in the recap, and continue. Approval is per session: the M5 plan (M5c and M5d included) was approved "as recommended" in the previous session, so ask the user **once** to confirm it before implementing.
- **Delivery runs through `commit-and-push`** and is authorized when the user asks, or automatically once an approved plan is implemented, verified (targeted checks, parity) and has no open plan deviation. Otherwise offer and wait. `main` is protected; never bypass hooks or branch protection; check `gh pr list --state open` before pushing and before merging, and report a red or blocked PR instead of working around it.
- **Plans open with an In-Game Scenario** (setup, what the player does, today, after, the rule that decides it, in table language), and the recap repeats it as **Try it in game**. Section 14 of the M5 plan has the scenarios for M5c and M5d.
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

## 8. Next session

M5 and M6 are done and the desktop app is parked (Q55, [issue #548](https://github.com/SteveRodrigue/MCD/issues/548)). The M7 and M8 plans are drafted and wait for the user's review (their last sections list the open decisions): [M7](plan_content_m7_empty_shell_ui.md) (empty-shell welcome screen and pack list) and [M8](plan_content_m8_leak_guard.md) (untrack the PDFs only, keep the scripts and generated Markdown per Q56, plus the leak guard). Once the user answers, log the decisions in `plan_content_folder_refactor.md` and implement. The old root `cache/` folder still exists on purpose (Q51): a small cleanup PR removes its ignore entries (`.gitignore`, `.vscode/settings.json`, the `code-audit` skill, the `**/cache/**` watch ignore in `vite.config.ts`) once the user asks for it.
