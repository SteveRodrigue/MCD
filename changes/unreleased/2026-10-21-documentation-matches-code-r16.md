---
type: Changed
---

- **Docs: documentation synchronized with the code after the audit remediation (AUD-20261017-232534 R16)**
  - Effect reference links in `docs/specifications/supplemental/` now point to `src/engine/effects/handlers/`; trigger source files in `02_timings_and_triggers.md` match the `dispatchTrigger` call sites.
  - ADR index status cells match their ADR files (ADR-0083 partial supersessions); addenda added to ADR-0003 (Framer Motion unused) and ADR-0027 (`passActivePlayer` removed).
  - Card editor spec: plugin location, dev-server-only scope and pack file name validation.
  - `CONTRIBUTING.md` dead `catalog.ts` link; frozen-catalog `overrideCard` rule in `.agents/rules/coding-and-testing-rules.md`.
