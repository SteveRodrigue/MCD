---
type: Changed
---

- **Refactor (UI): Board components read the game state and dispatch from one session context (AUD-20261017-232534, R8)**
  - `GameStateContext` now provides `{ state, dispatch, getPlayability }`; `App` wraps the board in `GameSessionProvider`. The `gameState` and `onDispatchAction` props are removed from `GameBoard`, `HeroZone`, `PlayerHandTray`, `TopBar`, the action modals, `CardPaymentModal`, `CombatLogDrawer`, `OptionsMenu`, `GameOverScreen`, `VillainPhaseStepper` and `TableauActionModal`.
  - The hand playability map moved from `PlayerHandTray` into the context and is built on first use, once per state.
  - `GameBoard` overrides `dispatch` for its subtree so the payment-modal interception still applies to every child.
  - ADR-0013 records that `autoResolveUnambiguous` and `villainPhaseStepping` stay in `state.options` (follow-up [#337](https://github.com/SteveRodrigue/MCD/issues/337)).
  - UI tests use the `TestSession` helper in `tests/support/render-with-session.tsx`.
