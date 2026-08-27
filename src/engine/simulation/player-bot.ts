import {
  GameState,
  GameAction,
  CardType,
} from '@engine/models';
import {
  canChangeForm,
  canBasicRecover,
  canBasicAttack,
  canBasicThwart,
  canPlayCard,
} from '../pipeline';

export interface BotDecisionContext {
  state: GameState;
  playerId: string;
}

/**
 * Heuristic AI Bot that selects the best legal action during the Player Phase.
 */
export function chooseBotAction(context: BotDecisionContext): GameAction {
  const { state, playerId } = context;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return { type: 'END_PLAYER_TURN', playerId };

  const halfHpThreshold = Math.floor(player.maxHealth / 2);
  const halfThreatThreshold = Math.floor(state.mainScheme.targetThreat / 2);
  const isThreatHigh = state.mainScheme.threat >= halfThreatThreshold;

  // 1. If in Alter-Ego form:
  if (player.currentForm === 'alter_ego') {
    // If not full HP, check Aunt May support first
    const auntMay = player.tableau.find((c) => c.card.code === '01006' && !c.exhausted);
    if (auntMay && player.health < player.maxHealth) {
      return {
        type: 'USE_CARD_ABILITY',
        playerId,
        cardInstanceId: auntMay.instanceId,
        abilityId: 'aunt_may',
      };
    }

    // Recover if damaged and ready
    if (player.health < player.maxHealth && canBasicRecover(state, playerId).allowed) {
      return { type: 'BASIC_RECOVER', playerId };
    }

    // Play cards available in Alter-Ego form (e.g. Supports, Upgrades, Resources)
    for (const cardInst of player.hand) {
      const cost = cardInst.card.cost ?? 0;
      const otherCardsInHand = player.hand.filter((c) => c.instanceId !== cardInst.instanceId);
      let availableResources = 0;
      const paymentIds: string[] = [];

      for (const otherCard of otherCardsInHand) {
        if (availableResources >= cost) break;
        const resCount = otherCard.card.resources.total || 1;
        availableResources += resCount;
        paymentIds.push(otherCard.instanceId);
      }

      if (availableResources >= cost) {
        const legality = canPlayCard(state, playerId, cardInst.instanceId, paymentIds);
        if (legality.allowed) {
          return {
            type: 'PLAY_CARD',
            playerId,
            cardInstanceId: cardInst.instanceId,
            paymentCardInstanceIds: paymentIds,
          };
        }
      }
    }

    // Flip to Hero form if HP is healthy (> half) and form change is ready
    if (player.health > halfHpThreshold && canChangeForm(state, playerId).allowed) {
      const heroForm = player.availableForms.find((f) => f.type === CardType.HERO);
      if (heroForm) {
        return {
          type: 'CHANGE_FORM',
          playerId,
          targetFormCode: heroForm.code,
        };
      }
    }
  }

  // 2. If in Hero form: Check if critically wounded (HP <= half) to flip to Alter-Ego
  if (player.currentForm === 'hero') {
    if (player.health <= halfHpThreshold && canChangeForm(state, playerId).allowed) {
      const alterEgoForm = player.availableForms.find((f) => f.type === CardType.ALTER_EGO);
      if (alterEgoForm) {
        return {
          type: 'CHANGE_FORM',
          playerId,
          targetFormCode: alterEgoForm.code,
        };
      }
    }
  }

  // 3. Play Cards from Hand (Allies, Upgrades, Supports, Events)
  for (const cardInst of player.hand) {
    const cost = cardInst.card.cost ?? 0;
    const otherCardsInHand = player.hand.filter((c) => c.instanceId !== cardInst.instanceId);
    let availableResources = 0;
    const paymentIds: string[] = [];

    for (const otherCard of otherCardsInHand) {
      if (availableResources >= cost) break;
      const resCount = otherCard.card.resources.total || 1;
      availableResources += resCount;
      paymentIds.push(otherCard.instanceId);
    }

    if (availableResources >= cost) {
      const legality = canPlayCard(state, playerId, cardInst.instanceId, paymentIds);
      if (legality.allowed) {
        return {
          type: 'PLAY_CARD',
          playerId,
          cardInstanceId: cardInst.instanceId,
          paymentCardInstanceIds: paymentIds,
        };
      }
    }
  }

  // 4. Ally Actions: Activate ready in-play allies
  for (const ally of player.allies) {
    if (!ally.exhausted) {
      // If threat is elevated, prioritize Ally Thwart
      if (isThreatHigh || state.mainScheme.threat >= 2) {
        return {
          type: 'ALLY_THWART',
          playerId,
          allyInstanceId: ally.instanceId,
          targetType: 'main_scheme',
        };
      } else if (player.engagedMinions.length > 0) {
        return {
          type: 'ALLY_ATTACK',
          playerId,
          allyInstanceId: ally.instanceId,
          targetType: 'minion',
          targetInstanceId: player.engagedMinions[0].instanceId,
        };
      } else {
        return {
          type: 'ALLY_ATTACK',
          playerId,
          allyInstanceId: ally.instanceId,
          targetType: 'villain',
        };
      }
    }
  }

  // 5. Hero Basic Actions: Thwart vs Attack
  if (player.currentForm === 'hero') {
    // If threat >= floor(maxThreat / 2), strictly THWART instead of Attack
    if (isThreatHigh && canBasicThwart(state, playerId, 'main_scheme').allowed) {
      return {
        type: 'BASIC_THWART',
        playerId,
        targetType: 'main_scheme',
      };
    }

    // Side Scheme thwart check if any active
    if (state.sideSchemes.length > 0) {
      const sideScheme = state.sideSchemes[0];
      if (canBasicThwart(state, playerId, 'side_scheme', sideScheme.instanceId).allowed) {
        return {
          type: 'BASIC_THWART',
          playerId,
          targetType: 'side_scheme',
          targetInstanceId: sideScheme.instanceId,
        };
      }
    }

    // General Main Scheme thwart if threat > 0
    if (state.mainScheme.threat > 1 && canBasicThwart(state, playerId, 'main_scheme').allowed) {
      return {
        type: 'BASIC_THWART',
        playerId,
        targetType: 'main_scheme',
      };
    }

    // Attack Minion if engaged with any
    if (player.engagedMinions.length > 0) {
      const targetMinion = player.engagedMinions[0];
      if (canBasicAttack(state, playerId, 'minion', targetMinion.instanceId).allowed) {
        return {
          type: 'BASIC_ATTACK',
          playerId,
          targetType: 'minion',
          targetInstanceId: targetMinion.instanceId,
        };
      }
    }

    // Attack Villain if allowed (no Guard)
    if (canBasicAttack(state, playerId, 'villain').allowed) {
      return {
        type: 'BASIC_ATTACK',
        playerId,
        targetType: 'villain',
      };
    }
  }

  // 6. If no further actions, end turn
  return {
    type: 'END_PLAYER_TURN',
    playerId,
  };
}
