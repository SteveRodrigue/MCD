# Plan: Dependabot alert 16 (postcss-selector-parser)

Status: **implemented (option A), uncommitted**. Built CSS byte-identical; full suite green.

## Alert summary

| Field           | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Alert           | #16, open                                                             |
| Advisory        | GHSA-rj75-hqrm-r3gf / CVE-2026-104844, medium                         |
| Issue           | Quadratic complexity in flat selector parsing allows CPU exhaustion   |
| Package         | `postcss-selector-parser`, transitive, development scope              |
| Installed       | 6.1.4 (`package-lock.json:5085`)                                      |
| Vulnerable      | `< 7.1.6`. No patched 6.x exists; the fix is 7.1.6 only.              |
| Dependency path | `tailwindcss@3.4.19` (`^6.1.2`) and `postcss-nested@6.2.0` (`^6.1.1`) |

## Security analysis

- Exposure is build-time only. Tailwind parses MCD's own CSS and templates during `npm run dev` and `npm run build`. The parser is not in the shipped bundle.
- The attack needs an attacker-controlled selector. MCD feeds it only repository files, so practical exploitability is very low. CI builds only trusted code.
- Priority: next maintenance window. Still worth closing because the alert is open and the fix is cheap if compatible.

## Impact map

- `package.json` (add an `overrides` entry; there is none today)
- `package-lock.json` (both consumers resolve to 7.1.6)
- `tailwind.config.js`, `postcss.config.js` (read, not changed)
- Commands: `npm run dev`, `npm run build`, `npm test`

## Options

| Option                                      | Pros                                              | Cons                                                                                                                                    | Tier |
| ------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| **A. Override to `^7.1.6` (recommended)**   | Smallest change. Closes the alert. Easy rollback. | Forces a major version on packages that declare `^6`. Not officially supported by Tailwind 3; needs a build check of the generated CSS. | 2    |
| B. Upgrade to Tailwind 4                    | Supported path; removes the override later.       | Large migration (config, plugin, class changes). Out of scope for a medium dev-only alert.                                              | 3    |
| C. Wait for Tailwind 3.x to bump the parser | No risk now.                                      | Tailwind 3 is in maintenance. A bump may never come, and the alert stays open.                                                          | -    |

## Proposed changes (option A)

- `[MODIFY]` `package.json`: add `"overrides": { "postcss-selector-parser": "^7.1.6" }`
- `[MODIFY]` `package-lock.json`: regenerate with `rtk npm install`
- `[ADD]` `changes/unreleased/dependabot-16-postcss-selector-parser.md`: changelog fragment

## Compatibility and risk

- 6.x to 7.x is a major bump. The 7.x line drops older Node versions; CI uses Node 20 and the package declares `node >=4`, so there is no conflict.
- Risk: Tailwind or `postcss-nested` uses a 6.x-only API and fails or emits different CSS.
- Check: build the CSS before and after and diff it. Identical output means the swap is safe.
- Rollback: remove the override and reinstall.

## Acceptance tests

1. Before the change: `rtk npm run build`, save `dist` CSS as the baseline.
2. After the change: `rtk npm ls postcss-selector-parser` shows only 7.1.6.
3. `rtk npm ci`, `rtk npm run format:check`, `rtk npm run lint`, `rtk npm run typecheck`, `rtk npm test`, `rtk npm run build`.
4. The built CSS is byte-identical to the baseline, or differences are explained.
5. Re-query alert 16 after the push and report its state.

## Open questions

1. If the CSS output differs, or Tailwind fails under 7.x, do you want to fall back to option C and leave the alert open, or move to the Tailwind 4 migration (option B)?

## Approval gate

Implementation does not start until you approve.
