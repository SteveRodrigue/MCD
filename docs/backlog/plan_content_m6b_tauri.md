# Plan — M6b: A desktop app that opens the same content

**Status:** PARKED 2026-11-01 by the owner (decision Q55); tracked in [issue #548](https://github.com/SteveRodrigue/MCD/issues/548). Not approved, not scheduled. Section 8 decisions were never answered.
**Parent:** [`plan_content_folder_refactor.md`](plan_content_folder_refactor.md) (Q5, Q21, Q23, Q26, Q43; roadmap row M6b) and [ADR-0092](../decisions/0092-content-packs-and-runtime-loading.md). Desktop storage: [ADR-0015](../decisions/0015-user-content-and-deck-storage-architecture.md).
**Depends on:** M3 (loader, `ContentDriver`), M4 (content root layout), M6 (`/card-art/<pack>/<file>` and the image cache), all merged. M7 (empty-shell UI) needs this.
**Gate note:** Gate 1 (Rhino) is active. M6b touches no engine file. Proof: the card data hash and `simulate --no-stats` output stay byte-identical, and the Rhino game in section 7 plays the same in the desktop window as in the browser.

## In-Game Scenario

**Setup:** Steve double-clicks the MCD desktop window (`npm run tauri dev` in this PR). Core is enabled, Spider-Man (Peter Parker) is picked, Rhino stage I. Player phase.
**Player does:** Starts the mission, plays a few cards, flips the main scheme, closes the window, opens it again.
**Today:** There is no desktop app. README says MCD "packages into native desktop executables via Tauri", but `src-tauri/` does not exist. Only the browser dev server works.
**After this change:** The same game opens in a native window. Heroes, scenarios and decks come from the `content/` folder (in the packaged app: the OS app-data folder). Every card shows its art: Core art is fetched once from MarvelCDB into the cache folder and reused offline. Nothing official is inside the installer.
**Why (rules):** None. This is about where the game reads its data, not gameplay.

**Scenario 2 (fresh install):** A packaged app starts on a machine with no content folder. It creates an empty one in the app-data folder and boots with zero packs (M7 draws the welcome screen; until then the existing "no content" state shows). It never crashes and never reads the repository.
**Scenario 3 (art, offline):** After one online game, the player unplugs the network and starts Rhino again. Every card seen before still shows its art.

## 1. Goal

After M6b a `ContentDriver` exists for Tauri, the card-art route works inside a Tauri window, and `tauri dev` and `tauri build` run. The browser path is unchanged. No new UI.

## 2. Facts (verified 2026-11-01 on `main`)

- **No Tauri today:** no `src-tauri/`, no `@tauri-apps/*` in `package.json`. **No Rust toolchain on this machine** (`rustc` and `cargo` not found). Installing Rust and the MSVC build tools is a prerequisite.
- **Driver seam:** `ContentDriver` has four read methods (`listFiles`, `listDirs`, `exists`, `readJson`) in `src/data/content/types.ts`. Implementations: `drivers/node-fs.ts`, `drivers/fetch.ts`. `src/main.tsx` is the only place that builds a `FetchDriver`.
- **Dev-server endpoints the browser relies on:** `/__content/*` (`content-middleware.ts`), `/card-art/<pack>/<file>.png` (`card-art-middleware.ts`, using `image-cache.ts`, Node only). Other dev plugins (game-state log, problem reports, editor) write to disk and are dev-server only.
- **Art URLs:** `src/data/content/card-art.ts` builds root-relative URLs (`CARD_ART_ROUTE = '/card-art'`). A Tauri window has its own origin, so a root-relative URL does not reach a Rust handler by itself.
- **Cache root:** `content-paths.ts` (Node only) knows the layout; the dev vs app-data root (Q26) is meant to live only there.
- **CI:** `.github/workflows/ci.yml` runs static checks, tests, build on one OS. No Rust job.

## 3. Design

### 3.1 Scaffold

`src-tauri/` with Tauri v2: `Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`, default capabilities with **no** filesystem or shell plugin and no remote URL allowed. `devUrl` points at the Vite dev server, `frontendDist` at `dist/`. Scripts: `tauri`, `tauri:dev`, `tauri:build` (the CLI is a `devDependency`).

### 3.2 Content root (Rust, one function)

`content_root()`: in a debug build, `<repo>/content` (found from the manifest dir, same layout as Q26's "dev uses the repo's `content/`"); in a release build, `<app-data>/content`, created on first start. Mirrors `content-paths.ts`; the TypeScript helper stays the only Node-side place.

### 3.3 Folder driver

Four Rust commands, one per `ContentDriver` method, each taking a path relative to the content root. Rules, identical to the dev endpoint: forward slashes, no `..`, no absolute path, only `.json` files, `.cache` and `translations` hidden from listings. `TauriDriver` in `src/data/content/drivers/tauri.ts` calls them with `invoke`. `main.tsx` picks it when the page runs inside Tauri, otherwise `FetchDriver`.

### 3.4 Art in a window

One Rust module mirrors `image-cache.ts`: pack's own art, then `content/.cache/images/<pack>/`, then (official packs only) MarvelCDB, written through a temp file and renamed. It is exposed as a Tauri custom URI scheme handler for `/card-art/<pack>/<file>.png`, so `<img src>` and the existing `CacheStorage` code keep working. `card-art.ts` gets one base constant for the route, set by the platform, instead of a second URL builder.

### 3.5 Tests and CI

- Vitest: `TauriDriver` against a fake `invoke` that serves a temp folder, through the same loader fixture the other drivers use (parity test: same `LoadedContent` as `NodeFsDriver`).
- Rust unit tests: path guard (rejects `..`, absolute, non-JSON, `.cache`), index listing, art filename pattern, atomic write.
- CI: one new job on `windows-latest` running `cargo clippy` and `cargo test` in `src-tauri/`. `tauri build` stays manual until releases are real (Q25).

## 4. Simplification & Refactor Check

- Reuse `ContentDriver` unchanged; no new interface. Reuse the loader and the M6 art naming. The only new URL knob is the art route base in `card-art.ts` (one constant, all callers already go through it).
- The Rust path guard and art-filename rules are written once and tested once; the TypeScript copies (`content-middleware.ts`, `image-cache.ts`) are the specification and stay the only Node versions.
- Not duplicated: no second manifest reader in Rust. Rust only moves bytes; the loader still parses and validates.

## 5. Debt Removed

- README's "packages into native executables via Tauri" becomes true (or is corrected to say how to run it).
- `docs/decisions/0003` and `0015` mention a `FileSystemStorageDriver`; they are updated to the real name and shape (`TauriDriver`), and ADR-0092 gets the shipped-app root rule from Q26.
- `src/main.tsx` driver choice becomes one small function instead of an inline `new FetchDriver()`.

## 6. File changes

| File                                                  | Change                                                           | Serves           |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ---------------- |
| `src-tauri/**`                                        | [NEW] scaffold, content commands, art scheme handler, Rust tests | Scenarios 1 to 3 |
| `src/data/content/drivers/tauri.ts`                   | [NEW] `TauriDriver`                                              | Scenario 1       |
| `src/data/content/card-art.ts`                        | [MODIFY] platform-set route base                                 | Scenario 3       |
| `src/main.tsx`                                        | [MODIFY] choose the driver by platform                           | Scenario 1       |
| `package.json`                                        | [MODIFY] `@tauri-apps/api`, `@tauri-apps/cli`, scripts           | Scenario 1       |
| `.github/workflows/ci.yml`                            | [MODIFY] Rust job                                                | all              |
| `tests/data/tauri-driver.test.ts`                     | [NEW] parity with `NodeFsDriver`                                 | Scenario 1       |
| `README.md`, ADRs 0003, 0015, 0092, `CONTRIBUTING.md` | [MODIFY] setup steps (Rust, MSVC), driver names                  | Debt Removed     |

## 7. UI and Card Editor

No change required. No screen is added; M7 owns onboarding. The Card Supplemental Editor keeps working in the browser dev server only; moving it onto a driver is M9.

Browser check, run once: `npm run tauri:dev`, pick Rhino and Spider-Man, start, confirm art on every card and both main scheme sides, close, reopen, unplug network, repeat. Compare against `npm run dev` in the browser.

## 8. Open decisions

1. **Tauri v2** (recommended) vs v1. v2 is current; v1 is end of life.
2. **Rust prerequisite:** Steve installs rustup and the MSVC build tools on this machine before implementation starts (recommended), or the PR is written and verified in CI only. The second cannot show Scenario 1.
3. **One PR** (recommended, like M6: the driver and art scheme are only testable inside the scaffold) vs two (scaffold first).
4. **CI:** Rust job on `windows-latest` only (recommended; the author uses Windows) vs a Linux and macOS matrix now.
5. **Packaged build content:** installer ships **no** content and creates an empty app-data folder (recommended, follows Q23 and Q25; M7 adds import) vs bundling Core JSON. Official art and card text are never bundled.
6. **Dev-only features in a Tauri window** (game-state log, problem reports, editor) are simply absent, as they are in `vite preview` today (recommended, Q43), vs porting them now.
