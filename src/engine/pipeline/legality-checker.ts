import {
  GameState,
  PlayerState,
  CardType,
  CardInstance,
  NormalizedCard,
  SideSchemeCard,
  GamePhase,
} from '@engine/models';

export function getPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((p) => p.id === playerId);
}

/**
 * Checks if a player can change form (RR v1.8 p. 13-14).
 * Limit: Once per round during the player turn.
 */
export function canChangeForm(
  state: GameState,
  playerId: string,
  targetFormCode?: string,
): { allowed: boolean; reason?: string } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  if (state.phase === GamePhase.PLAYER_PHASE) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer && activePlayer.id !== playerId) {
      return { allowed: false, reason: `Not your turn (Currently ${activePlayer.name}'s turn).` };
    }
  }

  if (player.basicChangeFormUsedThisRound || player.formChangedThisRound) {
    return { allowed: false, reason: 'Form has already been changed this round (Limit once per round as a basic action).' };
  }

  if (targetFormCode) {
    const targetForm = player.availableForms.find((f) => f.code === targetFormCode);
    if (!targetForm) {
      return { allowed: false, reason: 'Target form is not available for this identity.' };
    }
    if (targetForm.code === player.activeFormCard.code) {
      return { allowed: false, reason: 'Already in the requested form.' };
    }
  }

  return { allowed: true };
}

/**
 * Checks if player can perform basic Recover (RR v1.8 p. 23).
 * Must be in Alter-Ego form and not exhausted.
 */
export function canBasicRecover(
  state: GameState,
  playerId: string,
): { allowed: boolean; reason?: string } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  if (state.phase === GamePhase.PLAYER_PHASE) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer && activePlayer.id !== playerId) {
      return { allowed: false, reason: `Not your turn (Currently ${activePlayer.name}'s turn).` };
    }
  }

  if (player.currentForm !== 'alter_ego') {
    return { allowed: false, reason: 'Can only recover while in Alter-Ego form.' };
  }

  if (player.exhausted) {
    return { allowed: false, reason: 'Character is exhausted.' };
  }

  return { allowed: true };
}

/**
 * Checks if player can perform basic Attack (RR v1.8 p. 5-6, 15 "Guard").
 * Must be in Hero form, not exhausted, and respect Guard keyword.
 */
export function canBasicAttack(
  state: GameState,
  playerId: string,
  targetType: 'villain' | 'minion',
  targetInstanceId?: string,
): { allowed: boolean; reason?: string } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  if (state.phase === GamePhase.PLAYER_PHASE) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer && activePlayer.id !== playerId) {
      return { allowed: false, reason: `Not your turn (Currently ${activePlayer.name}'s turn).` };
    }
  }

  if (player.currentForm !== 'hero') {
    return { allowed: false, reason: 'Can only attack while in Hero form.' };
  }

  if (player.exhausted) {
    return { allowed: false, reason: 'Character is exhausted.' };
  }

  if (targetType === 'minion') {
    if (!targetInstanceId) {
      return { allowed: false, reason: 'Minion target instance ID must be specified.' };
    }
    // Find minion across all engaged minions
    const allMinions = state.players.flatMap((p) => p.engagedMinions);
    const minion = allMinions.find((m) => m.instanceId === targetInstanceId);
    if (!minion) {
      return { allowed: false, reason: 'Target minion is not in play.' };
    }
  }

  if (targetType === 'villain') {
    // Guard keyword check: While an engaged minion with Guard is in play with this player, villain cannot be attacked.
    const hasGuardMinion = player.engagedMinions.some((m) => {
      const text = m.card.text || '';
      return text.includes('Guard') || (m.card.traits || []).includes('Guard');
    });

    if (hasGuardMinion) {
      return {
        allowed: false,
        reason: 'Cannot attack the villain while an engaged minion with Guard is in play.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Checks if player can perform basic Thwart (RR v1.8 p. 29, 11 "Crisis", 20 "Patrol").
 * Must be in Hero form, not exhausted, and respect Crisis icons and Patrol minions.
 */
export function canBasicThwart(
  state: GameState,
  playerId: string,
  targetType: 'main_scheme' | 'side_scheme',
  targetInstanceId?: string,
): { allowed: boolean; reason?: string } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  if (state.phase === GamePhase.PLAYER_PHASE) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer && activePlayer.id !== playerId) {
      return { allowed: false, reason: `Not your turn (Currently ${activePlayer.name}'s turn).` };
    }
  }

  if (player.currentForm !== 'hero') {
    return { allowed: false, reason: 'Can only thwart while in Hero form.' };
  }

  if (player.exhausted) {
    return { allowed: false, reason: 'Character is exhausted.' };
  }

  if (targetType === 'side_scheme') {
    if (!targetInstanceId) {
      return { allowed: false, reason: 'Side scheme target instance ID must be specified.' };
    }
    const sideScheme = state.sideSchemes.find((s) => s.instanceId === targetInstanceId);
    if (!sideScheme) {
      return { allowed: false, reason: 'Target side scheme is not in play.' };
    }
  }

  if (targetType === 'main_scheme') {
    // 1. Patrol Keyword Check: A minion with Patrol engaged with this player prevents thwarting main scheme
    const hasPatrolMinion = player.engagedMinions.some((m) => {
      const text = m.card.text || '';
      return text.includes('Patrol') || (m.card.traits || []).includes('Patrol');
    });

    if (hasPatrolMinion) {
      return {
        allowed: false,
        reason: 'Cannot thwart the main scheme while an engaged minion with Patrol is in play.',
      };
    }

    // 2. Crisis Icon Check: Any side scheme with Crisis in play prevents removing threat from main scheme
    const hasCrisisScheme = state.sideSchemes.some((s) => {
      const sideCard = s.card as SideSchemeCard;
      return sideCard.hasCrisis || (s.card.text || '').includes('Crisis');
    });

    if (hasCrisisScheme) {
      return {
        allowed: false,
        reason: 'Cannot thwart the main scheme while a side scheme with a Crisis icon is in play.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Computes the active maximum ally limit for a player dynamically (ADR-0018).
 * Base: 3 allies (RR v1.8 p. 3).
 * Modifiers: Scans in-play cards for CONSTANT abilities with ALLY_LIMIT_BONUS.
 */
export function getPlayerAllyLimit(state: GameState, playerId: string): number {
  const BASE_ALLY_LIMIT = 3;
  let bonus = 0;

  for (const p of state.players) {
    for (const item of p.tableau) {
      const abilities = item.card.enrichment?.abilities || [];
      for (const ab of abilities) {
        const limitStep = ab.steps?.find((s) => s.effect === 'ALLY_LIMIT_BONUS');
        if (ab.timing === 'CONSTANT' && limitStep) {
          const target = limitStep.params?.target || 'CONTROLLER';
          if (target === 'ALL_PLAYERS' || p.id === playerId) {
            bonus += Number(limitStep.params?.amount) || 1;
          }
        }
      }
    }
  }

  return BASE_ALLY_LIMIT + bonus;
}

/**
 * Validates whether hand cards specified for payment cover the cost of the card being played.
 */
export function canPlayCard(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
  paymentCardInstanceIds: string[],
  generatorInstanceIds: string[] = [],
): { allowed: boolean; reason?: string; cardToPlay?: NormalizedCard } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  const targetCardInstance = player.hand.find((c) => c.instanceId === cardInstanceId);
  if (!targetCardInstance) {
    return { allowed: false, reason: 'Card to play is not in player hand.' };
  }

  const card = targetCardInstance.card;
  let cost = card.cost ?? 0;

  const abilities = card.enrichment?.abilities || [];

  // Player Turn Validation (RR v1.8 p. 19 "Player Turn" & "Ask for an Action")
  if (state.phase === GamePhase.PLAYER_PHASE) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer && activePlayer.id !== playerId) {
      return {
        allowed: false,
        reason: `Not your turn (Currently ${activePlayer.name}'s turn).`,
      };
    }
  }

  // Ambiguity / Blocked Card Check (ADR-0021)
  if (card.enrichment?.audit?.ambiguityFile) {
    return {
      allowed: false,
      reason: `Card mechanic is currently under architectural review / blocked (${card.enrichment.audit.ambiguityFile}).`,
    };
  }

  // Reactive Event Restriction (RR v1.8 p. 12, 16, 19)
  // An event card with Interrupt or Response timing can ONLY be played during its specific trigger window.
  // It cannot be proactively played / paid for as a standard player action.
  const isReactiveEvent =
    card.type === CardType.EVENT &&
    abilities.length > 0 &&
    !abilities.some((a) => a.timing === 'ACTION' || a.timing === 'HERO_ACTION' || a.timing === 'ALTER_EGO_ACTION') &&
    abilities.some(
      (a) =>
        a.timing &&
        (a.timing.includes('INTERRUPT') || a.timing.includes('RESPONSE')),
    );

  if (isReactiveEvent) {
    return {
      allowed: false,
      reason: 'Interrupt/Response events can only be played when their trigger occurs.',
    };
  }

  // Resource Card Restriction (RR v1.8 p. 24)
  // Resource cards cannot be played as standalone actions; they are discarded to generate resources for payment.
  const isResourceCard = card.type === CardType.RESOURCE;
  const hasResourceAction = abilities.some((a) => a.timing === 'ACTION' || a.timing === 'HERO_ACTION' || a.timing === 'ALTER_EGO_ACTION');
  if (isResourceCard && !hasResourceAction) {
    return {
      allowed: false,
      reason: 'Resource cards cannot be played directly; they are discarded to pay costs.',
    };
  }

  // Form restrictions check (RR v1.8 p. 16, 28)
  // An event card with Hero/Alter-Ego timing requires the corresponding form to play.
  // Upgrades, Supports, and Allies can be played in either form unless a printed restriction exists.
  const isEvent = card.type === CardType.EVENT;
  const hasHeroTiming = abilities.some((a) => a.timing && a.timing.startsWith('HERO_'));
  const hasAlterEgoTiming = abilities.some((a) => a.timing && a.timing.startsWith('ALTER_EGO_'));
  const playRestriction = (card.enrichment as any)?.playRestriction;

  const isHeroFormRequired =
    card.type === CardType.HERO ||
    (isEvent && hasHeroTiming) ||
    playRestriction === 'HERO_FORM';

  const isAlterEgoFormRequired =
    card.type === CardType.ALTER_EGO ||
    (isEvent && hasAlterEgoTiming) ||
    playRestriction === 'ALTER_EGO_FORM';

  if (isHeroFormRequired && player.currentForm !== 'hero') {
    return { allowed: false, reason: 'Can only play this card while in Hero form.' };
  }

  if (isAlterEgoFormRequired && player.currentForm !== 'alter_ego') {
    return { allowed: false, reason: 'Can only play this card while in Alter-Ego form.' };
  }

  // Dynamic Ally Limit Check (RR v1.8 p. 3, ADR-0018)
  if (card.type === CardType.ALLY) {
    const maxAllies = getPlayerAllyLimit(state, playerId);
    if (player.allies.length >= maxAllies) {
      return { allowed: false, reason: `Ally limit reached (${maxAllies} allies max).` };
    }
  }

  // Unicity Constraint Check (RR v1.8 p. 28)
  if (card.isUnique) {
    const alreadyInPlay =
      player.allies.some((a) => a.card.name === card.name) ||
      player.tableau.some((t) => t.card.name === card.name);
    if (alreadyInPlay) {
      return { allowed: false, reason: `A unique copy of '${card.name}' is already in play.` };
    }
  }

  // Cost payment validation
  if (cost > 0) {
    // Payment cards cannot include the card being played
    if (paymentCardInstanceIds.includes(cardInstanceId)) {
      return { allowed: false, reason: 'The card being played cannot be used to pay for itself.' };
    }

    let generatedResources = 0;

    // 1. Resources from Hand Discards
    for (const pId of paymentCardInstanceIds) {
      const pCard = player.hand.find((c) => c.instanceId === pId);
      if (!pCard) {
        return { allowed: false, reason: `Payment card instance ${pId} not found in hand.` };
      }

      // Check aspect doubling cards (e.g. The Power of Leadership / Justice / Aggression / Protection)
      const aspectDoubleStep = pCard.card.enrichment?.abilities
        ?.flatMap((a) => a.steps || [])
        .find((s) => s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT');
      if (aspectDoubleStep && aspectDoubleStep.params?.aspect === card.faction) {
        generatedResources += 2;
      } else {
        generatedResources += pCard.card.resources.total || 1;
      }
    }

    // 2. Resources from Table Generators / Reducers
    for (const gId of generatorInstanceIds) {
      // Check if identity ability (e.g. Peter Parker Scientist / Carol Danvers Rechannel)
      if (gId === 'identity_ability' || gId === player.activeFormCard.code) {
        const idAbility = player.activeFormCard.enrichment?.abilities?.find(
          (a) => a.timing === 'RESOURCE' || a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE'),
        );
        if (idAbility) {
          if (idAbility.limit === 'ONCE_PER_ROUND' && (player.usedAbilitiesThisRound?.[idAbility.id] || 0) >= 1) {
            return {
              allowed: false,
              reason: `Identity ability '${idAbility.id}' has already been used this round (Limit: once per round).`,
            };
          }
          if (idAbility.limit === 'ONCE_PER_PHASE' && (player.usedAbilitiesThisPhase?.[idAbility.id] || 0) >= 1) {
            return {
              allowed: false,
              reason: `Identity ability '${idAbility.id}' has already been used this phase (Limit: once per phase).`,
            };
          }
          const genStep = idAbility.steps?.find((s) => s.effect === 'GENERATE_RESOURCE');
          generatedResources += Number(genStep?.params?.amount) || 1;
        }
        continue;
      }

      const gCard = player.tableau.find((c) => c.instanceId === gId);
      if (!gCard) {
        return { allowed: false, reason: `Resource generator instance ${gId} not found in tableau.` };
      }
      if (gCard.exhausted) {
        return { allowed: false, reason: `Resource generator ${gCard.card.name} is already exhausted.` };
      }

      // Check if generator relies on counters (uses)
      if (gCard.card.enrichment?.uses) {
        if ((gCard.tokens?.counters || 0) <= 0) {
          return { allowed: false, reason: `${gCard.card.name} has no counters remaining.` };
        }
        generatedResources += 1;
      } else {
        // Generic generator / cost reducer
        generatedResources += 1;
      }
    }

    if (generatedResources < cost) {
      return {
        allowed: false,
        reason: `Insufficient resources: Need ${cost}, but selected payment provides ${generatedResources}.`,
      };
    }
  }

  return { allowed: true, cardToPlay: card };
}

export interface CardPlayabilityStatus {
  isPlayable: boolean;
  reasons: string[];
  maxPotentialResources: number;
}

/**
 * Evaluates whether a card in a player's hand can currently be played (ADR-0018).
 * Checks all game conditions: active turn, identity form, maximum affordable resources,
 * unicity constraints, ally limits, and custom play restrictions.
 */
export function evaluateCardPlayability(
  state: GameState,
  playerId: string,
  cardInstance: CardInstance,
): CardPlayabilityStatus {
  const player = getPlayer(state, playerId);
  if (!player) {
    return { isPlayable: false, reasons: ['Player not found'], maxPotentialResources: 0 };
  }

  const card = cardInstance.card;
  const reasons: string[] = [];

  const abilities = card.enrichment?.abilities || [];

  // 1. Player Turn Validation (RR v1.8 p. 19)
  if (state.phase === GamePhase.PLAYER_PHASE) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer && activePlayer.id !== playerId) {
      reasons.push(`Not your turn (Currently ${activePlayer.name}'s turn)`);
    }
  }

  // Ambiguity / Blocked Card Check (ADR-0021)
  if (card.enrichment?.audit?.ambiguityFile) {
    reasons.push(`Card is currently under architectural review / blocked (${card.enrichment.audit.ambiguityFile})`);
  }

  // 2. Reactive Event Validation (RR v1.8 p. 12, 16, 19)
  // An event card with Interrupt or Response timing can ONLY be played during its specific trigger window.
  const isReactiveEvent =
    card.type === CardType.EVENT &&
    abilities.length > 0 &&
    !abilities.some((a) => a.timing === 'ACTION' || a.timing === 'HERO_ACTION' || a.timing === 'ALTER_EGO_ACTION') &&
    abilities.some(
      (a) =>
        a.timing &&
        (a.timing.includes('INTERRUPT') || a.timing.includes('RESPONSE')),
    );

  if (isReactiveEvent) {
    reasons.push('Interrupt/Response: Can only be played when triggered');
  }

  // Resource Card Restriction (RR v1.8 p. 24)
  const isResourceCard = card.type === CardType.RESOURCE;
  const hasResourceAction = abilities.some((a) => a.timing === 'ACTION' || a.timing === 'HERO_ACTION' || a.timing === 'ALTER_EGO_ACTION');
  if (isResourceCard && !hasResourceAction) {
    reasons.push('Resource card: Used to generate resources when paying costs');
  }

  // 3. Identity Form Validation (RR v1.8 p. 16, 28)
  // Events with Hero/Alter-Ego actions require the corresponding form.
  // Upgrades, Supports, and Allies are playable in either form unless explicit playRestriction is set.
  const isEvent = card.type === CardType.EVENT;
  const hasHeroTiming = abilities.some((a) => a.timing && a.timing.startsWith('HERO_'));
  const hasAlterEgoTiming = abilities.some((a) => a.timing && a.timing.startsWith('ALTER_EGO_'));
  const playRestriction = (card.enrichment as any)?.playRestriction;

  const isHeroFormRequired =
    card.type === CardType.HERO ||
    (isEvent && hasHeroTiming) ||
    playRestriction === 'HERO_FORM';

  const isAlterEgoFormRequired =
    card.type === CardType.ALTER_EGO ||
    (isEvent && hasAlterEgoTiming) ||
    playRestriction === 'ALTER_EGO_FORM';

  if (isHeroFormRequired && player.currentForm !== 'hero') {
    reasons.push('Requires Hero form');
  }

  if (isAlterEgoFormRequired && player.currentForm !== 'alter_ego') {
    reasons.push('Requires Alter-Ego form');
  }

  // 3. Dynamic Ally Limit Validation (RR v1.8 p. 3)
  if (card.type === CardType.ALLY) {
    const maxAllies = getPlayerAllyLimit(state, playerId);
    if (player.allies.length >= maxAllies) {
      reasons.push(`Ally limit reached (${maxAllies} allies max)`);
    }
  }

  // 4. Unicity Constraint Check (RR v1.8 p. 28)
  if (card.isUnique) {
    const alreadyInPlay =
      player.allies.some((a) => a.card.name === card.name) ||
      player.tableau.some((t) => t.card.name === card.name);
    if (alreadyInPlay) {
      reasons.push(`A unique copy of '${card.name}' is already in play`);
    }
  }

  // 5. Maximum Potential Resource Affordability Check
  let maxPotentialResources = 0;

  // A. Hand resources from other cards
  for (const other of player.hand) {
    if (other.instanceId === cardInstance.instanceId) continue;
    const aspectDoubleStep = other.card.enrichment?.abilities
      ?.flatMap((a) => a.steps || [])
      .find((s) => s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT');
    const multiplier = aspectDoubleStep && aspectDoubleStep.params?.aspect === card.faction ? 2 : 1;
    maxPotentialResources += (other.card.resources.total || 1) * multiplier;
  }

  // B. Identity Resource Ability
  const idAbilities = player.activeFormCard.enrichment?.abilities || [];
  for (const ab of idAbilities) {
    if (ab.timing === 'RESOURCE' || ab.steps?.some((s) => s.effect === 'GENERATE_RESOURCE')) {
      const isUsedRound = ab.limit === 'ONCE_PER_ROUND' && (player.usedAbilitiesThisRound?.[ab.id] || 0) >= 1;
      const isUsedPhase = ab.limit === 'ONCE_PER_PHASE' && (player.usedAbilitiesThisPhase?.[ab.id] || 0) >= 1;
      if (!isUsedRound && !isUsedPhase) {
        const genStep = ab.steps?.find((s) => s.effect === 'GENERATE_RESOURCE');
        maxPotentialResources += Number(genStep?.params?.amount) || 1;
      }
    }
  }

  // C. In-Play Tableau Generators
  for (const t of player.tableau) {
    if (t.exhausted) continue;
    if (t.card.enrichment?.uses) {
      if ((t.tokens?.counters || 0) > 0) {
        maxPotentialResources += 1;
      }
    } else {
      const hasResAbility = t.card.enrichment?.abilities?.some(
        (a) =>
          a.timing === 'RESOURCE' ||
          a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE' || s.effect === 'COST_REDUCER'),
      );
      if (hasResAbility) {
        maxPotentialResources += 1;
      }
    }
  }

  const cost = card.cost ?? 0;
  if (cost > 0 && maxPotentialResources < cost) {
    reasons.push(`Cannot afford cost (Need ${cost}, max available ${maxPotentialResources})`);
  }

  return {
    isPlayable: reasons.length === 0,
    reasons,
    maxPotentialResources,
  };
}
