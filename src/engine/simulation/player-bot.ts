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

  // 2. If in Hero form:
  if (player.currentForm === 'hero') {
    // A. Check if we can play Swinging Web Kick (01005, Cost 3)
    const kickCard = player.hand.find((c) => c.card.code === '01005');
    if (kickCard && player.hand.length >= 4) {
      const paymentCards = player.hand
        .filter((c) => c.instanceId !== kickCard.instanceId)
        .slice(0, 3)
        .map((c) => c.instanceId);

      if (canPlayCard(state, playerId, kickCard.instanceId, paymentCards).allowed) {
        return {
          type: 'PLAY_CARD',
          playerId,
          cardInstanceId: kickCard.instanceId,
          paymentCardInstanceIds: paymentCards,
          targetInstanceId: undefined, // Hits villain
        };
      }
    }

    // B. Check if we can play Web-Shooter (01008, Cost 1)
    const shooterCard = player.hand.find((c) => c.card.code === '01008');
    if (shooterCard && player.hand.length >= 2) {
      const paymentCard = player.hand.find((c) => c.instanceId !== shooterCard.instanceId);
      if (paymentCard) {
        if (canPlayCard(state, playerId, shooterCard.instanceId, [paymentCard.instanceId]).allowed) {
          return {
            type: 'PLAY_CARD',
            playerId,
            cardInstanceId: shooterCard.instanceId,
            paymentCardInstanceIds: [paymentCard.instanceId],
          };
        }
      }
    }

    // C. Basic Actions (Thwart vs Attack)
    // If Main scheme threat is high (>= 3), prioritize Thwart
    if (state.mainScheme.threat >= 3 && canBasicThwart(state, playerId, 'main_scheme').allowed) {
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

    // Thwart Main Scheme if still ready
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
