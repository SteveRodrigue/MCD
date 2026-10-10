# Plan: port `lookup-rule` to TypeScript

## Problem
`npm run rule` runs `python scripts/lookup-rule.py`. On this Windows machine `python` is the Microsoft Store stub, so the command fails. `py` works, but the daily rules lookup should not depend on a Python install.

## Scope
- Port only `scripts/lookup-rule.py` to `scripts/lookup-rule.ts` (run via `tsx`, like the other scripts).
- `data/upstream/*.py` are upstream-owned: not touched.
- `tools/build_rules_markdown.py` stays Python (maintenance only, not touched).

## File changes
1. Add `scripts/lookup-rule.ts`: same logic and output as the Python version (normalize, exact/partial match, body extraction from `### <title>` section, See also / Referenced by / FAQs). Reads `references/rules/rules_graph.json`.
2. Delete `scripts/lookup-rule.py` (no duplicate paths, per project rules).
3. `package.json`: `"rule": "tsx scripts/lookup-rule.ts"`.
4. Docs: replace `python scripts/lookup-rule.py` with `npm run rule --` in `AGENTS.md`, `references/README.md`, `references/rules/README.md`, and any `.agents/` hits.
5. Fix the "Run python tools/build_rules_markdown.py first" error hint (keep, it is still the correct generator).

## Tests
- Compare output of old vs new for `toughness`, `attack`, a nonexistent term, and a multi-word term (diff must be empty apart from line endings).
- `rtk npm run lint`, `rtk npm test`.

## UI / Card Editor impact
No change required. The change touches only a CLI script, `package.json`, and docs; nothing under `src/` (UI, Card Editor) is read or modified.

## Decisions (resolved)
- Delete `scripts/lookup-rule.py` (approved by running execute-plan on the recommended plan).
