import {
  CardAbility,
  CardInstance,
  CardType,
  GameLogEntry,
  GameState,
  MinionCard,
  VillainCard,
  VillainState,
} from '../models';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';
import { executeEffect, type EffectExecutionContext } from '../effects';
import { drawEncounterCard } from './deck-exhaustion';
import { hasEntityKeyword } from './stat-calculator';

/**
 * The one boost resolution used by every activation: villain attack, villain scheme, minion attack
 * and minion scheme (RR v1.8 Boost, #263). Callers keep only what is specific to their activation.
 */

/** An enemy that activates: the villain or an engaged minion. */
export type BoostActivator = CardInstance | VillainState;

/** Who the boost log entries are about, and under which category they are filed. */
export interface BoostLogContext {
  category: NonNullable<GameLogEntry['category']>;
  actor: NonNullable<GameLogEntry['actor']>;
}

export interface ResolveBoostCardsOptions extends BoostLogContext {
  queue: CardInstance[];
  /** Instance id of the activating enemy, read by effects that add a boost card to the activation. */
  activatorInstanceId: string;
  /** The player the activation is against. */
  playerId: string;
  /** Extra context for star boost abilities (an attack passes its attacker and defender type). */
  abilityContext?: Pick<EffectExecutionContext, 'attackerType' | 'defenderType'>;
  /** Lets the caller hold a star boost ability back; returning true means it will resolve later. */
  onDeferred?: (ability: CardAbility, boostCard: CardInstance) => boolean;
  /** Called with each boost card as it is turned up, before its reveal trigger. */
  onRevealed?: (boostCard: CardInstance) => void;
}

type MayAddBoostCards = VillainCard | MinionCard;

/** Additional boost cards the activating enemy and its attachments give (Klaw 01113, ADR-0019). */
export function getAdditionalBoostCardCount(
  entity: BoostActivator,
  attachments: CardInstance[] = [],
): number {
  let count = (entity.card as MayAddBoostCards).additionalBoostCards ?? 0;
  for (const attachment of attachments) {
    count += (attachment.card as MayAddBoostCards).additionalBoostCards ?? 0;
  }
  return count;
}

/**
 * Deals the boost cards of one activation, in the order they are turned up (RR v1.8 Attack step 3):
 * the facedown cards the enemy already holds, then the base card, then the additional cards.
 * Only a villain or a Villainous minion is dealt a base card (RR v1.8 Attack step 1).
 * The held pile is emptied here, so a card added while the activation runs joins the queue instead.
 */
export function dealBoostCards(
  state: GameState,
  entity: BoostActivator,
  log: BoostLogContext,
): CardInstance[] {
  const queue: CardInstance[] = [...(entity.facedownBoostCards ?? [])];
  delete entity.facedownBoostCards;

  const dealsBaseCard =
    entity.card.type === CardType.VILLAIN || hasEntityKeyword(entity, 'Villainous');
  if (!dealsBaseCard) return queue;

  const baseCard = drawEncounterCard(state);
  if (baseCard) queue.push(baseCard);

  const extraCount = getAdditionalBoostCardCount(entity, entity.attachments);
  for (let i = 0; i < extraCount; i++) {
    const extraCard = drawEncounterCard(state);
    if (!extraCard) continue;
    queue.push(extraCard);
    state.log.push({
      id: `log_${Date.now()}_extra_${i}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: log.category,
      actor: log.actor,
      key: 'villain.boost.extra',
      params: { villain: entity.card.name },
      onomatopoeia: 'EXTRA BOOST DEALT!',
    });
  }
  return queue;
}

/**
 * Turns the boost cards up one at a time, first in first out (RR v1.8 Boost): reveal trigger, star
 * ability, boost icons, then discard. A boost card an ability adds meanwhile
 * (`GIVE_ADDITIONAL_BOOST_CARD`) joins the end of `state.activeBoostResolution.queue`.
 * Returns the total boost icons.
 */
export function resolveBoostCards(state: GameState, options: ResolveBoostCardsOptions): number {
  const { queue, playerId, category, actor } = options;
  const outer = state.activeBoostResolution;
  state.activeBoostResolution = {
    queue,
    activatorInstanceId: options.activatorInstanceId,
    targetPlayerId: playerId,
  };

  let totalIcons = 0;
  // The loop runs for any enemy whose queue is not empty, not only a villain or a Villainous minion:
  // a non-Villainous minion can hold or be given a facedown boost card. The one known card in the
  // official pool is Deadliest Man Alive 60034 (side scheme: "When Bullseye attacks, give him a
  // facedown boost card") on Bullseye 60033, who has no Villainous keyword.
  while (queue.length > 0) {
    const boostCard = queue.shift()!;
    state.activeBoostCard = boostCard;
    options.onRevealed?.(boostCard);

    // Boost reveal interrupt window (e.g. Defiance, Target Acquired).
    dispatchTrigger(state, 'WHEN_BOOST_CARD_REVEALED', {
      targetPlayerId: playerId,
      sourceInstanceId: boostCard.instanceId,
    });

    if (boostCard.card.boostStar) {
      const boostAbilities = (boostCard.card.enrichment?.abilities || []).filter(
        (a) => a.timing === 'BOOST' || a.trigger === 'BOOST',
      );
      for (const boostAbility of boostAbilities) {
        if (options.onDeferred?.(boostAbility, boostCard)) continue;
        executeEffect(state, boostAbility, {
          playerId,
          sourceCardInstance: boostCard,
          ...options.abilityContext,
        });
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category,
          actor,
          key: 'villain.boost.starResolved',
          params: { card: boostCard.card.name, abilityId: boostAbility.id },
          onomatopoeia: 'STAR BOOST ACTIVATED!',
        });
      }
    }

    const icons = boostCard.card.boostIcons ?? 0;
    totalIcons += icons;
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category,
      actor,
      key: 'villain.boost.revealed',
      params: { villain: actor.name, card: boostCard.card.name, boostIcons: icons },
      onomatopoeia: 'BOOST REVEALED!',
    });

    // Discard unless its own Boost put it into play engaged with the player the activation is against
    // (e.g. Weapons Runner).
    const targetPlayer = state.players.find((p) => p.id === playerId);
    if (!targetPlayer?.engagedMinions.some((m) => m.instanceId === boostCard.instanceId)) {
      state.encounterDiscard.push(boostCard);
    }
    state.activeBoostCard = undefined;
  }

  state.activeBoostResolution = outer;
  return totalIcons;
}
