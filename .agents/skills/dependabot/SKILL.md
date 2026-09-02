---
name: dependabot
description: 'Audit GitHub Dependabot alerts for the MCD repository, assess dependency and codebase impact, and prepare a review-gated remediation plan. Use when checking Dependabot alerts, security vulnerabilities, npm dependency advisories, upgrade risk, or dependency security fixes.'
argument-hint: 'Optional scope: all alerts, a package, an alert number, or a severity threshold'
user-invocable: true
disable-model-invocation: false
---

# Dependabot Audit & Remediation Protocol

Use this skill to turn GitHub Dependabot alerts into evidence-backed remediation plans. The skill audits the live repository alerts, maps each vulnerable dependency to the MCD build and runtime surface, and prepares an implementation plan for user review before any dependency or source change is made.

## Path Policy

Use paths relative to the MCD repository root for all local project files. Never use personal filesystem paths, drive-letter paths, `file:///` links, or `vscode://` links. Use repository-relative paths such as `package.json`, `src/`, `tests/`, or `docs/`.

## Safety Rules

- Never expose authentication tokens, credentials, or environment secrets.
- Do not run `npm audit fix`, upgrade dependencies, edit `package.json`, edit lockfiles, or modify source code before the user approves the implementation plan.
- Treat GitHub Dependabot data as advisory evidence. Verify the affected version range, patched version, package usage, and exploitability in this repository.
- Separate production dependencies from development-only dependencies. A vulnerability in a build or test tool can still affect CI or local development, but may not affect the shipped application.
- Do not suppress, dismiss, or close a Dependabot alert as a substitute for remediation.
- Preserve unrelated working-tree changes. Do not reset, checkout, or clean files without explicit user approval.

## Procedure

### 1. Establish Scope and Repository State

1. Read the requested scope. Default to all open alerts if no scope is provided.
2. Confirm the repository root and current branch with `git status --short` and `git branch --show-current`.
3. Record whether the worktree is clean. Do not include unrelated changes in a future remediation commit.
4. Read `package.json`, `package-lock.json`, `vite.config.ts`, CI workflow files, and relevant workspace scripts before drawing conclusions.

### 2. Retrieve Live Dependabot Alerts

Use the authenticated GitHub CLI or GitHub API for the repository:

```text
gh api repos/<owner>/<repo>/dependabot/alerts --paginate
```

For MCD, use `repos/SteveRodrigue/MCD`. Capture only the fields needed for analysis:

- Alert number and state
- Package name and dependency scope
- Installed and vulnerable version ranges
- First patched version, when available
- Advisory severity, CVE/GHSA identifiers, summary, and published date
- Dependency manifest and dependency relationship
- Pull request or remediation metadata, when present

If GitHub access is unavailable, report the limitation and ask the user to provide the alert export. Do not invent advisory details.

### 3. Normalize and Prioritize Findings

For each open alert, classify:

| Dimension | Values |
| --- | --- |
| Severity | critical, high, medium, low, unknown |
| Dependency scope | runtime, build, test, tooling, transitive, unknown |
| Exposure | shipped bundle, dev server, CI, local-only, indirect, unknown |
| Remediation | patched version available, workaround, no patch, unknown |
| Priority | immediate, next maintenance window, monitor, blocked |

Prioritize by exploitability and exposure, not severity alone. A critical development-server issue may require immediate action even when the package is not bundled into production.

### 4. Trace Repository Impact

For each affected package:

1. Locate the declaration in `package.json` and the resolved version in `package-lock.json`.
2. Search `src/`, `tests/`, `tools/`, scripts, CI workflows, and configuration for direct API usage or behavior affected by the advisory.
3. Determine whether the package is bundled, executed only during development, used in CI, or present only transitively.
4. Identify affected commands such as `npm run dev`, `npm run build`, `npm test`, `npm run lint`, and `npm run format:check`.
5. Check whether the advisory concerns MCD's actual configuration, such as Vite server settings, Vitest UI exposure, or Windows path handling.
6. Record concrete evidence with repository-relative paths and symbols. Do not claim code impact without a matching usage or configuration reference.

### 5. Assess Upgrade Risk

For every proposed patched version:

- Compare the current and target semver ranges.
- Identify major-version changes and likely breaking APIs.
- Review package release notes and official advisory guidance when available.
- Check peer dependencies and Node.js compatibility against the CI version in `.github/workflows/ci.yml`.
- Identify likely changes to Vite, Vitest, ESLint, TypeScript, React, or build-plugin behavior.
- Define required regression coverage, including security-relevant configuration checks.

Classify the remediation blast radius:

- **Tier 1:** Lockfile-only or patch/minor upgrade with no API/configuration impact evidenced.
- **Tier 2:** Dependency upgrade requiring configuration changes, test updates, or broad verification.
- **Tier 3:** Major upgrade, runtime behavior change, security architecture change, or uncertain impact. Requires explicit design review.

### 6. Prepare the Implementation Plan

Create a reviewable plan before changing dependencies or source. The plan must include:

1. **Alert Summary:** Alert IDs, packages, severities, advisory references, and current status.
2. **Rules and Security Analysis:** Why the advisory applies or does not apply to MCD, including development-server, CI, production, and local exposure.
3. **Impact Map:** Exact repository-relative files, scripts, configuration, and code paths affected.
4. **Proposed Changes:** File-by-file `[MODIFY]`, `[ADD]`, or `[DELETE]` list, including `package.json` and `package-lock.json` when relevant.
5. **Compatibility and Risk:** Semver changes, Node/CI compatibility, migration concerns, and rollback considerations.
6. **Acceptance Tests:** Exact commands and test files covering install, lint, format, typecheck, unit tests, build, and any advisory-specific behavior.
7. **Open Questions:** Unknown patch availability, transitive dependency constraints, or decisions requiring user input.
8. **Approval Gate:** State clearly that implementation must not begin until the user approves the plan.

Use a repository-relative plan path such as `docs/plans/dependabot-<date>-<scope>.md` when a durable plan is requested. If the host environment provides a user-facing implementation-plan artifact, use that artifact and request feedback instead. Do not create a new plan directory solely for this skill without user approval.

### 7. Stop for Review

Present the plan and stop. Do not edit `package.json`, `package-lock.json`, source code, tests, or CI until the user explicitly approves or revises the plan.

Approval examples:

- `Approve the Dependabot plan.`
- `Proceed with the Vite and Vitest upgrades only.`
- `Revise the plan to avoid major-version upgrades.`

If the user rejects or narrows the plan, update the impact analysis and request approval again.

### 8. Implement Only After Approval

After approval:

1. Reconfirm the working-tree state and alert data; alerts may have changed.
2. Apply the smallest compatible dependency/configuration change.
3. Regenerate the lockfile using the repository's package manager.
4. Add or update regression tests for security-relevant behavior.
5. Run the approved verification commands:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

6. Re-query Dependabot alerts and report whether the alert closed, remains open, or changed state.
7. Update `CHANGELOG.md` and relevant documentation when the remediation changes supported tooling, configuration, or developer workflow.
8. Summarize residual risk and any alerts that remain unresolved.

## Required Final Report

The final report must include:

- Alerts found and their current states
- Impact classification for each alert
- Files and commands inspected
- Approved changes made, if any
- Verification results
- Remaining alerts and residual risk
- Whether GitHub Dependabot now reports the alert as resolved

A Dependabot audit is incomplete until the alert state is rechecked after implementation or the inability to recheck is explicitly reported.
