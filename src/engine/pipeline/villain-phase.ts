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
  getEffectiveHandSize,
} from './stat-calculator';

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
  // 1. Check Pre-Attack Interceptors (e.g. Webbed Up 01009)
  const webbedUpIdx = (state.villain.attachments || []).findIndex(
    (att) => att.card.code === '01009' || att.card.enrichment?.abilities?.some((a) => a.effect === 'INTERCEPT_ATTACK'),
  );
  if (webbedUpIdx !== -1) {
    const [webbedUp] = state.villain.attachments.splice(webbedUpIdx, 1);
    const owner = state.players.find((p) => p.hero.code === '01001a') || player;
    owner.discard.push(webbedUp);

    if (!state.villain.statusCards.includes(StatusCard.STUNNED)) {
      state.villain.statusCards.push(StatusCard.STUNNED);
    }

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'combat',
      key: 'villain.attack.cancelled',
      params: { villain: state.villain.card.name, cancelledBy: 'Webbed Up' },
      onomatopoeia: 'WEBBED UP! ATTACK CANCELLED & STUNNED!',
    });
    return;
  }

  // 2. Villain Attacks Hero
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
    return;
  }

  // Timing Window 2 (Interrupts): Villain Initiates Attack (Data-Driven, e.g. Spider-Sense)
  dispatchTrigger(state, 'VILLAIN_INITIATES_ATTACK', { targetPlayerId: player.id });

  // Compute Effective Attack and Keywords via stat-calculator (e.g. Charge +3 ATK / Overkill)
  const villainStats = getEffectiveVillainStats(state, state.villain);
  const hasOverkill = villainStats.keywords.includes('OVERKILL');

  // Draw Boost Card
  const boostCard = drawEncounterCard(state);
  const boostIcons = boostCard ? boostCard.card.boostIcons || 0 : 0;
  const baseAttack = villainStats.attack;
  let totalAttack = baseAttack + boostIcons;

  if (boostCard) {
    state.encounterDiscard.push(boostCard);
  }

  // Timing Window 2 (Defense Interrupts): Take Attack Damage (Data-Driven, e.g. Backflip)
  const defenseResult = dispatchTrigger(state, 'TAKE_ATTACK_DAMAGE', {
    targetPlayerId: player.id,
    damageAmount: totalAttack,
  });

  totalAttack = defenseResult.damageAmount ?? totalAttack;

  // Discard single-use attack attachments (e.g. Charge 01099)
  const chargeIdx = (state.villain.attachments || []).findIndex((att) => att.card.code === '01099');
  if (chargeIdx !== -1) {
    const [chargeAtt] = state.villain.attachments.splice(chargeIdx, 1);
    state.encounterDiscard.push(chargeAtt);
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
  const minionCard = minion.card as MinionCard;
  const attackDamage = minionCard.attack || 1;
  const toughIndex = player.statusCards.indexOf(StatusCard.TOUGH);

  if (toughIndex !== -1) {
    player.statusCards.splice(toughIndex, 1);
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'hero.tough.absorbed',
      params: { player: player.name, source: minion.card.name },
      onomatopoeia: 'CLANG! (TOUGH)',
    });
  } else {
    player.health = Math.max(0, player.health - attackDamage);
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      key: 'minion.attack.hit',
      params: {
        minion: minion.card.name,
        player: player.name,
        damage: attackDamage,
      },
      onomatopoeia: 'MINION ATTACK!',
    });

    if (player.health <= 0) {
      state.winner = 'VILLAIN';
    }
  }

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
    // Discard allies with ROUND_END / DISCARD_SELF abilities (e.g. Nick Fury - ADR-0018)
    const endRoundAllies = player.allies.filter((a) => {
      const abilities = a.card.enrichment?.abilities || [];
      return abilities.some(
        (ab) =>
          (ab.trigger === 'ROUND_END' || ab.timing === 'FORCED_RESPONSE') &&
          ab.effect === 'DISCARD_SELF',
      );
    });
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
    player.usedAbilitiesThisRound = {};
    player.usedAbilitiesThisPhase = {};

    // Ready allies
    for (const ally of player.allies) {
      ally.exhausted = false;
    }

    // Ready tableau
    for (const card of player.tableau) {
      card.exhausted = false;
    }

    // 3. Draw up to effective Hand Size (Hero vs Alter-Ego + constant auras e.g. Iron Man Tech upgrades)
    const targetHandSize = getEffectiveHandSize(player, state);

    const cardsToDraw = Math.max(0, targetHandSize - player.hand.length);
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
