# Plan — M0: Content Packs ADR and doc supersessions

**Status:** Draft for review (2026-10-31). Documentation only; no source, test, data or config changes.
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (decisions Q13 to Q33).
**Gate:** none. Can start now (Q6).

## 1. Goal

Record the architecture decided in the parent plan as **one ADR** (Q29), and mark every earlier document it replaces so
nothing contradicts it. M0 is the contract M1 to M12 are built against.

## 2. Rules and spec analysis

- No gameplay rule is touched; Rules Reference lookups are not needed.
- ADR conventions (verified in `docs/decisions/`): file `NNNN-kebab-title.md`, header `# [ADR-NNNN] Title`, then
  Status / Date / Authors / Deciders lines. Highest existing number is 0091, so the new file is **`0092-content-packs-and-runtime-loading.md`**.
- `tools/audit/docs-check.ts` enforces for ADRs: a row in the `docs/decisions/README.md` Decision Log in ascending ID order;
  the row status and date equal the file's `Status` and `Date` **exactly**; a fully superseded ADR's target must mention its
  ID; relative links and `#anchors` resolve; backticked `docs/...` paths must exist (so the ADR must not name future
  `docs/creators/...` files in backticks, use plain text); `npm run X` mentions must exist in `package.json` (so no
  `pack:validate` in code spans until M2 lands, name it in plain text).
- Partial supersession is not validated beyond status-text equality, so each partially superseded ADR needs its README row
  edited to the identical string.

## 3. Content of ADR-0092

Sections (template headings, `docs/decisions/template.md`): Context, Decision Drivers, Considered Options, Decision
Outcome, Evaluation of Options, Consequences, References. Decisions it records, each citing its parent-plan row:

1. Pack as the unit of content; `content/packs/<id>/`, `content/decks/`, `content/.cache/` layout (Q9, Q9b, Q26).
2. Runtime loading of data, build-time bundling of trusted code hooks (Q3); user packs JSON-only until a sandbox ADR (Q4, Q16).
3. Pack `origin` values `official-bundled` / `official-sync` / `user` and their mutability (Q27); reserved ID namespace (Q18).
4. Hook API and `apiVersion` fixed with the manifest; generated import map for official hooks (Q16, Q33).
5. Storage driver per platform; app-data root in packaged builds; public releases dev-only for now (Q5, Q25, Q26).
6. Missing-pack behavior (Q22), official art never bundled (Q23), editor on the driver only (Q24).
7. Zero-pack boot is a supported state, proved by empty-dir tests (Q28).
8. Explicitly out of scope: removing Core from the repo (M12), fixtures, sandbox design, Scenario Editor.

## 4. Simplification & Refactor Check

Merged or deleted instead of added:

- **Merge** ADR-0015's never-built `IContentStorageDriver` idea into ADR-0092 (kept as the storage-driver concept, renamed
  paths). A repo search found no `IContentStorage*`, `fan_made_*` or `marvelcdb/` in `src/`; only
  `src/engine/decks/starter-decks.ts` and one test use `data/prebuilt_decks/`. The old layout is dead design, so it is
  superseded rather than kept as an alternative.
- **Replace** the plugins backlog decisions Q3, Q4, Q5, Q9 (build-time only, codegen, `plugins/official/`, `@plugin-api`
  barrel) instead of maintaining two decision logs. The barrel and codegen ideas survive inside ADR-0092 as hook-API
  details; the folder and build-time-only parts are dropped.
- **No new ADR for the sandbox**: written when it is actually designed.

## 5. File changes

| File | Change |
| --- | --- |
| `docs/decisions/0092-content-packs-and-runtime-loading.md` | New. Status `Accepted`, `Supersedes in part` line listing ADR-0011, ADR-0015. |
| `docs/decisions/README.md` | Add the ADR-0092 row after the ADR-0091 row; edit the ADR-0011 and ADR-0015 rows; add a Mermaid lineage graph (ADR-0015 to ADR-0092, ADR-0011 to ADR-0092). |
| `docs/decisions/0015-user-content-and-deck-storage-architecture.md` | Status becomes `Accepted (Superseded in part by [ADR-0092](...) regarding folder layout)`; storage-driver concept kept. |
| `docs/decisions/0011-card-orientation-and-art-caching.md` | Status adds `Superseded in part by ADR-0092 regarding the image cache location` (cache moves to `content/.cache/images/<pack>`). |
| `docs/decisions/0016-one-file-per-deck-and-collision-safe-naming.md` | Add a one-line note that the folders it names follow ADR-0092's layout (it links ADR-0015 at lines 14 and 140). |
| `docs/specifications/content_plugins_scenarios_and_campaigns.md` | Decision Log rows Q3, Q4, Q5, Q9 get "Superseded by ADR-0092"; sections 2 (target directory), 5 B1 to B3 (codegen, async load, relocation) get a superseded banner. Keep `**Status:** Backlogged` in the first 12 lines (docs-check exemption). |
| `docs/backlog/plan_content_folder_refactor.md` | Replace "see M0" references with a link to the ADR once accepted; drop the "ADR-0015 would need a short superseding ADR" note. |
| `README.md` (root, line ~58) | Update the plugins-backlog link text if the spec is renamed; otherwise unchanged. |

No code, tests or `package.json` change.

## 6. Tests and verification

- `npm run docs:check` (ADR index, status equality, links, anchors). Must pass with zero findings and no new allowlist entries.
- `npm run format:check` for the new Markdown.
- Run each once after the last file edit; no repeat runs without changes (Lean Testing Policy).

## 7. Debt Removed

- Two contradictory decision logs (plugins backlog Q3/Q4/Q5/Q9 vs the parent plan) collapse into one ADR.
- ADR-0015's layout (never implemented) stops reading as current.
- The ADR-0033 follow-up the plugins spec called "Content Plugin Architecture" is closed by ADR-0092 instead of staying a dangling promise.

## 8. UI and Card Editor impact

None.

## 9. Decisions (2026-10-31)

1. **ADR title: "Content Packs & Runtime Loading"** (Q34). ADR-0092 states that it fulfils the "Content Plugin Architecture" ADR the plugins spec reserved.
2. **Vocabulary: "pack" for content, "hook" for code** (Q35). "Plugin" is retired in prose except for the existing `ScenarioPlugin` interface.
3. **ADR-0011 is partially superseded** for the image-cache location (Q36).

## 10. Done when

ADR-0092 is Accepted, README table and lineage are updated, the three superseded documents point at it, and
`npm run docs:check` is clean.
