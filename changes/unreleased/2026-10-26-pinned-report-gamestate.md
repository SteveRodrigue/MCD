---
type: Fixed
---

- **Fix (Tooling): Problem reports pin their GameState so issue links no longer break ([ADR-0042](docs/decisions/0042-local-first-developer-problem-reporting.md))**
  - Submitting a report now saves its GameState to `logs/gamestates/pinned/`, which the rolling snapshot history (newest 25) never prunes. The report JSON holds `gameStateFile` instead of an embedded copy.
  - `problem-report-triage` drops its snapshot-writing step and cites the pinned file; the report-delete guard hook checks it.
