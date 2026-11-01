# Final plan: Theme Engine for the game

Status: **approved. All phases are done. Phase 6 (the rest of the UI, so a theme is a full skin) was carried out as N4 of [the integration plan](./PLAN_game_integration.md), with its own plan: [PLAN_board_theming.md](./PLAN_board_theming.md).** Each phase is developed, tested and committed in turn.

## 0. Decisions already made

- All 7 lab styles ship as themes: Pop-Art, Storyboard, Newsprint, Night Edition, Splash Page, Dossier, Hero HUD.
- The player either **selects a theme** or turns on **Random**: a theme is rolled when each new game starts and stays for that game.
- **Card accents** (hero colours from the upstream pack, aspect colours, villain/encounter) are a player toggle; each theme draws them its own way.
- **Verb colours never change** between themes (yellow decide, red attack/forced, blue thwart/info, purple hero special, green defend/heal).
- **Card Anchoring Rule** is mandatory: a card thumbnail whenever a card is named, its text shown, its ability used, or it triggered the modal.
- **The `src/ui/components/templates/` folder stays** as the living reference for future design: gallery, three archetype demos, sample data, the `/templates/` browser. Docs stay in `docs/templates/modals/`.
- **No commits** until you ask.

## 1. Target architecture

Today everything lives in `templates/`. The game must not import from a lab folder, so the shared parts move out
and `templates/` becomes the consumer that demonstrates them. Dependency direction: **game and templates both depend on `theme/`; `theme/` depends on neither.**

```
src/ui/theme/                       (production, new)
  modal-styles.ts                   registry of the 7 themes + tokens + verb colours   (moves from templates/)
  card-accents.ts                   accent palette + hero colours lookup               (moves)
  useModalStyle.ts, ModalStyleContext.tsx   active theme context                       (moves)
  resolve-theme.ts                  pure: fixed or random pick                          (new)
  ThemeProvider.tsx                 reads settings + per-game roll, supplies the context (new)
  ModalScaffold.tsx, CardRef.tsx, AccentStripe.tsx,
  ComicSpeech.tsx, ActionBurst.tsx, useActionBurst.ts, comic-shapes.ts                 (move)
  ThemePreview.tsx                  token-drawn mini modal, shared by gallery and picker (extracted from StyleGallery)
  ThemePicker.tsx                   the player-facing picker                            (new)

src/ui/components/templates/        (kept, lab + reference)
  ModalTemplatesScreen.tsx, StyleGallery.tsx
  DecisionTemplate.tsx, SequenceTemplate.tsx, SelectTemplate.tsx, template-data.ts, template-routes.ts
```

Moves are file moves with import updates; behaviour and the 146 lab tests stay green throughout.
An architecture test asserts that nothing under `src/ui/components/board|cards|setup` imports from `components/templates/`.

## 2. Settings and data model

Extend `GameSettings` in `src/ui/context/game-settings-context.ts` (it is already merged with `DEFAULT_SETTINGS` on
load, so old saved settings get the new keys automatically):

```ts
themeMode: 'fixed' | 'random';     // default 'fixed'
themeId: ModalStyleId;             // used when fixed; default 'pop-art'
randomThemePool: ModalStyleId[];   // eligible themes for Random; default all 7
cardAccents: boolean;              // default true
```

Stored values are validated on load: unknown theme id falls back to the default, unknown pool entries are dropped,
an empty pool means "all". No new storage key, no new store.

## 3. Resolution and Random

`resolveTheme({ mode, themeId, pool, previousId, random = Math.random }): ModalStyleId` (pure):

- fixed: returns `themeId`.
- random: uniform pick from `pool`, **never the same as `previousId`** when the pool has 2 or more.
- UI only. It never uses the engine RNG, so game determinism and replays are untouched. `src/engine/` stays headless.

Per-game lifecycle (in `App.tsx`): `handleStartSetup` resolves once into `gameThemeId` state; that theme stays through
mulligan, play and game over. A reload mid-game keeps it (`sessionStorage`, cleared on new game). The next game
rolls again with the last game's theme as `previousId`. Options shows "This game: <theme>" with a **Re-roll** button in Random mode.
Changing the fixed theme in Options applies immediately, like other settings.

## 4. Shell contract: what `ModalScaffold` must cover before real modals can use it

The lab scaffold is enough for the three demos. Real modals also need, added in Phase 1 with tests:

| Need | Scaffold addition |
|---|---|
| Dismissible modals (Options, Report a problem, card stats) | `onClose`: header close button, Escape key, optional backdrop click |
| Forced prompts above other layers | `layer` prop passed to `ModalLayer` (`modal` default, `critical`) |
| Existing tests rely on test ids and roles | `testId` already supported; real modals keep their current ids and accessible names |
| Focus and accessibility | focus moves into the dialog on open and returns on close; `aria-modal`, `aria-labelledby` (already present) |
| Different widths | `maxWidthClass` (present) |
| Header without a trigger card | `trigger={null}` (present) |

## 5. Migration scope, tier by tier (ADR-0056 keeps its 3 tiers)

Only the **shell** (backdrop, frame, header, footer) is replaced. Each modal's content and logic are untouched,
and its existing tests must pass unchanged.

| Tier | What | Files | Treatment |
|---|---|---|---|
| 1: gameplay prompts | Batch A | `WakandaForeverModal` (317 lines, closes #358), `DecisionPromptModal` (533), `SelectCardsModal` (121) | themed via `ModalScaffold` |
| 1 | Batch B | `AttackTargetModal`, `ThwartTargetModal`, `CombatBoostModal`, `DistributeAmountModal`, `SimultaneousAbilitiesModal`, `AllyActionModal`, `TableauActionModal`, `IdentityActionModal`, `CardPaymentModal` (1355) | themed |
| 3: utility | Batch C | `OptionsMenu`, `ReportProblemModal`, `CardStatsModal`, `ResetCardStatsConfirmModal`, `GameOverScreen` | themed |
| 2: in-universe newspapers | `DailyBugleActionNewspaper`, `EndTurnConfirmationModal` | planned as exempt (they stay The Daily Bugle in every theme); later they became Newspaper kit pages that follow the theme (board plan, phase 8) |
| Not modals | `CombatLogDrawer`, `DevStepErrorBanner`, `RemovedFromGameBox`, hand tray and zone overlays | out of scope here; done in Phase 6 (N4) |

Each migrated file also drops its `border-3` classes (that utility does not exist in our Tailwind config, so those
borders silently never render). Fixed in the same change, as debt in the path; the remaining uses are tracked in issue #373.

## 6. Phases (each shippable, each verified before the next)

| # | Scope | You can see | Verification | Est. |
|---|---|---|---|---|
| 1 (done) | Move shared files to `src/ui/theme/`; `resolve-theme.ts`; settings keys + validation; `ThemeProvider` at the App root; scaffold additions (section 4); architecture test | nothing changes in the game; lab identical | lab tests, new unit tests, tsc, eslint | 1 session |
| 2 (done) | Migrate Batch A (Wakanda, Decision, Select) | these three follow the theme (default Pop-Art) | their existing tests (`wakanda-forever-modal`, `DecisionPromptModal`, `SelectCardsModal`) + theme matrix | 1 session |
| 3 (done) | `ThemePicker` in Options and on the setup screen; Random mode, pool, Re-roll, card-accent switch; per-game roll in `App.tsx` | player picks a theme or Random; Random changes per game | picker/provider/App-flow tests, browser run of a full game start | 1 session |
| 4 (done) | Migrate Batch B | all gameplay prompts themed | each modal's existing tests + matrix; browser pass per modal | 2 to 3 sessions |
| 5 (done) | Migrate Batch C | utility dialogs themed | same | 1 session |
| 6 (done, as N4) | Board chrome (top bar, zones, hand tray, drawers) so a theme is a full skin | whole UI themed | visual pass | 2 sessions |

Phases 2 and 3 are ordered so the picker never ships before at least the key modals respond to it.
Phases 4 and 5 can each be split by modal if you prefer smaller reviews.

## 7. Tests

- `resolveTheme`: fixed; random with injected RNG; no immediate repeat; pool filtering; empty pool; invalid id.
- Settings: defaults, persistence round trip, old saved settings without theme keys, invalid stored values.
- `ThemeProvider`: fixed applies; random rolls once per game and survives re-render; a new game re-rolls; reload keeps the roll.
- `ModalScaffold` additions: close button, Escape, backdrop click, focus in and out, `layer`.
- Per migrated modal: renders under every theme (the lab's matrix pattern) and passes the Card Anchoring check.
- Architecture: nothing in the game imports from `components/templates/`.
- Targeted runs only (`vitest run <files>`); the full suite stays with the pre-push hook.

## 8. Quality gates

- Tailwind only sees literal class strings: no class built by interpolation in tokens.
- Contrast check per theme (Night, Hero HUD, Dossier are the risky ones); `prefers-reduced-motion` already respected by bursts.
- Bundle: tokens are small; the lab stays lazy-loaded so players do not download it.
- `tsc`, `eslint --max-warnings 0`, `prettier --check` on changed files.

## 9. Docs and ADR

- New **ADR-0091 "Themeable modal system"**: amends ADR-0056 (one pop-art style becomes a registry of themes; the 3 tiers stay;
  verb colours fixed; Card Anchoring Rule; the Daily Bugle was planned exempt and later followed the theme). Registered in `docs/decisions/README.md`.
- `docs/engine/coding_guidelines.md`: pointer to the scaffold and Card Anchoring Rule for new modals.
- `docs/templates/modals/`: README and styles.md updated for the `theme/` move; this plan marked done as phases land.

## 10. Simplification & Refactor Check

- One registry, one scaffold, one provider replace roughly 20 hand-written modal shells.
- Settings extend the existing context; no new store.
- Lab keeps its own demos but imports the shared code; nothing duplicated.
- Merge candidates found while migrating (similar option-row and confirm-button markup across Batch B) become tokens or scaffold parts, not copies.

## 11. Debt Removed

- ~20 divergent modal shells, the 10 silent `border-3` no-ops, mock card boxes in `WakandaForeverModal` (#358),
  card names written as plain text in modal prose.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Random theme on modals only looks mixed with the board until Phase 6 | Ship the picker only after Batch A; make Phase 6 an explicit follow-up decision |
| `CardPaymentModal` (1355 lines) is hard to reshape | Swap only the outer shell; content untouched; its two payment tests guard it |
| A theme hurts readability in a long session | Contrast check per theme; Pop-Art stays the default; the player can switch any time |
| Test ids or accessible names change and break existing tests | Keep them; the migration rule is "existing tests pass unchanged" |

## 13. Open decisions (defaults in bold)

1. Daily Bugle newspapers exempt from theming: **yes** (ADR-0056).
2. `/templates/` route: **dev-only in production builds** (folder and docs stay either way). Or keep it reachable for players?
3. Phase 6 (board chrome): **decide after Phase 3**, once you have seen themed modals in a real game.
4. Pop-Art as the default theme for new players: **yes**.
