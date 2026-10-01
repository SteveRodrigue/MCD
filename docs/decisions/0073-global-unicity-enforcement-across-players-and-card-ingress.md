# 0073. Global Unicity Enforcement Across Players and Card Ingress

Date: 2026-10-01
Status: Accepted

## Context & Problem Statement

In Marvel Champions, cards bearing the unique icon ([unique]) represent a singular entity in the Marvel universe (Rules Reference v1.8 pp. 28–29). Under official rules:
1. A player card in an out-of-play state that matches a card in play cannot enter play (it cannot be played or put into play, and any effect attempting to do so has no effect).
2. Two unique cards match if:
   - They share a title, and both have no subtitle and no alter-ego title (e.g. two copies of *Nick Fury* or *Helicarrier*).
   - The subtitle or alter-ego title of one matches the title, subtitle, or alter-ego title of the other (e.g. *Spider-Man* `04045` with subtitle *"Peter Parker"* matches hero *Spider-Man* `01001a` and alter-ego *Peter Parker* `01001b`).
3. This unicity constraint is table-wide and global across all player tableaus, all player allies, all identities (Hero/Alter-Ego), and in-play encounter cards (villains, minions).

In GitHub Issue #187, a player was able to play *Nick Fury* (`01084`) even when another copy was already in play under a teammate's control. Investigation revealed:
1. `canPlayCard` correctly rejected duplicate plays via canonical `checkUniqueCardPlayable(state, card)`.
2. However, `evaluateCardPlayability` in `src/engine/pipeline/legality-checker.ts` ran a local-only loop:
   ```typescript
   if (card.isUnique) {
     const alreadyInPlay =
       player.allies.some((a) => a.card.name === card.name) ||
       player.tableau.some((t) => t.card.name === card.name);
     if (alreadyInPlay) {
       reasons.push(`A unique copy of '${card.name}' is already in play`);
     }
   }
   ```
   This evaluated strictly against the local player (`player`), completely ignoring other players' allies, tableaus, hero/alter-ego identities, and villains/minions.
3. Because UI components like `PlayerHandTray` rely on `evaluateCardPlayability` to determine play halos, button states, and disabled tooltips, the card was presented as playable with an active play glow.
4. Furthermore, card ingress via `PUT_INTO_PLAY` in `src/engine/effects/index.ts` lacked global unicity checks, which could allow unique cards to enter play through card effects even if a matching unique card was already in play.

## Decision Drivers

- **RR v1.8 pp. 28–29 (Unique Icon):** Global table-wide unicity must be enforced strictly across all seats, identities, tableaus, and in-play cards.
- **Engine-UI Parity:** `evaluateCardPlayability` and `canPlayCard` must evaluate identical unicity rules so the UI never displays an unplayable card as playable.
- **Ingress Safety:** No ability (e.g. `PUT_INTO_PLAY` from discard, deck, or set-aside) may put a matching unique card into play.
- **Resource Spending Legality:** Disallowing a card from entering play or being played must not prevent a player from spending that card from hand as a resource.

## Considered Options

1. **Option A: Canonical Engine & Ingress Unicity (Adopted)**
   - Wire `checkUniqueCardPlayable(state, card)` into `evaluateCardPlayability()`.
   - Add global unicity filtering in `PUT_INTO_PLAY` in `effects/index.ts`.
   - Preserve resource payment legality for unplayable unique hand cards.
2. **Option B: Local Loop Expansion in `evaluateCardPlayability`**
   - Expand the local loop in `evaluateCardPlayability` to iterate over `state.players`.
   - Rejected because duplicating `checkUniqueCardPlayable` logic violates single-source-of-truth and risks subtitled/identity persona comparison drift.

## Decision Outcome

Adopted **Option A**.

### 1. Unified Legality Evaluation (`legality-checker.ts`)
In `evaluateCardPlayability`:
```typescript
// 4. Global Unicity Constraint Check (RR v1.8 p. 28-29)
const unicityCheck = checkUniqueCardPlayable(state, card);
if (!unicityCheck.allowed && unicityCheck.reason) {
  reasons.push(unicityCheck.reason);
}
```
This guarantees full alignment with `canPlayCard` and leverages `isUniqueCollision`, checking:
- Active Hero and Alter-Ego identities across all players.
- In-play allies across all players.
- In-play tableaus (supports, upgrades) across all players.
- Engaged unique minions across all players.
- Active unique villains.

### 2. Ingress Protection in `PUT_INTO_PLAY` (`effects/index.ts`)
In `case 'PUT_INTO_PLAY'`:
```typescript
const matches = (
  step.effectParams?.target === 'SELF' && context.sourceCardInstance
    ? [context.sourceCardInstance]
    : sourceList.filter((c) => matchesCardFilter(c.card, filter, { player, state }))
).filter((c) => !c.card.isUnique || checkUniqueCardPlayable(state, c.card).allowed);
```
Per RR v1.8 p. 29 ("A player card... cannot be played or put into play. Any effect that attempts to do so has no effect"), unique cards attempting to enter play that match any in-play card are filtered out of the matched candidates.

### 3. Resource Spending Invariance
Unicity governs entering play and being played. A unique card in hand that cannot be played (e.g. *Spider-Man* `04045` in a game where Player 1 is Peter Parker) remains an eligible card to discard as a resource for paying costs.

## Consequences

### Positive
- **Issue #187 Resolved:** In multiplayer games, unique allies (*Nick Fury*) and supports/upgrades (*Avengers Mansion*, *Helicarrier*) controlled by any player correctly block duplicate copies across all other players.
- **Engine-UI Consistency:** `PlayerHandTray` immediately reflects unplayable status (`isPlayable: false`), removes active play halos, and displays the exact unicity violation in tooltips and warning banners.
- **Ingress Leak Prevention:** Effects attempting to put unique cards into play will not violate the unique rule.
- **Persona Matching Parity:** Hero/Alter-Ego persona matching (e.g., Peter Parker ally vs Peter Parker identity) is uniformly enforced in both pre-checks and UI.

### Negative / Tradeoffs
- None. `checkUniqueCardPlayable` is an in-memory iteration over current players and in-play zones, with negligible execution time.
