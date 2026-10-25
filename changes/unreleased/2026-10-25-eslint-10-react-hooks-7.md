---
type: Changed
---

- **Tooling: Upgraded ESLint to 10.13.0, `@eslint/js` to 10.0.1 and `eslint-plugin-react-hooks` to 7.1.1 (Dependabot PRs #411, #408)**
  - ESLint 10 cannot install with react-hooks 5, and react-hooks 7 adds the React Compiler rules, so the three move together. All rules stay on; nothing is disabled.
  - Removed nine dead assignments that ESLint 10's `no-useless-assignment` flags, including the `failureCount` counter of `scripts/simulate-games.ts`, which always printed 0 because a crash rethrows.
  - **Refactor (UI):** state that was synchronised inside effects is now derived or adjusted during render. `App` derives the game state with the UI settings applied instead of resetting it from an effect, `GameBoard` derives the End Turn prompt and follows the active hero seat in render, and the instant villain-phase pacing steps on a zero-delay timer instead of inside the effect.
  - Three small hooks replace repeated effect patterns: `useOnChange` (adjust state when a value changes), `useAsyncData` (a fetch keyed by a request, used by `useCardArt` and the Card Editor) and `useStableCallback` (one function identity that calls the latest handler, used by the hand tray).
  - `CardPaymentModal` computes its starting selection and discard cost in pure functions; `GameSessionProvider` builds its playability map through a `once` helper; `useEdgeScroll` loops through a local step function.
