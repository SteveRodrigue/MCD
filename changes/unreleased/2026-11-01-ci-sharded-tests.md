---
type: Changed
---

- **CI: Sharded test job and one content load per test run**
  - `.github/workflows/ci.yml` runs the suite in 4 parallel shards (`vitest --shard`), and a new `test-merge` job merges their blob reports and checks the coverage thresholds on the whole suite. `build-and-test` stays the required check.
  - `vitest.config.ts` skips the coverage thresholds in a `--shard` run, since a shard covers only part of the suite; the merge run checks them. Blob reports land in the ignored `.vitest/`.
  - `tests/setup/global-content.ts` reads and validates the enabled packs once per run (vitest `globalSetup` + `provide`); `tests/setup/load-content.ts` only applies them in each test file.
  - `npm run verify` no longer runs the suite twice (`test:coverage` already runs every test).
