# Android Efficiency (01144a-c): "the top card of the deck"

**Status:** resolved by the user (plan #352, open decision 3, approved 2026-11-03).

## Printed text

Boost: "Choose to either spend a resource or put the top card of the deck into play facedown, engaged with you as a Drone minion."

## The ambiguity

Every other Drone card says "your deck" or "their deck". This Boost says "the deck", which could mean:

1. The boosted player's own deck, like every other Drone card.
2. The encounter deck, so an encounter card becomes a Drone and leaves the encounter deck.

## Decision

Reading 1: the boosted player's own deck. The Drone is engaged with that player, and a Drone's real card goes to its owner's discard pile (01140), which only fits a player card.

The data calls `ULTRON_DRONE` with `target: SELF`, so it uses the same action as every other Drone card.
