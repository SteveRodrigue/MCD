import {
  GameState,
  TriggerType,
} from '@engine/models';
import { executeEffect } from '../effects';

export interface TriggerContext {
  targetPlayerId: string;
  sourceInstanceId?: string;
  damageAmount?: number;
  preventedDamage?: boolean;
}

export interface TriggerDispatchResult {
  state: GameState;
  preventedDamage?: boolean;
  damageAmount?: number;
}

/**
 * Generic Trigger Dispatcher: Resolves all matching declarative abilities for a given trigger event.
 * Eliminates all hardcoded card codes from engine pipelines!
 */
export function dispatchTrigger(
  state: GameState,
  trigger: TriggerType,
  context: TriggerContext,
): TriggerDispatchResult {
  const player = state.players.find((p) => p.id === context.targetPlayerId);
  if (!player) return { state };

  let currentDamage = context.damageAmount ?? 0;
  let isPrevented = context.preventedDamage ?? false;

  // 1. Scan in-play identity card abilities (e.g. Spider-Sense on Spider-Man 01001a)
  const identityAbilities = player.activeFormCard.enrichment?.abilities || [];
  for (const ability of identityAbilities) {
    if (ability.trigger === trigger) {
      executeEffect(state, ability, { playerId: player.id });
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        key: `ability.${ability.id}.triggered`,
        params: { player: player.name },
        onomatopoeia: 'ABILITY TRIGGERED!',
      });
    }
  }

  // 2. Scan tableau & in-play cards
  for (const cardInst of player.tableau) {
    const abilities = cardInst.card.enrichment?.abilities || [];
    for (const ability of abilities) {
      if (ability.trigger === trigger && !cardInst.exhausted) {
        executeEffect(state, ability, { playerId: player.id, sourceCardInstance: cardInst });
      }
    }
  }

  // 3. Scan in-hand cards for Hand triggers (e.g. Backflip for TAKE_ATTACK_DAMAGE)
  if (trigger === 'TAKE_ATTACK_DAMAGE' && currentDamage > 0) {
    const handInterruptIdx = player.hand.findIndex((c) => {
      const abilities = c.card.enrichment?.abilities || [];
      return abilities.some((a) => a.trigger === trigger && a.zone === 'HAND');
    });

    if (handInterruptIdx !== -1) {
      const [interruptCard] = player.hand.splice(handInterruptIdx, 1);
      const ability = interruptCard.card.enrichment!.abilities!.find(
        (a) => a.trigger === trigger && a.zone === 'HAND',
      )!;

      // Handle cost (discard self)
      if (ability.cost?.discardSelf !== false) {
        player.discard.push(interruptCard);
      }

      // Execute effect
      if (ability.effect === 'PREVENT_DAMAGE') {
        currentDamage = 0;
        isPrevented = true;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: `card.${interruptCard.card.code}.preventedDamage`,
          params: { player: player.name },
          onomatopoeia: 'DEFENSE! (0 DAMAGE)',
        });
      }
    }
  }

  return {
    state,
    damageAmount: currentDamage,
    preventedDamage: isPrevented,
  };
}
