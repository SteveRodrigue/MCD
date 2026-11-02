---
type: Changed
---

- **CI: Test shards balanced by run time**
  - `tools/test-shards.ts` adds a vitest sequencer that splits `--shard` runs by recorded run time (`tests/shard-timings.json`) instead of by path hash, which put the slowest UI files in one shard (88s against 38-49s for the others).
  - A test file without a recorded time counts as the median, so new tests spread across the shards.
  - `npm run test:timings` refreshes the timings; the CI `test-merge` job warns when the slowest shard runs more than 25% past the average.
