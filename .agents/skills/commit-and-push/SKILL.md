---
name: commit-and-push
description: 'Inspect staged/unstaged changes, run quality gates, format Conventional Commit messages, and push when explicitly requested by user. Trigger on "commit and push" or prefixed with "commit-and-push:".'
---

# 🚀 Commit-and-Push Protocol (Clean Delivery & Quality Gate Workflow)

**Shared rules:** Apply [`.agents/rules/shared-quality-gates.md`](../../rules/shared-quality-gates.md), including path, command, verification, and delivery authorization policies.

A commit and push only ever happen in response to the user's explicit request in the current message (e.g. "commit and push", "commit this", or the skill's trigger prefix); the agent never initiates delivery on its own.


---

## Commit Preparation Lifecycle

```mermaid
flowchart TD
    S1["1. Inspect Working Tree & Status (git status, git diff)"] --> S2["2. Stage Changes & Clean Working Tree (git add)"]
    S2 --> S3["3. Execute Quality Gates (format, lint, typecheck, tests)"]
    S3 --> S4["4. Categorize & Select Scope (Conventional Commits)"]
    S4 --> S5["5. Formulate Concise Commit Message (Auto-Generate if Absent)"]
      S5 --> S6["6. Validate issue references, then commit"]
      S6 --> S7["7. Push and run final verification"]
```

---

## 🔍 Step 1: Inspect Working Tree & Changes

1. Run `git status` to detect staged, unstaged, and untracked files.
2. Run `git diff` and `git diff --cached` to inspect the exact lines of code changed.
3. Verify that no unwanted files (e.g. debug scripts in `scratch/`, OS artifacts, temporary logs) are inadvertently staged.
4. Record the intended file set. Do not silently absorb unrelated staged or unstaged changes.

---

## 📦 Step 2: Stage Target Changes

1. If files are unstaged, stage intentional changes:
   - For complete feature/fix deliveries: stage the reviewed file list explicitly.
   - For selective commits: `git add <file1> <file2> ...`
2. If supplemental card data (`src/data/supplemental/`) was modified:
   - **Always run:** `npm run report:declarations`
   - Stage the updated report: `git add docs/reports/supplemental_declarations_usage_report.md`
3. Re-run `git diff --cached --name-status` and confirm every staged path belongs to the intended file set.
4. Never use `git add .` or a formatter's broad staging command as automatic recovery; review and stage only the files intentionally changed by this task.

---

## 🛡️ Step 3: Run Automated Quality Gates

Before committing, run the project's quality verification pipeline:

1. **Prettier Format Check:**

   ```sh
   npm run format:check
   ```

   _Recovery:_ If formatting issues are found, format only the reviewed file set, inspect the diff, and stage only the intended files.

2. **ESLint Static Analysis:**

   ```sh
   npm run lint
   ```

   _Requirement:_ Must exit with 0 errors and 0 warnings (`--max-warnings 0`).

3. **TypeScript Typecheck:**

   ```sh
   npm run typecheck
   ```

   _Requirement:_ Must compile cleanly with 0 TypeScript diagnostics (`tsc --noEmit`).

4. **Automated Test Suite (Zero Skipped Tests Invariant):**
   ```sh
   npm test
   ```
   _Requirement:_ All unit, integration, and contract tests must pass with **0 failures and 0 skipped tests** (`passed: N, failed: 0, skipped: 0`). Any skipped test (`it.skip`, `describe.skip`, `test.skip`, `it.todo`) is tech debt and strictly blocks commit and push until resolved or pruned. Tests must strictly pass or fail: no lingering code, no lingering problems.

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
| `docs/` (all files, any depth) and root-level `.md` files (`README.md`, `CHANGELOG.md`, `AGENTS.md`, `CHEATSHEET.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`) | `(docs)`                              |
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
git commit -m "<category>(<scope>): <description>"
```

_Note:_ The pre-commit hook in `.githooks/pre-commit` will automatically execute `format:check`, `lint`, and `typecheck`. Verify that it passes with code 0.

---

## 🚀 Step 7: Native Git Push & Final Verification

1. Since the user's request already authorized commit and push together, push to the remote tracking branch directly after a successful commit:
   ```sh
   git push origin main
   ```
2. Verify the pre-push hook executes `npm test` cleanly with **0 failures and 0 skipped tests** (`passed: N, failed: 0, skipped: 0`).
3. Re-query every referenced issue after push:
   ```sh
   gh issue view <NUM> --json number,state,closedAt,title,url
   ```
   - For `Fixes` and `Closes`, verify the issue is now `CLOSED`.
   - For `Refs` and informational references, report the current state and URL; do not claim the issue was closed.
   - If the expected state is not reached, report the post-push discrepancy explicitly instead of treating the delivery as fully verified.
4. Run `git status` to verify:
   - Working tree is clean (`nothing to commit, working tree clean`).
   - Branch is up to date with remote (`Your branch is up to date with 'origin/main'`).
