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
  Keyword,
  hasKeyword,
} from '@engine/models';
import { dispatchTrigger } from '../triggers';
import { executeEffect } from '../effects';
import { handleMainSchemeCompletion } from './scenario-helpers';
import {
  getEffectiveVillainStats,
  hasEntityKeyword,
  consumeEntityStatusCards,
} from './stat-calculator';
import { initiateEnemyAttack, CombatOptions } from './combat-pipeline';
export type { CombatOptions };
import { drawEncounterCard } from './deck-exhaustion';
export { drawEncounterCard };

/**
 * Step 1: Place Threat on Main Scheme (RR v1.8 p. 31)
 */
export function step1_placeThreat(state: GameState): GameState {
  state.villainPhaseStep = VillainPhaseStep.MAIN_SCHEME_THREAT;
  const playerCount = state.players.length;

  // Escalation threat per player + acceleration tokens + side scheme acceleration icons
  let totalThreatToAdd =
    state.mainScheme.card.escalationThreat * playerCount + state.accelerationTokens;

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
export function executeVillainAttackAgainstPlayer(
  state: GameState,
  player: PlayerState,
  options?: CombatOptions,
): GameState {
  return initiateEnemyAttack(state, { type: 'VILLAIN' }, player.id, options);
}

/**
 * Executes a single villain scheme against a target alter-ego or on-demand (Advance 01186).
 */
/**
 * Executes a single villain scheme against a target alter-ego or on-demand (Advance 01186).
 */
export function executeVillainSchemeAgainstPlayer(state: GameState, player: PlayerState): void {
  // Check Confused status on Villain (taking into account Steady - RR v1.8 p. 28)
  if (consumeEntityStatusCards(state.villain, StatusCard.CONFUSED)) {
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
export function executeMinionAttackAgainstPlayer(
  state: GameState,
  minion: CardInstance,
  player: PlayerState,
  options?: CombatOptions,
): GameState {
  const nextState = initiateEnemyAttack(
    state,
    { type: 'MINION', card: minion },
    player.id,
    options,
  );

  // Forced Responses on minion attack (e.g. Sandman 01102: discard top 2 cards of encounter deck)
  // When resolved synchronously or immediately without pending prompt
  if (!nextState.pendingDecisionPrompt) {
    const abilities = minion.card.enrichment?.abilities || [];
    for (const ability of abilities) {
      if (
        ability.trigger === 'MINION_ATTACKED' ||
        (ability.timing === 'FORCED_RESPONSE' && ability.trigger === 'ATTACK')
      ) {
        executeEffect(nextState, ability, { playerId: player.id, sourceCardInstance: minion });
      }
    }
  }

  return nextState;
}

/**
 * Executes a single minion scheme against an alter-ego.
 */
export function executeMinionSchemeAgainstPlayer(
  state: GameState,
  minion: CardInstance,
  player: PlayerState,
): void {
  // Check Confused status on Minion (taking into account Steady - RR v1.8 p. 28)
  if (consumeEntityStatusCards(minion, StatusCard.CONFUSED)) {
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'minion.confused.cancelled',
      params: { minion: minion.card.name },
      onomatopoeia: 'CONFUSION CLEARED!',
    });
    return;
  }

  const minionCard = minion.card as MinionCard;
  let schemeThreat = minionCard.scheme || 1;

  // Villainous minion deals and resolves a facedown boost card (RR v1.8 p. 30)
  if (hasEntityKeyword(minion, 'Villainous')) {
    const boostCard = drawEncounterCard(state);
    if (boostCard) {
      const icons = boostCard.card.boostIcons || 0;
      schemeThreat += icons;
      state.encounterDiscard.push(boostCard);
    }
  }

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
export function executeMinionActivationAgainstPlayer(
  state: GameState,
  minion: CardInstance,
  player: PlayerState,
  options?: CombatOptions,
): GameState {
  if (player.currentForm === 'hero') {
    return executeMinionAttackAgainstPlayer(state, minion, player, options);
  } else {
    executeMinionSchemeAgainstPlayer(state, minion, player);
    return state;
  }
}

/**
 * Step 2: Villain & Minion Activations (RR v1.8 p. 22: Interleaved Player-by-Player Activation Loop)
 * In player order starting from firstPlayerIndex:
 * 1. The villain activates against the player (Attack if hero, Scheme if alter-ego).
 * 2. Each minion engaged with that player activates against the player (Attack if hero, Scheme if alter-ego).
 */
export function step2_villainAndMinionActivations(
  state: GameState,
  options?: CombatOptions,
): GameState {
  if (state.winner) return state;
  state.phase = GamePhase.VILLAIN_PHASE;
  state.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;

  if (!(state as any).pendingActivations) {
    const activations: {
      type: 'VILLAIN' | 'MINION';
      playerId: string;
      minionInstanceId?: string;
    }[] = [];
    for (let i = 0; i < state.players.length; i++) {
      const playerIdx = (state.firstPlayerIndex + i) % state.players.length;
      const player = state.players[playerIdx];

      activations.push({ type: 'VILLAIN', playerId: player.id });
      for (const minion of player.engagedMinions) {
        activations.push({
          type: 'MINION',
          playerId: player.id,
          minionInstanceId: minion.instanceId,
        });
      }
    }
    (state as any).pendingActivations = activations;
  }

  while ((state as any).pendingActivations && (state as any).pendingActivations.length > 0) {
    const act = (state as any).pendingActivations.shift()!;
    const player = state.players.find((p) => p.id === act.playerId);
    if (!player) continue;

    if (act.type === 'VILLAIN') {
      if (player.currentForm === 'hero') {
        state = executeVillainAttackAgainstPlayer(state, player, options);
      } else {
        executeVillainSchemeAgainstPlayer(state, player);
      }
    } else if (act.type === 'MINION') {
      const minion = player.engagedMinions.find((m) => m.instanceId === act.minionInstanceId);
      if (minion) {
        state = executeMinionActivationAgainstPlayer(state, minion, player, options);
      }
    }

    if (state.pendingDecisionPrompt || state.winner) {
      return state;
    }
  }

  delete (state as any).pendingActivations;
  return state;
}

// Backward-compatible alias for Step 2
export const step2_villainActivations = step2_villainAndMinionActivations;

/**
 * Step 3: Minion Activations (Deprecated standalone step; now interleaved in Step 2 per RR v1.8 p. 22).
 * Kept as an optional direct-call helper if needed by legacy tests.
 */
export function step3_minionActivations(state: GameState, options?: CombatOptions): GameState {
  if (state.winner) return state;
  state.villainPhaseStep = VillainPhaseStep.MINION_ACTIVATIONS;

  for (const player of state.players) {
    for (const minion of player.engagedMinions) {
      executeMinionActivationAgainstPlayer(state, minion, player, options);
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
        const hasToughness = hasKeyword(card, Keyword.TOUGH);
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
            executeEffect(state, ability, {
              playerId: player.id,
              sourceCardInstance: cardInstance,
            });
          }
        }
      } else if (card.type === CardType.SIDE_SCHEME) {
        const sideSchemeCard = card as SideSchemeCard;
        const baseThreat =
          sideSchemeCard.baseThreat * (sideSchemeCard.baseThreatFixed ? 1 : state.players.length);
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
            executeEffect(state, ability, {
              playerId: player.id,
              sourceCardInstance: cardInstance,
            });
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
            executeEffect(state, ability, {
              playerId: player.id,
              sourceCardInstance: cardInstance,
            });
          }
        }
      } else {
        // Treachery generic resolution: execute declarative WHEN_REVEALED
        const abilities = card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'FORCED_RESPONSE') {
            executeEffect(state, ability, {
              playerId: player.id,
              sourceCardInstance: cardInstance,
            });
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

      if (state.pendingDecisionPrompt || state.winner) {
        return state;
      }
    }
  }

  return state;
}

import { step6_passFirstPlayerAndRoundUpkeep } from './round-upkeep';
export { step6_passFirstPlayerAndRoundUpkeep };

/**
 * Resumes and continues Villain Phase progression after a prompt resolution (ADR-0031 / ADR-0032).
 */
export function continueVillainPhase(state: GameState, options?: CombatOptions): GameState {
  if (state.winner) return state;

  // Step 2: Activations
  if (state.villainPhaseStep === VillainPhaseStep.VILLAIN_ACTIVATIONS) {
    state = step2_villainAndMinionActivations(state, options);
    if (state.pendingDecisionPrompt || state.winner) return state;
    state.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;
  }

  // Step 4: Deal Encounter Cards
  if (state.villainPhaseStep === VillainPhaseStep.DEAL_ENCOUNTER_CARDS) {
    state = step4_dealEncounterCards(state);
    if (state.winner) return state;
    state.villainPhaseStep = VillainPhaseStep.REVEAL_ENCOUNTER_CARDS;
  }

  // Step 5: Reveal Encounter Cards
  if (state.villainPhaseStep === VillainPhaseStep.REVEAL_ENCOUNTER_CARDS) {
    state = step5_revealEncounterCards(state);
    if (state.pendingDecisionPrompt || state.winner) return state;
  }

  // Dispatch Villain Phase Ended triggers across all players
  for (const player of state.players) {
    dispatchTrigger(state, 'VILLAIN_PHASE_ENDED', { targetPlayerId: player.id });
  }

  return step6_passFirstPlayerAndRoundUpkeep(state);
}

/**
 * Complete Villain Phase Automation Runner (RR v1.8 p. 22)
 * 1. Sets phase to VILLAIN_PHASE and resets usedAbilitiesThisPhase for all players.
 * 2. Dispatches VILLAIN_PHASE_BEGAN.
 * 3. Executes Steps 1 through 5 sequentially (pausing cleanly when interactive prompts are enqueued).
 * 4. Dispatches VILLAIN_PHASE_ENDED.
 * 5. Passes execution to Step 6 (Round Upkeep & Token Rotation).
 */
export function executeVillainPhase(state: GameState, options?: CombatOptions): GameState {
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

  nextState.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;
  delete (nextState as any).pendingActivations;

  return continueVillainPhase(nextState, options);
}
