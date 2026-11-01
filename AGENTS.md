# Marvel Champions Digital (MCD) - Agent Instructions

The canonical shared policies and quality gates are in
[`.agents/rules/shared-quality-gates.md`](.agents/rules/shared-quality-gates.md).
The shell policy is in [`.agents/rules/command-execution.md`](.agents/rules/command-execution.md),
the RTK token reduction policy is in
[`.agents/rules/antigravity-rtk-rules.md`](.agents/rules/antigravity-rtk-rules.md),
the coding and testing rules are in
[`.agents/rules/coding-and-testing-rules.md`](.agents/rules/coding-and-testing-rules.md)
(full guidelines with examples: [`docs/coding_guidelines.md`](docs/coding_guidelines.md), including
§15 Recurring-Error Guardrails),
and the post-task procedure is in
[`.agents/rules/post-task-checklist.md`](.agents/rules/post-task-checklist.md).

## Project principles

- Follow Marvel Champions Rules Reference v1.8 for gameplay behavior.
- **Rules Reference Inspection Policy:** Agents must use the structured Markdown reference in `references/rules/` (or the lookup command `npm run rule -- <term>`) for all gameplay rules research, card translations, and engine verification. Agents must **not** open or read the raw PDF (`references/mc_rulesreference_v18_compressed.pdf`) unless confidence on an ambiguous reading is low (<95%) or explicitly requested by the user.
- **Cross-Cutting Rules Protocol:** When researching a rule or mechanic in `references/rules/`:
  1. Inspect the primary entry in `references/rules/glossary/`.
  2. Follow and inspect all direct `See also:` and `Referenced by:` links, plus any linked FAQ/errata items.
  3. Verify against the relevant operational cluster in `references/rules/TOPIC_MAP.md` (e.g. Combat & Damage, Timing & Triggers, Card Economy) to ensure all interrelated mechanics are satisfied.
  4. If ambiguity remains across entries, run a targeted ripgrep (`rg -i "<term>" references/rules/`).
- **Shell Execution & RTK Policy:** Execute commands directly in native PowerShell (no `powershell -Command` wrappers). Always prefix shell commands (`git`, `npm`, `vitest`, `npx`) with `rtk` (e.g. `rtk git status`, `rtk git diff`, `rtk npm test`, `rtk vitest run`, `rtk npm run lint`) to compress outputs by 60–90% per [`.agents/rules/antigravity-rtk-rules.md`](.agents/rules/antigravity-rtk-rules.md).
- Keep `src/engine/` headless and decoupled from React, DOM, and CSS.
- Keep card-specific behavior declarative in `content/packs/*/supplemental/`; engine primitives must be generic.
- Align implementation work with the currently active roadmap and milestone gates unless the user
  explicitly changes scope. Read-only audits may inspect any user-selected scope.
- Preserve the project's comic pop-art visual direction in user-facing UI work.
- Do not introduce unapproved legacy shims, aliases, deprecated names, duplicate paths, or temporary shortcuts.
- **One Legality Gate:** Whether a card or ability can be played, used or offered is decided in `src/engine/pipeline/legality-checker.ts` and the target-validity gate `checkAbilityTargets` (ADR-0090). Extend them; never add a parallel check in a caller (trigger scan, prompt queue, action handler, UI). Rule: `.agents/rules/coding-and-testing-rules.md`, `docs/coding_guidelines.md` §15.11.
- **No Tech Debt (hard rule, overrides skill steps):** Fix debt in the path of the change in the same change. Never offer "leave it", "defer", "report separately", "close as invalid" or "tracked gap" as an option for it; the recommended plan is always the cleanest complete one, and every plan lists **Debt Removed**. A wrong issue premise is corrected and the real defect fixed, not closed. Full rules: [No Tech Debt Mandate](.agents/rules/shared-quality-gates.md#no-tech-debt-mandate).
- **Refactor-First & Zero-Bloat Policy:** We are early in development: refactor now. Never propose "we'll support both", parallel functions, or copy-pasted logic with minor variations. Before adding a new function, primitive, or branch, search for similar existing code and prefer **merging similar functions**, **adding a parameter to an existing function**, or **simplifying tangled/spaghetti code in the path of the change** and updating all callers/data in scope.
- **Lean Testing Policy (No Redundant Runs):** Run only targeted tests (`rtk npx vitest run <target>` or `rtk npx vitest related <files> --run`) during implementation. Never re-run a test, `typecheck`, or `lint` command if zero files changed since it last passed. Leave the full test suite (`npm test`) to the `git push` hook (`.githooks/pre-push`).
- Never add skipped or todo tests to hide unfinished work.
- **Autonomy & Stop Policy:** Stop and ask only for plan approval, confidence below 95%, a plan deviation (the code cannot follow the approved plan), a destructive action, or a failure that survives two fix attempts. Decide everything else, list it under **Decisions I made** in the recap, and continue. Ask all open questions in one message, recommendation first. Full rules: [Stop policy](.agents/rules/shared-quality-gates.md#stop-policy).
- **Game-First Plans:** This is a game. Every plan opens with an **In-Game Scenario** (setup, what the player does, today, after the change, the rule that decides it) before any code, and each code change points to the scenario it serves. Template: [In-Game Scenario](.agents/rules/shared-quality-gates.md#in-game-scenario).
- **Supplemental Card Comments Policy:** The `comment` field resides strictly inside `audit.comment` and is reserved for human/user notes. Agents must never autonomously add or update `audit.comment`. If explicitly instructed by the user to add or update a comment, the agent must clearly state the reason in the review recap and commit message. Card ambiguities or defects must be resolved with user interaction or in `docs/ambiguities/`, never by embedding informal notes in `audit.comment`.
- **ADHD Mode Default Policy:** `i-have-adhd` mode is on by default in this project. On Claude Code, the SessionStart hook `.claude/hooks/adhd-default.mjs` injects the skill rules. On other hosts, agents must read `.agents/skills/i-have-adhd/SKILL.md` and apply it from the first turn. It turns off only when the user says "stop adhd mode" or "normal mode".

## Claude Code setup

Skills live in `.agents/skills/`. Claude Code only reads `.claude/skills/`, so that path must be a link to `.agents/skills`. If it is missing, create it before anything else (setup steps in [`CONTRIBUTING.md`](CONTRIBUTING.md)): `New-Item -ItemType Junction -Path .claude\skills -Target .agents\skills`.

## Before implementation

For source, test, supplemental-data, dependency, or configuration changes, write the plan defined in the [Plan and approval gate](.agents/rules/shared-quality-gates.md#plan-and-approval-gate) (In-Game Scenario first, then rules analysis, Simplification & Refactor Check, Debt Removed, files, UI/Card Editor impact, tests, open decisions) and stop for approval.

## Artifact presentation

When creating or updating an artifact (plan, audit, report), provide a 2–3 sentence high-level summary and link in chat. Do not duplicate or paste the artifact markdown into the response.

## Delivery

Delivery (branch, commit, push, pull request, squash-merge) runs through `commit-and-push`. It is authorized by the user's request, or automatically once an approved plan is implemented, verified, and has no open deviation. `main` is protected and the branch protection is never bypassed. Full rules: [Delivery authorization](.agents/rules/shared-quality-gates.md#delivery-authorization).
