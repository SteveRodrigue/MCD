# Plan R15: Close the audit's open questions (OQ-2, OQ-4, OQ-5)

> **Status:** Proposed, waiting for owner approval. Each question is investigated first; a fix, if any, gets its own short plan or issue.
> **Source:** post-remediation report of code audit AUD-20261017-232534 (item R15), audit §7. OQ-1 (keyword matching) was resolved by F008 (`hasKeyword` helper); OQ-3 moved to R8.
> **Gate:** Tech Debt & Tooling. **Tier:** 1. **Estimate:** 2–4 h for the three investigations.
> **Queue:** section 3.5 of [teamwork_status_and_next_target.md](teamwork_status_and_next_target.md).

## OQ-2: unbounded `state.log`

- **Question:** does the log size hurt long games? `appendLog` (`src/engine/state/game-log.ts:21`) pushes without a cap; the log is cloned with the state on every action and kept in snapshots.
- **Investigate:** with the simulator now playing real rounds (F001), run long games (`npm run simulate` with a higher round cap or a seed that lasts 15+ rounds) and record log entries, bytes and clone time per action at round 5, 10, 15.
- **Decide:** if the log exceeds about 20 % of the state or clone time grows noticeably, cap it in `appendLog` (keep the last N entries in state), one place since `appendLog` is the only writer. Where older entries go (dropped, or kept by the UI outside the engine state) is an owner decision; check first what the UI log panel and problem reports read.
- **Tests (if capped):** a game past N entries keeps N in state.

## OQ-4: MarvelCDB art fallback and CORS

- **Question:** does the remote fallback in `src/ui/services/card-cache-service.ts:181-190` ever work in a browser? `fetch` to `marvelcdb.com` probably fails CORS and falls back silently.
- **Investigate:** production build (`npm run build && npx vite preview`), dev art endpoint unavailable, open the board; check the network tab.
- **Decide:** if it always fails, delete the remote branch and show the placeholder (smaller code, honest behaviour), or use `<img src>` without `fetch` (no CORS needed for display, no CacheStorage). Owner picks; this ties to the audit's F020 option B (plain `<img>` + HTTP cache).

## OQ-5: out-of-scope packs bundled

- **Question:** `src/data/supplemental/index.ts` imports `aoa_encounter`, `cw_encounter` and `mts` (about 3 KB). Keep them in the Gate 1 bundle or load them behind a Gate 4 flag?
- **This is a product decision, not a defect.** Recommended: keep (negligible size, the Card Editor uses them); revisit when packs grow.

## Simplification & Refactor Check

Each fix above removes code (remote branch) or puts a rule in the single existing writer (`appendLog`); none adds a parallel path.

## Open decisions

1. OQ-4: delete the remote fallback or switch to `<img src>`.
2. OQ-5: keep the packs bundled (recommended) or flag them.

## UI and Card Editor impact

OQ-4 may change how missing art is shown. OQ-2 may change how many entries the in-state log holds (UI log panel unaffected by design).

## Commits

One per question that leads to a change, each with `Refs AUD-20261017-232534 R15 OQ-<n>`.
