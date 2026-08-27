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

  // 1. If in Alter-Ego form:
  if (player.currentForm === 'alter_ego') {
    // If low HP (< 7), recover if ready
    if (player.health <= 6 && canBasicRecover(state, playerId).allowed) {
      return { type: 'BASIC_RECOVER', playerId };
    }

    // Check if Aunt May is ready in tableau to heal
    const auntMay = player.tableau.find((c) => c.card.code === '01006' && !c.exhausted);
    if (auntMay && player.health <= 6) {
      return {
        type: 'USE_CARD_ABILITY',
        playerId,
        cardInstanceId: auntMay.instanceId,
        abilityId: 'aunt_may',
      };
    }

    // Flip to Hero form if not changed yet
    if (canChangeForm(state, playerId).allowed) {
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

  // 2. If in Hero or Alter-Ego form: Try to play any valid cards in hand
  for (const cardInst of player.hand) {
    const cost = cardInst.card.cost ?? 0;
    // Find payment cards from other cards in hand
    const otherCardsInHand = player.hand.filter((c) => c.instanceId !== cardInst.instanceId);

    // Sum available resources from other cards
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

  // 3. If in Hero form: Perform Basic Actions (Thwart vs Attack)
  if (player.currentForm === 'hero') {
    // If Main scheme threat is elevated (>= 2), prioritize Thwart
    if (state.mainScheme.threat >= 2 && canBasicThwart(state, playerId, 'main_scheme').allowed) {
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

    // Thwart Main Scheme if still ready and threat > 0
    if (state.mainScheme.threat > 0 && canBasicThwart(state, playerId, 'main_scheme').allowed) {
      return {
        type: 'BASIC_THWART',
        playerId,
        targetType: 'main_scheme',
      };
    }
  }

  // 3. If no further actions, end turn
  return {
    type: 'END_PLAYER_TURN',
    playerId,
  };
}
