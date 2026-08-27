import {
  GameState,
  GamePhase,
  VillainPhaseStep,
  StatusCard,
  CardType,
  CardInstance,
  SideSchemeCard,
  MinionCard,
} from '@engine/models';
import { dispatchTrigger } from '../triggers';
import { executeEffect } from '../effects';

/**
 * Helper to draw the top card of the encounter deck.
 * If empty, increments acceleration tokens, shuffles discard pile to create a new deck (RR v1.8 p. 11).
 */
export function drawEncounterCard(state: GameState): CardInstance | undefined {
  if (state.encounterDeck.length === 0) {
    if (state.encounterDiscard.length === 0) return undefined;

    // Place 1 acceleration token on main scheme
    state.accelerationTokens += 1;
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'encounter.deck.empty',
      onomatopoeia: 'ACCELERATION!',
    });

    // Shuffle discard into deck
    state.encounterDeck = [...state.encounterDiscard].sort(() => Math.random() - 0.5);
    state.encounterDiscard = [];
  }

  return state.encounterDeck.shift();
}

/**
 * Step 1: Place Threat on Main Scheme (RR v1.8 p. 31)
 */
export function step1_placeThreat(state: GameState): GameState {
  state.villainPhaseStep = VillainPhaseStep.MAIN_SCHEME_THREAT;
  const playerCount = state.players.length;

  // Escalation threat per player + acceleration tokens + side scheme acceleration icons
  let totalThreatToAdd = state.mainScheme.card.escalationThreat * playerCount + state.accelerationTokens;

  for (const sideScheme of state.sideSchemes) {
    const card = sideScheme.card as SideSchemeCard;
    if (card.hasAcceleration) {
      totalThreatToAdd += 1;
    }
  }

  state.mainScheme.threat += totalThreatToAdd;

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'villainPhase.step1.threatPlaced',
    params: {
      amount: totalThreatToAdd,
      currentThreat: state.mainScheme.threat,
      targetThreat: state.mainScheme.targetThreat,
    },
    onomatopoeia: 'SCHEME GROWS!',
  });

  // Check Villain Victory condition (Main scheme threat overflow)
  if (state.mainScheme.threat >= state.mainScheme.targetThreat) {
    state.winner = 'VILLAIN';
  }

  return state;
}

/**
 * Step 2: Villain Activations (RR v1.8 p. 31, p. 7 "Attack", p. 25 "Scheme", p. 8 "Boost")
 */
export function step2_villainActivations(state: GameState): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;

  for (let i = 0; i < state.players.length; i++) {
    // In player order starting from firstPlayerIndex
    const playerIdx = (state.firstPlayerIndex + i) % state.players.length;
    const player = state.players[playerIdx];

    if (player.currentForm === 'hero') {
      // 1. Villain Attacks Hero
      const stunIndex = state.villain.statusCards.indexOf(StatusCard.STUNNED);
      if (stunIndex !== -1) {
        state.villain.statusCards.splice(stunIndex, 1);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'villain.stunned.cancelled',
          params: { villain: state.villain.card.name },
          onomatopoeia: 'STUN CLEARED!',
        });
        continue;
      }

      // Timing Window 2 (Interrupts): Villain Initiates Attack (Data-Driven, e.g. Spider-Sense)
      dispatchTrigger(state, 'VILLAIN_INITIATES_ATTACK', { targetPlayerId: player.id });

      // Check Attachments for Attack Modifiers and Overkill
      let attachmentBonus = 0;
      let hasOverkill = false;
      const attachmentsToDiscard: CardInstance[] = [];

      for (const att of state.villain.attachments) {
        if (att.card.code === '01100') {
          attachmentBonus += 1; // Enhanced Ivory Horn +1 ATK
        } else if (att.card.code === '01099') {
          attachmentBonus += 3; // Charge +3 ATK & Overkill
          hasOverkill = true;
          attachmentsToDiscard.push(att);
        }
      }

      // Draw Boost Card
      const boostCard = drawEncounterCard(state);
      const boostIcons = boostCard ? boostCard.card.boostIcons || 0 : 0;
      const baseAttack = state.villain.card.attack || 0;
      let totalAttack = baseAttack + attachmentBonus + boostIcons;

      if (boostCard) {
        state.encounterDiscard.push(boostCard);
      }

      // Timing Window 2 (Defense Interrupts): Take Attack Damage (Data-Driven, e.g. Backflip)
      const defenseResult = dispatchTrigger(state, 'TAKE_ATTACK_DAMAGE', {
        targetPlayerId: player.id,
        damageAmount: totalAttack,
      });

      totalAttack = defenseResult.damageAmount ?? totalAttack;

      // Discard single-use attachments (e.g. Charge)
      for (const att of attachmentsToDiscard) {
        const idx = state.villain.attachments.indexOf(att);
        if (idx !== -1) {
          state.villain.attachments.splice(idx, 1);
          state.encounterDiscard.push(att);
        }
      }

      // Check Tough on Hero
      const toughIndex = player.statusCards.indexOf(StatusCard.TOUGH);
      if (toughIndex !== -1 && totalAttack > 0) {
        player.statusCards.splice(toughIndex, 1);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'hero.tough.absorbed',
          params: { player: player.name },
          onomatopoeia: 'CLANG! (TOUGH)',
        });
      } else if (totalAttack > 0) {
        player.health = Math.max(0, player.health - totalAttack);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'villain.attack.hit',
          params: {
            villain: state.villain.card.name,
            player: player.name,
            damage: totalAttack,
            boost: boostIcons,
            overkill: hasOverkill ? 'true' : 'false',
          },
          onomatopoeia: 'WHAM!',
        });

        if (player.health <= 0) {
          state.winner = 'VILLAIN';
        }
      }
    } else {
      // 2. Villain Schemes against Alter-Ego
      const confuseIndex = state.villain.statusCards.indexOf(StatusCard.CONFUSED);
      if (confuseIndex !== -1) {
        state.villain.statusCards.splice(confuseIndex, 1);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'villain.confused.cancelled',
          params: { villain: state.villain.card.name },
          onomatopoeia: 'CONFUSION CLEARED!',
        });
        continue;
      }

      // Draw Boost Card
      const boostCard = drawEncounterCard(state);
      const boostIcons = boostCard ? boostCard.card.boostIcons || 0 : 0;
      const baseScheme = state.villain.card.scheme || 0;
      const totalScheme = baseScheme + boostIcons;

      if (boostCard) {
        state.encounterDiscard.push(boostCard);
      }

      state.mainScheme.threat += totalScheme;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        key: 'villain.scheme.threat',
        params: {
          villain: state.villain.card.name,
          threat: totalScheme,
          boost: boostIcons,
        },
        onomatopoeia: 'SCHEME!',
      });

      if (state.mainScheme.threat >= state.mainScheme.targetThreat) {
        state.winner = 'VILLAIN';
      }
    }
  }

  return state;
}

/**
 * Step 3: Minion Activations (RR v1.8 p. 31)
 */
export function step3_minionActivations(state: GameState): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.MINION_ACTIVATIONS;

  for (const player of state.players) {
    for (const minion of player.engagedMinions) {
      const minionCard = minion.card as MinionCard;

      if (player.currentForm === 'hero') {
        const attackDamage = minionCard.attack || 1;
        const toughIndex = player.statusCards.indexOf(StatusCard.TOUGH);

        if (toughIndex !== -1) {
          player.statusCards.splice(toughIndex, 1);
        } else {
          player.health = Math.max(0, player.health - attackDamage);
          if (player.health <= 0) {
            state.winner = 'VILLAIN';
          }
        }
      } else {
        const schemeThreat = minionCard.scheme || 1;
        state.mainScheme.threat += schemeThreat;
        if (state.mainScheme.threat >= state.mainScheme.targetThreat) {
          state.winner = 'VILLAIN';
        }
      }
    }
  }

  return state;
}

/**
 * Step 4: Deal Encounter Cards (RR v1.8 p. 32)
 */
export function step4_dealEncounterCards(state: GameState): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;

  // Check Hazard icons count from side schemes
  let hazardCount = 0;
  for (const sideScheme of state.sideSchemes) {
    const card = sideScheme.card as SideSchemeCard;
    if (card.hasHazard) hazardCount += 1;
  }

  // 1 card per player
  for (let i = 0; i < state.players.length; i++) {
    const playerIdx = (state.firstPlayerIndex + i) % state.players.length;
    const card = drawEncounterCard(state);
    if (card) {
      state.players[playerIdx].dealtEncounterCards.push(card);
    }
  }

  // Extra cards for hazard icons to first player
  for (let h = 0; h < hazardCount; h++) {
    const extraCard = drawEncounterCard(state);
    if (extraCard) {
      state.players[state.firstPlayerIndex].dealtEncounterCards.push(extraCard);
    }
  }

  return state;
}

/**
 * Step 5: Reveal and Resolve Encounter Cards (RR v1.8 p. 32)
 */
export function step5_revealEncounterCards(state: GameState): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.REVEAL_ENCOUNTER_CARDS;

  for (let i = 0; i < state.players.length; i++) {
    const playerIdx = (state.firstPlayerIndex + i) % state.players.length;
    const player = state.players[playerIdx];

    while (player.dealtEncounterCards.length > 0) {
      const cardInstance = player.dealtEncounterCards.shift()!;
      const card = cardInstance.card;

      if (card.type === CardType.MINION) {
        // Enters play engaged with this player
        player.engagedMinions.push(cardInstance);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'encounter.reveal.minion',
          params: { player: player.name, minion: card.name },
          onomatopoeia: 'MINION SPAWNS!',
        });
      } else if (card.type === CardType.SIDE_SCHEME) {
        const sideSchemeCard = card as SideSchemeCard;
        const baseThreat = sideSchemeCard.baseThreat * (sideSchemeCard.baseThreatFixed ? 1 : state.players.length);
        state.sideSchemes.push({
          instanceId: cardInstance.instanceId,
          card: sideSchemeCard,
          threat: baseThreat,
        });
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'encounter.reveal.sideScheme',
          params: { sideScheme: card.name, threat: baseThreat },
          onomatopoeia: 'SIDE SCHEME!',
        });
      } else if (card.type === CardType.ATTACHMENT) {
        state.villain.attachments.push(cardInstance);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'encounter.reveal.attachment',
          params: { attachment: card.name, host: state.villain.card.name },
          onomatopoeia: 'ATTACHED!',
        });
      } else {
        // Treachery generic resolution: execute declarative WHEN_REVEALED
        const abilities = card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'FORCED_RESPONSE') {
            executeEffect(state, ability, { playerId: player.id, sourceCardInstance: cardInstance });
          }
        }
        state.encounterDiscard.push(cardInstance);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'encounter.reveal.treachery',
          params: { card: card.name },
          onomatopoeia: 'TREACHERY!',
        });
      }
    }
  }

  return state;
}

/**
 * Step 6: Pass First Player Token & End of Round Upkeep (RR v1.8 p. 32)
 */
export function step6_passFirstPlayerAndRoundUpkeep(state: GameState): GameState {
  state.villainPhaseStep = VillainPhaseStep.PASS_FIRST_PLAYER;

  // 1. Pass First Player Token
  state.firstPlayerIndex = (state.firstPlayerIndex + 1) % state.players.length;
  state.activePlayerIndex = state.firstPlayerIndex;

  // 2. Ready all player cards & reset round flags
  for (const player of state.players) {
    // Discard round-end allies (e.g. Nick Fury 01084)
    const endRoundAllies = player.allies.filter((a) => a.card.code === '01084');
    for (const ally of endRoundAllies) {
      const idx = player.allies.indexOf(ally);
      if (idx !== -1) {
        player.allies.splice(idx, 1);
        player.discard.push(ally);
      }
    }

    // Ready identity
    player.exhausted = false;
    player.formChangedThisRound = false;
    player.recoveryUsedThisRound = false;

    // Ready allies
    for (const ally of player.allies) {
      ally.exhausted = false;
    }

    // Ready tableau
    for (const card of player.tableau) {
      card.exhausted = false;
    }

    // 3. Draw up to printed Hand Size (Hero vs Alter-Ego hand size)
    const printedHandSize =
      player.currentForm === 'hero' ? player.hero.handSize : player.alterEgo.handSize;

    const cardsToDraw = Math.max(0, printedHandSize - player.hand.length);
    for (let d = 0; d < cardsToDraw; d++) {
      if (player.deck.length === 0) {
        // Player deck cycle rule (RR v1.8 p. 12): Shuffle discard into deck + deal 1 facedown encounter card
        if (player.discard.length > 0) {
          player.deck = [...player.discard].sort(() => Math.random() - 0.5);
          player.discard = [];
          const extraEncounter = drawEncounterCard(state);
          if (extraEncounter) {
            player.dealtEncounterCards.push(extraEncounter);
          }
        }
      }
      const drawn = player.deck.shift();
      if (drawn) {
        player.hand.push(drawn);
      }
    }
  }

  // 4. Increment Round & return to Player Phase
  state.roundNumber += 1;
  state.phase = GamePhase.PLAYER_PHASE;
  delete state.villainPhaseStep;

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'round.upkeep.complete',
    params: { round: state.roundNumber },
    onomatopoeia: 'NEW ROUND!',
  });

  return state;
}

/**
 * Complete Villain Phase Automation Runner
 */
export function executeVillainPhase(state: GameState): GameState {
  const nextState: GameState = JSON.parse(JSON.stringify(state));
  nextState.phase = GamePhase.VILLAIN_PHASE;

  nextState.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    round: nextState.roundNumber,
    phase: GamePhase.VILLAIN_PHASE,
    key: 'phase.villain_phase.start',
    params: { round: nextState.roundNumber },
    onomatopoeia: 'VILLAIN PHASE!',
  });

  step1_placeThreat(nextState);
  if (nextState.winner) return nextState;

  step2_villainActivations(nextState);
  if (nextState.winner) return nextState;

  step3_minionActivations(nextState);
  if (nextState.winner) return nextState;

  step4_dealEncounterCards(nextState);
  if (nextState.winner) return nextState;

  step5_revealEncounterCards(nextState);
  if (nextState.winner) return nextState;

  step6_passFirstPlayerAndRoundUpkeep(nextState);
  return nextState;
}
