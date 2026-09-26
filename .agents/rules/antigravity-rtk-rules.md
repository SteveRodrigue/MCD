---
always_on: true
description: 'RTK (Rust Token Killer) CLI proxy instructions to condense command output by 60-90%'
---

# RTK (Rust Token Killer)

Prefix shell commands with `rtk` to filter and condense output, saving 60–90% of tokens while preserving all errors, warnings, and exit codes:

- **Git:** `rtk git status`, `rtk git diff`, `rtk git log -n 10`, `rtk git add <files>`, `rtk git commit -m "..."`, `rtk git push`
- **Testing:** `rtk vitest run <file>`, `rtk npm test`
- **Build & Quality:** `rtk npm run lint`, `rtk npm run typecheck`, `rtk npm run build`
- **Files:** `rtk ls .`, `rtk read <file>`, `rtk grep "<pattern>" .`

Keep the prefix inside chained commands:
`rtk git status && rtk git diff`

## Output & Recovery

Command output is condensed to eliminate token waste while preserving every actionable failure:
- When tests pass, they collapse to a clean count summary.
- When tests fail, full assertion failure details and locations are preserved.
- If a command fails or output is truncated, RTK stores full raw logs locally with an `rtk recall <id>` hint.
- Run `rtk proxy <cmd>` only when unfiltered raw output is explicitly needed.
- Check overall token savings with `rtk gain`.
