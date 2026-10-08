import {
  GameState,
  GameAction,
  ActionResult,
  StatusCard,
  CardType,
  AlterEgoCard,
  AllyCard,
  SideSchemeCard,
  PlayerSideSchemeCard,
  CardInstance,
  GamePhase,
  DecisionPromptOption,
  PendingDecisionPrompt,
  PlayerState,
  VillainState,
  CardAbility,
  Keyword,
  getKeywordValue,
  cloneGameState,
  getActiveVillain,
  getActiveMainScheme,
  getVillainsInPlay,
  getVillainById,
  getPerPlayerCount,
} from '@engine/models';
import {
  getPlayer,
  canChangeForm,
  canBasicRecover,
  canBasicAttack,
  canAllyAttack,
  canBasicThwart,
  canAllyThwart,
  canPlayCard,
  isCardRestricted,
  getCardRestrictedWeight,
  getPlayerRestrictedCount,
  getPlayerRestrictedLimit,
  canInitiateAbility,
} from './legality-checker';
import {
  canPayAbilityCost,
  executeAbilityCost,
  getEventAbilityExtraCost,
  executeResourceCostPayment,
  checkAndDiscardZeroCounterCard,
  getApplicableCostReductions,
  getEffectiveCardCost,
} from './cost-engine';
import {
  executeEffect,
  moveDefeatedCardToPile,
  dealDistributedDamageToPlayer,
  processHostDefeated,
  defeatSideScheme,
  resetCardState,
  hasPendingSequence,
  resumePendingSequence,
} from '../effects';
import {
  advanceVillainPhaseStep,
  continueVillainPhase,
  executeMinionAttackAgainstPlayer,
  resolveActiveEncounterCardAfterInterrupt,
  completeEncounterAttachment,
} from './villain-phase';
import { initiatePlayerPhaseCleanup, executePlayerCleanup } from './player-phase-cleanup';
import { handleVillainDefeat } from './scenario-helpers';
import {
  getEffectiveAllyStats,
  getEffectiveHeroStats,
  getEffectiveMaxHealth,
  getEffectiveMinionHitPoints,
  hasEntityKeyword,
  consumeEntityStatusCards,
} from './stat-calculator';
import {
  resolveDecisionPrompt,
  enqueueDecisionPrompt,
  peekDecisionPrompt,
  popDecisionPrompt,
  validateSearchSelection,
} from './prompt-queue';
import {
  resolveDefenderDeclaration,
  finishAttackDamageAndPostResolution,
  continueAttackAfterInitiation,
} from './combat-pipeline';
import { getSpecialHandler } from '../specials/special-registry';
import {
  attachCardToHost,
  initializeCardUses,
  findInPlayCardInstance,
} from '../state/state-validator';
import { advancePlayerSetup, collectPlayerSetupAbilities } from '../state/game-setup';
import { applyToughnessOnEntry } from '../state/card-instance';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';
import {
  resolveEntityByInstanceId,
  getEligibleTargets,
  TargetFilterOptions,
} from '../effects/target-resolver';
import { getStepEffectParams } from '../../data/supplemental/schema';
import { isStepGateClosedByState } from './step-gate-evaluator';
import { applyDamageToTarget, dispatchDefeat } from './damage-pipeline';
import { applyThwart, applyThreatPlacement } from './threat-pipeline';

/**
 * Universal Card Routing Helper for Search, Scry, Look and Mulligan Primitives (RR v1.8 p. 19, 26).
 */
export function routeCardInstances(
  state: GameState,
  player: PlayerState,
  cards: CardInstance[],
  destination: string | null | undefined,
  sourceZone: string,
  targetHost?: string,
) {
  if (cards.length === 0) return;

  if (!destination || destination === 'LEAVE_IN_PLACE') {
    if (sourceZone === 'PLAYER_DISCARD') {
      player.discard.push(...cards);
    } else if (sourceZone === 'PLAYER_HAND') {
      player.hand.push(...cards);
    } else if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.unshift(...cards);
    } else if (sourceZone === 'ENCOUNTER_DISCARD') {
      state.encounterDiscard.push(...cards);
    } else {
      player.deck.unshift(...cards);
    }
    return;
  }

  if (destination === 'REVEAL') {
    for (const card of cards) {
      resolveActiveEncounterCardAfterInterrupt(state, card, player, false);
    }
    return;
  }

  if (destination === 'HAND') {
    player.hand.push(...cards);
  } else if (destination === 'TABLEAU') {
    for (const card of cards) {
      if (card.card.type === CardType.SIDE_SCHEME) {
        const sideSchemeCard = card.card as SideSchemeCard;
        const baseThreat =
          sideSchemeCard.baseThreat *
          (sideSchemeCard.baseThreatFixed ? 1 : getPerPlayerCount(state));
        state.sideSchemes.push({
          instanceId: card.instanceId,
          card: sideSchemeCard,
          threat: baseThreat,
        });
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'encounter.reveal.sideScheme',
          params: { sideScheme: card.card.name, threat: baseThreat },
          onomatopoeia: 'SIDE SCHEME!',
        });
        const abilities = card.card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'WHEN_REVEALED') {
            executeEffect(state, ability, {
              playerId: player.id,
              sourceCardInstance: card,
            });
          }
        }
      } else {
        player.tableau.push(card);
      }
    }
  } else if (destination === 'DISCARD') {
    if (sourceZone.startsWith('ENCOUNTER')) {
      state.encounterDiscard.push(...cards);
    } else {
      player.discard.push(...cards);
    }
  } else if (destination === 'DECK_TOP') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.unshift(...cards);
    } else {
      player.deck.unshift(...cards);
    }
  } else if (destination === 'DECK_BOTTOM') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.push(...cards);
    } else {
      player.deck.push(...cards);
    }
  } else if (destination === 'DECK_SHUFFLE') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.push(...cards);
      state.encounterDeck.sort(() => Math.random() - 0.5);
    } else {
      player.deck.push(...cards);
      player.deck.sort(() => Math.random() - 0.5);
    }
  } else if (destination === 'ATTACH_TO_TARGET') {
    for (const card of cards) {
      attachCardToHost(state, card, targetHost || 'VILLAIN', player.id);
    }
  }
}

/**
 * Resolves the villain a player attacks or attaches to: the one named by `targetInstanceId`
 * (any villain in play may be targeted, MC03 rules insert p.6), else the active villain.
 * Returns undefined when an id is given that matches none of the villains in play.
 */
function resolveAttackedVillain(
  state: GameState,
  targetInstanceId?: string,
): VillainState | undefined {
  if (!targetInstanceId) return getActiveVillain(state);
  const found = getVillainById(state, targetInstanceId);
  if (found) return found;
  // States without a villains collection only have the legacy pointer (#215).
  return getVillainsInPlay(state).length === 0 ? getActiveVillain(state) : undefined;
}

/**
 * Resolves the abilities of an event that was just played: pays the declared extra cost first
 * (so its results feed the steps), then executes the effects.
 */
function resolveEventAbilities(
  state: GameState,
  player: PlayerState,
  playedCardInstance: CardInstance,
  context: {
    chosenTargetType?: Parameters<typeof executeEffect>[2]['chosenTargetType'];
    chosenTargetInstanceId?: string;
    resourcesSpent?: string[];
    discardCardInstanceIds?: string[];
  },
): void {
  for (const ability of playedCardInstance.card.enrichment?.abilities || []) {
    const extraCost = getEventAbilityExtraCost(ability);
    const discardedCards = extraCost
      ? executeAbilityCost(state, player, extraCost, playedCardInstance, {
          discardCardInstanceIds: context.discardCardInstanceIds,
        }).discardedCards
      : undefined;
    executeEffect(state, ability, {
      playerId: player.id,
      chosenTargetType: context.chosenTargetType,
      chosenTargetInstanceId: context.chosenTargetInstanceId,
      sourceCardInstance: playedCardInstance,
      resourcesSpent: context.resourcesSpent,
      discardedCards,
    });
  }
}

/**
 * Pure state reducer / action dispatcher executing player commands in accordance with RR v1.8.
 * After a successful action, an ability sequence that paused on a decision prompt resumes
 * as soon as the prompt queue is empty (#248).
 */
export function dispatchAction(
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  const outcome = dispatchSingleAction(state, action);
  if (!outcome.result.success) return outcome;

  let next = outcome.state;
  if (hasPendingSequence(next) && !peekDecisionPrompt(next)) {
    next = resumePendingSequence(next);
  }
  // Player Setup abilities (step 16) continue once the decision they waited for is answered.
  if (next.setupState?.stage === 'PLAYER_SETUP') {
    next = advancePlayerSetup(next);
  }
  return next === outcome.state ? outcome : { state: next, result: outcome.result };
}

function dispatchSingleAction(
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  // Clone state immutably for pure state transition
  const nextState: GameState = cloneGameState(state);

  switch (action.type) {
    case 'RESOLVE_MULLIGAN': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      if (!nextState.setupState || nextState.setupState.stage !== 'MULLIGAN_PHASE') {
        return {
          state,
          result: { success: false, error: 'Game is not currently in the Mulligan Phase' },
        };
      }

      if (nextState.setupState.mulliganCompleted[action.playerId]) {
        return {
          state,
          result: { success: false, error: 'Player has already completed their mulligan' },
        };
      }

      // 1. Separate chosen discards from hand
      const discardIds = action.discardCardInstanceIds || [];
      const keptHand: typeof player.hand = [];
      const mulliganDiscards: typeof player.hand = [];

      for (const card of player.hand) {
        if (discardIds.includes(card.instanceId)) {
          mulliganDiscards.push(card);
        } else {
          keptHand.push(card);
        }
      }

      // 2. Draw replacements from top of player deck
      const replacementCount = mulliganDiscards.length;
      const drawnReplacements = player.deck.splice(0, replacementCount);
      player.hand = [...keptHand, ...drawnReplacements];

      // 3. Rejected cards move directly to the player discard pile (RR v1.8 p. 23 - NO DECK SHUFFLE)
      player.discard.push(...mulliganDiscards);

      // 4. Mark player mulligan complete
      nextState.setupState.mulliganCompleted[action.playerId] = true;

      const onomatopoeia = 'MULLIGAN RESOLVED!';
      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        phase: GamePhase.SETUP_PHASE,
        key: 'player.setup.mulligan',
        params: {
          player: player.name,
          discardedCount: replacementCount,
          handSize: player.hand.length,
        },
        onomatopoeia,
      });

      // 5. Check if all players have completed mulligan
      const allDone = nextState.players.every((p) => nextState.setupState?.mulliganCompleted[p.id]);
      if (allDone) {
        // Step 16 follows the mulligans; `dispatchAction` resolves the Setup abilities.
        nextState.setupState.stage = 'PLAYER_SETUP';
        nextState.setupState.pendingSetupAbilities = collectPlayerSetupAbilities(nextState);
      }

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'CHANGE_FORM': {
      const check = canChangeForm(nextState, action.playerId, action.targetFormCode);
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      let nextFormCard = player.availableForms.find((f) => f.code !== player.activeFormCard.code);

      if (action.targetFormCode) {
        nextFormCard = player.availableForms.find((f) => f.code === action.targetFormCode);
      }

      if (!nextFormCard) {
        return { state, result: { success: false, error: 'Could not determine next form' } };
      }

      player.activeFormCard = nextFormCard;
      player.currentForm = nextFormCard.type === CardType.HERO ? 'hero' : 'alter_ego';
      player.basicChangeFormUsedThisRound = true;
      player.formChangedThisRound = true;
      dispatchTrigger(nextState, 'FORM_CHANGED', {
        targetPlayerId: player.id,
        targetType: player.currentForm,
        sourceInstanceId: player.activeFormCard.code,
      });

      const onomatopoeia = player.currentForm === 'hero' ? 'SUIT UP!' : 'IDENTITY FLIP!';

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        key: 'player.action.changeForm',
        params: {
          player: player.name,
          form: nextFormCard.name,
        },
        onomatopoeia,
      });

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'BASIC_RECOVER': {
      const check = canBasicRecover(nextState, action.playerId);
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      const recValue = (player.activeFormCard as AlterEgoCard).recover || 0;
      const maxHp = getEffectiveMaxHealth(player, nextState);
      const healedAmount = Math.min(maxHp - player.health, recValue);

      player.health += healedAmount;
      player.exhausted = true;
      player.recoveryUsedThisRound = true;

      const onomatopoeia = 'REST & RECOVER!';

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        key: 'player.action.recover',
        params: {
          player: player.name,
          amount: healedAmount,
          health: player.health,
        },
        onomatopoeia,
      });

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: player.activeFormCard.name },
        onomatopoeia: 'EXHAUST',
      });

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'BASIC_ATTACK': {
      const check = canBasicAttack(
        nextState,
        action.playerId,
        action.targetType,
        action.targetInstanceId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      player.exhausted = true;

      // 1. Stunned Status Replacement Check (RR v1.8 p. 28, taking into account Steady)
      if (consumeEntityStatusCards(player, StatusCard.STUNNED)) {
        const onomatopoeia = 'STUN CLEARED!';
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'status.stunned.cleared',
          params: { player: player.name },
          onomatopoeia,
        });
        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      const heroStats = getEffectiveHeroStats(nextState, player);
      const attackDamage = heroStats.attack;

      // 2. Resolve Attack on Target
      if (action.targetType === 'villain') {
        const targetVillain = resolveAttackedVillain(nextState, action.targetInstanceId);
        if (!targetVillain)
          return { state, result: { success: false, error: 'Villain not found' } };
        const damageRes = applyDamageToTarget(nextState, {
          target: {
            type: 'villain',
            entity: targetVillain,
            name: targetVillain.card?.name || (targetVillain as any).name || 'Villain',
            attachments: targetVillain.attachments,
            statusCards: targetVillain.statusCards,
          },
          amount: attackDamage,
          sourceType: 'HERO',
          sourcePlayerId: player.id,
          isAttack: true,
        });

        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          category: 'status',
          key: 'card.state.exhausted',
          params: { card: player.activeFormCard.name },
          onomatopoeia: 'EXHAUST',
        });

        dispatchTrigger(nextState, 'BASIC_ATTACK_PERFORMED', { targetPlayerId: player.id });
        dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
          targetPlayerId: player.id,
          targetType: 'villain',
          attackSource: { kind: 'HERO', playerId: player.id },
        });

        const onomatopoeia = damageRes.result.onomatopoeia || 'POW!';
        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      if (action.targetType === 'minion' && action.targetInstanceId) {
        const targetMinionPlayer = nextState.players.find((p) =>
          p.engagedMinions.some((m) => m.instanceId === action.targetInstanceId),
        );

        if (!targetMinionPlayer) {
          return { state, result: { success: false, error: 'Minion not found' } };
        }

        const minionIndex = targetMinionPlayer.engagedMinions.findIndex(
          (m) => m.instanceId === action.targetInstanceId,
        );
        const minion = targetMinionPlayer.engagedMinions[minionIndex];

        const damageRes = applyDamageToTarget(nextState, {
          target: {
            type: 'minion',
            entity: minion,
            instanceId: minion.instanceId,
            name: minion.card.name,
            targetPlayerId: targetMinionPlayer.id,
            attachments: minion.attachments,
            statusCards: minion.statusCards,
          },
          amount: attackDamage,
          sourceType: 'HERO',
          sourcePlayerId: player.id,
          isAttack: true,
        });

        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          category: 'status',
          key: 'card.state.exhausted',
          params: { card: player.activeFormCard.name },
          onomatopoeia: 'EXHAUST',
        });

        dispatchTrigger(nextState, 'BASIC_ATTACK_PERFORMED', { targetPlayerId: player.id });
        dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
          targetPlayerId: player.id,
          targetType: 'minion',
          targetInstanceId: action.targetInstanceId,
          attackSource: { kind: 'HERO', playerId: player.id },
        });

        const onomatopoeia = damageRes.result.onomatopoeia || 'POW!';
        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      return { state: nextState, result: { success: true } };
    }

    case 'ALLY_ATTACK': {
      const check = canAllyAttack(
        nextState,
        action.playerId,
        action.allyInstanceId,
        action.targetType,
        action.targetInstanceId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      const allyIdx = player.allies.findIndex((a) => a.instanceId === action.allyInstanceId);
      const ally = player.allies[allyIdx];
      ally.exhausted = true;
      const allyCard = ally.card as AllyCard;
      const allyStats = getEffectiveAllyStats(nextState, ally);
      const attackDmg = allyStats.attack;

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        key: 'player.action.allyAttack',
        params: {
          player: player.name,
          ally: allyCard.name,
          damage: attackDmg,
          target: action.targetType,
        },
        onomatopoeia: 'ALLY ATTACK!',
      });

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: allyCard.name },
        onomatopoeia: 'EXHAUST',
      });

      // Deal damage to target
      if (action.targetType === 'villain') {
        const targetVillain = resolveAttackedVillain(nextState, action.targetInstanceId);
        if (!targetVillain)
          return { state, result: { success: false, error: 'Villain not found' } };
        applyDamageToTarget(nextState, {
          target: {
            type: 'villain',
            entity: targetVillain,
            name: targetVillain.card?.name || (targetVillain as any).name || 'Villain',
            attachments: targetVillain.attachments,
            statusCards: targetVillain.statusCards,
          },
          amount: attackDmg,
          sourceType: 'ALLY',
          sourceCardInstance: ally,
          sourcePlayerId: player.id,
          isAttack: true,
        });
      } else if (action.targetType === 'minion' && action.targetInstanceId) {
        const targetMinionPlayer = nextState.players.find((p) =>
          p.engagedMinions.some((m) => m.instanceId === action.targetInstanceId),
        );

        if (targetMinionPlayer) {
          const minionIndex = targetMinionPlayer.engagedMinions.findIndex(
            (m) => m.instanceId === action.targetInstanceId,
          );
          const minion = targetMinionPlayer.engagedMinions[minionIndex];

          applyDamageToTarget(nextState, {
            target: {
              type: 'minion',
              entity: minion,
              instanceId: minion.instanceId,
              name: minion.card.name,
              targetPlayerId: targetMinionPlayer.id,
              attachments: minion.attachments,
              statusCards: minion.statusCards,
            },
            amount: attackDmg,
            sourceType: 'ALLY',
            sourceCardInstance: ally,
            sourcePlayerId: player.id,
            isAttack: true,
          });
        }
      }

      // Consequential damage to ally (e.g. 1 damage)
      const consequential = allyCard.attackCost ?? 1;
      ally.tokens = { ...ally.tokens, damage: (ally.tokens?.damage || 0) + consequential };

      // Check Ally Defeat
      const allyHp = allyCard.health || 2;
      if ((ally.tokens?.damage || 0) >= allyHp) {
        player.allies.splice(allyIdx, 1);
        processHostDefeated(nextState, ally, { player });
        dispatchDefeat(nextState, {
          targetPlayerId: player.id,
          targetInstanceId: ally.instanceId,
          targetType: 'ALLY',
          defeatSource: { kind: 'EFFECT', playerId: player.id, byAttack: false },
        });
        const owner = (ally.ownerId ? getPlayer(nextState, ally.ownerId) : undefined) || player;
        resetCardState(ally);
        owner.discard.push(ally);
      }

      dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
        targetPlayerId: player.id,
        targetType: action.targetType,
        targetInstanceId: action.targetInstanceId,
        sourceInstanceId: action.allyInstanceId,
        sourceCardCode: ally.card.code,
        attackerCard: ally,
        attackSource: { kind: 'ALLY', playerId: player.id, instanceId: ally.instanceId },
      });

      const onomatopoeia = 'ALLY ATTACK!';
      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'ALLY_THWART': {
      const check = canAllyThwart(
        nextState,
        action.playerId,
        action.allyInstanceId,
        action.targetType,
        action.targetInstanceId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      const allyIdx = player.allies.findIndex((a) => a.instanceId === action.allyInstanceId);
      const ally = player.allies[allyIdx];

      ally.exhausted = true;
      const allyCard = ally.card as AllyCard;
      const allyStats = getEffectiveAllyStats(nextState, ally);
      const thwValue = allyStats.thwart;

      const thwartRes = applyThwart(nextState, {
        thwarterType: 'ALLY',
        thwarterEntity: ally,
        playerId: player.id,
        targetType: action.targetType,
        targetInstanceId: action.targetInstanceId,
        thwartValue: thwValue,
      });

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: allyCard.name },
        onomatopoeia: 'EXHAUST',
      });

      // Consequential damage to ally
      const consequential = allyCard.thwartCost ?? 1;
      ally.tokens = { ...ally.tokens, damage: (ally.tokens?.damage || 0) + consequential };

      // Check Ally Defeat
      const allyHp = allyCard.health || 2;
      if ((ally.tokens?.damage || 0) >= allyHp) {
        player.allies.splice(allyIdx, 1);
        processHostDefeated(nextState, ally, { player });
        dispatchDefeat(nextState, {
          targetPlayerId: player.id,
          targetInstanceId: ally.instanceId,
          targetType: 'ALLY',
          defeatSource: { kind: 'EFFECT', playerId: player.id, byAttack: false },
        });
        const owner = (ally.ownerId ? getPlayer(nextState, ally.ownerId) : undefined) || player;
        resetCardState(ally);
        owner.discard.push(ally);
      }

      const onomatopoeia = thwartRes.result.onomatopoeia || 'ALLY THWART!';
      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'BASIC_THWART': {
      const check = canBasicThwart(
        nextState,
        action.playerId,
        action.targetType,
        action.targetInstanceId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      player.exhausted = true;

      const heroStats = getEffectiveHeroStats(nextState, player);
      const thwartValue = heroStats.thwart;

      const thwartRes = applyThwart(nextState, {
        thwarterType: 'HERO',
        thwarterEntity: player,
        playerId: player.id,
        targetType: action.targetType,
        targetInstanceId: action.targetInstanceId,
        thwartValue,
      });

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: player.activeFormCard.name },
        onomatopoeia: 'EXHAUST',
      });

      const onomatopoeia = thwartRes.result.onomatopoeia || 'FOILED!';
      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'PLAY_CARD': {
      const sourceZone = action.sourceZone || 'HAND';
      const check = canPlayCard(
        nextState,
        action.playerId,
        action.cardInstanceId,
        action.paymentCardInstanceIds,
        action.generatorInstanceIds,
        sourceZone,
        action.targetOwnerPlayerId,
        action.targetPlayerId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;

      let targetCard: CardInstance | undefined;
      let targetOwnerPlayer: PlayerState = player;

      if (sourceZone === 'PLAYER_DISCARD') {
        targetCard = player.discard.find((c) => c.instanceId === action.cardInstanceId);
      } else if (sourceZone === 'ANY_PLAYER_DISCARD') {
        if (action.targetOwnerPlayerId) {
          const owner = getPlayer(nextState, action.targetOwnerPlayerId);
          if (owner) {
            targetCard = owner.discard.find((c) => c.instanceId === action.cardInstanceId);
            targetOwnerPlayer = owner;
          }
        }
        if (!targetCard) {
          for (const p of nextState.players) {
            targetCard = p.discard.find((c) => c.instanceId === action.cardInstanceId);
            if (targetCard) {
              targetOwnerPlayer = p;
              break;
            }
          }
        }
      } else if (sourceZone === 'DECK_TOP') {
        targetCard =
          player.deck[0]?.instanceId === action.cardInstanceId ? player.deck[0] : undefined;
      } else if (sourceZone === 'ATTACHED' || sourceZone === 'TUCKED') {
        targetCard =
          player.attachments?.find((c) => c.instanceId === action.cardInstanceId) ||
          player.cardsUnderneath?.find((c) => c.instanceId === action.cardInstanceId);
      } else {
        targetCard = player.hand.find((c) => c.instanceId === action.cardInstanceId);
      }

      if (!targetCard) {
        return {
          state,
          result: {
            success: false,
            error:
              sourceZone === 'HAND'
                ? 'Target card not found in hand'
                : `Target card not found in ${sourceZone}`,
          },
        };
      }

      // An event pays its declared extra cost (a hand discard) when played: refuse the play
      // before anything changes when that cost cannot be paid (RR v1.8 "Costs").
      if (targetCard.card.type === CardType.EVENT) {
        for (const ability of targetCard.card.enrichment?.abilities || []) {
          const extraCost = getEventAbilityExtraCost(ability);
          if (!extraCost) continue;
          const costCheck = canPayAbilityCost(nextState, player, extraCost, targetCard, {
            discardCardInstanceIds: action.discardCardInstanceIds ?? [],
            playedCardInstanceId: targetCard.instanceId,
          });
          if (!costCheck.allowed) {
            return { state, result: { success: false, error: costCheck.reason } };
          }
        }
      }

      // Check Restricted Keyword limit replacement trigger (RR v1.8 p. 25, ADR-0018, ADR-0032)
      if (isCardRestricted(targetCard.card)) {
        const cardWeight = getCardRestrictedWeight(targetCard.card);
        const currentRestricted = getPlayerRestrictedCount(player);
        const maxRestricted = getPlayerRestrictedLimit(nextState, action.playerId);

        if (currentRestricted + cardWeight > maxRestricted) {
          const options: DecisionPromptOption[] = player.tableau
            .filter((c) => isCardRestricted(c.card))
            .map((c) => ({
              id: c.instanceId,
              label: `Discard ${c.card.name}`,
              description: `Discard ${c.card.name} from tableau to make room for ${targetCard.card.name}`,
              effect: 'DISCARD_RESTRICTED_REPLACEMENT',
              params: {
                discardCardInstanceId: c.instanceId,
                pendingCardInstanceId: action.cardInstanceId,
                paymentCardInstanceIds: action.paymentCardInstanceIds,
                generatorInstanceIds: action.generatorInstanceIds,
                targetInstanceId: action.targetInstanceId,
              },
            }));

          options.push({
            id: 'cancel_play',
            label: 'Cancel (Do not play)',
            description: `Cancel playing ${targetCard.card.name}`,
            effect: 'CANCEL_PLAY',
            params: {
              pendingCardInstanceId: action.cardInstanceId,
            },
          });

          const prompt: PendingDecisionPrompt = {
            promptId: `prompt_discard_restricted_${Date.now()}`,
            playerId: player.id,
            title: 'Restricted Limit Reached',
            description: `You have reached your Restricted card limit (${maxRestricted} max). Choose an in-play Restricted card to discard to make room for ${targetCard.card.name}, or Cancel:`,
            sourceCardName: targetCard.card.name,
            options,
            isVoluntary: true,
          };

          const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
          return {
            state: enqueuedState,
            result: { success: true, onomatopoeia: 'CHOOSE RESTRICTED!' },
          };
        }
      }

      // 1 & 2. Process Hand Payments & Generator Activations via Unified Payment Subsystem (ADR-0072)
      const effectiveCost = getEffectiveCardCost(nextState, player, targetCard).effectiveCost;
      const paymentRes = executeResourceCostPayment(
        nextState,
        player,
        effectiveCost,
        undefined,
        false,
        {
          paymentCardInstanceIds: action.paymentCardInstanceIds,
          generatorInstanceIds: action.generatorInstanceIds,
        },
        targetCard,
        targetCard.card.faction,
      );
      const resourcesSpent = paymentRes.resourcesSpent;

      // Consume applicable active cost reductions immediately upon payment (RR v1.8 p. 7, 17, 23, Issue #46, Issue #165)
      const applicableReductions = getApplicableCostReductions(player, targetCard, nextState);
      if (applicableReductions.length > 0) {
        const consumedIds = new Set(applicableReductions.map((r) => r.id));
        player.activeCostReductions = (player.activeCostReductions || []).filter(
          (r) => !consumedIds.has(r.id),
        );
        player.costReductions = player.activeCostReductions.reduce((sum, r) => sum + r.amount, 0);

        for (const r of applicableReductions) {
          nextState.log.push({
            id: `log_${Date.now()}_cost_consumed`,
            timestamp: Date.now(),
            round: nextState.roundNumber,
            phase: nextState.phase,
            category: 'ability',
            key: 'cost.reduction.consumed',
            params: {
              player: player.name,
              source: r.sourceCardName,
              card: targetCard.card.name,
              amount: r.amount,
            },
            onomatopoeia: `${r.sourceCardName.toUpperCase()} DISCOUNT APPLIED!`,
          });
        }
      }

      // 3. Play Target Card from Source Zone
      let playedCardInstance: CardInstance;
      if (sourceZone === 'PLAYER_DISCARD') {
        const idx = player.discard.findIndex((c) => c.instanceId === action.cardInstanceId);
        [playedCardInstance] = player.discard.splice(idx, 1);
      } else if (sourceZone === 'ANY_PLAYER_DISCARD') {
        const idx = targetOwnerPlayer.discard.findIndex(
          (c) => c.instanceId === action.cardInstanceId,
        );
        [playedCardInstance] = targetOwnerPlayer.discard.splice(idx, 1);
      } else if (sourceZone === 'DECK_TOP') {
        playedCardInstance = player.deck.shift()!;
      } else if (sourceZone === 'ATTACHED' || sourceZone === 'TUCKED') {
        const attIdx =
          player.attachments?.findIndex((c) => c.instanceId === action.cardInstanceId) ?? -1;
        if (attIdx !== -1) {
          [playedCardInstance] = player.attachments!.splice(attIdx, 1);
        } else {
          const tuckIdx =
            player.cardsUnderneath?.findIndex((c) => c.instanceId === action.cardInstanceId) ?? -1;
          [playedCardInstance] = player.cardsUnderneath!.splice(tuckIdx, 1);
        }
      } else {
        const targetIndex = player.hand.findIndex((c) => c.instanceId === action.cardInstanceId);
        [playedCardInstance] = player.hand.splice(targetIndex, 1);
      }

      const cardType = playedCardInstance.card.type;

      // Track owner for cross-player control and attachments per RR v1.8 p. 11
      if (sourceZone === 'ANY_PLAYER_DISCARD') {
        playedCardInstance.ownerId = targetOwnerPlayer.id;
      } else {
        playedCardInstance.ownerId = action.playerId;
      }

      // Cards entering play enter ready with reset transient state (RR v1.8 p. 11, 24)
      if (cardType !== CardType.EVENT) {
        resetCardState(playedCardInstance);
        playedCardInstance.exhausted = false;
      }

      // Initialize counters declaratively for cards with 'uses' definition (RR v1.8 p. 30)
      initializeCardUses(playedCardInstance);

      // Determine onomatopoeia based on ability effects / card type
      let onomatopoeia = 'PLAY!';
      const abilities = playedCardInstance.card.enrichment?.abilities || [];
      const isAttackEffect = abilities.some((a) =>
        (a.steps || []).some((s) =>
          ['DEAL_DAMAGE', 'REPULSOR_BLAST', 'EXPLOSION'].includes(s.effect),
        ),
      );
      const isThwartEffect = abilities.some((a) =>
        (a.steps || []).some((s) => s.effect === 'REMOVE_THREAT'),
      );

      if (isAttackEffect) {
        onomatopoeia = 'POW!';
      } else if (isThwartEffect) {
        onomatopoeia = 'FOILED!';
      } else if (cardType === CardType.ALLY) {
        onomatopoeia = 'ALLY CALL!';
      }

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        actor: {
          name: player.hero?.name || player.name,
          type: player.currentForm === 'hero' ? 'hero' : 'alter_ego',
        },
        key: 'CARD_PLAYED',
        params: {
          who: player.hero?.name || player.name,
          card: playedCardInstance.card.name,
          cost: playedCardInstance.card.cost ?? 0,
        },
        onomatopoeia,
      });

      // Target determination
      let targetType:
        | 'villain'
        | 'minion'
        | 'main_scheme'
        | 'side_scheme'
        | 'character'
        | 'identity'
        | 'ally'
        | 'hero' = 'villain';
      if (action.targetInstanceId) {
        const resolved = resolveEntityByInstanceId(nextState, action.targetInstanceId);
        if (resolved) {
          if (resolved.kind === 'scheme') {
            targetType = resolved.entityType;
          } else if (resolved.kind === 'character') {
            if (resolved.entityType === 'villain') targetType = 'villain';
            else if (resolved.entityType === 'minion') targetType = 'minion';
            else if (resolved.entityType === 'ally') targetType = 'ally';
            else targetType = 'character';
          } else if (resolved.kind === 'player') {
            targetType = 'identity';
          }
        }
      }

      if (cardType === CardType.UPGRADE || cardType === CardType.SUPPORT) {
        const attachAbility = abilities.find((a) =>
          a.steps?.some((s) => s.effect === 'ATTACH_TO_HOST'),
        );
        if (attachAbility) {
          const attachStep = attachAbility.steps.find((s) => s.effect === 'ATTACH_TO_HOST');
          const targetHost = (attachStep?.effectParams?.target as string) || 'VILLAIN';
          (playedCardInstance as any).ownerId = action.playerId;

          // If target is CHOSEN_MINION / MINION and no targetInstanceId was supplied
          if (
            (targetHost === 'CHOSEN_MINION' || targetHost === 'MINION') &&
            !action.targetInstanceId
          ) {
            const allMinions: { minion: CardInstance; player: PlayerState }[] = [];
            for (const p of nextState.players) {
              for (const m of p.engagedMinions || []) {
                allMinions.push({ minion: m, player: p });
              }
            }

            if (allMinions.length > 1) {
              const options: DecisionPromptOption[] = allMinions.map(
                ({ minion, player: engPlayer }) => ({
                  id: minion.instanceId,
                  label: `${minion.card.name} (${engPlayer.name})`,
                  description: `Attach ${playedCardInstance.card.name} to ${minion.card.name}`,
                  effect: 'ATTACH_TO_HOST',
                  params: {
                    isAttachmentMinionChoice: true,
                    attachmentCard: playedCardInstance,
                    ownerId: action.playerId,
                  },
                }),
              );

              const prompt: PendingDecisionPrompt = {
                promptId: `prompt_attach_minion_${Date.now()}`,
                playerId: action.playerId,
                title: 'Choose Minion Host',
                description: `Choose which minion to attach ${playedCardInstance.card.name} to:`,
                sourceCardName: playedCardInstance.card.name,
                options,
                isVoluntary: false,
              };

              const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
              return {
                state: enqueuedState,
                result: { success: true, onomatopoeia: 'CHOOSE MINION!' },
              };
            } else if (allMinions.length === 1) {
              attachCardToHost(
                nextState,
                playedCardInstance,
                targetHost,
                allMinions[0].minion.instanceId,
              );
              const hostName = `${allMinions[0].minion.card.name} (${allMinions[0].player.name})`;
              nextState.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: nextState.roundNumber,
                phase: nextState.phase,
                category: 'ability',
                actor: { name: player.name, type: player.currentForm },
                key: 'card.attached.to_host',
                params: {
                  player: player.name,
                  card: playedCardInstance.card.name,
                  host: hostName,
                  target: hostName,
                },
                onomatopoeia: 'ATTACHED!',
              });
            } else {
              attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
              nextState.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: nextState.roundNumber,
                phase: nextState.phase,
                category: 'ability',
                actor: { name: player.name, type: player.currentForm },
                key: 'card.attached.to_host',
                params: {
                  player: player.name,
                  card: playedCardInstance.card.name,
                  host: 'Minion',
                  target: 'Minion',
                },
                onomatopoeia: 'ATTACHED!',
              });
            }
          } else if (targetHost === 'CHOSEN_MINION' || targetHost === 'MINION') {
            attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
            let hostName = action.targetInstanceId || 'Minion';
            for (const p of nextState.players) {
              const m = p.engagedMinions?.find((min) => min.instanceId === action.targetInstanceId);
              if (m) {
                hostName = `${m.card.name} (${p.name})`;
                break;
              }
            }
            nextState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: nextState.roundNumber,
              phase: nextState.phase,
              category: 'ability',
              actor: { name: player.name, type: player.currentForm },
              key: 'card.attached.to_host',
              params: {
                player: player.name,
                card: playedCardInstance.card.name,
                host: hostName,
                target: hostName,
              },
              onomatopoeia: 'ATTACHED!',
            });
          } else if (
            (targetHost === 'CHOSEN_ALLY' || targetHost === 'ALLY') &&
            !action.targetInstanceId
          ) {
            const maxPerHost =
              attachStep?.effectParams?.maxPerHost !== undefined
                ? Number(attachStep.effectParams.maxPerHost)
                : undefined;

            const allAllies: { ally: CardInstance; player: PlayerState }[] = [];
            for (const p of nextState.players) {
              for (const a of p.allies || []) {
                if (maxPerHost !== undefined && maxPerHost > 0) {
                  const currentAttached = (a.attachments || []).filter(
                    (att) =>
                      att.card.code === playedCardInstance.card.code ||
                      att.card.name === playedCardInstance.card.name,
                  ).length;
                  if (currentAttached >= maxPerHost) continue;
                }
                allAllies.push({ ally: a, player: p });
              }
            }

            if (allAllies.length > 1) {
              const options: DecisionPromptOption[] = allAllies.map(
                ({ ally, player: ctrlPlayer }) => ({
                  id: ally.instanceId,
                  label: `${ally.card.name} (${ctrlPlayer.name})`,
                  description: `Attach ${playedCardInstance.card.name} to ${ally.card.name}`,
                  effect: 'ATTACH_TO_HOST',
                  params: {
                    isAttachmentAllyChoice: true,
                    attachmentCard: playedCardInstance,
                    ownerId: action.playerId,
                  },
                }),
              );

              const prompt: PendingDecisionPrompt = {
                promptId: `prompt_attach_ally_${Date.now()}`,
                playerId: action.playerId,
                title: 'Choose Ally Host',
                description: `Choose which ally to attach ${playedCardInstance.card.name} to:`,
                sourceCardName: playedCardInstance.card.name,
                options,
                isVoluntary: false,
              };

              const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
              return {
                state: enqueuedState,
                result: { success: true, onomatopoeia: 'CHOOSE ALLY!' },
              };
            } else if (allAllies.length === 1) {
              attachCardToHost(
                nextState,
                playedCardInstance,
                targetHost,
                allAllies[0].ally.instanceId,
              );
              const hostName = `${allAllies[0].ally.card.name} (${allAllies[0].player.name})`;
              nextState.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: nextState.roundNumber,
                phase: nextState.phase,
                category: 'ability',
                actor: { name: player.name, type: player.currentForm },
                key: 'card.attached.to_host',
                params: {
                  player: player.name,
                  card: playedCardInstance.card.name,
                  host: hostName,
                  target: hostName,
                },
                onomatopoeia: 'ATTACHED!',
              });
            } else {
              attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
              nextState.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: nextState.roundNumber,
                phase: nextState.phase,
                category: 'ability',
                actor: { name: player.name, type: player.currentForm },
                key: 'card.attached.to_host',
                params: {
                  player: player.name,
                  card: playedCardInstance.card.name,
                  host: 'Ally',
                  target: 'Ally',
                },
                onomatopoeia: 'ATTACHED!',
              });
            }
          } else if (targetHost === 'CHOSEN_ALLY' || targetHost === 'ALLY') {
            attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
            let hostName = action.targetInstanceId || 'Ally';
            for (const p of nextState.players) {
              const a = p.allies?.find((al) => al.instanceId === action.targetInstanceId);
              if (a) {
                hostName = `${a.card.name} (${p.name})`;
                break;
              }
            }
            nextState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: nextState.roundNumber,
              phase: nextState.phase,
              category: 'ability',
              actor: { name: player.name, type: player.currentForm },
              key: 'card.attached.to_host',
              params: {
                player: player.name,
                card: playedCardInstance.card.name,
                host: hostName,
                target: hostName,
              },
              onomatopoeia: 'ATTACHED!',
            });
          } else if (
            (targetHost === 'CHOSEN_ENEMY' || targetHost === 'ENEMY') &&
            !action.targetInstanceId
          ) {
            const maxPerHost =
              attachStep?.effectParams?.maxPerHost !== undefined
                ? Number(attachStep.effectParams.maxPerHost)
                : undefined;

            const allEnemies: { enemy: CardInstance | VillainState; id: string; name: string }[] =
              [];
            for (const villain of getVillainsInPlay(nextState)) {
              const currentAttached = (villain.attachments || []).filter(
                (att) =>
                  att.card.code === playedCardInstance.card.code ||
                  att.card.name === playedCardInstance.card.name,
              ).length;
              if (maxPerHost === undefined || maxPerHost <= 0 || currentAttached < maxPerHost) {
                allEnemies.push({
                  enemy: villain,
                  id: villain.instanceId || 'villain',
                  name: villain.card.name,
                });
              }
            }

            for (const p of nextState.players) {
              for (const m of p.engagedMinions || []) {
                if (maxPerHost !== undefined && maxPerHost > 0) {
                  const currentAttached = (m.attachments || []).filter(
                    (att) =>
                      att.card.code === playedCardInstance.card.code ||
                      att.card.name === playedCardInstance.card.name,
                  ).length;
                  if (currentAttached >= maxPerHost) continue;
                }
                allEnemies.push({
                  enemy: m,
                  id: m.instanceId,
                  name: `${m.card.name} (${p.name})`,
                });
              }
            }

            if (allEnemies.length > 1) {
              const options: DecisionPromptOption[] = allEnemies.map(({ id, name }) => ({
                id,
                label: name,
                description: `Attach ${playedCardInstance.card.name} to ${name}`,
                effect: 'ATTACH_TO_HOST',
                params: {
                  isAttachmentEnemyChoice: true,
                  attachmentCard: playedCardInstance,
                  ownerId: action.playerId,
                },
              }));

              const prompt: PendingDecisionPrompt = {
                promptId: `prompt_attach_enemy_${Date.now()}`,
                playerId: action.playerId,
                title: 'Choose Enemy Host',
                description: `Choose which enemy to attach ${playedCardInstance.card.name} to:`,
                sourceCardName: playedCardInstance.card.name,
                options,
                isVoluntary: false,
              };

              const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
              return {
                state: enqueuedState,
                result: { success: true, onomatopoeia: 'CHOOSE ENEMY!' },
              };
            } else if (allEnemies.length === 1) {
              attachCardToHost(nextState, playedCardInstance, targetHost, allEnemies[0].id);
              const hostName = allEnemies[0].name;
              nextState.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: nextState.roundNumber,
                phase: nextState.phase,
                category: 'ability',
                actor: { name: player.name, type: player.currentForm },
                key: 'card.attached.to_host',
                params: {
                  player: player.name,
                  card: playedCardInstance.card.name,
                  host: hostName,
                  target: hostName,
                },
                onomatopoeia: 'ATTACHED!',
              });
            } else {
              attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
              const villainName =
                resolveAttackedVillain(nextState, action.targetInstanceId)?.card.name ?? '';
              nextState.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: nextState.roundNumber,
                phase: nextState.phase,
                category: 'ability',
                actor: { name: player.name, type: player.currentForm },
                key: 'card.attached.to_host',
                params: {
                  player: player.name,
                  card: playedCardInstance.card.name,
                  host: villainName,
                  target: villainName,
                },
                onomatopoeia: 'ATTACHED!',
              });
            }
          } else if (targetHost === 'CHOSEN_ENEMY' || targetHost === 'ENEMY') {
            attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
            let hostName =
              resolveAttackedVillain(nextState, action.targetInstanceId)?.card.name ?? '';
            for (const p of nextState.players) {
              const m = p.engagedMinions?.find((min) => min.instanceId === action.targetInstanceId);
              if (m) {
                hostName = `${m.card.name} (${p.name})`;
                break;
              }
            }
            nextState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: nextState.roundNumber,
              phase: nextState.phase,
              category: 'ability',
              actor: { name: player.name, type: player.currentForm },
              key: 'card.attached.to_host',
              params: {
                player: player.name,
                card: playedCardInstance.card.name,
                host: hostName,
                target: hostName,
              },
              onomatopoeia: 'ATTACHED!',
            });
          } else {
            attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
            const villainName =
              resolveAttackedVillain(nextState, action.targetInstanceId)?.card.name ?? '';
            nextState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: nextState.roundNumber,
              phase: nextState.phase,
              category: 'ability',
              actor: { name: player.name, type: player.currentForm },
              key: 'card.attached.to_host',
              params: {
                player: player.name,
                card: playedCardInstance.card.name,
                host: villainName,
                target: villainName,
              },
              onomatopoeia: 'ATTACHED!',
            });
          }
        } else if (playedCardInstance.card.enrichment?.playUnderAnyPlayerControl) {
          if (action.targetPlayerId) {
            const targetPlayer = getPlayer(nextState, action.targetPlayerId);
            if (!targetPlayer) {
              return {
                state,
                result: {
                  success: false,
                  error: `Target player ${action.targetPlayerId} not found`,
                },
              };
            }
            playedCardInstance.ownerId = action.playerId;
            targetPlayer.tableau.push(playedCardInstance);
          } else if (nextState.players.length === 1) {
            playedCardInstance.ownerId = player.id;
            player.tableau.push(playedCardInstance);
          } else {
            const options: DecisionPromptOption[] = nextState.players.map((p) => {
              const count = p.tableau.filter(
                (c) =>
                  c.card.code === playedCardInstance.card.code ||
                  c.card.name.toLowerCase().trim() ===
                    playedCardInstance.card.name.toLowerCase().trim(),
              ).length;
              if (
                playedCardInstance.card.maxPerPlayer !== undefined &&
                count >= playedCardInstance.card.maxPerPlayer
              ) {
                return {
                  id: p.id,
                  label: p.name,
                  effect: 'PLAY_UNDER_PLAYER_CONTROL',
                  params: {
                    targetPlayerId: p.id,
                    playedCardInstance,
                    ownerId: action.playerId,
                  },
                  disabled: true,
                  disabledReason: `Max ${playedCardInstance.card.maxPerPlayer} per player limit reached for ${p.name}`,
                };
              }
              return {
                id: p.id,
                label: p.name,
                effect: 'PLAY_UNDER_PLAYER_CONTROL',
                params: {
                  targetPlayerId: p.id,
                  playedCardInstance,
                  ownerId: action.playerId,
                },
              };
            });

            const prompt: PendingDecisionPrompt = {
              promptId: `prompt_choose_player_${Date.now()}`,
              playerId: action.playerId,
              title: 'Choose Player Control',
              description: `Choose which player takes control of ${playedCardInstance.card.name}:`,
              sourceCardName: playedCardInstance.card.name,
              options,
              isVoluntary: false,
            };

            const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
            return {
              state: enqueuedState,
              result: { success: true, onomatopoeia: 'CHOOSE HERO!' },
            };
          }
        } else {
          player.tableau.push(playedCardInstance);
        }

        const controllingPlayer =
          action.targetPlayerId && playedCardInstance.card.enrichment?.playUnderAnyPlayerControl
            ? getPlayer(nextState, action.targetPlayerId) || player
            : player;

        // Apply immediate max health expansion (RR v1.8 p. 11: Current HP increases by same amount)
        for (const ability of abilities) {
          const matchingStep = ability.steps?.find(
            (s) =>
              s.effect === 'MODIFY_MAX_HEALTH' ||
              (s.effect === 'MODIFY_STAT' && s.effectParams?.stat === 'HEALTH'),
          );
          if (ability.timing === 'CONSTANT' && matchingStep) {
            const hpBonus =
              (matchingStep.effectParams?.amount as number) ||
              (matchingStep.effectParams?.healthBonus as number) ||
              0;
            if (hpBonus > 0) {
              controllingPlayer.health += hpBonus;
              controllingPlayer.maxHealth = getEffectiveMaxHealth(controllingPlayer, nextState);
            }
          }
        }

        dispatchTrigger(nextState, 'CARD_PLAYED', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
        dispatchTrigger(nextState, 'ENTERS_PLAY', {
          targetPlayerId: controllingPlayer.id,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
      } else if (cardType === CardType.ALLY) {
        applyToughnessOnEntry(playedCardInstance);
        player.allies.push(playedCardInstance);
        // Dispatch CARD_PLAYED trigger (ally was played — cost paid or waived per ADR-0047)
        dispatchTrigger(nextState, 'CARD_PLAYED', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
        // Dispatch ENTERS_PLAY trigger (ally has entered an in-play zone — per RR v1.8 p.11)
        dispatchTrigger(nextState, 'ENTERS_PLAY', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
      } else if (cardType === CardType.EVENT) {
        let eventTargetId = action.targetInstanceId;

        // Check if event has a CHOSEN_* target scope
        let requiredTargetScope: string | undefined;
        let filterOpts: TargetFilterOptions | undefined;

        for (const ab of abilities) {
          for (const step of ab.steps || []) {
            if (isStepGateClosedByState(step, nextState, { playerId: action.playerId })) continue;
            const stepParams = getStepEffectParams(step);
            const tgt = stepParams.target as string | undefined;
            if (tgt && tgt.startsWith('CHOSEN_')) {
              requiredTargetScope = tgt;
              if (step.effect === 'HEAL' || step.effect === 'HEAL_DAMAGE') {
                filterOpts = { damaged: true };
              } else if (
                step.effect === 'READY' ||
                step.effect === 'READY_ALLY' ||
                step.effect === 'READY_CHARACTER'
              ) {
                filterOpts = { exhausted: true };
              } else if (step.effect === 'REMOVE_THREAT') {
                filterOpts = {
                  ignoresCrisis: Boolean(
                    stepParams.ignoresCrisis ||
                    step.effectParams?.ignoresCrisis ||
                    (step as any).ignoresCrisis,
                  ),
                };
              }
              break;
            }
          }
          if (requiredTargetScope) break;
        }

        if (requiredTargetScope && !eventTargetId) {
          const eligibleTargets = getEligibleTargets(
            nextState,
            player,
            requiredTargetScope,
            filterOpts,
          );
          if (eligibleTargets.length === 1) {
            eventTargetId = eligibleTargets[0].id;
            const resolved = resolveEntityByInstanceId(nextState, eventTargetId);
            if (resolved) {
              if (resolved.kind === 'scheme') targetType = resolved.entityType;
              else if (resolved.kind === 'character') {
                if (resolved.entityType === 'villain') targetType = 'villain';
                else if (resolved.entityType === 'minion') targetType = 'minion';
                else if (resolved.entityType === 'ally') targetType = 'ally';
                else targetType = 'character';
              } else if (resolved.kind === 'player') targetType = 'identity';
            }
          } else if (eligibleTargets.length > 1) {
            const options: DecisionPromptOption[] = eligibleTargets.map((t) => {
              let label = t.id;
              if (t.kind === 'character') {
                if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
                  const p = t.entity as PlayerState;
                  label = `${p.name} (${p.currentForm === 'hero' ? p.hero.name : p.alterEgo.name})`;
                } else if (t.entityType === 'ally' || t.entityType === 'minion') {
                  const cardName = (t.entity as CardInstance).card.name;
                  label = t.player ? `${cardName} (${t.player.name})` : cardName;
                } else if (t.entityType === 'villain') {
                  label = `${(t.entity as VillainState).card.name} (Villain)`;
                }
              } else if (t.kind === 'player') {
                label = (t.entity as PlayerState).name;
              } else if (t.kind === 'scheme') {
                label = (t.entity as any).card?.name || t.id;
              }
              return {
                id: t.id,
                label,
                description: `Target ${label} with ${playedCardInstance.card.name}`,
                effect: 'EVENT_CHOSEN_TARGET',
                params: {
                  isEventTargetChoice: true,
                  playedCardInstance,
                  ownerId: action.playerId,
                  resourcesSpent,
                  discardCardInstanceIds: action.discardCardInstanceIds,
                },
              };
            });

            options.push({
              id: 'cancel_target',
              label: 'Cancel (Return to Hand)',
              description: `Cancel playing ${playedCardInstance.card.name} and return it to hand`,
              effect: 'EVENT_CHOSEN_TARGET',
              params: {
                isEventTargetChoice: true,
                playedCardInstance,
                ownerId: action.playerId,
                resourcesSpent,
              },
            });

            const prompt: PendingDecisionPrompt = {
              promptId: `prompt_event_target_${Date.now()}`,
              playerId: action.playerId,
              title: `Choose Target for ${playedCardInstance.card.name}`,
              description: `Select target for ${playedCardInstance.card.name}:`,
              sourceCardName: playedCardInstance.card.name,
              options,
              isVoluntary: true,
            };

            const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
            return {
              state: enqueuedState,
              result: { success: true, onomatopoeia: 'CHOOSE TARGET!' },
            };
          } else {
            return {
              state,
              result: { success: false, error: 'No eligible targets found for card effect.' },
            };
          }
        }

        // Execute declarative event abilities
        resolveEventAbilities(nextState, player, playedCardInstance, {
          chosenTargetType: targetType,
          chosenTargetInstanceId: eventTargetId,
          resourcesSpent,
          discardCardInstanceIds: action.discardCardInstanceIds,
        });
        player.discard.push(playedCardInstance);
        dispatchTrigger(nextState, 'CARD_PLAYED', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
      } else if (cardType === CardType.PLAYER_SIDE_SCHEME) {
        // Player Side Schemes enter the shared scheme area alongside encounter Side Schemes
        // (RR v1.8 p. 26, ADR-0034), scaled by player count like any other scheme.
        const schemeCard = playedCardInstance.card as unknown as
          SideSchemeCard | PlayerSideSchemeCard;
        const baseThreat =
          (schemeCard.baseThreat ?? 0) *
          (schemeCard.baseThreatFixed ? 1 : getPerPlayerCount(nextState));

        nextState.sideSchemes.push({
          instanceId: playedCardInstance.instanceId,
          card: schemeCard,
          threat: baseThreat,
          ownerId: player.id,
        });

        // Dispatch CARD_PLAYED trigger (side scheme was played — cost paid)
        dispatchTrigger(nextState, 'CARD_PLAYED', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
        // Dispatch ENTERS_PLAY trigger (side scheme has entered the shared scheme area — per RR v1.8 p.11)
        dispatchTrigger(nextState, 'ENTERS_PLAY', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });

        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          key: 'encounter.reveal.sideScheme',
          params: { sideScheme: playedCardInstance.card.name, threat: baseThreat },
          onomatopoeia: 'SIDE SCHEME!',
        });
      }

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'USE_CARD_ABILITY': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      // Find card in all in-play zones or identity (ADR-0055)
      let targetCardInst = findInPlayCardInstance(nextState, action.cardInstanceId);
      const isIdentity = player.activeFormCard.code === action.cardInstanceId;

      const enrichment = isIdentity
        ? player.activeFormCard.enrichment
        : targetCardInst?.card.enrichment;

      if (!enrichment || !enrichment.abilities) {
        return { state, result: { success: false, error: 'Card has no registered abilities' } };
      }

      const ability = enrichment.abilities.find((a) => a.id === action.abilityId);
      if (!ability) {
        return { state, result: { success: false, error: 'Ability not found on card' } };
      }

      // Timing / Form validation
      if (ability.timing.startsWith('HERO_') && player.currentForm !== 'hero') {
        return {
          state,
          result: { success: false, error: 'Can only use this ability in Hero form' },
        };
      }
      if (ability.timing.startsWith('ALTER_EGO_') && player.currentForm !== 'alter_ego') {
        return {
          state,
          result: { success: false, error: 'Can only use this ability in Alter-Ego form' },
        };
      }

      // Limit validation (e.g. ONCE_PER_ROUND, ONCE_PER_PHASE)
      const abilityKey = targetCardInst ? `${targetCardInst.instanceId}_${ability.id}` : ability.id;
      if (
        ability.limit === 'ONCE_PER_ROUND' &&
        (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1
      ) {
        return {
          state,
          result: {
            success: false,
            error: `Ability '${ability.id}' has already been used this round (Limit: once per round)`,
          },
        };
      }
      if (
        ability.limit === 'ONCE_PER_PHASE' &&
        (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1
      ) {
        return {
          state,
          result: {
            success: false,
            error: `Ability '${ability.id}' has already been used this phase (Limit: once per phase)`,
          },
        };
      }

      // Resource payment validation: Player must explicitly select payment cards or generators (RR v1.8 p. 25 / ADR-0055)
      if (
        ability.cost?.resourceCost ||
        (ability.cost?.resources && ability.cost.resources.length > 0)
      ) {
        const hasPaymentCards = (action.paymentCardInstanceIds?.length || 0) > 0;
        const hasGenerators = (action.generatorInstanceIds?.length || 0) > 0;
        if (!hasPaymentCards && !hasGenerators) {
          return {
            state,
            result: {
              success: false,
              error:
                'Payment cards or resource generators must be selected to satisfy the resource cost.',
            },
          };
        }
      }

      if (
        ability.cost?.discardCard?.from === 'HAND' &&
        ability.cost.discardCard.mode !== 'RANDOM'
      ) {
        const requiredCount = ability.cost.discardCard.count || 1;
        if (
          !action.discardCardInstanceIds ||
          action.discardCardInstanceIds.length < requiredCount
        ) {
          return {
            state,
            result: {
              success: false,
              error: 'Discard cards must be selected from hand to satisfy the discard cost.',
            },
          };
        }
      }

      // Ability initiation & target validity check (RR v1.8 p. 15-16, 29, 30; Issue #101)
      const initCheck = canInitiateAbility(nextState, action.playerId, ability, targetCardInst, {
        discardCardInstanceIds: action.discardCardInstanceIds,
        paymentCardInstanceIds: action.paymentCardInstanceIds,
        generatorInstanceIds: action.generatorInstanceIds,
        targetInstanceId: action.targetInstanceId,
      });
      if (!initCheck.allowed) {
        return { state, result: { success: false, error: initCheck.reason } };
      }

      // Execute cost payment
      const { discardedCards, resourcesSpent } = executeAbilityCost(
        nextState,
        player,
        ability,
        targetCardInst,
        {
          discardCardInstanceIds: action.discardCardInstanceIds,
          paymentCardInstanceIds: action.paymentCardInstanceIds,
          generatorInstanceIds: action.generatorInstanceIds,
          targetInstanceId: action.targetInstanceId,
        },
      );

      // Discard on empty counters if Uses counters exhausted (RR v1.8 p. 30)
      if (targetCardInst) {
        checkAndDiscardZeroCounterCard(nextState, player, targetCardInst);
      }

      // The cost results feed the steps' dynamic amounts (`DISCARDED_CARDS`, `RESOURCES_SPENT`).
      const costContext = { discardedCards, resourcesSpent };

      let abilityTargetId = action.targetInstanceId;
      let requiredAbilityScope: string | undefined;
      let abilityFilterOpts: TargetFilterOptions | undefined;
      for (const step of ability.steps || []) {
        if (isStepGateClosedByState(step, nextState, { playerId: action.playerId })) continue;
        const stepParams = getStepEffectParams(step);
        const tgt = stepParams.target as string | undefined;
        if (tgt && tgt.startsWith('CHOSEN_') && tgt !== 'CHOSEN_PLAYER') {
          requiredAbilityScope = tgt;
          if (step.effect === 'HEAL' || step.effect === 'HEAL_DAMAGE') {
            abilityFilterOpts = { damaged: true };
          } else if (
            step.effect === 'READY' ||
            step.effect === 'READY_ALLY' ||
            step.effect === 'READY_CHARACTER'
          ) {
            abilityFilterOpts = { exhausted: true };
          } else if (step.effect === 'REMOVE_THREAT') {
            abilityFilterOpts = {
              ignoresCrisis: Boolean(
                stepParams.ignoresCrisis ||
                step.effectParams?.ignoresCrisis ||
                (step as any).ignoresCrisis,
              ),
            };
          }
          break;
        }
      }

      if (requiredAbilityScope && !abilityTargetId) {
        const eligibleTargets = getEligibleTargets(
          nextState,
          player,
          requiredAbilityScope,
          abilityFilterOpts,
        );
        if (eligibleTargets.length === 1) {
          abilityTargetId = eligibleTargets[0].id;
        } else if (eligibleTargets.length > 1) {
          const options: DecisionPromptOption[] = eligibleTargets.map((t) => {
            let label = t.id;
            if (t.kind === 'character') {
              if (t.entityType === 'hero' || t.entityType === 'alter_ego') {
                const p = t.entity as PlayerState;
                label = `${p.name} (${p.currentForm === 'hero' ? p.hero.name : p.alterEgo.name})`;
              } else if (t.entityType === 'ally' || t.entityType === 'minion') {
                const cardName = (t.entity as CardInstance).card.name;
                label = t.player ? `${cardName} (${t.player.name})` : cardName;
              } else if (t.entityType === 'villain') {
                label = `${(t.entity as VillainState).card.name} (Villain)`;
              }
            } else if (t.kind === 'player') {
              label = (t.entity as PlayerState).name;
            } else if (t.kind === 'scheme') {
              label = (t.entity as any).card?.name || t.id;
            }
            return {
              id: t.id,
              label,
              description: `Target ${label} with ${targetCardInst?.card.name || ability.id}`,
              effect: 'ABILITY_CHOSEN_TARGET',
              params: {
                isAbilityTargetChoice: true,
                ability,
                sourceCardInst: targetCardInst,
                abilityKey,
                playerId: action.playerId,
                ...costContext,
              },
            };
          });

          const prompt: PendingDecisionPrompt = {
            promptId: `prompt_ability_target_${Date.now()}`,
            playerId: action.playerId,
            title: `Choose Target for ${targetCardInst?.card.name || 'Ability'}`,
            description: `Select target for ${targetCardInst?.card.name || 'Ability'}:`,
            sourceCardName: targetCardInst?.card.name || 'Ability',
            options,
            isVoluntary: false,
          };

          const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
          return {
            state: enqueuedState,
            result: { success: true, onomatopoeia: 'CHOOSE TARGET!' },
          };
        }
      }

      // Execute effect primitive
      const effectRes = executeEffect(nextState, ability, {
        playerId: action.playerId,
        sourceCardInstance: targetCardInst,
        chosenTargetInstanceId: abilityTargetId,
        ...costContext,
      });

      if (effectRes.success) {
        if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
        player.usedAbilitiesThisRound[abilityKey] =
          (player.usedAbilitiesThisRound[abilityKey] || 0) + 1;
        if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
        player.usedAbilitiesThisPhase[abilityKey] =
          (player.usedAbilitiesThisPhase[abilityKey] || 0) + 1;
      }

      return {
        state: effectRes.state,
        result: {
          success: effectRes.success,
          error: effectRes.error,
          onomatopoeia: effectRes.onomatopoeia || 'ABILITY ACTIVATED!',
        },
      };
    }

    case 'END_PLAYER_TURN':
    case 'END_TURN' as any: {
      if (nextState.players[nextState.activePlayerIndex]?.id !== action.playerId) {
        return {
          state,
          result: { success: false, error: 'Cannot end turn when it is not your turn' },
        };
      }

      const currentPlayer = nextState.players[nextState.activePlayerIndex];
      const nextIndex = (nextState.activePlayerIndex + 1) % nextState.players.length;
      const characterName =
        currentPlayer.activeFormCard?.name ||
        (currentPlayer.currentForm === 'alter_ego'
          ? currentPlayer.alterEgo?.name
          : currentPlayer.hero?.name) ||
        currentPlayer.name;

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'phase',
        actor: {
          name: characterName,
          type: currentPlayer.currentForm || 'hero',
        },
        key: 'player.turn.ended',
        params: {
          player: characterName,
          who: characterName,
        },
        onomatopoeia: 'PASS',
      });

      // Expire TURN-duration cost reductions and stat modifiers on current player and controlled cards (RR v1.8)
      currentPlayer.activeCostReductions = (currentPlayer.activeCostReductions || []).filter(
        (r) => r.duration !== 'TURN',
      );
      currentPlayer.costReductions = currentPlayer.activeCostReductions.reduce(
        (sum, r) => sum + r.amount,
        0,
      );
      currentPlayer.activeStatModifiers = (currentPlayer.activeStatModifiers || []).filter(
        (m) => m.duration !== 'TURN',
      );
      for (const card of [
        ...currentPlayer.allies,
        ...currentPlayer.tableau,
        ...(currentPlayer.attachments || []),
      ]) {
        card.activeStatModifiers = (card.activeStatModifiers || []).filter(
          (m) => m.duration !== 'TURN',
        );
      }

      // If all players have taken their turns in this round -> proceed to End of Player Phase Clean-Up (RR v1.8 p. 23)
      if (nextIndex === nextState.firstPlayerIndex) {
        nextState.activePlayerIndex = nextState.firstPlayerIndex;
        const finalState = initiatePlayerPhaseCleanup(nextState);
        return {
          state: finalState,
          result: { success: true, onomatopoeia: 'END OF PLAYER PHASE' },
        };
      } else {
        nextState.activePlayerIndex = nextIndex;
        const nextPlayer = nextState.players[nextIndex];
        return {
          state: nextState,
          result: {
            success: true,
            onomatopoeia: `${nextPlayer.name.toUpperCase()}'S TURN!`,
          },
        };
      }
    }

    case 'ADVANCE_VILLAIN_PHASE': {
      if (nextState.winner) {
        return {
          state,
          result: { success: false, error: 'Game has already ended' },
        };
      }

      if (peekDecisionPrompt(nextState)) {
        return {
          state,
          result: {
            success: false,
            error: 'Cannot advance villain phase while a decision prompt is pending',
          },
        };
      }

      const advancedState = advanceVillainPhaseStep(nextState);
      const onom = advancedState.villainPhaseStepEvent?.onomatopoeia || 'STEP';
      return {
        state: advancedState,
        result: {
          success: true,
          onomatopoeia: onom,
        },
      };
    }

    case 'DEV_ADD_CARD_TO_HAND': {
      const player = nextState.players.find((p) => p.id === action.playerId);
      if (!player) {
        return { state, result: { success: false, error: 'Player not found' } };
      }

      const cardIdx = player.deck.findIndex((c) => c.instanceId === action.cardInstanceId);
      if (cardIdx === -1) {
        return { state, result: { success: false, error: 'Card not found in deck' } };
      }

      const [selectedCard] = player.deck.splice(cardIdx, 1);
      player.hand.push(selectedCard);

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'ability',
        actor: { name: player.name, type: player.currentForm },
        key: 'dev.card.tutor',
        params: { card: selectedCard.card.name, hero: player.name },
        onomatopoeia: 'DEV TUTOR!',
      });

      return {
        state: nextState,
        result: {
          success: true,
          onomatopoeia: 'CARD ADDED!',
        },
      };
    }

    case 'RESOLVE_DECISION_PROMPT': {
      const activePrompt = peekDecisionPrompt(nextState);
      const targetPlayerId = action.playerId || activePrompt?.playerId;
      const player = targetPlayerId ? getPlayer(nextState, targetPlayerId) : undefined;
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      // Distribution Prompt Resolution (ADR-0064)
      if (
        activePrompt &&
        (activePrompt.kind === 'DISTRIBUTE_POINTS' || activePrompt.distributionConfig !== undefined)
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);

        if (
          (action.selectedOptionId === 'cancel' || action.selectedOptionId === 'pass') &&
          (activePrompt.distributionConfig?.canCancel || activePrompt.isVoluntary)
        ) {
          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: player.name, type: player.currentForm },
            key: 'decision.distribution.cancelled',
            params: { player: player.name, source: activePrompt.sourceCardName },
            onomatopoeia: 'CANCELLED',
          });
          return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
        }

        const assignments = action.assignments || {};
        const config = activePrompt.distributionConfig;
        const domain = config?.allocationDomain || 'DAMAGE';

        // Route assignments to top execution stack frame if one exists
        if (poppedState.executionStack && poppedState.executionStack.length > 0) {
          const topFrame = poppedState.executionStack[poppedState.executionStack.length - 1];
          if (topFrame) {
            topFrame.context = { ...(topFrame.context || {}), assignments };
          }
        }

        // Apply assignments across targets
        for (const [targetId, amount] of Object.entries(assignments)) {
          if (amount <= 0) continue;

          if (domain === 'DAMAGE') {
            let ally: CardInstance | undefined;
            let allyController: PlayerState | undefined;
            for (const p of poppedState.players) {
              const found = p.allies.find((a) => a.instanceId === targetId);
              if (found) {
                ally = found;
                allyController = p;
                break;
              }
            }

            if (ally && allyController) {
              const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
              if (allyToughIdx !== -1) {
                ally.statusCards!.splice(allyToughIdx, 1);
              } else {
                const currentDmg = ally.tokens?.damage || 0;
                const newDmg = currentDmg + amount;
                const allyHp = (ally.card as any).health || 1;
                if (newDmg >= allyHp) {
                  const idx = allyController.allies.indexOf(ally);
                  allyController.allies.splice(idx, 1);
                  processHostDefeated(poppedState, ally, { player: allyController });
                  dispatchDefeat(poppedState, {
                    targetPlayerId: allyController.id,
                    targetInstanceId: ally.instanceId,
                    targetType: 'ALLY',
                    defeatSource: { kind: 'EFFECT', playerId: player.id, byAttack: false },
                  });
                  const owner =
                    (ally.ownerId
                      ? poppedState.players.find((pl) => pl.id === ally.ownerId)
                      : undefined) || allyController;
                  resetCardState(ally);
                  owner.discard.push(ally);
                } else {
                  ally.tokens = { ...ally.tokens, damage: newDmg };
                }
              }
            } else {
              const targetPlayer =
                poppedState.players.find(
                  (pl) =>
                    pl.id === targetId ||
                    pl.activeFormCard?.code === targetId ||
                    pl.hero?.code === targetId,
                ) || (targetId === player.id ? player : undefined);
              // A chosen villain is resolved by id so any villain in play can be targeted.
              const targetVillain =
                targetId === 'villain'
                  ? getActiveVillain(poppedState)
                  : getVillainById(poppedState, targetId);

              if (targetPlayer) {
                dealDistributedDamageToPlayer(poppedState, targetPlayer, amount);
              } else if (targetVillain) {
                const vToughIdx = targetVillain.statusCards.indexOf(StatusCard.TOUGH);
                if (vToughIdx !== -1) {
                  targetVillain.statusCards.splice(vToughIdx, 1);
                } else {
                  targetVillain.health = Math.max(0, targetVillain.health - amount);
                  if (targetVillain.health <= 0) {
                    handleVillainDefeat(poppedState, targetVillain.instanceId);
                  }
                }
              } else {
                for (const p of poppedState.players) {
                  const mIdx = p.engagedMinions.findIndex((m) => m.instanceId === targetId);
                  if (mIdx !== -1) {
                    const minion = p.engagedMinions[mIdx];
                    const mToughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
                    if (mToughIdx !== -1) {
                      minion.statusCards!.splice(mToughIdx, 1);
                    } else {
                      const currentDmg = minion.tokens?.damage || 0;
                      const newDmg = currentDmg + amount;
                      const minionHp = getEffectiveMinionHitPoints(poppedState, minion);
                      if (newDmg >= minionHp) {
                        processHostDefeated(poppedState, minion, { player: p });
                        p.engagedMinions.splice(mIdx, 1);
                        moveDefeatedCardToPile(poppedState, minion, poppedState.encounterDiscard);
                        dispatchDefeat(poppedState, {
                          targetPlayerId: player.id,
                          targetInstanceId: minion.instanceId,
                          targetType: 'MINION',
                          defeatSource: { kind: 'EFFECT', playerId: player.id, byAttack: false },
                        });
                      } else {
                        minion.tokens = { ...minion.tokens, damage: newDmg };
                      }
                    }
                    break;
                  }
                }
              }
            }
          } else if (domain === 'THREAT_REMOVAL') {
            const targetMainScheme = getActiveMainScheme(poppedState);
            if (
              targetId === 'main_scheme' ||
              targetId === targetMainScheme?.instanceId ||
              targetId === targetMainScheme?.card?.code
            ) {
              targetMainScheme.threat = Math.max(0, targetMainScheme.threat - amount);
            } else {
              const sideIdx = (poppedState.sideSchemes || []).findIndex(
                (s) => s.instanceId === targetId || s.card.code === targetId,
              );
              if (sideIdx !== -1) {
                const side = poppedState.sideSchemes![sideIdx];
                side.threat = Math.max(0, (side.threat || 0) - amount);
                if (side.threat <= 0) {
                  defeatSideScheme(poppedState, side.instanceId, player.id);
                }
              }
            }
          } else if (domain === 'HEAL') {
            let ally: CardInstance | undefined;
            for (const p of poppedState.players) {
              const found = p.allies.find((a) => a.instanceId === targetId);
              if (found) {
                ally = found;
                break;
              }
            }
            if (ally) {
              const currentDmg = ally.tokens?.damage || 0;
              ally.tokens = { ...ally.tokens, damage: Math.max(0, currentDmg - amount) };
            } else {
              const targetPlayer = poppedState.players.find(
                (pl) =>
                  pl.id === targetId ||
                  pl.activeFormCard?.code === targetId ||
                  pl.hero?.code === targetId,
              );
              if (targetPlayer) {
                targetPlayer.health = Math.min(
                  targetPlayer.maxHealth,
                  targetPlayer.health + amount,
                );
              }
            }
          } else if (domain === 'EXHAUST') {
            const cardInst = findInPlayCardInstance(poppedState, targetId);
            if (cardInst) {
              cardInst.exhausted = true;
            } else {
              const targetPlayer = poppedState.players.find((pl) => pl.id === targetId);
              if (targetPlayer) targetPlayer.exhausted = true;
            }
          } else if (domain === 'COUNTERS') {
            const cardInst = findInPlayCardInstance(poppedState, targetId);
            if (cardInst) {
              cardInst.tokens = {
                ...cardInst.tokens,
                counters: (cardInst.tokens?.counters || 0) + amount,
              };
            }
          }
        }

        const assignedTotal = Object.values(assignments).reduce((sum, n) => sum + (n || 0), 0);
        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'decision.distribution.resolved',
          params: {
            player: player.name,
            domain,
            amount: assignedTotal,
            source: activePrompt.sourceCardName,
          },
          onomatopoeia: 'POINTS ASSIGNED!',
        });

        return {
          state: poppedState,
          result: { success: true, onomatopoeia: 'POINTS ASSIGNED!' },
        };
      }

      // 0. Wakanda Forever! Sequence Order Prompt Resolution (ADR-0038)
      if (
        activePrompt &&
        (activePrompt.title?.includes('Wakanda Forever') ||
          activePrompt.sourceCardName === 'Wakanda Forever!')
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const sequenceOrder: string[] =
          (action as any).sequenceOrder ||
          (action.selectedOptionId ? [action.selectedOptionId] : []);
        const wfHandler = getSpecialHandler('WAKANDA_FOREVER');
        if (wfHandler) {
          const res = wfHandler.execute(
            poppedState,
            { playerId: action.playerId },
            { sequenceOrder },
          );
          return {
            state: res.state,
            result: { success: res.success, onomatopoeia: res.onomatopoeia },
          };
        }
      }

      // 1. End of Player Phase Voluntary Discard & Clean-Up Prompt (RR v1.8 p. 23)
      if (
        activePrompt &&
        activePrompt.options.some(
          (o) => o.effect === 'PLAYER_PHASE_DISCARD_CARD' || o.effect === 'FINISH_PLAYER_CLEANUP',
        )
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const targetPlayer = poppedState.players.find((p) => p.id === action.playerId);
        if (!targetPlayer)
          return { state: poppedState, result: { success: false, error: 'Player not found' } };

        if (
          !selectedOption ||
          selectedOption.id === 'done_cleanup' ||
          selectedOption.effect === 'FINISH_PLAYER_CLEANUP'
        ) {
          // Finish this player's cleanup without any more discards -> refills hand & readies cards
          const finishedState = executePlayerCleanup(poppedState, action.playerId, []);
          return {
            state: finishedState,
            result: { success: true, onomatopoeia: 'CLEAN-UP COMPLETE!' },
          };
        }

        if (selectedOption.effect === 'PLAYER_PHASE_DISCARD_CARD') {
          const cardId = selectedOption.params?.cardInstanceId as string;
          const cardIdx = targetPlayer.hand.findIndex((c) => c.instanceId === cardId);
          if (cardIdx !== -1) {
            const [discarded] = targetPlayer.hand.splice(cardIdx, 1);
            targetPlayer.discard.push(discarded);
            poppedState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: poppedState.roundNumber,
              phase: poppedState.phase,
              category: 'phase',
              actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
              key: 'player.phase.cleanup.cardDiscarded',
              params: { player: targetPlayer.name, card: discarded.card.name },
              onomatopoeia: 'DISCARD',
            });
          }

          // If still has cards in hand, re-enqueue prompt with remaining hand cards
          if (targetPlayer.hand.length > 0) {
            const remainingOptions: DecisionPromptOption[] = targetPlayer.hand.map((c) => ({
              id: `discard_${c.instanceId}`,
              label: `Discard ${c.card.name}`,
              description: `Discard ${c.card.name} to discard pile`,
              effect: 'PLAYER_PHASE_DISCARD_CARD',
              params: { cardInstanceId: c.instanceId, playerId: targetPlayer.id },
            }));

            remainingOptions.push({
              id: 'done_cleanup',
              label: 'Done / Keep Remaining Cards',
              description: 'Proceed to refill hand and ready all cards',
              effect: 'FINISH_PLAYER_CLEANUP',
              params: { playerId: targetPlayer.id },
            });

            const rePrompt: PendingDecisionPrompt = {
              promptId: `prompt_cleanup_${targetPlayer.id}_${Date.now()}`,
              playerId: targetPlayer.id,
              title: 'End of Player Phase: Voluntary Discard',
              description: `${targetPlayer.name}: Select any additional cards in your hand you wish to discard:`,
              sourceCardName: targetPlayer.hero?.name || targetPlayer.name,
              options: remainingOptions,
              isVoluntary: true,
            };

            const enqueuedState = enqueueDecisionPrompt(poppedState, rePrompt);
            return { state: enqueuedState, result: { success: true, onomatopoeia: 'DISCARDED' } };
          } else {
            // No more cards in hand -> finish cleanup
            const finishedState = executePlayerCleanup(poppedState, action.playerId, []);
            return {
              state: finishedState,
              result: { success: true, onomatopoeia: 'CLEAN-UP COMPLETE!' },
            };
          }
        }
      }

      if (
        activePrompt &&
        activePrompt.options.some((o) => o.params?.isEncounterAttachmentHostChoice)
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption =
          activePrompt.options.find((o) => o.id === action.selectedOptionId) ??
          activePrompt.options[0];
        const params = selectedOption.params as {
          attachmentCard: CardInstance;
          revealingPlayerId: string;
          isCancelled: boolean;
          hostName: string;
        };
        const revealingPlayer = getPlayer(poppedState, params.revealingPlayerId) || player;
        completeEncounterAttachment(
          poppedState,
          params.attachmentCard,
          selectedOption.id,
          params.hostName,
          revealingPlayer,
          params.isCancelled,
        );
        return { state: poppedState, result: { success: true, onomatopoeia: 'ATTACHED!' } };
      }

      if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentMinionChoice)) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const chosenMinionId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const attachmentCard = (selectedOption?.params?.attachmentCard ||
          activePrompt.options.find((o) => o.params?.attachmentCard)?.params?.attachmentCard ||
          activePrompt.options[0]?.params?.attachmentCard) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options.find((o) => o.params?.ownerId)?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId) as string | undefined;

        const isCancelled =
          action.selectedOptionId === 'cancel' ||
          action.selectedOptionId === 'pass' ||
          selectedOption?.id === 'cancel' ||
          selectedOption?.id === 'pass';

        if (isCancelled) {
          const targetPlayer = (ownerId ? getPlayer(poppedState, ownerId) : undefined) || player;
          if (attachmentCard) {
            let discIdx = targetPlayer.discard.findIndex(
              (c) => c.instanceId === attachmentCard.instanceId,
            );
            if (discIdx !== -1) {
              targetPlayer.discard.splice(discIdx, 1);
            } else {
              for (const otherPlayer of poppedState.players) {
                discIdx = otherPlayer.discard.findIndex(
                  (c) => c.instanceId === attachmentCard.instanceId,
                );
                if (discIdx !== -1) {
                  otherPlayer.discard.splice(discIdx, 1);
                  break;
                }
              }
            }
            if (!targetPlayer.hand.some((c) => c.instanceId === attachmentCard.instanceId)) {
              targetPlayer.hand.push(attachmentCard);
            }
          }

          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'decision.prompt.cancelled',
            params: {
              player: targetPlayer.name,
              source: activePrompt.sourceCardName,
            },
            onomatopoeia: 'CANCELLED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
        }

        if (attachmentCard) {
          (attachmentCard as any).ownerId = ownerId;
          attachCardToHost(poppedState, attachmentCard, 'CHOSEN_MINION', chosenMinionId);
        }

        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'card.attached.to_host',
          params: {
            player: player.name,
            card: activePrompt.sourceCardName,
            host: selectedOption?.label || chosenMinionId,
            target: selectedOption?.label || chosenMinionId,
          },
          onomatopoeia: 'ATTACHED!',
        });

        return { state: poppedState, result: { success: true, onomatopoeia: 'ATTACHED!' } };
      }

      if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentAllyChoice)) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const chosenAllyId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const attachmentCard = (selectedOption?.params?.attachmentCard ||
          activePrompt.options.find((o) => o.params?.attachmentCard)?.params?.attachmentCard ||
          activePrompt.options[0]?.params?.attachmentCard) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options.find((o) => o.params?.ownerId)?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId) as string | undefined;

        const isCancelled =
          action.selectedOptionId === 'cancel' ||
          action.selectedOptionId === 'pass' ||
          selectedOption?.id === 'cancel' ||
          selectedOption?.id === 'pass';

        if (isCancelled) {
          const targetPlayer = (ownerId ? getPlayer(poppedState, ownerId) : undefined) || player;
          if (attachmentCard) {
            let discIdx = targetPlayer.discard.findIndex(
              (c) => c.instanceId === attachmentCard.instanceId,
            );
            if (discIdx !== -1) {
              targetPlayer.discard.splice(discIdx, 1);
            } else {
              for (const otherPlayer of poppedState.players) {
                discIdx = otherPlayer.discard.findIndex(
                  (c) => c.instanceId === attachmentCard.instanceId,
                );
                if (discIdx !== -1) {
                  otherPlayer.discard.splice(discIdx, 1);
                  break;
                }
              }
            }
            if (!targetPlayer.hand.some((c) => c.instanceId === attachmentCard.instanceId)) {
              targetPlayer.hand.push(attachmentCard);
            }
          }

          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'decision.prompt.cancelled',
            params: {
              player: targetPlayer.name,
              source: activePrompt.sourceCardName,
            },
            onomatopoeia: 'CANCELLED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
        }

        if (attachmentCard) {
          (attachmentCard as any).ownerId = ownerId;
          attachCardToHost(poppedState, attachmentCard, 'CHOSEN_ALLY', chosenAllyId);
        }

        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'card.attached.to_host',
          params: {
            player: player.name,
            card: activePrompt.sourceCardName,
            host: selectedOption?.label || chosenAllyId,
            target: selectedOption?.label || chosenAllyId,
          },
          onomatopoeia: 'ATTACHED!',
        });

        return { state: poppedState, result: { success: true, onomatopoeia: 'ATTACHED!' } };
      }

      if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentEnemyChoice)) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const chosenEnemyId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const attachmentCard = (selectedOption?.params?.attachmentCard ||
          activePrompt.options.find((o) => o.params?.attachmentCard)?.params?.attachmentCard ||
          activePrompt.options[0]?.params?.attachmentCard) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options.find((o) => o.params?.ownerId)?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId) as string | undefined;

        const isCancelled =
          action.selectedOptionId === 'cancel' ||
          action.selectedOptionId === 'pass' ||
          selectedOption?.id === 'cancel' ||
          selectedOption?.id === 'pass';

        if (isCancelled) {
          const targetPlayer = (ownerId ? getPlayer(poppedState, ownerId) : undefined) || player;
          if (attachmentCard) {
            let discIdx = targetPlayer.discard.findIndex(
              (c) => c.instanceId === attachmentCard.instanceId,
            );
            if (discIdx !== -1) {
              targetPlayer.discard.splice(discIdx, 1);
            } else {
              for (const otherPlayer of poppedState.players) {
                discIdx = otherPlayer.discard.findIndex(
                  (c) => c.instanceId === attachmentCard.instanceId,
                );
                if (discIdx !== -1) {
                  otherPlayer.discard.splice(discIdx, 1);
                  break;
                }
              }
            }
            if (!targetPlayer.hand.some((c) => c.instanceId === attachmentCard.instanceId)) {
              targetPlayer.hand.push(attachmentCard);
            }
          }

          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'decision.prompt.cancelled',
            params: {
              player: targetPlayer.name,
              source: activePrompt.sourceCardName,
            },
            onomatopoeia: 'CANCELLED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
        }

        if (attachmentCard) {
          (attachmentCard as any).ownerId = ownerId;
          attachCardToHost(poppedState, attachmentCard, 'CHOSEN_ENEMY', chosenEnemyId);
        }

        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'card.attached.to_host',
          params: {
            player: player.name,
            card: activePrompt.sourceCardName,
            host: selectedOption?.label || chosenEnemyId,
            target: selectedOption?.label || chosenEnemyId,
          },
          onomatopoeia: 'ATTACHED!',
        });

        return { state: poppedState, result: { success: true, onomatopoeia: 'ATTACHED!' } };
      }

      if (activePrompt && activePrompt.options.some((o) => o.params?.isEventTargetChoice)) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options.find((o) => o.params?.ownerId)?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId ||
          action.playerId) as string;
        const targetPlayer = getPlayer(poppedState, ownerId) || player;

        const isCancelled =
          action.selectedOptionId === 'cancel_target' ||
          action.selectedOptionId === 'cancel' ||
          action.selectedOptionId === 'pass' ||
          selectedOption?.id === 'cancel_target' ||
          selectedOption?.id === 'cancel' ||
          selectedOption?.id === 'pass';

        if (isCancelled) {
          const playedCardInstance = (selectedOption?.params?.playedCardInstance ||
            activePrompt.options.find((o) => o.params?.playedCardInstance)?.params
              ?.playedCardInstance ||
            activePrompt.options[0]?.params?.playedCardInstance) as CardInstance | undefined;

          if (playedCardInstance) {
            let discIdx = targetPlayer.discard.findIndex(
              (c) => c.instanceId === playedCardInstance.instanceId,
            );
            if (discIdx !== -1) {
              targetPlayer.discard.splice(discIdx, 1);
            } else {
              for (const otherPlayer of poppedState.players) {
                discIdx = otherPlayer.discard.findIndex(
                  (c) => c.instanceId === playedCardInstance.instanceId,
                );
                if (discIdx !== -1) {
                  otherPlayer.discard.splice(discIdx, 1);
                  break;
                }
              }
            }
            if (!targetPlayer.hand.some((c) => c.instanceId === playedCardInstance.instanceId)) {
              targetPlayer.hand.push(playedCardInstance);
            }
          }

          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'decision.prompt.cancelled',
            params: {
              player: targetPlayer.name,
              source: activePrompt.sourceCardName,
            },
            onomatopoeia: 'CANCELLED',
          });

          return {
            state: poppedState,
            result: { success: true, onomatopoeia: 'CANCELLED' },
          };
        }

        const chosenTargetId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const playedCardInstance = (selectedOption?.params?.playedCardInstance ||
          activePrompt.options[0]?.params?.playedCardInstance) as CardInstance | undefined;
        const resourcesSpent = (selectedOption?.params?.resourcesSpent ||
          activePrompt.options[0]?.params?.resourcesSpent) as string[] | undefined;
        const discardCardInstanceIds = (selectedOption?.params?.discardCardInstanceIds ||
          activePrompt.options[0]?.params?.discardCardInstanceIds) as string[] | undefined;

        if (playedCardInstance) {
          let targetType:
            | 'villain'
            | 'minion'
            | 'main_scheme'
            | 'side_scheme'
            | 'character'
            | 'identity'
            | 'ally' = 'villain';
          const resolved = resolveEntityByInstanceId(poppedState, chosenTargetId);
          if (resolved) {
            if (resolved.kind === 'scheme') targetType = resolved.entityType;
            else if (resolved.kind === 'character') {
              if (resolved.entityType === 'villain') targetType = 'villain';
              else if (resolved.entityType === 'minion') targetType = 'minion';
              else if (resolved.entityType === 'ally') targetType = 'ally';
              else targetType = 'character';
            } else if (resolved.kind === 'player') targetType = 'identity';
          }

          resolveEventAbilities(poppedState, targetPlayer, playedCardInstance, {
            chosenTargetType: targetType,
            chosenTargetInstanceId: chosenTargetId,
            resourcesSpent,
            discardCardInstanceIds,
          });
          targetPlayer.discard.push(playedCardInstance);
          dispatchTrigger(poppedState, 'CARD_PLAYED', {
            targetPlayerId: ownerId,
            sourceInstanceId: playedCardInstance.instanceId,
            resourcesSpent,
          });
        }

        return {
          state: poppedState,
          result: { success: true, onomatopoeia: 'TARGET RESOLVED!' },
        };
      }

      if (activePrompt && activePrompt.options.some((o) => o.params?.isAbilityTargetChoice)) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const chosenTargetId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const promptAbility = (selectedOption?.params?.ability ||
          activePrompt.options[0]?.params?.ability) as CardAbility | undefined;
        const sourceCardInst = (selectedOption?.params?.sourceCardInst ||
          activePrompt.options[0]?.params?.sourceCardInst) as CardInstance | undefined;
        const abilityKey = (selectedOption?.params?.abilityKey ||
          activePrompt.options[0]?.params?.abilityKey) as string;
        const executingPlayerId = (selectedOption?.params?.playerId ||
          activePrompt.options[0]?.params?.playerId ||
          action.playerId) as string;

        if (promptAbility) {
          const effectRes = executeEffect(poppedState, promptAbility, {
            playerId: executingPlayerId,
            sourceCardInstance: sourceCardInst,
            chosenTargetInstanceId: chosenTargetId,
            discardedCards: (selectedOption?.params?.discardedCards ||
              activePrompt.options[0]?.params?.discardedCards) as CardInstance[] | undefined,
            resourcesSpent: (selectedOption?.params?.resourcesSpent ||
              activePrompt.options[0]?.params?.resourcesSpent) as string[] | undefined,
          });

          const actPlayer = getPlayer(poppedState, executingPlayerId);
          if (actPlayer && effectRes.success && abilityKey) {
            if (!actPlayer.usedAbilitiesThisRound) actPlayer.usedAbilitiesThisRound = {};
            actPlayer.usedAbilitiesThisRound[abilityKey] =
              (actPlayer.usedAbilitiesThisRound[abilityKey] || 0) + 1;
            if (!actPlayer.usedAbilitiesThisPhase) actPlayer.usedAbilitiesThisPhase = {};
            actPlayer.usedAbilitiesThisPhase[abilityKey] =
              (actPlayer.usedAbilitiesThisPhase[abilityKey] || 0) + 1;
          }

          return {
            state: effectRes.state,
            result: {
              success: effectRes.success,
              error: effectRes.error,
              onomatopoeia: effectRes.onomatopoeia || 'ABILITY ACTIVATED!',
            },
          };
        }
      }

      if (
        activePrompt &&
        activePrompt.options.some((o) => o.effect === 'PLAY_UNDER_PLAYER_CONTROL')
      ) {
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        if (!selectedOption) {
          return { state: nextState, result: { success: false, error: 'Option not found' } };
        }

        if (selectedOption.disabled) {
          return {
            state: nextState,
            result: {
              success: false,
              error: selectedOption.disabledReason || 'Option is disabled',
            },
          };
        }

        const { state: poppedState } = popDecisionPrompt(nextState);
        const params = selectedOption.params as any;
        const targetPlayerId = params?.targetPlayerId as string;
        const playedCardInstance = params?.playedCardInstance as CardInstance;
        const ownerId = (params?.ownerId as string) || action.playerId;

        const targetPlayer = getPlayer(poppedState, targetPlayerId) || player;
        playedCardInstance.ownerId = ownerId;
        targetPlayer.tableau.push(playedCardInstance);

        const onomatopoeia = 'PLAYED UNDER CONTROL!';
        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'card.playUnderControl.resolved',
          params: {
            player: player.name,
            card: playedCardInstance.card.name,
            targetPlayer: targetPlayer.name,
          },
          onomatopoeia,
        });

        // Apply immediate max health expansion if needed
        const cardAbilities = playedCardInstance.card.enrichment?.abilities || [];
        for (const ability of cardAbilities) {
          const matchingStep = ability.steps?.find(
            (s) =>
              s.effect === 'MODIFY_MAX_HEALTH' ||
              (s.effect === 'MODIFY_STAT' && s.effectParams?.stat === 'HEALTH'),
          );
          if (ability.timing === 'CONSTANT' && matchingStep) {
            const hpBonus =
              (matchingStep.effectParams?.amount as number) ||
              (matchingStep.effectParams?.healthBonus as number) ||
              0;
            if (hpBonus > 0) {
              targetPlayer.health += hpBonus;
              targetPlayer.maxHealth = getEffectiveMaxHealth(targetPlayer, poppedState);
            }
          }
        }

        dispatchTrigger(poppedState, 'CARD_PLAYED', {
          targetPlayerId: ownerId,
          sourceInstanceId: playedCardInstance.instanceId,
        });
        dispatchTrigger(poppedState, 'ENTERS_PLAY', {
          targetPlayerId: targetPlayer.id,
          sourceInstanceId: playedCardInstance.instanceId,
        });

        return { state: poppedState, result: { success: true, onomatopoeia } };
      }

      if (
        activePrompt &&
        activePrompt.options.some(
          (o) => o.effect === 'DISCARD_RESTRICTED_REPLACEMENT' || o.effect === 'CANCEL_PLAY',
        )
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);

        if (
          !selectedOption ||
          selectedOption.id === 'cancel_play' ||
          selectedOption.effect === 'CANCEL_PLAY'
        ) {
          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'card_play',
            actor: { name: player.name, type: player.currentForm },
            key: 'card.play.cancelled',
            params: { player: player.name, card: activePrompt.sourceCardName },
            onomatopoeia: 'CANCELLED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
        }

        if (selectedOption.effect === 'DISCARD_RESTRICTED_REPLACEMENT') {
          const params = selectedOption.params as any;
          const discardId = params?.discardCardInstanceId || selectedOption.id;
          const discardIdx = player.tableau.findIndex((c) => c.instanceId === discardId);
          if (discardIdx !== -1) {
            const [discarded] = player.tableau.splice(discardIdx, 1);
            player.discard.push(discarded);

            poppedState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: poppedState.roundNumber,
              phase: poppedState.phase,
              category: 'card_play',
              actor: { name: player.name, type: player.currentForm },
              key: 'card.discarded.to_make_room',
              params: {
                player: player.name,
                discardedCard: discarded.card.name,
                incomingCard: activePrompt.sourceCardName,
              },
              onomatopoeia: 'REPLACED!',
            });
          }

          return dispatchAction(poppedState, {
            type: 'PLAY_CARD',
            playerId: action.playerId,
            cardInstanceId: params.pendingCardInstanceId,
            paymentCardInstanceIds: params.paymentCardInstanceIds || [],
            generatorInstanceIds: params.generatorInstanceIds || [],
            targetInstanceId: params.targetInstanceId,
          });
        }
      }

      if (
        activePrompt &&
        activePrompt.options.some((o) => o.effect === 'SEARCH_AND_SELECT_RESOLUTION')
      ) {
        // The chosen cards: a multi-select prompt answers with `selectedOptionIds` (possibly none)
        const chosenIds: string[] = activePrompt.selection
          ? (action.selectedOptionIds ?? [])
          : [action.selectedOptionId];
        const selectionError = validateSearchSelection(activePrompt, chosenIds);
        if (selectionError) {
          return { state, result: { success: false, error: selectionError } };
        }
        const { state: poppedState } = popDecisionPrompt(nextState);
        const params = activePrompt.options[0]?.params as any;

        const lookedCards: CardInstance[] = params?.lookedCards || [];
        const sourceZone: string = params?.sourceZone || 'PLAYER_DECK';
        const sourceZones: string[] = Array.isArray(params?.sourceZones)
          ? params.sourceZones
          : params?.sourceZone
            ? [params.sourceZone]
            : ['PLAYER_DECK'];
        const selectedDestination: string = params?.selectedDestination || 'HAND';
        const unselectedDestination: string | null | undefined = params?.unselectedDestination;
        const shuffleAfter: boolean = !!params?.shuffleAfter;
        const isLookCountSpliced: boolean = !!params?.isLookCountSpliced;

        const targetPlayer =
          (params?.targetPlayerId
            ? poppedState.players.find((p) => p.id === params.targetPlayerId)
            : undefined) || poppedState.players.find((p) => p.id === action.playerId)!;

        if (chosenIds.length === 0) {
          if (isLookCountSpliced) {
            routeCardInstances(
              poppedState,
              targetPlayer,
              lookedCards,
              unselectedDestination,
              sourceZone,
            );
          }
          if (shuffleAfter) {
            if (sourceZones.includes('ENCOUNTER_DECK')) {
              poppedState.encounterDeck.sort(() => Math.random() - 0.5);
            }
            if (sourceZones.includes('PLAYER_DECK')) {
              targetPlayer.deck.sort(() => Math.random() - 0.5);
            }
          }

          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'card.search.passed',
            params: { player: targetPlayer.name, prompt: activePrompt.title },
            onomatopoeia: 'PASSED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'PASSED' } };
        }

        // Selected cards
        const chosenCards: { card: CardInstance; zone: string }[] = [];
        let unchosenCards: CardInstance[] = [];

        if (isLookCountSpliced) {
          for (const id of chosenIds) {
            const card = lookedCards.find((c) => c.instanceId === id);
            if (card) chosenCards.push({ card, zone: sourceZone });
          }
          unchosenCards = lookedCards.filter((c) => !chosenIds.includes(c.instanceId));
        } else {
          // Full search across pile: find and splice each chosen card from the source zones
          for (const id of chosenIds) {
            const searchZones = [sourceZone, ...sourceZones.filter((z) => z !== sourceZone)];
            for (const zone of searchZones) {
              let pile: CardInstance[] = targetPlayer.deck;
              if (zone === 'PLAYER_DISCARD') pile = targetPlayer.discard;
              else if (zone === 'PLAYER_HAND') pile = targetPlayer.hand;
              else if (zone === 'ENCOUNTER_DECK') pile = poppedState.encounterDeck;
              else if (zone === 'ENCOUNTER_DISCARD') pile = poppedState.encounterDiscard;

              const matchIdx = pile.findIndex((c) => c.instanceId === id);
              if (matchIdx !== -1) {
                chosenCards.push({ card: pile.splice(matchIdx, 1)[0], zone });
                break;
              }
            }
          }
        }

        for (const { card, zone } of chosenCards) {
          routeCardInstances(
            poppedState,
            targetPlayer,
            [card],
            selectedDestination,
            zone,
            params?.target,
          );
        }

        if (isLookCountSpliced && unchosenCards.length > 0) {
          routeCardInstances(
            poppedState,
            targetPlayer,
            unchosenCards,
            unselectedDestination,
            sourceZone,
          );
        }

        if (shuffleAfter) {
          if (sourceZones.includes('ENCOUNTER_DECK')) {
            poppedState.encounterDeck.sort(() => Math.random() - 0.5);
          }
          if (sourceZones.includes('PLAYER_DECK')) {
            targetPlayer.deck.sort(() => Math.random() - 0.5);
          }
        }

        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
          key: 'card.searched.selected',
          params: {
            player: targetPlayer.name,
            card: chosenCards.map((c) => c.card.card.name).join(', '),
          },
          onomatopoeia: 'SELECTED!',
        });

        return { state: poppedState, result: { success: true, onomatopoeia: 'SELECTED!' } };
      }

      if (
        activePrompt &&
        activePrompt.options.some(
          (o) =>
            o.effect === 'PLAY_CARD_FROM_ZONE_RESOLUTION' ||
            o.effect === 'PLAY_CARD_FROM_ZONE_PASS',
        )
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const targetPlayer =
          poppedState.players.find((p) => p.id === (action.playerId || activePrompt.playerId)) ||
          player;

        if (
          !selectedOption ||
          action.selectedOptionId === 'pass_play_from_zone' ||
          action.selectedOptionId === 'pass' ||
          action.selectedOptionId === 'PLAY_CARD_FROM_ZONE_PASS' ||
          selectedOption?.id === 'pass_play_from_zone' ||
          selectedOption?.id === 'pass' ||
          selectedOption?.effect === 'PLAY_CARD_FROM_ZONE_PASS'
        ) {
          if (activePrompt.sourceCardInstanceId || activePrompt.sourceCardCode) {
            let discardIdx = targetPlayer.discard.findIndex(
              (c) =>
                (activePrompt.sourceCardInstanceId &&
                  c.instanceId === activePrompt.sourceCardInstanceId) ||
                (activePrompt.sourceCardCode && c.card.code === activePrompt.sourceCardCode),
            );
            if (discardIdx !== -1) {
              const [refunded] = targetPlayer.discard.splice(discardIdx, 1);
              targetPlayer.hand.push(refunded);
            } else {
              for (const otherPlayer of poppedState.players) {
                discardIdx = otherPlayer.discard.findIndex(
                  (c) =>
                    (activePrompt.sourceCardInstanceId &&
                      c.instanceId === activePrompt.sourceCardInstanceId) ||
                    (activePrompt.sourceCardCode && c.card.code === activePrompt.sourceCardCode),
                );
                if (discardIdx !== -1) {
                  const [refunded] = otherPlayer.discard.splice(discardIdx, 1);
                  targetPlayer.hand.push(refunded);
                  break;
                }
              }
            }
          }

          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'card.playFromZone.passed',
            params: { player: targetPlayer.name, prompt: activePrompt.title },
            onomatopoeia: 'PASSED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'PASSED' } };
        }

        const params = selectedOption.params as any;
        const chosenInstanceId = params.chosenInstanceId;
        const ownerId = params.ownerId;
        const ownerPlayer = poppedState.players.find((p) => p.id === ownerId) || player;

        // Splice from owner discard
        const matchIdx = ownerPlayer.discard.findIndex((c) => c.instanceId === chosenInstanceId);
        if (matchIdx !== -1) {
          const [chosenCard] = ownerPlayer.discard.splice(matchIdx, 1);

          // Deduct cost
          const cost = chosenCard.card.cost ?? 0;
          const paymentOptions =
            (action.paymentCardInstanceIds && action.paymentCardInstanceIds.length > 0) ||
            (action.generatorInstanceIds && action.generatorInstanceIds.length > 0)
              ? {
                  paymentCardInstanceIds: action.paymentCardInstanceIds,
                  generatorInstanceIds: action.generatorInstanceIds,
                }
              : undefined;

          if (paymentOptions && cost > 0) {
            executeResourceCostPayment(
              poppedState,
              targetPlayer,
              cost,
              undefined,
              false,
              paymentOptions,
              chosenCard,
              chosenCard.card.faction,
            );
          } else if (cost > 0) {
            // Deduct up to cost cards from player hand if present
            const countToDiscard = Math.min(cost, targetPlayer.hand.length);
            const discarded = targetPlayer.hand.splice(0, countToDiscard);
            targetPlayer.discard.push(...discarded);
          }

          // Track owner for cross-player control per RR v1.8 p. 11
          chosenCard.ownerId = ownerPlayer.id;

          // Reset transient gameplay state and ensure card enters ready (RR v1.8 p. 11, 24)
          resetCardState(chosenCard);
          chosenCard.exhausted = false;

          if (chosenCard.card.type === CardType.ALLY) {
            applyToughnessOnEntry(chosenCard);
            targetPlayer.allies.push(chosenCard);
          } else {
            targetPlayer.tableau.push(chosenCard);
          }

          initializeCardUses(chosenCard);

          // Trigger CARD_PLAYED (card was played, cost paid per ADR-0047) and ENTERS_PLAY (per RR v1.8 p.11)
          dispatchTrigger(poppedState, 'CARD_PLAYED', {
            targetPlayerId: targetPlayer.id,
            sourceInstanceId: chosenCard.instanceId,
          });
          dispatchTrigger(poppedState, 'ENTERS_PLAY', {
            targetPlayerId: targetPlayer.id,
            sourceInstanceId: chosenCard.instanceId,
          });

          const onomatopoeia = `PLAYED ${chosenCard.card.name.toUpperCase()}!`;
          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'card.playFromZone.resolved',
            params: {
              player: targetPlayer.name,
              card: chosenCard.card.name,
            },
            onomatopoeia,
          });

          return { state: poppedState, result: { success: true, onomatopoeia } };
        }
      }

      const paymentOptions =
        action.paymentCardInstanceIds || action.generatorInstanceIds
          ? {
              paymentCardInstanceIds: action.paymentCardInstanceIds,
              generatorInstanceIds: action.generatorInstanceIds,
            }
          : undefined;
      const hadPausedThreatPlacement = (nextState.pendingThreatPlacements?.length ?? 0) > 0;
      const promptRes = resolveDecisionPrompt(
        nextState,
        action.playerId,
        action.selectedOptionId,
        paymentOptions,
      );
      let resultingState = promptRes.state;

      // If resolving an initiation trigger prompt for an active attack, continue attack
      if (resultingState.activeAttackContext?.phase === 'INITIATION') {
        const attackCtx = resultingState.activeAttackContext;
        resultingState = continueAttackAfterInitiation(resultingState, attackCtx);
      }

      // If resolving a damage prevention interrupt for an active attack, finish damage calculation and post-resolution
      if (
        activePrompt &&
        resultingState.activeAttackContext?.pendingDamage !== undefined &&
        (activePrompt.description?.includes('DAMAGE_WOULD_BE_TAKEN') ||
          activePrompt.options.some(
            (o) => (o.params as any)?.ability?.trigger === 'DAMAGE_WOULD_BE_TAKEN',
          ))
      ) {
        const attackCtx = resultingState.activeAttackContext;
        let preventedDamage = 0;
        if (action.selectedOptionId !== 'pass' && action.selectedOptionId !== 'PASS') {
          const optAbility = (
            activePrompt?.options.find((o) => o.id === action.selectedOptionId)?.params as any
          )?.ability;
          const preventStep = optAbility?.steps?.find((s: any) => s.effect === 'PREVENT_DAMAGE');
          if (preventStep) {
            const isAll =
              preventStep.effectParams?.amount === 'ALL' ||
              preventStep.effectParams?.preventAll ||
              preventStep.effectParams?.amount === undefined;
            preventedDamage = isAll
              ? (attackCtx.pendingDamage ?? 0)
              : Number(preventStep.effectParams?.amount || 0);
          }
        }
        resultingState = finishAttackDamageAndPostResolution(
          resultingState,
          attackCtx,
          preventedDamage,
        );
      }

      // If in villain phase and no decision prompts are pending, continue villain phase sequence
      if (resultingState.phase === GamePhase.VILLAIN_PHASE && !peekDecisionPrompt(resultingState)) {
        if (resultingState.options?.villainPhaseStepping && resultingState.lastCombatOutcome) {
          // Allow resolved combat state and lastCombatOutcome to return to UI for math modal
        } else if (resultingState.options?.villainPhaseStepping && hadPausedThreatPlacement) {
          // Stepped phase: the step event now shows the placed threat (#266); the next step continues.
        } else {
          resultingState = continueVillainPhase(resultingState);
        }
      }

      return {
        ...promptRes,
        state: resultingState,
      };
    }

    case 'DECLARE_DEFENDER': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      let updatedState = resolveDefenderDeclaration(nextState, {
        type: action.defenderType,
        playerId: action.playerId,
        allyInstanceId: action.allyInstanceId,
      });

      if (updatedState.phase === GamePhase.VILLAIN_PHASE && !peekDecisionPrompt(updatedState)) {
        if (updatedState.options?.villainPhaseStepping && updatedState.lastCombatOutcome) {
          // Allow resolved combat state and lastCombatOutcome to return to UI for math modal
        } else {
          updatedState = continueVillainPhase(updatedState);
        }
      }

      return {
        state: updatedState,
        result: { success: true, onomatopoeia: 'DEFENSE RESOLVED!' },
      };
    }

    case 'MINION_ENGAGES_PLAYER': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      const minionInst = (action as any).minionInstance as CardInstance;
      if (minionInst) {
        player.engagedMinions.push(minionInst);

        // Quickstrike Keyword check (RR v1.8 p. 18)
        if (hasEntityKeyword(minionInst, 'Quickstrike') && player.currentForm === 'hero') {
          const updated = executeMinionAttackAgainstPlayer(nextState, minionInst, player, {
            synchronousPolicy: 'TAKE_UNDEFENDED',
          });
          return { state: updated, result: { success: true, onomatopoeia: 'QUICKSTRIKE!' } };
        }
      }

      return { state: nextState, result: { success: true } };
    }

    case 'REVEAL_ENCOUNTER_CARD': {
      const targetPlayer =
        getPlayer(nextState, (action as any).targetPlayerId || (action as any).playerId) ||
        nextState.players[0];
      const encounterCard = (action as any).encounterCard as CardInstance;
      if (!encounterCard)
        return { state, result: { success: false, error: 'Encounter card required' } };

      // Incite X Keyword check (RR v1.8 p. 16, ADR-0019)
      const inciteAmount =
        (encounterCard.card.enrichment as any)?.incite ||
        getKeywordValue(encounterCard.card, Keyword.INCITE) ||
        0;
      if (inciteAmount > 0) {
        applyThreatPlacement(nextState, {
          targetType: 'main_scheme',
          amount: inciteAmount,
          sourceType: 'INCITE',
          sourceEntityName: encounterCard.card?.name || 'Encounter Card',
          sourcePlayerId: targetPlayer.id,
        });
      }

      // Route card according to type
      if (encounterCard.card.type === CardType.MINION) {
        targetPlayer.engagedMinions.push(encounterCard);
        if (hasEntityKeyword(encounterCard, 'Quickstrike') && targetPlayer.currentForm === 'hero') {
          const updated = executeMinionAttackAgainstPlayer(nextState, encounterCard, targetPlayer, {
            synchronousPolicy: 'TAKE_UNDEFENDED',
          });
          return { state: updated, result: { success: true, onomatopoeia: 'QUICKSTRIKE!' } };
        }
      }

      return { state: nextState, result: { success: true, onomatopoeia: 'REVEALED!' } };
    }

    default:
      return { state, result: { success: false, error: 'Unknown action type' } };
  }
}
