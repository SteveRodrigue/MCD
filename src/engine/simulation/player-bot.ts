import { GameState, GameAction, CardType } from '@engine/models';
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
  const ninetyPercentHpThreshold = Math.ceil(player.maxHealth * 0.9);
  const halfThreatThreshold = Math.floor(state.mainScheme.targetThreat / 2);
  const isThreatHigh = state.mainScheme.threat >= halfThreatThreshold;

  // 1. If in Alter-Ego form:
  if (player.currentForm === 'alter_ego') {
    // 1A. If HP is at 90% or higher, immediately flip to Hero side at turn start
    if (player.health >= ninetyPercentHpThreshold && canChangeForm(state, playerId).allowed) {
      const heroForm = player.availableForms.find((f) => f.type === CardType.HERO);
      if (heroForm) {
        return {
          type: 'CHANGE_FORM',
          playerId,
          targetFormCode: heroForm.code,
        };
      }
    }

    // 1B. If damaged (< 100%), check for ready healing support abilities in tableau (ADR-0018)
    const healingSupport = player.tableau.find((c) => {
      if (c.exhausted) return false;
      const abilities = c.card.enrichment?.abilities || [];
      return abilities.some(
        (a) =>
          (a.timing === 'ALTER_EGO_ACTION' || a.timing === 'ACTION') &&
          a.steps?.some((s) => s.effect === 'HEAL_DAMAGE'),
      );
    });
    if (healingSupport && player.health < player.maxHealth) {
      const healAbility = healingSupport.card.enrichment!.abilities!.find(
        (a) =>
          (a.timing === 'ALTER_EGO_ACTION' || a.timing === 'ACTION') &&
          a.steps?.some((s) => s.effect === 'HEAL_DAMAGE'),
      )!;
      return {
        type: 'USE_CARD_ABILITY',
        playerId,
        cardInstanceId: healingSupport.instanceId,
        abilityId: healAbility.id,
      };
    }

    // 1C. Recover if damaged and ready
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

  // 5. Hero Basic Actions: MUST exhaust hero before ending turn (privilege Thwart over Attack)
  if (player.currentForm === 'hero' && !player.exhausted) {
    // 5A. Privilege Thwarting: Side Scheme first
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

    // 5B. Privilege Thwarting: Main Scheme if threat > 0
    if (state.mainScheme.threat > 0 && canBasicThwart(state, playerId, 'main_scheme').allowed) {
      return {
        type: 'BASIC_THWART',
        playerId,
        targetType: 'main_scheme',
      };
    }

    // 5C. Attack Minion if engaged with any
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

    // 5D. Attack Villain if allowed (no Guard)
    if (canBasicAttack(state, playerId, 'villain').allowed) {
      return {
        type: 'BASIC_ATTACK',
        playerId,
        targetType: 'villain',
      };
    }
  }

  // 6. If in Alter-Ego form and not exhausted:
  if (player.currentForm === 'alter_ego' && !player.exhausted) {
    if (player.health < player.maxHealth && canBasicRecover(state, playerId).allowed) {
      return { type: 'BASIC_RECOVER', playerId };
    }
    // If full HP and can flip to Hero to thwart/attack, flip now
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

  // 7. End turn only once all available activations/exhaustions are exhausted
  return {
    type: 'END_PLAYER_TURN',
    playerId,
  };
}
