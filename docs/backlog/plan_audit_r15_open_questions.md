# Plan R15: Close the audit's open questions (OQ-2, OQ-4, OQ-5)

> **Status:** Investigated 2026-10-20, awaiting commit. OQ-2: no change. OQ-4: dead branch removed. OQ-5: keep.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R15), audit §7. OQ-1 (keyword matching) was resolved by F008 (`hasKeyword` helper); OQ-3 moved to R8.
> **Gate:** Tech Debt & Tooling. **Tier:** 1. **Estimate:** 2–4 h for the three investigations.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## OQ-2: unbounded `state.log`

- **Question:** does the log size hurt long games? `appendLog` (`src/engine/state/game-log.ts:21`) pushes without a cap; the log is cloned with the state on every action and kept in snapshots.
- **Investigate:** with the simulator now playing real rounds (F001), run long games (`npm run simulate` with a higher round cap or a seed that lasts 15+ rounds) and record log entries, bytes and clone time per action at round 5, 10, 15.
- **Owner input (2026-10-20):** protection against runaway games is far-fetched; most games end within a few hundred entries. The log is also the precursor of replays, so dropping entries is undesirable.
- **Result (2026-10-20, 12 configs, solo and 2-player, Rhino):** bots lose to Rhino in 1-6 rounds, so no game reached round 15. Observed: solo about 20-25 entries/round, 2-player about 40/round, about 210 bytes/entry; the log is 4-18 % of the state (170-300 KB) and `structuredClone` of the full state takes about 3 ms, of which the log adds about 0.1-0.4 ms. Linear extrapolation to round 15: 2-player about 600 entries (about 130 KB), solo about 350 (about 75 KB). Both are under the 1,000-entry / 20 % thresholds, so **no change**. Re-measure when the bot (or a human) can survive 10+ rounds.
- **Decide (measure-only by default):** baseline is `JSON.stringify(state).length` and `structuredClone` time. Close with **no change** if the log stays under ~1,000 entries (about 100 KB) and under ~20 % of the state at round 15. Only if a game exceeds that, move the log out of the cloned state (append-only sink), never truncate it. Before any change, list every reader of `state.log`: UI log panel, problem reports, replay/determinism tests, simulator output, trigger logic that inspects past entries.
- **Tests (if changed):** the new sink keeps every entry, in order.

## OQ-4: MarvelCDB art fallback and CORS

- **Question:** does the remote fallback in `src/ui/services/card-cache-service.ts:181-190` ever work in a browser? `fetch` to `marvelcdb.com` probably fails CORS and falls back silently.
- **Investigate:** production build (`npm run build && npx vite preview`), dev art endpoint unavailable, open the board; check the network tab.
- **Quick check first:** `curl -sI` the MarvelCDB art URL and look for `access-control-allow-origin`; absent means the remote `fetch` can never succeed.
- **Result (2026-10-20):** `curl -I` with `Origin: http://localhost:5173` on `bundles/cards/01001a.png` returns 200 with no `access-control-allow-origin`; the OPTIONS preflight has none either. A browser `fetch` to it is blocked, so the remote branch never works. Delete it.
- **Owner decision (2026-10-20):** keep the CacheStorage layer. If the remote fetch always fails, delete only the remote branch (lines 180-190). When art is missing (not reachable, not yet downloaded), the card frame shows `card.title` + `card.text` from engine data instead of a broken image. A full card mockup is out of scope for now.
- **Done (2026-10-20):** the dead `fetch` branch is removed from `getCardArtUrl` (plus a test that the remote CDN is never fetched and ADR-0011 updated). No UI work needed: `CardView.tsx` already retries the CDN with `<img src>` (works without CORS) and then shows the vector fallback with name, traits and text (`showFallback`). `getRemoteMarvelCdbUrl` stays, used by those `<img>` paths.

## OQ-5: out-of-scope packs bundled

- **Question:** `src/data/supplemental/index.ts` imports `aoa_encounter`, `cw_encounter` and `mts` (about 3 KB). Keep them in the Gate 1 bundle or load them behind a Gate 4 flag?
- **Owner decision (2026-10-20): keep bundled** until the engine loads packs on demand. No work in R15; close the question.

## Simplification & Refactor Check

Each fix above removes code (remote branch) or puts a rule in the single existing writer (`appendLog`); none adds a parallel path.

## Open decisions

None left. OQ-2 thresholds above (1,000 entries / 20 %) are proposed; confirm or adjust.

## UI and Card Editor impact

OQ-4: the card frame shows title + text when art is missing (check Card Editor preview uses the same component). OQ-2: none unless the measurement fails.

## Commits

One per question that leads to a change, each with `Refs AUD-20261017-232534 R15 OQ-<n>`.
