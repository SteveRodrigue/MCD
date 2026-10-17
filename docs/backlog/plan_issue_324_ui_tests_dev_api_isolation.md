# Plan: Issue #324 — UI tests reach the running dev server

> **Status:** Approved.
> **Scope:** Issue [#324](https://github.com/SteveRodrigue/MCD/issues/324) only. Test configuration; no `src/` change. The commit will say `fix(ui): Keep UI tests off the running dev server (Fixes #324)`.
> **Triage:** preventative priority. Tests corrupt local developer data, and the noise hides real errors.
> **UI / Card Editor impact:** None. No component, engine, or supplemental data change.

---

## 1. Root-Cause Analysis

- Vitest runs the `ui` project in happy-dom. With no `environmentOptions.happyDOM.url`, Vitest sets the page URL to `http://localhost:3000` (`node_modules/vitest/dist/chunks/index.DC7d2Pf8.js:343`).
- The dev server also listens on port 3000 (`vite.config.ts:559`, `strictPort: true`).
- So a relative `fetch('/api/...')` from a UI test goes to the developer's running dev server. The red test proved it: `fetch('/api/stats')` returned the real all-time stats (`gamesPlayed: 8`).
- Effects:
  1. **Data corruption.** Any UI test that renders `GameBoard` POSTs stats deltas to the real `stats/card_play_stats.json`. The same applies to the other dev endpoints the UI calls: `/api/logs/gamestate`, `/api/logs/report`, `/api/supplemental/...`.
  2. **AbortError noise.** When a request is still in flight at teardown, happy-dom aborts it and prints the `DOMException [AbortError]` traces. That happens only when the timing lines up, so the noise is intermittent (2 traces in 1 of 6 full runs).
  3. **Results depend on the machine.** The same test can behave differently depending on whether a dev server is running.

## 2. Simplification & Refactor Check

- **Deleted:** the per-file `getAllTimeStats` default stub added to `tests/ui/card-context-menu-stats.test.tsx` `beforeEach` during the #315 review. The shared setup replaces it. The explicit per-test `mockResolvedValue` with sample stats stays.
- **Merged:** one shared UI setup file instead of a `fetch` stub per test file.
- **No new production code.** The services already fall back to `localStorage` when the server is unreachable (ADR-0084). The tests just take that documented offline path.

## 3. Blast Radius

**Tier 2 (test infrastructure):** every `tests/ui/**/*.test.tsx` file runs under the new setup. Tests that stub `fetch` themselves (`vi.stubGlobal('fetch', ...)`) still override it per test.

## 4. Proposed Fix

1. `vitest.config.ts`, `ui` project:
   - `environmentOptions: { happyDOM: { url: 'http://mcd-ui-tests.invalid' } }`. The `.invalid` TLD never resolves (RFC 2606), so no UI test can reach a local server, whatever runs on port 3000.
   - `setupFiles: ['tests/ui/setup/offline-dev-api.ts']`.
2. New `tests/ui/setup/offline-dev-api.ts`: wraps global `fetch` so any request whose path starts with `/api/` resolves right away to `new Response(null, { status: 503 })` (dev server unavailable). Other URLs pass through to the original `fetch`. A request that resolves immediately is never in flight at teardown, so the AbortError traces stop.
3. `tests/ui/card-context-menu-stats.test.tsx`: remove the redundant default `getAllTimeStats` stub and its `createInitialAllTimeStats` import.

## 5. Regression Verification

- New `tests/ui/stats-api-test-isolation.test.tsx` (red now): `fetch('/api/stats')` answers 503, and `location.origin` is not `http://localhost:3000`.
- `rtk npx vitest run tests/ui` once: 0 failed, 0 skipped, and no `AbortError` in the output.
- Prettier, lint and typecheck on the changed files.

## 6. Open Decisions

1. **Your real stats file was changed by this investigation.** See the chat for details. Should I add anything for that, such as a backup before reset in `cardStatsPlugin`? The recommendation is no: that is out of #324's scope.
