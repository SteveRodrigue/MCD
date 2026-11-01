# Plan — M8: Official PDFs and art can no longer be committed

**Status:** approved by Steve 2026-11-01 (Q1 narrowed to PDFs only, every other recommendation accepted); implemented in PR #551 together with this plan. Next: [M7](plan_content_m7_empty_shell_ui.md).
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (section 0 Tier 1, Q15, Q20, Q23; roadmap row M8) and the rule spec in [`content_coupling_audit.md`](content_coupling_audit.md) section 6.
**Depends on:** M1 (audit), M4 (content layout), M6 (art cache), all merged. Independent of M7: no common file.
**Gate note:** Gate 1 (Rhino) is active. M8 touches no gameplay code. Proof: seeded Rhino game and `simulate --no-stats` byte-identical, full suite green after the untracking. Decision (Steve, 2026-11-01): untrack the PDFs only; keep the scripts and the generated Markdown tracked.

## In-Game Scenario

In-Game Scenario: none (repository hygiene and contributor tooling; the game plays the same).

**Contributor scenario (stands in for it):**
**Setup:** A new contributor clones MCD. They want to regenerate the Rules Reference Markdown from the official PDF.
**Does:** Looks for the PDF under `references/`.
**Today:** 78 PDFs (409 MB) are committed, so the PDF is simply there. `npm run rule -- toughness` works from the committed Markdown.
**After this change:** `npm run rule -- toughness` still works unchanged, from the tracked Markdown. The PDFs are not in the clone. `references/SETUP.md` says where to download the official PDF (the Fantasy Flight support page in `references/links.md`) and where to put it; `python tools/build_rules_markdown.py` regenerates the Markdown from it. Trying to commit a PDF, a card image, or a file over 5 MB fails the pre-commit hook and CI with a clear message.
**Why:** Tier 1 of the scope decision, narrowed by Steve: the repository stops redistributing the official PDFs. The Markdown conversion stays.

## 1. Goal

Untrack the 78 PDFs, keep the lookup tooling and the generated Markdown tracked, and add a leak guard that fails when forbidden official material (PDFs, card images, caches, oversized files) is tracked.

## 2. Facts (verified 2026-11-01 on `main`)

- **Tracked under `references/`:** 116 files: 78 PDFs (the only files this plan untracks), 35 files in `references/rules/` (glossary A to Z, appendices, `README.md`, `TOPIC_MAP.md`, `rules_graph.json`), `rules_reference_v18.md`, plus `README.md`, `links.md`, `GitHub Links.md.txt`. All stay tracked except the PDFs. 392 MB on disk.
- **Code that reads them:** `scripts/lookup-rule.ts` (`npm run rule`) reads `references/rules/`. **`src/engine/simulation/rules-graph.ts` imports `references/rules/rules_graph.json` at build time**, and `rule-coverage.ts`, `rule-observations.ts` and `tests/engine/rule-coverage.test.ts` depend on it. Because the Markdown and graph stay tracked, none of this changes. `rules_graph.json` stays in `references/rules/`.
- **Generator:** `tools/build_rules_markdown.py` writes `references/rules/` from the PDF and is the only writer of `rules_graph.json`.
- **The raw PDF is linked from a skill:** `card-integration-protocol` links the Rules Reference PDF, and `docs:check` checks relative Markdown links, so the link must become plain text when the PDF is untracked.
- **Policy text pointing at the folder:** `AGENTS.md` (Rules Reference Inspection Policy), `CONTRIBUTING.md`, `.agents/rules/shared-quality-gates.md`, five skills under `.agents/skills/`.
- **Leak guard:** none exists today (audit confirmed). The mechanism spec is ready: `tools/audit/leak-guard.ts`, same shape as `tools/audit/docs-check.ts`, `tools/audit/leak-guard.allow.json`, wired as `npm run leak:check` into `.githooks/pre-commit` and `npm run verify`. Rules: `pdf`, `image`, `cache`, `size` (over 5 MB); `upstream` stays disabled until M12; a JSON `text` rule for `"originalText"` and upstream-card shape outside `content/packs/**`.
- **History:** Q20 leaves git history as is, so untracking stops future distribution but does not shrink the repository or remove the PDFs from past commits.
- Local copies survive: `git rm --cached` leaves the PDFs on the owner's disk. A fresh clone does not have them and does not need them for `npm run rule`.

## 3. Design

### 3.1 Untrack the PDFs

`git rm -r --cached` for `references/**/*.pdf`; a `.gitignore` entry `references/**/*.pdf`. Everything else under `references/` stays tracked. `references/README.md` is updated (the PDF list becomes "download these yourself", pointing to `links.md`), and a new short `references/SETUP.md` explains where to download the Rules Reference and how to run `tools/build_rules_markdown.py` on it.

### 3.2 `card-integration-protocol` link

The skill links the raw Rules Reference PDF; `docs:check` checks relative links, so the link becomes plain text (or points to the tracked Markdown).

### 3.3 No new setup script

Per Steve's answer, no `setup:references` script, no graph move and no "not set up" message in `lookup-rule`: `npm run rule` keeps working from the tracked Markdown. `tools/build_rules_markdown.py` is the only tool a contributor with the PDF needs.

### 3.4 Leak guard

Implement exactly the spec in `content_coupling_audit.md` section 6 (path rules `pdf`, `image`, `cache`, `size`; text rule; allowlist with `reason` and optional `until`, same `AllowEntry` as `docs-check.ts`). Input is `git ls-files`. The `upstream` rule exists but is switched off until M12. The `pdf` rule has an empty allowlist after the untracking. Initial allowlist: `text` rule for `src/data/supplemental/schema.json` (generated schema). Run it in `static-checks` of `.github/workflows/ci.yml` as well as locally.

### 3.5 Docs and policy

`AGENTS.md`, `CONTRIBUTING.md` and the quality-gates rule keep the Inspection Policy unchanged (the Markdown is still there); `references/README.md` and `CONTRIBUTING.md` add the leak-guard rule and the PDF download note. `docs:check` must tolerate paths under `references/` that are no longer tracked (confirmed at implementation, adjusted only if it fails).

## 4. Simplification & Refactor Check

- One guard in the existing `tools/audit/` family, mirroring `docs-check.ts`; no second mechanism and no new allowlist format.
- Nothing new is added besides the guard and `SETUP.md`: no setup script and no file moves.
- The `references/README.md` file list is cut to what is tracked.

## 5. Debt Removed

- 409 MB of redistributed PDFs from the tracked tree (the Markdown conversion stays, by decision).
- The "Leak guard: none" gap recorded in the M1 audit.

## 6. File changes

| File | Change | Serves |
| --- | --- | --- |
| `references/**/*.pdf` | [DELETE from index, kept on disk], `.gitignore` | Contributor scenario |
| `references/SETUP.md`, `references/README.md` | [NEW]/[MODIFY] PDF download note | Contributor scenario |
| `.agents/skills/card-integration-protocol/SKILL.md` | [MODIFY] PDF link becomes plain text | docs:check |
| `tools/audit/leak-guard.ts`, `tools/audit/leak-guard.allow.json`, `tests/tools/leak-guard.test.ts` | [NEW] | guard |
| `package.json`, `.githooks/pre-commit`, `.github/workflows/ci.yml` | [MODIFY] `leak:check` | guard |
| `CONTRIBUTING.md` | [MODIFY] leak-guard rule | Docs and policy |

## 7. UI and Card Editor

No change required. No source under `src/ui/` or the editor changes (evidence: no `src/` file is touched).

## 8. Tests

- `tests/tools/leak-guard.test.ts` runs `runLeakGuard` over a temp git-style file list: one test per rule (pdf, image, cache, size, text), the allowlist (with a reason, with a closed `until`), and a clean tree (the done check).
- `tests/engine/rule-coverage.test.ts` and `lookup-rule` are untouched (the Markdown and graph stay).
- Dry run on `main` before the PR: the guard must flag exactly the 78 PDFs (and nothing else) until the untracking commit, then exit 0.

## 9. Open decisions

Answered by Steve (2026-11-01): Q1 untrack the PDFs only; keep the scripts and the generated Markdown. This removes the graph move, `setup:references`, and the cloud-agent lookup loss from the earlier draft.

1. **History stays as is in M8** (Q20). The 78 PDFs stay in past commits (about 300 MB of git objects); if the repository is public they remain retrievable. Purging means `git filter-repo` and a force-push of `main`, which is destructive and needs your explicit go; I can plan it separately. **Recommend: decide soon, as its own step.** Is the repo public?
2. **Run the leak guard in pre-commit, `verify` and CI; one PR** (recommended).
3. **Order with M7:** M8 first, then M7, one PR each (recommended; they share no file).
