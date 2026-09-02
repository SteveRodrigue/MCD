# [ADR-0042] Local-First Developer Problem Reporting & Deferred GitHub Filing

- **Status:** Accepted
- **Date:** 2026-09-02
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

Developers and testers using Dev Mode need a fast way to flag bugs, improvements, and missing/incomplete features directly from the game table, with the current `GameState` attached for reproduction, without leaving the app. MCD is a pure client-side SPA (React + Vite, optionally packaged as a Tauri desktop app) with **no backend server and no stored GitHub credentials** anywhere in the codebase. We need a mechanism to capture structured problem reports and eventually get them into GitHub Issues with the correct labels, without exposing a GitHub personal access token in the client bundle.

---

## Decision Drivers

- Driver 1: **Security** — never embed a GitHub API token or other secret in a browser-shipped bundle (OWASP secret-exposure risk).
- Driver 2: **Reuse of proven patterns** — the existing `logGameStateSnapshot()` / `gameStateSnapshotPlugin()` pair (ADR-0009-adjacent tooling) already demonstrates a safe dev-only Vite middleware → local JSON file pattern.
- Driver 3: **Early-project pragmatism** — the project is in an early phase; a fully authenticated issue-filing pipeline is not yet justified, but the capture UX should not block on it.
- Driver 4: **Inbox Zero discipline** — mirror the `docs/ambiguities/` 1-file-per-item pattern so pending reports are trivially auditable and prunable.

---

## Considered Options

1. **Option 1: Direct client-side GitHub API call (`fetch` to `api.github.com/repos/.../issues`).**
2. **Option 2: Local-first JSON capture via a dev-only Vite middleware, with a companion agent skill to file issues later.**
3. **Option 3: Standalone Node/Express backend service dedicated to issue filing.**

---

## Decision Outcome

**Chosen Option:** **Option 2: Local-first JSON capture (`logs/reports/`) + deferred filing via the `problem-report-triage` skill.**

### Rationale ("The Why")

Option 2 requires zero new infrastructure, follows an already-proven and reviewed pattern (`gameStateSnapshotPlugin`), and completely avoids storing or transmitting any GitHub credential from the browser. The trade-off — the capture endpoint only works under `vite dev`/`vite preview`, not a production build — is acceptable at this project phase and is explicitly called out in the in-app UI copy. A prefilled `github.com/.../issues/new?title=&body=&labels=` link is also offered as an immediate, token-free convenience path for anyone who wants to file directly. When the project matures, this can be swapped for a real "Open GitHub Issue" deep link or a properly authenticated backend without changing the capture UX.

---

## Evaluation of Options

### Option 1: Direct client-side GitHub API call

- **Pros:**
  - Immediate, one-step issue creation with no manual follow-up.
- **Cons:**
  - Requires a GitHub token reachable by client JS → severe secret-exposure risk (OWASP A02/A05).
  - No backend exists today to broker the call server-side.

### Option 2: Local-first JSON capture + deferred skill-based filing (Chosen)

- **Pros:**
  - No secrets in the client bundle; mirrors the existing, reviewed gamestate-snapshot pattern.
  - Works today with zero new infrastructure; naturally extensible to a real backend later.
  - Produces an auditable, Inbox-Zero-prunable trail (`logs/reports/`).
- **Cons:**
  - Only functions under `vite dev`/`vite preview`; a no-op in production/Tauri builds (explicitly surfaced in the UI).
  - Filing to GitHub is a separate, deferred step (the `problem-report-triage` skill or manual prefilled-URL click) rather than instantaneous.

### Option 3: Standalone Node/Express backend service

- **Pros:**
  - Could support authenticated GitHub API calls safely (token stays server-side).
- **Cons:**
  - Introduces a new always-running service, deployment, and secret-management surface for a single dev-tooling feature — disproportionate at this project phase.

---

## Consequences

### Positive Consequences

- Dev Mode testers can capture a fully-reproducible problem report (including the live `GameState`) in a few clicks, with zero risk of leaking credentials.
- The `logs/reports/` + `problem-report-triage` skill combination gives a clean, auditable Inbox-Zero workflow for converting reports into properly labeled GitHub Issues.
- The pattern is directly reusable/extensible if a real backend or authenticated deep-link is added later.

### Negative Consequences / Risks & Mitigations

- **Risk:** Reports captured during a production/Tauri session are silently dropped (network fetch fails). **Mitigation:** UI copy explicitly states the limitation; a sessionStorage fallback preserves the payload for the current tab, and the prefilled GitHub URL remains available regardless of environment.
- **Risk:** Reports could pile up unfiled in `logs/reports/`. **Mitigation:** The `problem-report-triage` skill enforces Inbox Zero — every successfully filed report is deleted immediately after issue creation is confirmed.
