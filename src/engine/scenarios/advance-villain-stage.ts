import {
  CardAbility,
  GameState,
  VillainState,
  VillainCard,
  getVillainById,
  getActiveVillain,
  replaceVillain,
  getPerPlayerCount,
} from '@engine/models';
import { cardCatalog } from '../../data/importer/card-loader';
import { executeEffect, discardHostAttachmentsAndTuckedCards } from '../effects';
import { applyToughnessOnEntry } from '../state/card-instance';
import { getEffectiveVillainStats } from '../pipeline/stat-calculator';

/** Printed hit points of a villain stage: per player when the card says so (RR v1.8 hit points). */
export function villainStageHitPoints(card: VillainCard, playerCount: number): number {
  return card.health * (card.healthPerHero ? playerCount || 1 : 1);
}

/**
 * Reveals a villain stage that just entered play: Toughness (a tough status card, not a second one
 * when it carried over) and the When Revealed abilities declared in supplemental data (RR v1.8
 * glossary "Villain": the reveal cannot be canceled).
 */
export function revealVillainStage(state: GameState, villain: VillainState): void {
  applyToughnessOnEntry(villain);

  const playerId = state.players[state.firstPlayerIndex ?? 0]?.id ?? state.players[0]?.id ?? '';
  for (const ability of villain.card.enrichment?.abilities ?? []) {
    if (ability.timing === 'WHEN_REVEALED' || ability.trigger === 'WHEN_REVEALED') {
      executeEffect(state, ability, { playerId });
    }
  }
}

/** The activation of the defeated villain ends without resolving (different title). */
function endVillainActivation(state: GameState, defeatedInstanceId: string): void {
  const attack = state.activeAttackContext;
  if (attack?.attackerType === 'VILLAIN' && attack.attackerVillainId === defeatedInstanceId) {
    delete state.activeAttackContext;
    const queue = state.pendingDecisionQueue;
    if (queue) {
      state.pendingDecisionQueue = queue.filter(
        (prompt) =>
          !prompt.options.some(
            (option) =>
              option.effect === 'DECLARE_DEFENDER' ||
              (option.params?.ability as CardAbility | undefined)?.trigger ===
                'ENEMY_INITIATES_ATTACK',
          ),
      );
      state.pendingDecisionQueue.forEach((prompt, i, remaining) => {
        prompt.queuePosition = i + 1;
        prompt.totalQueued = remaining.length;
      });
    }
  }
  if (state.activeBoostResolution?.activatorInstanceId === defeatedInstanceId) {
    delete state.activeBoostResolution;
  }
}

/**
 * The attack in progress resumes with the new stage (same title): its attack value and keywords
 * follow the new card, keeping any modifier applied during the attack.
 */
function resumeVillainAttack(
  state: GameState,
  before: VillainState,
  after: VillainState,
  instanceId: string,
): void {
  const attack = state.activeAttackContext;
  if (attack?.attackerType !== 'VILLAIN' || attack.attackerVillainId !== instanceId) return;

  const oldStats = getEffectiveVillainStats(state, before);
  const newStats = getEffectiveVillainStats(state, after);
  attack.baseAttack += newStats.attack - oldStats.attack;
  attack.hasOverkill =
    (attack.hasOverkill && !oldStats.keywords.includes('OVERKILL')) ||
    newStats.keywords.includes('OVERKILL');
  attack.hasPiercing =
    (attack.hasPiercing && !oldStats.keywords.includes('PIERCING')) ||
    newStats.keywords.includes('PIERCING');
}

/**
 * Generic villain stage change (RR v1.8 glossary "Villain"). The defeated stage is removed, the
 * next stage is revealed with its printed hit points (per player), and excess damage does not carry
 * over.
 *
 * - Same title: the new stage is the same character. It keeps its `instanceId`, attachments, status
 *   cards, cards underneath and facedown boost cards, and an activation in progress resumes with the
 *   new stage.
 * - Different title: nothing carries over (attachments and boost cards are discarded) and an
 *   activation in progress ends without resolving.
 *
 * `onRevealed` runs after the stage is revealed, for scenario-specific reveal text.
 */
export function advanceVillainStage(
  state: GameState,
  defeatedInstanceId: string,
  nextStageCode: string,
  onRevealed?: (newVillain: VillainState) => void,
): { state: GameState; advancedStage: true } {
  const nextCard = cardCatalog.getCard(nextStageCode) as VillainCard | undefined;
  if (!nextCard) {
    throw new Error(`Next villain stage card '${nextStageCode}' not found in catalog.`);
  }

  const defeated = getVillainById(state, defeatedInstanceId) ?? getActiveVillain(state);
  const instanceId = defeated.instanceId!;
  const maxHealth = villainStageHitPoints(nextCard, getPerPlayerCount(state));
  const sameTitle = nextCard.name === defeated.card.name;

  let next: VillainState;
  if (sameTitle) {
    next = { ...defeated, card: nextCard, health: maxHealth, maxHealth };
    replaceVillain(state, instanceId, next);
    resumeVillainAttack(state, defeated, next, instanceId);
  } else {
    discardHostAttachmentsAndTuckedCards(state, defeated);
    if (defeated.facedownBoostCards?.length) {
      state.encounterDiscard.push(...defeated.facedownBoostCards);
    }
    next = {
      instanceId: `villain_${Date.now()}_${nextStageCode}`,
      card: nextCard,
      health: maxHealth,
      maxHealth,
      exhausted: false,
      statusCards: [],
      attachments: [],
    };
    replaceVillain(state, instanceId, next);
    endVillainActivation(state, instanceId);
  }

  state.log.push({
    id: `log_${Date.now()}`,
    timestamp: Date.now(),
    category: 'combat',
    key: 'villain.stageAdvance',
    params: { villain: nextCard.name, stage: nextCard.stage, health: maxHealth },
    onomatopoeia: `${nextCard.name.toUpperCase()} ADVANCES TO STAGE ${nextCard.stage}!`,
  });

  revealVillainStage(state, next);
  onRevealed?.(next);

  return { state, advancedStage: true };
}
