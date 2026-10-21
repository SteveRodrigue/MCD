---
name: commit-and-push
description: 'Inspect staged/unstaged changes, run quality gates, format Conventional Commit messages, and push when explicitly requested by user. Trigger on "commit and push" or prefixed with "commit-and-push:".'
---

# 🚀 Commit-and-Push Protocol (Clean Delivery & Quality Gate Workflow)

**Shared rules:** Apply [`.agents/rules/shared-quality-gates.md`](../../rules/shared-quality-gates.md), including path, command, verification, and delivery authorization policies.

A commit and push only ever happen in response to the user's explicit request in the current message (e.g. "commit and push", "commit this", or the skill's trigger prefix); the agent never initiates delivery on its own.

**Needs:** `rtk` (see [`antigravity-rtk-rules.md`](../../rules/antigravity-rtk-rules.md)), Node.js with `npm ci`, and the GitHub CLI authenticated via `gh auth login` (check with `gh auth status`).

---

Copy this checklist and tick each step as you go:

- [ ] Step 1: Inspect the working tree, delete completed plans, update progress docs, and record the intended file set
- [ ] Step 2: Format and stage by name
- [ ] Step 3: Rely on the git hooks (no manual gate runs)
- [ ] Step 4: Pick category and scope
- [ ] Step 5: Write the commit message
- [ ] Step 6: Validate issue references, then commit
- [ ] Step 7: Push and verify

If the pre-commit or pre-push hook fails, fix the cause, re-stage, and go back to Step 6 to make a new commit. If a staged path is not in the intended file set, unstage it and go back to Step 2.

---

## 🔍 Step 1: Inspect Working Tree & Changes

1. Run `rtk git status` to detect staged, unstaged, and untracked files.
2. Run `rtk git diff` and `rtk git diff --cached` to inspect the exact lines of code changed.
3. Verify that no unwanted files (e.g. debug scripts in `scratch/`, OS artifacts, temporary logs) are inadvertently staged.
4. Record the intended file set. Do not silently absorb unrelated staged or unstaged changes.
5. Check the progress documentation: if the change completes a plan, delete that plan file in the same delivery, and update the queue, status headers, and any other progress or tracking document (e.g. `docs/backlog/`) the change affects. Include these files in the intended file set.

---

## 📦 Step 2: Stage Target Changes

1. Format only the modified TS/TSX/JS files before staging so `.githooks/pre-commit` passes on the first try:
   ```sh
   rtk npx prettier --write <modified-ts-tsx-js-files>
   ```
2. Stage intentional changes by name:
   - For complete feature/fix deliveries: stage the reviewed file list explicitly (`rtk git add <file1> <file2> ...`).
   - A hook blocks `git add .`, `-A`, `--all`, and `git commit -a`, because a broad stage commits unrelated work.
3. If supplemental card data (`src/data/supplemental/`) was modified and `report:declarations` has not yet been run since the last data edit:
   - Run `rtk npm run report:declarations`
   - Stage the updated reports: `rtk git add docs/reports/supplemental_data/ docs/reports/supplemental_declarations_usage_report.md`
4. Re-run `rtk git diff --cached --name-status` and confirm every staged path belongs to the intended file set.

---

## 🛡️ Step 3: Rely on Git Hooks (No Duplicate Manual Runs)

Do **not** manually run `npm run format:check`, `npm run lint`, `npm run typecheck`, or `npm test` before committing:
- `git commit` automatically triggers `.githooks/pre-commit` (`format:check`, `lint`, `typecheck`).
- `git push` automatically triggers `.githooks/pre-push` (`npm test` enforcing 0 failures and 0 skipped tests).
- Running them manually in Step 3 duplicates every check back-to-back. Only run a targeted check manually if a hook fails and you are diagnosing the fix.

---

## 🏷️ Step 4: Category & Scope Selection Matrix

Select the appropriate Conventional Commits category and scope based on the modified files:

### Category Table

| Category   | Usage & Criteria                                                  | Example Scenarios                                          |
| :--------- | :---------------------------------------------------------------- | :--------------------------------------------------------- |
| `feat`     | New capability, effect primitive, mechanic, UI component, or rule | Adding `SUFFERED_DAMAGE`, new card ability, form toggle    |
| `fix`      | Correcting a defect, rule violation, wrong target, or regression  | Fixing cost calculation, card timing, missing status check |
| `test`     | Adding, updating, or fixing tests without source code change      | Adding contract tests, fixing test flakiness, determinism  |
| `docs`     | Documentation updates, specifications, ADRs, report updates       | Updating roadmap, README, rules references, ADR records    |
| `refactor` | Code reorganization or optimization with zero functional change   | Extracting helper functions, renaming internal variables   |
| `style`    | Code style, Prettier formatting, semicolon adjustments            | Formatting files, fixing trailing spaces                   |
| `chore`    | Maintenance tasks, dependencies, git hooks, build configs         | Updating `.githooks`, `package.json`, Vite config          |

### Scope Matrix

| Subsystem Modified                                                                                                                                                            | Recommended Scope                     |
| :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| `src/engine/` (State, actions, combat, triggers, phases)                                                                                                                      | `(engine)`                            |
| `src/ui/` (Components, views, modals, layouts, styles)                                                                                                                        | `(ui)`                                |
| `src/data/supplemental/` (Pack JSONs, card declarations)                                                                                                                      | `(data)`                              |
| `src/data/importer/` (Card loader, normalization, i18n)                                                                                                                       | `(importer)`                          |
| `src/tools/` or `tools/` (Analyzers, CLI tools, scripts)                                                                                                                      | `(tooling)`                           |
| `changes/` (changelog fragments), `docs/` (all files, any depth) and root-level `.md` files (`README.md`, `CHANGELOG.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`) | `(docs)`                              |
| `.githooks/` or `.github/` (Hooks, workflows, CI)                                                                                                                             | `(hooks)` or `(ci)`                   |
| Test files in `tests/` across subsystems                                                                                                                                      | `(tests)` or matching subsystem scope |

---

## ✍️ Step 5: Formulate Concise Commit Message

### 1. If Description Was Provided by User:

- Normalize into Conventional Commits: `<category>(<scope>): <Description in imperative mood>`
- Check if an open GitHub issue relates to the task; append `(Fixes #X)` or `(Closes #X)` if applicable.

### 2. If Description Was NOT Provided by User:

Analyze the staged git diff and synthesize a concise, informative title adhering to these rules:

- **Imperative Mood:** Use "Add", "Fix", "Implement", "Update" (never "Added", "Fixing", "Updated").
- **Length Constraint:** Header must be $\le 72$ characters.
- **Accurate Scope:** Reference the primary subsystem or card code (e.g. `fix(data): Update Gamma Slam target to CHOSEN_ENEMY`).
- **Detailed Body (Optional):** For multi-file changes, include a bulleted summary of key changes below the header.

### 3. State the Commit Message:

State the formulated message before committing, so the change is traceable in the transcript:

```text
Commit:
  category: <category>
  scope:    <scope>
  message:  <category>(<scope>): <description>
```

---

## Step 6: Issue Integrity and Commit

Before committing, inspect issue references in the staged diff and commit message.

1. Extract explicit references such as `Fixes #123`, `Closes #123`, `Refs #123`, and `Issue #123`. Do not treat card IDs, ADR numbers, or arbitrary `#` text as GitHub issue references.
2. If no issue references exist, record `Issue validation: not applicable` and continue.
3. If references exist, confirm GitHub CLI availability and authentication with `gh auth status`.
4. Query every referenced issue:

   ```sh
   gh issue view <NUM> --json number,state,title,url
   ```

5. Before commit, enforce these conditions:
   - `Fixes` and `Closes` references point to an existing **open** issue.
   - `Refs` and informational references point to an existing issue; either state is valid.
   - A closed issue must not receive a new `Fixes` or `Closes` trailer. Change it to `Refs`, or stop and ask the user only for this specific conflict.
6. If GitHub is unavailable or unauthenticated, stop before committing when issue references require validation. Report the exact limitation; do not claim validation succeeded.
7. Once quality gates (Step 3) and issue validation pass, commit directly without a separate approval round-trip:

```sh
rtk git commit -m "<category>(<scope>): <description>"
```

_Note:_ The pre-commit hook in `.githooks/pre-commit` will automatically execute `format:check`, `lint`, and `typecheck`. Verify that it passes with code 0.

---

## 🚀 Step 7: Native Git Push & Final Verification

1. Since the user's request already authorized commit and push together, push to the remote tracking branch directly after a successful commit:
   ```sh
   rtk git push
   ```
2. Verify the pre-push hook executes `npm test` cleanly with **0 failures and 0 skipped tests** (`passed: N, failed: 0, skipped: 0`).
3. Re-query every referenced issue after push:
   ```sh
   rtk gh issue view <NUM> --json number,state,closedAt,title,url
   ```
   - For `Fixes` and `Closes`, verify the issue is now `CLOSED`.
   - For `Refs` and informational references, report the current state and URL; do not claim the issue was closed.
   - If the expected state is not reached, report the post-push discrepancy explicitly instead of treating the delivery as fully verified.
4. Run `rtk git status` to verify:
   - Working tree is clean (`nothing to commit, working tree clean`).
   - Branch is up to date with its remote tracking branch (`Your branch is up to date with 'origin/<branch>'`).
