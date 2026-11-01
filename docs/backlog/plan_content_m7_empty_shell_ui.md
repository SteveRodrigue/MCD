# Plan — M7: The game explains itself when there is no content

**Status:** draft 2026-11-01, waiting for review together with [M8](plan_content_m8_leak_guard.md) (open decisions in section 8).
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q12, Q22, Q28, Q45, Q55; roadmap row M7, section 3.5) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md).
**Depends on:** M2, M3 (merged). **Not** on the desktop app: Q55 parked it (issue #548), so M7 runs on the dev-server driver only.
**Gate note:** Gate 1 (Rhino) is active. M7 touches no engine file. Proof: seeded Rhino game and `simulate --no-stats` stay byte-identical, and the browser check in section 7.

## In-Game Scenario

**Setup:** A fresh checkout where `content/config.json` lists no pack (`"enabledPacks": []`). `npm run dev`.
**Player does:** Opens the game.
**Today:** The Mission Control screen shows one line, "No scenario available: enable a content pack." Nothing says what a pack is, where to get content, or how to enable it. The hero and deck pickers assume content exists.
**After this change:** A comic-style welcome screen says there is no content yet and that MCD is an unofficial fan project (not affiliated with Fantasy Flight Games or Marvel). It lists the three ways to get content, each honest about its state today: **Sync official data** (shows the exact command, `npm run content:sync`, with a copy button, then "enable the pack in `content/config.json`"), **Add content folder** and **Import pack (zip)** (visible but disabled, with the reason "needs the desktop app or browser import, not built yet"). A **Content** screen lists every pack found on disk with a status: **Playable**, **Data only** (cards but no supplemental data, or not enabled), **Needs Core** (a dependency is missing) or **Failed**, with the loader's reason.
**Why (rules):** None. This is about onboarding, not gameplay.

**Scenario 2 (partial collection):** Only `core` is enabled, but a scenario of another pack is on disk. In Mission Control that scenario is listed but disabled, with "Needs Green Goblin" (Q22). Rhino still starts normally.
**Scenario 3 (a broken pack):** An enabled user pack has a bad `pack.json`. The game still starts with the other packs; the Content screen shows that pack as **Failed** with the reason, and one line names it on the welcome or setup screen.
**Scenario 4 (Core only, today's play):** With `core` enabled nothing changes at the table: the welcome screen never appears and Rhino plays exactly as before.

## 1. Goal

After M7 a zero-pack or partial install is a supported, explained state. No new way to write content is added (that needs a write path, Q24).

## 2. Facts (verified 2026-11-01 on `main`)

- `src/main.tsx` boots through `bootContent(new FetchDriver('/__content'))`; failures are only `console.warn`ed.
- `ScenarioSelector` (`src/ui/components/setup/ScenarioSelector.tsx`, bottom) already shows the one-line "no scenario" state when `ScenarioRegistry` is empty. `tests/ui/zero-pack-smoke.test.tsx` proves zero-pack boot does not throw (Q28); an empty-directory loader test exists in `tests/data/content-loader.test.ts`.
- `LoadedContent` holds loaded packs and `failures`, nothing about packs on disk that are not enabled. `scripts/pack-status.ts` derives Playable-style facts for agents from the files (Q45); the UI has no equivalent.
- The dev endpoint index (`/__content/index.json`) lists every `.json` under `content/` except `.cache` and `translations`, so manifests and folder shapes of all packs are visible to the browser without reading card files.
- `content/config.json` is tracked and read-only to the browser. No write endpoint exists, and Q24 says dev middleware is not to grow.
- README already has a "Legal Disclaimer" section (line 161); the welcome-screen and README wording promised by Q12 is not there.
- Tauri and zip import do not exist (Q55, M11).

## 3. Design

### 3.1 One shared description of packs

Add to the loader, next to `loadContent`, `describePacks(driver, loaded)`: for every folder in `content/packs/` return `{ id, name, origin, state, reason? }` with `state` one of `playable | data-only | needs-pack | failed` (Q45). It reuses the loader's existing dependency resolution and failure list, and reads only manifests and the index (no card files for packs that are not enabled). `scripts/pack-status.ts` is changed to call the same function in Node, so there is one definition of "Data only" (this removes a duplicate rule, not just adds one). `bootContent` keeps the result in the content store so the UI reads it synchronously.

### 3.2 Screens

- **WelcomeScreen** (new, comic style): shown by `App` instead of Mission Control when no scenario is registered. Fan-project disclaimer, the three actions of the scenario above, a link to `docs/creators/` once M10 lands (plain text path until then).
- **ContentScreen** (new): the pack list. Reached from the welcome screen and from a small "Content" button in the setup header.
- **ScenarioSelector**: scenarios whose pack is missing render disabled with "Needs <pack name>" (Q22); the existing one-line empty state is deleted in favour of the welcome screen.
- **Hero and deck pickers**: an empty pack list shows a short "no heroes: enable a pack" line instead of an empty select.
- A **Failed pack** line on the setup screen replaces the console-only warning.

All new strings go through the existing locale files (`src/locales/en` and `fr`).

### 3.3 Not in M7

Writing `content/config.json` from the UI, adding a folder, zip import, any desktop packaging. The buttons exist, disabled with a reason, so the welcome screen is honest and M11 only has to enable them.

## 4. Simplification & Refactor Check

- Reuse the loader's dependency resolution and failure list; do not re-derive them in the UI.
- `pack-status.ts` and the new UI use one `describePacks`; the script's private "with supplemental / data only" rule is deleted.
- The one-line empty branch of `ScenarioSelector` is deleted, not kept beside the welcome screen.
- No new store: the pack description rides in the existing content store.

## 5. Debt Removed

- The console-only `warn` of failed packs in `main.tsx`.
- The duplicated "data only" rule in `scripts/pack-status.ts`.
- The "polished empty state is M7" placeholders in `ScenarioSelector.tsx` and `tests/ui/zero-pack-smoke.test.tsx`.
- README gains the unofficial-fan-project statement (Q12) beside the existing legal section.

## 6. File changes

| File | Change | Serves |
| --- | --- | --- |
| `src/data/content/loader.ts`, `types.ts`, `apply.ts`, `store.ts` | [MODIFY] `describePacks`, keep result in store | Scenarios 1 to 3 |
| `scripts/pack-status.ts` | [MODIFY] use `describePacks` | Debt Removed |
| `src/ui/components/setup/WelcomeScreen.tsx` | [NEW] | Scenario 1 |
| `src/ui/components/setup/ContentScreen.tsx` | [NEW] | Scenarios 1 to 3 |
| `src/ui/components/setup/ScenarioSelector.tsx` | [MODIFY] disabled-with-reason, drop one-line empty state | Scenario 2 |
| `src/ui/App.tsx`, `src/main.tsx` | [MODIFY] route to the new screens, drop `console.warn` | Scenarios 1, 3 |
| `src/locales/{en,fr}/*.json` | [MODIFY] new strings | all |
| `README.md` | [MODIFY] unofficial-fan-project statement | Q12 |

## 7. UI and Card Editor

UI: the files above. Comic pop-art style kept (panels, Bangers headings, `ToneButton`). Card Supplemental Editor: no change required (it only needs packs loaded, which is unchanged).

Browser check, run once: (1) `enabledPacks: []`: welcome screen, disclaimer, three actions (two disabled with reason), Content screen lists packs with states; (2) `["core"]`: no welcome screen, Rhino plays as before; (3) temporarily corrupt a user pack's `pack.json`: other packs load, Failed row with reason.

## 8. Tests

- `tests/data/describe-packs.test.ts`: playable, data-only, needs-pack, failed, over a temp content folder (one test per state, named after Scenarios 1 to 3).
- `tests/ui/welcome-screen.test.tsx`: zero packs shows the welcome screen, the disclaimer and the disabled actions (extends the existing zero-pack smoke test).
- `tests/ui/content-screen.test.tsx`: statuses and failure reason.
- `tests/ui/scenario-selector.test.tsx`: scenario of a missing pack is disabled with the pack name (Scenario 2).
- Existing parity gate unchanged.

## 9. Open decisions

1. **Sync button runs nothing** (recommended): it shows the command and a copy button. Alternative: a dev-server endpoint that runs the sync. It would be dev-only and writes to disk, which Q24 argues against.
2. **Enabling a pack stays a manual edit** of `content/config.json` (recommended; M7 is read-only). Alternative: a write endpoint now.
3. **Content screen entry point:** a header button on setup (recommended) vs welcome screen only.
4. **Language:** new strings in English and French now (recommended; matches today's locale files) vs English only with French marked untranslated.
5. **Order with M8:** M7 first, as Q15 says (recommended). The two touch no common file, so M8 may go first without conflict.
