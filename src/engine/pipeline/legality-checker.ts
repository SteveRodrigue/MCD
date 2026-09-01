import {
  GameState,
  PlayerState,
  CardType,
  CardInstance,
  NormalizedCard,
  SideSchemeCard,
  GamePhase,
} from '@engine/models';
import { getCardEnrichment } from '../../data/supplemental';

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
      return (
        m.card.keywords?.includes(Keyword.GUARD) ||
        text.includes('Guard') ||
        (m.card.traits || []).includes('Guard')
      );
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
 * Checks if an ally can perform an Attack (RR v1.8 p. 6, 15 "Guard").
 * Ally must not be exhausted and respect Guard keyword.
 */
export function canAllyAttack(
  state: GameState,
  playerId: string,
  allyInstanceId: string,
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

  const ally = player.allies.find((a) => a.instanceId === allyInstanceId);
  if (!ally) return { allowed: false, reason: 'Ally not found in play.' };

  if (ally.exhausted) {
    return { allowed: false, reason: 'Ally is exhausted.' };
  }

  if (targetType === 'minion') {
    if (!targetInstanceId) {
      return { allowed: false, reason: 'Minion target instance ID must be specified.' };
    }
    const allMinions = state.players.flatMap((p) => p.engagedMinions);
    const minion = allMinions.find((m) => m.instanceId === targetInstanceId);
    if (!minion) {
      return { allowed: false, reason: 'Target minion is not in play.' };
    }
  }

  if (targetType === 'villain') {
    // Guard keyword check: While an engaged minion with Guard is engaged with this player, villain cannot be attacked.
    const hasGuardMinion = player.engagedMinions.some((m) => {
      const text = m.card.text || '';
      return (
        m.card.keywords?.includes(Keyword.GUARD) ||
        text.includes('Guard') ||
        (m.card.traits || []).includes('Guard')
      );
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
    if (sideScheme.threat <= 0) {
      return { allowed: false, reason: 'Cannot thwart a scheme with no threat.' };
    }
  }

  if (targetType === 'main_scheme') {
    // 0. Threat Check: Cannot thwart a scheme with no threat (RR v1.8 p. 29)
    if (!state.mainScheme || state.mainScheme.threat <= 0) {
      return {
        allowed: false,
        reason: 'Cannot thwart a scheme with no threat.',
      };
    }

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
import { Keyword } from '@engine/models';

/**
 * Checks if a card possesses the Restricted keyword (RR v1.8 p. 25).
 */
export function isCardRestricted(card: NormalizedCard): boolean {
  if (card.keywords?.includes(Keyword.RESTRICTED)) return true;
  const text = (card.text || '').toLowerCase();
  return text.includes('restricted.') || text.includes('<b>restricted</b>');
}

/**
 * Computes the slot weight of a restricted card (RR v1.8 p. 25).
 * Base: 1 slot. Heavy items (e.g. "Counts as 2 restricted cards"): 2 slots.
 */
export function getCardRestrictedWeight(card: NormalizedCard): number {
  if (!isCardRestricted(card)) return 0;
  const text = (card.text || '').toLowerCase();
  if (
    text.includes('counts as 2 restricted cards') ||
    text.includes('counts as two restricted cards') ||
    text.includes('counts as 2 restricted')
  ) {
    return 2;
  }
  return 1;
}

/**
 * Computes the active restricted card limit for a player dynamically (RR v1.8 p. 25 / ADR-0018).
 * Base: 2 restricted cards max.
 * Modifiers: Scans in-play cards for CONSTANT abilities with RESTRICTED_LIMIT_BONUS (e.g. Side Holster).
 */
export function getPlayerRestrictedLimit(state: GameState, playerId: string): number {
  const BASE_RESTRICTED_LIMIT = 2;
  let bonus = 0;

  const player = getPlayer(state, playerId);
  if (!player) return BASE_RESTRICTED_LIMIT;

  for (const item of player.tableau) {
    const abilities = item.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      const limitStep = ab.steps?.find((s) => s.effect === 'RESTRICTED_LIMIT_BONUS');
      if (ab.timing === 'CONSTANT' && limitStep) {
        bonus += Number(limitStep.params?.amount) || 1;
      }
    }
  }

  return BASE_RESTRICTED_LIMIT + bonus;
}

/**
 * Computes the total restricted slot weight currently occupied in a player's tableau.
 */
export function getPlayerRestrictedCount(player: PlayerState): number {
  let count = 0;
  for (const item of player.tableau) {
    count += getCardRestrictedWeight(item.card);
  }
  return count;
}

/**
 * Validates the Global Unique Card Rule & Identity Collision (RR v1.8 p. 29).
 * Unique cards are evaluated globally across all player tableaus, all player allies,
 * all in-game Hero/Alter-Ego identities, and in-play villain/minion cards.
 */
export function checkUniqueCardPlayable(
  state: GameState,
  card: NormalizedCard,
): { allowed: boolean; reason?: string } {
  if (!card.isUnique) return { allowed: true };

  const targetName = card.name.toLowerCase().trim();
  const targetSubname = card.subname?.toLowerCase().trim();

  // 1. Check against active Hero & Alter-Ego identities in the game
  for (const p of state.players) {
    const heroName = p.hero.name.toLowerCase().trim();
    const heroSubname = p.hero.subname?.toLowerCase().trim();
    const alterEgoName = p.alterEgo.name.toLowerCase().trim();
    const alterEgoSubname = p.alterEgo.subname?.toLowerCase().trim();

    // Match card name or subname with Hero/Alter-Ego name or subname
    const matchesHero =
      targetName === heroName ||
      (targetSubname && targetSubname === heroName) ||
      (heroSubname && targetName === heroSubname);
    const matchesAlterEgo =
      targetName === alterEgoName ||
      (targetSubname && targetSubname === alterEgoName) ||
      (alterEgoSubname && targetName === alterEgoSubname);

    if (matchesHero || matchesAlterEgo) {
      return {
        allowed: false,
        reason: `Global unicity violation (RR v1.8 p. 29): Unique card '${card.name}' shares identity with player '${p.name}'.`,
      };
    }
  }

  // 2. Check against all in-play cards across ALL players (tableaus and allies)
  for (const p of state.players) {
    // Check in-play allies
    for (const ally of p.allies) {
      if (ally.card.isUnique) {
        const allyName = ally.card.name.toLowerCase().trim();
        const allySubname = ally.card.subname?.toLowerCase().trim();

        const nameMatch = targetName === allyName;
        const subnameMatch =
          targetSubname && allySubname ? targetSubname === allySubname : nameMatch;

        if (nameMatch && subnameMatch) {
          return {
            allowed: false,
            reason: `Global unicity violation (RR v1.8 p. 29): A unique copy of '${card.name}' is already in play under ${p.name}'s control.`,
          };
        }
      }
    }

    // Check in-play tableau (upgrades/supports)
    for (const item of p.tableau) {
      if (item.card.isUnique) {
        const itemName = item.card.name.toLowerCase().trim();
        const itemSubname = item.card.subname?.toLowerCase().trim();

        const nameMatch = targetName === itemName;
        const subnameMatch =
          targetSubname && itemSubname ? targetSubname === itemSubname : nameMatch;

        if (nameMatch && subnameMatch) {
          return {
            allowed: false,
            reason: `Global unicity violation (RR v1.8 p. 29): A unique copy of '${card.name}' is already in play in ${p.name}'s tableau.`,
          };
        }
      }
    }

    // Check engaged unique minions
    for (const minion of p.engagedMinions) {
      if (minion.card.isUnique) {
        const minionName = minion.card.name.toLowerCase().trim();
        if (targetName === minionName) {
          return {
            allowed: false,
            reason: `Global unicity violation (RR v1.8 p. 29): A unique minion '${card.name}' is already in play.`,
          };
        }
      }
    }
  }

  // 3. Check against active Villain
  if (state.villain?.card.isUnique) {
    const villainName = state.villain.card.name.toLowerCase().trim();
    if (targetName === villainName) {
      return {
        allowed: false,
        reason: `Global unicity violation (RR v1.8 p. 29): A unique character '${card.name}' is active as the villain.`,
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

  // Restricted Keyword Limit Check (RR v1.8 p. 25, ADR-0018)
  if (isCardRestricted(card)) {
    const cardWeight = getCardRestrictedWeight(card);
    const currentRestricted = getPlayerRestrictedCount(player);
    const maxRestricted = getPlayerRestrictedLimit(state, playerId);

    if (currentRestricted + cardWeight > maxRestricted) {
      return {
        allowed: false,
        reason: `Restricted card limit reached (${maxRestricted} restricted cards max).`,
      };
    }
  }

  // Global Unicity Constraint Check (RR v1.8 p. 29)
  const unicityCheck = checkUniqueCardPlayable(state, card);
  if (!unicityCheck.allowed) {
    return unicityCheck;
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

      // Check generator abilities and form restrictions (RR v1.8 p. 16, 24)
      const enrichment = gCard.card.enrichment || getCardEnrichment(gCard.card.code);
      const abilities = enrichment?.abilities || [];

      const isHeroRestricted =
        abilities.some((a) => a.timing === 'HERO_ACTION' || a.timing?.startsWith('HERO_')) ||
        (gCard.card.text || '').toLowerCase().includes('hero resource:') ||
        (gCard.card.text || '').toLowerCase().includes('hero action:');
      const isAlterEgoRestricted =
        abilities.some((a) => a.timing === 'ALTER_EGO_ACTION' || a.timing?.startsWith('ALTER_EGO_')) ||
        (gCard.card.text || '').toLowerCase().includes('alter-ego resource:') ||
        (gCard.card.text || '').toLowerCase().includes('alter-ego action:');

      if (isHeroRestricted && player.currentForm !== 'hero') {
        return { allowed: false, reason: `${gCard.card.name} ability requires Hero form.` };
      }
      if (isAlterEgoRestricted && player.currentForm !== 'alter_ego') {
        return { allowed: false, reason: `${gCard.card.name} ability requires Alter-Ego form.` };
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
    const enrichment = t.card.enrichment || getCardEnrichment(t.card.code);
    const uses = enrichment?.uses;
    const abilities = enrichment?.abilities || [];
    const tableAbility = abilities.find(
      (a) =>
        a.timing === 'RESOURCE' ||
        a.timing === 'HERO_ACTION' ||
        a.timing === 'ALTER_EGO_ACTION' ||
        a.timing === 'ACTION' ||
        a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE' || s.effect === 'COST_REDUCER'),
    );

    const isHeroRestricted =
      abilities.some((a) => a.timing === 'HERO_ACTION' || a.timing?.startsWith('HERO_')) ||
      (t.card.text || '').toLowerCase().includes('hero resource:') ||
      (t.card.text || '').toLowerCase().includes('hero action:');
    const isAlterEgoRestricted =
      abilities.some((a) => a.timing === 'ALTER_EGO_ACTION' || a.timing?.startsWith('ALTER_EGO_')) ||
      (t.card.text || '').toLowerCase().includes('alter-ego resource:') ||
      (t.card.text || '').toLowerCase().includes('alter-ego action:');

    if (isHeroRestricted && player.currentForm !== 'hero') continue;
    if (isAlterEgoRestricted && player.currentForm !== 'alter_ego') continue;

    if (uses) {
      if ((t.tokens?.counters || 0) > 0) {
        maxPotentialResources += 1;
      }
    } else if (tableAbility) {
      maxPotentialResources += 1;
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
