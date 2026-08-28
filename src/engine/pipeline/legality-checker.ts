import {
  GameState,
  PlayerState,
  CardType,
  NormalizedCard,
  SideSchemeCard,
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

  if (player.formChangedThisRound) {
    return { allowed: false, reason: 'Form has already been changed this round (Limit once per round).' };
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

  // Form restrictions check (e.g. Alter-Ego Action / Hero Action)
  const isHeroCard = card.type === CardType.HERO || (card.text || '').includes('Hero Action');
  const isAlterEgoCard = card.type === CardType.ALTER_EGO || (card.text || '').includes('Alter-Ego Action');

  if (isHeroCard && player.currentForm !== 'hero') {
    return { allowed: false, reason: 'Can only play this card while in Hero form.' };
  }

  if (isAlterEgoCard && player.currentForm !== 'alter_ego') {
    return { allowed: false, reason: 'Can only play this card while in Alter-Ego form.' };
  }

  // Ally Limit Check (RR v1.8 p. 3: default limit 3, +1 with The Triskelion)
  if (card.type === CardType.ALLY) {
    const hasTriskelion = state.players.some((p) =>
      p.tableau.some((t) => t.card.code === '01073'),
    );
    const maxAllies = hasTriskelion ? 4 : 3;
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
      const aspectDoubleAbility = pCard.card.enrichment?.abilities?.find(
        (a) => a.effect === 'DOUBLE_RESOURCE_FOR_ASPECT',
      );
      if (aspectDoubleAbility && aspectDoubleAbility.params?.aspect === card.faction) {
        generatedResources += 2;
      } else {
        generatedResources += pCard.card.resources.total || 1;
      }
    }

    // 2. Resources from Table Generators / Reducers
    for (const gId of generatorInstanceIds) {
      // Check if identity ability (e.g. Peter Parker Scientist)
      if (gId === 'identity_ability' || gId === player.activeFormCard.code) {
        if (player.currentForm === 'alter_ego' && player.activeFormCard.code === '01001b') {
          generatedResources += 1;
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

      // Web-Shooter: requires counter
      if (gCard.card.code === '01008') {
        if ((gCard.tokens?.counters || 0) <= 0) {
          return { allowed: false, reason: 'Web-Shooter has no web counters remaining.' };
        }
        generatedResources += 1;
      } else if (gCard.card.code === '01092') {
        // Helicarrier: reduces cost or provides 1 resource
        generatedResources += 1;
      } else {
        // Generic generator
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
