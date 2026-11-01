# Plan — M8: Official PDFs and art can no longer be committed

**Status:** draft 2026-11-01, waiting for review together with [M7](plan_content_m7_empty_shell_ui.md) (open decisions in section 8).
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (section 0 Tier 1, Q15, Q20, Q23; roadmap row M8) and the rule spec in [`content_coupling_audit.md`](content_coupling_audit.md) section 6.
**Depends on:** M1 (audit), M4 (content layout), M6 (art cache), all merged. Independent of M7: no common file.
**Gate note:** Gate 1 (Rhino) is active. M8 touches no gameplay code. Proof: seeded Rhino game and `simulate --no-stats` byte-identical, full suite green after the untracking.

## In-Game Scenario

In-Game Scenario: none (repository hygiene and contributor tooling; the game plays the same).

**Contributor scenario (stands in for it):**
**Setup:** A new contributor clones MCD, or an agent starts a fresh worktree. No Rules Reference files are present.
**Does:** Runs `npm run rule -- toughness`.
**Today:** It works, because 78 PDFs (409 MB) and the Markdown conversion of the Rules Reference are committed.
**After this change:** It stops with "Rules Reference not set up: run `npm run setup:references`". That command says where to download the official PDF (the Fantasy Flight support page already in `references/links.md`), checks the file, and regenerates `references/rules/` locally. After that, `npm run rule` works as before. Trying to commit a PDF, a card image, or a file over 5 MB fails the pre-commit hook and CI with a clear message.
**Why:** Tier 1 of the scope decision: the repository stops redistributing official publications (section 0 of the parent plan).

## 1. Goal

Untrack the rules PDFs and the Markdown copies of the Rules Reference, keep the lookup tooling working from locally generated files, and add a leak guard that fails when forbidden official material is tracked.

## 2. Facts (verified 2026-11-01 on `main`)

- **Tracked under `references/`:** 116 files: 78 PDFs, 35 files in `references/rules/` (glossary A to Z, appendices, `README.md`, `TOPIC_MAP.md`, `rules_graph.json`), `rules_reference_v18.md`, plus `README.md`, `links.md`, `GitHub Links.md.txt`. 392 MB on disk.
- **Code that reads them:** `scripts/lookup-rule.ts` (`npm run rule`) reads `references/rules/`. **`src/engine/simulation/rules-graph.ts` imports `references/rules/rules_graph.json` at build time**, and `rule-coverage.ts`, `rule-observations.ts` and `tests/engine/rule-coverage.test.ts` depend on it. Untracking the folder as is would break the build and CI. `rules_graph.json` holds only term titles, anchors and cross-reference lists (the longest string is 46 characters), no rule text.
- **Generator:** `tools/build_rules_markdown.py` writes `references/rules/` from the PDF and is the only writer of `rules_graph.json`.
- **Policy text pointing at the folder:** `AGENTS.md` (Rules Reference Inspection Policy), `CONTRIBUTING.md`, `.agents/rules/shared-quality-gates.md`, five skills under `.agents/skills/`.
- **Leak guard:** none exists today (audit confirmed). The mechanism spec is ready: `tools/audit/leak-guard.ts`, same shape as `tools/audit/docs-check.ts`, `tools/audit/leak-guard.allow.json`, wired as `npm run leak:check` into `.githooks/pre-commit` and `npm run verify`. Rules: `pdf`, `image`, `cache`, `size` (over 5 MB); `upstream` stays disabled until M12; a JSON `text` rule for `"originalText"` and upstream-card shape outside `content/packs/**`.
- **History:** Q20 leaves git history as is, so untracking stops future distribution but does not shrink the repository or remove the PDFs from past commits.
- Local copies survive: `git rm --cached` leaves the files on the owner's disk. A fresh worktree does not have them (this is the case `setup:references` serves).

## 3. Design

### 3.1 Untrack

`git rm -r --cached` for `references/**/*.pdf`, `references/rules/` (except the graph, below) and `references/rules_reference_v18.md`; `.gitignore` entries for them. Kept tracked: `references/README.md` (rewritten for the new setup), `references/links.md`, `GitHub Links.md.txt`, and a new `references/SETUP.md`.

### 3.2 The graph moves into the code

`rules_graph.json` moves to `src/engine/simulation/rules-graph.json` (tracked, small, term names only). `rules-graph.ts` imports it from there, `tools/build_rules_markdown.py` writes it there, and `lookup-rule.ts` reads the same file for its index. The engine no longer imports anything from `references/`. This keeps `rule-coverage` and its test independent of the local setup.

### 3.3 `setup:references`

`scripts/setup-references.ts` (`npm run setup:references`): looks for the Rules Reference PDF at `references/mc_rulesreference_v18_compressed.pdf` or at `--from <path>`; if absent, prints the official URL from `references/links.md` and stops. If present, verifies the file name and SHA-256 (recorded in `references/SETUP.md`, computed at implementation from the owner's copy), then runs `python tools/build_rules_markdown.py` to regenerate `references/rules/` and `rules_reference_v18.md`. It never downloads anything itself.

`npm run rule` checks that `references/rules/` exists and otherwise fails with the one-line message above.

### 3.4 Leak guard

Implement exactly the spec in `content_coupling_audit.md` section 6 (path rules `pdf`, `image`, `cache`, `size`; text rule; allowlist with `reason` and optional `until`, same `AllowEntry` as `docs-check.ts`). Input is `git ls-files`. The `upstream` rule exists but is switched off until M12. Initial allowlist: `text` rule for `src/data/supplemental/schema.json` (generated schema). Run it in `static-checks` of `.github/workflows/ci.yml` as well as locally.

### 3.5 Docs and policy

`AGENTS.md`, `CONTRIBUTING.md`, the quality-gates rule and the five skills keep the Inspection Policy but add "run `npm run setup:references` first if `references/rules/` is missing". `docs:check` must tolerate paths under `references/` that are no longer tracked (it reads the working tree today; confirmed at implementation, adjusted only if it fails).

## 4. Simplification & Refactor Check

- One guard in the existing `tools/audit/` family, mirroring `docs-check.ts`; no second mechanism and no new allowlist format.
- The engine stops depending on a documentation folder: the graph sits next to the code that uses it, and the Python generator and `lookup-rule.ts` share that one file.
- The `references/README.md` file list is cut to what is tracked.

## 5. Debt Removed

- Engine import of `references/rules/rules_graph.json` (a documentation path used as a data source).
- 409 MB of redistributed PDFs and a full Markdown copy of the Rules Reference from the tracked tree.
- Policy text that assumes the references are always present.
- The "Leak guard: none" gap recorded in the M1 audit.

## 6. File changes

| File | Change | Serves |
| --- | --- | --- |
| `references/**/*.pdf`, `references/rules/**` (except graph), `references/rules_reference_v18.md` | [DELETE from index, kept on disk], `.gitignore` | Contributor scenario |
| `references/rules/rules_graph.json` to `src/engine/simulation/rules-graph.json` | [MOVE] | Debt Removed |
| `src/engine/simulation/rules-graph.ts`, `tools/build_rules_markdown.py`, `scripts/lookup-rule.ts` | [MODIFY] new graph path, friendly missing-setup message | Contributor scenario |
| `scripts/setup-references.ts`, `references/SETUP.md` | [NEW] | Contributor scenario |
| `tools/audit/leak-guard.ts`, `tools/audit/leak-guard.allow.json`, `tests/tools/leak-guard.test.ts` | [NEW] | guard |
| `package.json`, `.githooks/pre-commit`, `.github/workflows/ci.yml` | [MODIFY] `leak:check`, `setup:references` | guard |
| `references/README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `.agents/rules/shared-quality-gates.md`, 5 skills | [MODIFY] setup step | Docs and policy |

## 7. UI and Card Editor

No change required. No source under `src/ui/` or the editor changes (evidence: the only `src/` file touched is `rules-graph.ts`, imported by engine simulation code).

## 8. Tests

- `tests/tools/leak-guard.test.ts` runs `runLeakGuard` over a temp git-style file list: one test per rule (pdf, image, cache, size, text), the allowlist (with a reason, with a closed `until`), and a clean tree (the done check).
- `tests/engine/rule-coverage.test.ts` keeps passing with the moved graph (no new test).
- `tests/tools/lookup-rule.test.ts` (new, small): missing `references/rules/` gives the setup message and a non-zero exit.
- Dry run on `main` before the PR: the guard must flag exactly the 78 PDFs (and nothing else) until the untracking commit, then exit 0.

## 9. Open decisions

1. **Move `rules_graph.json` into `src/engine/simulation/` and keep it tracked** (recommended; term titles and links only, no rule text; the engine and CI need it). Alternative: generate it in CI from the PDF, which cannot work because the PDF is not distributed.
2. **Keep `references/links.md` and `GitHub Links.md.txt` tracked** (recommended; links, not content).
3. **`setup:references` never downloads** (recommended; the owner of the PDF stays in control). Alternative: it downloads from the support page, which can break when the page moves.
4. **History stays as is** (Q20), so the PDFs remain in old commits. Rewriting history is out of scope; say so if you want it reopened.
5. **One PR** (recommended: the untracking, the graph move and the guard must land together or CI breaks) vs separate PRs.
6. **Order with M7:** M7 first (Q15), but they share no file, so either order works.
