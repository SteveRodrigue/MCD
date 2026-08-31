import {
  GameState,
  GamePhase,
  VillainPhaseStep,
  StatusCard,
  CardType,
  CardInstance,
  SideSchemeCard,
  MinionCard,
  PlayerState,
} from '@engine/models';
import { dispatchTrigger } from '../triggers';
import { executeEffect } from '../effects';
import { handleMainSchemeCompletion } from './scenario-helpers';
import {
  getEffectiveVillainStats,
} from './stat-calculator';
import { executeEnemyAttackSynchronously } from './combat-pipeline';

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

    // Shuffle encounter discard into deck
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
    return handleMainSchemeCompletion(state, state.mainScheme.instanceId);
  }

  return state;
}

/**
 * Executes a single villain attack against a target hero (including triggers, boost cards, and defense).
 */
export function executeVillainAttackAgainstPlayer(state: GameState, player: PlayerState): void {
  executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, player.id, 'TAKE_UNDEFENDED');
}

/**
 * Executes a single villain scheme against a target alter-ego or on-demand (Advance 01186).
 */
export function executeVillainSchemeAgainstPlayer(state: GameState, player: PlayerState): void {
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
    return;
  }

  // Draw Boost Card
  const boostCard = drawEncounterCard(state);
  const boostIcons = boostCard ? boostCard.card.boostIcons || 0 : 0;
  const villainStats = getEffectiveVillainStats(state, state.villain);
  const baseScheme = villainStats.scheme;
  const totalScheme = baseScheme + boostIcons;

  if (boostCard) {
    state.encounterDiscard.push(boostCard);
  }

  // Threat Placement Trigger (e.g. Emergency 01085 Interrupt)
  const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
    targetPlayerId: player.id,
    threatAmount: totalScheme,
  });
  const finalThreat = triggerRes.threatAmount ?? totalScheme;

  state.mainScheme.threat += finalThreat;
  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'villain.scheme.threat',
    params: {
      villain: state.villain.card.name,
      threat: finalThreat,
      boost: boostIcons,
    },
    onomatopoeia: 'SCHEME!',
  });

  if (state.mainScheme.threat >= state.mainScheme.targetThreat) {
    state.winner = 'VILLAIN';
  }
}

/**
 * Executes a single minion attack against a hero.
 */
export function executeMinionAttackAgainstPlayer(state: GameState, minion: CardInstance, player: PlayerState): void {
  executeEnemyAttackSynchronously(state, { type: 'MINION', card: minion }, player.id, 'TAKE_UNDEFENDED');

  // Forced Responses on minion attack (e.g. Sandman 01102: discard top 2 cards of encounter deck)
  const abilities = minion.card.enrichment?.abilities || [];
  for (const ability of abilities) {
    if (ability.trigger === 'MINION_ATTACKED' || (ability.timing === 'FORCED_RESPONSE' && ability.trigger === 'ATTACK')) {
      executeEffect(state, ability, { playerId: player.id, sourceCardInstance: minion });
    }
  }
}

/**
 * Executes a single minion scheme against an alter-ego.
 */
export function executeMinionSchemeAgainstPlayer(state: GameState, minion: CardInstance, player: PlayerState): void {
  const minionCard = minion.card as MinionCard;
  const schemeThreat = minionCard.scheme || 1;
  const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
    targetPlayerId: player.id,
    threatAmount: schemeThreat,
  });
  const finalThreat = triggerRes.threatAmount ?? schemeThreat;

  state.mainScheme.threat += finalThreat;
  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'minion.scheme.threat',
    params: {
      minion: minion.card.name,
      player: player.name,
      threat: finalThreat,
    },
    onomatopoeia: 'MINION SCHEMES!',
  });

  if (state.mainScheme.threat >= state.mainScheme.targetThreat) {
    state.winner = 'VILLAIN';
  }
}

/**
 * Executes a single minion activation against a player (Attack if hero, Scheme if alter-ego).
 */
export function executeMinionActivationAgainstPlayer(state: GameState, minion: CardInstance, player: PlayerState): void {
  if (player.currentForm === 'hero') {
    executeMinionAttackAgainstPlayer(state, minion, player);
  } else {
    executeMinionSchemeAgainstPlayer(state, minion, player);
  }
}

/**
 * Step 2: Villain & Minion Activations (RR v1.8 p. 22: Interleaved Player-by-Player Activation Loop)
 * In player order starting from firstPlayerIndex:
 * 1. The villain activates against the player (Attack if hero, Scheme if alter-ego).
 * 2. Each minion engaged with that player activates against the player (Attack if hero, Scheme if alter-ego).
 */
export function step2_villainAndMinionActivations(state: GameState): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;

  for (let i = 0; i < state.players.length; i++) {
    // In player order starting from firstPlayerIndex
    const playerIdx = (state.firstPlayerIndex + i) % state.players.length;
    const player = state.players[playerIdx];

    // 1. Villain activates against this player
    if (player.currentForm === 'hero') {
      executeVillainAttackAgainstPlayer(state, player);
    } else {
      executeVillainSchemeAgainstPlayer(state, player);
    }

    if (state.winner) return state;

    // 2. Each minion engaged with this player activates against this player
    for (const minion of player.engagedMinions) {
      executeMinionActivationAgainstPlayer(state, minion, player);
      if (state.winner) return state;
    }
  }

  return state;
}

// Backward-compatible alias for Step 2
export const step2_villainActivations = step2_villainAndMinionActivations;

/**
 * Step 3: Minion Activations (Deprecated standalone step; now interleaved in Step 2 per RR v1.8 p. 22).
 * Kept as an optional direct-call helper if needed by legacy tests.
 */
export function step3_minionActivations(state: GameState): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.MINION_ACTIVATIONS;

  for (const player of state.players) {
    for (const minion of player.engagedMinions) {
      executeMinionActivationAgainstPlayer(state, minion, player);
      if (state.winner) return state;
    }
  }

  return state;
}

/**
 * Step 4: Deal Encounter Cards (RR v1.8 p. 11, p. 22, p. 32 & FFG Heroic Mode)
 * 1. Pass 1 (Base & Heroic): Deal 1 + heroicLevel encounter cards to each player in player order, starting with First Player.
 * 2. Pass 2 (Hazard Icons): Deal 1 additional encounter card for each active Hazard icon sequentially in player order starting with First Player.
 */
export function step4_dealEncounterCards(state: GameState): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;

  const playerCount = state.players.length;
  if (playerCount === 0) return state;

  const heroicLevel = Math.max(0, state.heroicLevel || 0);
  const baseCardsPerPlayer = 1 + heroicLevel;

  // Pass 1: Deal base encounter cards (+ heroic modifier) in player order
  for (let round = 0; round < baseCardsPerPlayer; round++) {
    for (let i = 0; i < playerCount; i++) {
      const playerIdx = (state.firstPlayerIndex + i) % playerCount;
      const card = drawEncounterCard(state);
      if (card) {
        state.players[playerIdx].dealtEncounterCards.push(card);
      }
    }
  }

  // Count active Hazard icons from all in-play side schemes
  let hazardCount = 0;
  for (const sideScheme of state.sideSchemes) {
    const card = sideScheme.card as SideSchemeCard;
    if (card.hasHazard) hazardCount += 1;
  }

  // Pass 2: Deal additional cards for hazard icons sequentially in player order starting from firstPlayerIndex (RR v1.8 p. 11)
  for (let h = 0; h < hazardCount; h++) {
    const targetPlayerIdx = (state.firstPlayerIndex + h) % playerCount;
    const extraCard = drawEncounterCard(state);
    if (extraCard) {
      state.players[targetPlayerIdx].dealtEncounterCards.push(extraCard);
    }
  }

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    key: 'villainPhase.step4.encounterCardsDealt',
    params: {
      basePerPlayer: baseCardsPerPlayer,
      heroicLevel,
      hazardCount,
    },
    onomatopoeia: 'ENCOUNTER DEALT!',
  });

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
        // Check Toughness keyword
        const hasToughness = (card.traits || []).includes('Toughness') || (card.text || '').toLowerCase().includes('toughness');
        if (hasToughness) {
          if (!cardInstance.statusCards) cardInstance.statusCards = [];
          if (!cardInstance.statusCards.includes(StatusCard.TOUGH)) {
            cardInstance.statusCards.push(StatusCard.TOUGH);
          }
        }

        // Enters play engaged with this player
        player.engagedMinions.push(cardInstance);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'encounter.reveal.minion',
          params: { player: player.name, minion: card.name },
          onomatopoeia: 'MINION SPAWNS!',
        });
        const abilities = card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'FORCED_RESPONSE') {
            executeEffect(state, ability, { playerId: player.id, sourceCardInstance: cardInstance });
          }
        }
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
        const abilities = card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'FORCED_RESPONSE') {
            executeEffect(state, ability, { playerId: player.id, sourceCardInstance: cardInstance });
          }
        }
      } else if (card.type === CardType.ATTACHMENT) {
        state.villain.attachments.push(cardInstance);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'encounter.reveal.attachment',
          params: { attachment: card.name, host: state.villain.card.name },
          onomatopoeia: 'ATTACHED!',
        });
        const abilities = card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'FORCED_RESPONSE') {
            executeEffect(state, ability, { playerId: player.id, sourceCardInstance: cardInstance });
          }
        }
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

import { step6_passFirstPlayerAndRoundUpkeep } from './round-upkeep';
export { step6_passFirstPlayerAndRoundUpkeep };

/**
 * Complete Villain Phase Automation Runner (RR v1.8 p. 22)
 * 1. Sets phase to VILLAIN_PHASE and resets usedAbilitiesThisPhase for all players.
 * 2. Dispatches VILLAIN_PHASE_BEGAN.
 * 3. Executes Steps 1 through 5 sequentially.
 * 4. Dispatches VILLAIN_PHASE_ENDED.
 * 5. Passes execution to Step 6 (Round Upkeep & Token Rotation).
 */
export function executeVillainPhase(state: GameState): GameState {
  const nextState: GameState = JSON.parse(JSON.stringify(state));
  nextState.phase = GamePhase.VILLAIN_PHASE;

  // Reset phase-level ability limits for all players during Villain Phase
  for (const player of nextState.players) {
    player.usedAbilitiesThisPhase = {};
  }

  nextState.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    round: nextState.roundNumber,
    phase: GamePhase.VILLAIN_PHASE,
    key: 'phase.villain_phase.start',
    params: { round: nextState.roundNumber },
    onomatopoeia: 'VILLAIN PHASE!',
  });

  // Dispatch Villain Phase Began triggers across all players
  for (const player of nextState.players) {
    dispatchTrigger(nextState, 'VILLAIN_PHASE_BEGAN', { targetPlayerId: player.id });
  }

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

  // Dispatch Villain Phase Ended triggers across all players
  for (const player of nextState.players) {
    dispatchTrigger(nextState, 'VILLAIN_PHASE_ENDED', { targetPlayerId: player.id });
  }

  return step6_passFirstPlayerAndRoundUpkeep(nextState);
}
