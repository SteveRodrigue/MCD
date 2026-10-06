# [ADR-0079] Player Elimination Removes the Player from `state.players`

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Owner & Claude
- **Related Issues:** #246 (player elimination), #274 (permanent cards), ADR-0078 (one damage pipeline)

---

## Context

A hero at 0 hit points ended the game for the heroes: eleven engine places wrote `state.winner = 'VILLAIN'` as soon as one identity fell. RR v1.8 *Player Elimination* says otherwise: only that player is eliminated, the others continue, and the players lose when **all** are eliminated. The rule holds for one player controlling several heroes as well as for several players.

## Decision

1. **`eliminatePlayer(state, playerId)` (`pipeline/player-elimination.ts`) is the only way a hero leaves the game.** It runs the five rule steps in order: the first player token passes clockwise; engaged minions engage the next clockwise player with everything they carry; cards in the play area the player does not own go to their owner's discard pile (encounter cards to the encounter discard pile); cards the player owns that sit in another play area join the player's discard pile; the play area leaves the game. When no player is left it sets `state.winner = 'VILLAIN'`. Permanent cards are #274.
2. **The player is removed from `state.players`** and kept in `state.eliminatedPlayers` (for the game-over screen and the log). Every effect that reads "the players" then ignores eliminated players with no filter, as the rules require. `firstPlayerIndex` and `activePlayerIndex` are re-based by the function.
3. **The per-player icon does not change on elimination** (RR v1.8). `getPerPlayerCount(state)` (`models/state.ts`) is `players.length + eliminatedPlayers.length` and is what every per-player value reads at runtime: escalation threat, side scheme threat, `perPlayer` effect amounts, scenario stage values. `state.players.length` keeps its meaning for "who is still playing" (turn order, "choose a player" prompts).
4. **A loop that can eliminate a player iterates a snapshot of player ids**, looks the player up by id on each pass and skips one that is gone (the activation queue already worked this way; the encounter reveal loop and the `ALL_CHARACTERS` damage loop were converted). A player never acts twice and no one is skipped.
5. **Defeat paths:** the damage pipeline, the distribute-points damage (formerly two hand-written copies, now through `applyDamageToTarget`) and the enemy attack damage call `eliminatePlayer` after `dispatchDefeat`. An attack whose target was eliminated ends: no Retaliate and no minion forced responses afterwards. Main scheme completion stays a group loss written directly.
6. **UI:** `GameOverScreen` shows victory or defeat with every hero, the fallen ones marked defeated. With no player left, `GameBoard` shows only that screen.

## Consequences

- Eight tests that asserted "one hero down means defeat" now assert elimination.
- Setup-time scenario values (`onGameSetup`) still read `state.players.length`, which is the starting count at that moment.
- A card effect that must count eliminated players for another reason has `eliminatedPlayers`.
