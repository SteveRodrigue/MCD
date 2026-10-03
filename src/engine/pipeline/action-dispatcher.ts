import {
  GameState,
  GameAction,
  ActionResult,
  StatusCard,
  CardType,
  AlterEgoCard,
  MinionCard,
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
  executeAbilityCost,
  executeResourceCostPayment,
  checkAndDiscardZeroCounterCard,
  getApplicableCostReductions,
  getEffectiveCardCost,
} from './cost-engine';
import {
  executeEffect,
  moveDefeatedCardToPile,
  processHostDefeated,
  defeatSideScheme,
  resetCardState,
} from '../effects';
import {
  advanceVillainPhaseStep,
  continueVillainPhase,
  executeMinionAttackAgainstPlayer,
  resolveActiveEncounterCardAfterInterrupt,
} from './villain-phase';
import { initiatePlayerPhaseCleanup, executePlayerCleanup } from './player-phase-cleanup';
import { handleVillainDefeat } from './scenario-helpers';
import {
  getEffectiveAllyStats,
  getEffectiveHeroStats,
  getEffectiveMaxHealth,
  hasEntityKeyword,
  consumeEntityStatusCards,
} from './stat-calculator';
import {
  resolveDecisionPrompt,
  enqueueDecisionPrompt,
  peekDecisionPrompt,
  popDecisionPrompt,
} from './prompt-queue';
import {
  resolveDefenderDeclaration,
  finishAttackDamageAndPostResolution,
  continueAttackAfterInitiation,
} from './combat-pipeline';
import { getSpecialHandler } from '../specials/special-registry';
import { attachCardToHost, initializeCardUses } from '../state/state-validator';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';
import {
  resolveEntityByInstanceId,
  getEligibleTargets,
  TargetFilterOptions,
} from '../effects/target-resolver';
import { getStepEffectParams } from '../../data/supplemental/schema';
import { applyDamageToTarget } from './damage-pipeline';
import { applyThwart, applyThreatPlacement } from './threat-pipeline';

function dispatchCanonicalDefeatTriggers(
  state: GameState,
  targetPlayerId: string,
  sourceInstanceId: string,
  entityType: 'CHARACTER' | 'SCHEME',
  targetType?: 'VILLAIN' | 'MINION' | 'ALLY' | 'SCHEME',
): void {
  const context = {
    targetPlayerId,
    sourceInstanceId,
    targetInstanceId: sourceInstanceId,
    entityType,
    targetType,
  };
  dispatchTrigger(state, 'DEFEATED', context);
  if (entityType === 'CHARACTER') {
    dispatchTrigger(state, 'CHARACTER_DEFEATED', context);
  } else {
    dispatchTrigger(state, 'SCHEME_DEFEATED', context);
  }
}

/**
 * Scans all in-play zones for a card instance by instanceId or card code (ADR-0055).
 * Searches player tableaus, allies, identity attachments, ally attachments,
 * minion attachments, villain attachments, and scheme attachments.
 */
export function findInPlayCardInstance(
  state: GameState,
  instanceId: string,
): CardInstance | undefined {
  for (const p of state.players || []) {
    const fromTableau = p.tableau.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromTableau) return fromTableau;

    const fromAllies = p.allies.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromAllies) return fromAllies;

    const fromAttachments = p.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromAttachments) return fromAttachments;

    for (const a of p.allies || []) {
      const fromAllyAtt = a.attachments?.find(
        (c) => c.instanceId === instanceId || c.card.code === instanceId,
      );
      if (fromAllyAtt) return fromAllyAtt;
    }

    for (const m of p.engagedMinions || []) {
      const fromMinionAtt = m.attachments?.find(
        (c) => c.instanceId === instanceId || c.card.code === instanceId,
      );
      if (fromMinionAtt) return fromMinionAtt;
    }
  }

  if (state.villain) {
    const fromVillainAtt = state.villain.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromVillainAtt) return fromVillainAtt;
  }

  if (state.mainScheme) {
    const fromMainSchemeAtt = state.mainScheme.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromMainSchemeAtt) return fromMainSchemeAtt;
  }

  for (const s of state.sideSchemes || []) {
    const fromSideSchemeAtt = s.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromSideSchemeAtt) return fromSideSchemeAtt;
  }

  return undefined;
}

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
          sideSchemeCard.baseThreat * (sideSchemeCard.baseThreatFixed ? 1 : state.players.length);
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
 * Pure state reducer / action dispatcher executing player commands in accordance with RR v1.8.
 */
export function dispatchAction(
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  // Clone state immutably for pure state transition
  const nextState: GameState = JSON.parse(JSON.stringify(state));

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
        nextState.setupState.stage = 'GAME_READY';
        nextState.phase = GamePhase.PLAYER_PHASE;
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: 1,
          phase: GamePhase.PLAYER_PHASE,
          key: 'phase.player_phase.start',
          params: { round: 1 },
          onomatopoeia: 'HEROES ACT!',
        });
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
        const damageRes = applyDamageToTarget(nextState, {
          target: {
            type: 'villain',
            entity: nextState.villain,
            name: nextState.villain.card?.name || (nextState.villain as any).name || 'Villain',
            attachments: nextState.villain.attachments,
            statusCards: nextState.villain.statusCards,
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
        applyDamageToTarget(nextState, {
          target: {
            type: 'villain',
            entity: nextState.villain,
            name: nextState.villain.card?.name || (nextState.villain as any).name || 'Villain',
            attachments: nextState.villain.attachments,
            statusCards: nextState.villain.statusCards,
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
        dispatchCanonicalDefeatTriggers(nextState, player.id, ally.instanceId, 'CHARACTER', 'ALLY');
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
        dispatchCanonicalDefeatTriggers(nextState, player.id, ally.instanceId, 'CHARACTER', 'ALLY');
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
            if (nextState.villain) {
              const currentAttached = (nextState.villain.attachments || []).filter(
                (att) =>
                  att.card.code === playedCardInstance.card.code ||
                  att.card.name === playedCardInstance.card.name,
              ).length;
              if (maxPerHost === undefined || maxPerHost <= 0 || currentAttached < maxPerHost) {
                allEnemies.push({
                  enemy: nextState.villain,
                  id: nextState.villain.instanceId || 'villain',
                  name: nextState.villain.card.name,
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
              const villainName = nextState.villain.card.name;
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
            let hostName = nextState.villain.card.name;
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
            const villainName = nextState.villain.card.name;
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
                },
              };
            });

            const prompt: PendingDecisionPrompt = {
              promptId: `prompt_event_target_${Date.now()}`,
              playerId: action.playerId,
              title: `Choose Target for ${playedCardInstance.card.name}`,
              description: `Select target for ${playedCardInstance.card.name}:`,
              sourceCardName: playedCardInstance.card.name,
              options,
              isVoluntary: false,
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
        for (const ability of abilities) {
          executeEffect(nextState, ability, {
            playerId: action.playerId,
            targetType,
            targetInstanceId: eventTargetId,
            sourceCardInstance: playedCardInstance,
            resourcesSpent,
          });
        }
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
          (schemeCard.baseThreatFixed ? 1 : nextState.players.length);

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
      const { discardedCount, resourcesPaid } = executeAbilityCost(
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

      // Dynamic parameter scaling (e.g. Legal Practice 01023: Remove 1 threat per discarded card)
      let effectiveAbility = ability;
      const scalingStep = ability.steps?.find(
        (s) => s.effectParams?.scaling === 'PER_DISCARDED_CARD',
      );
      if (scalingStep) {
        effectiveAbility = {
          ...ability,
          steps: ability.steps.map((s) =>
            s === scalingStep
              ? {
                  ...s,
                  effectParams: {
                    ...s.effectParams,
                    amount: discardedCount * ((s.effectParams?.multiplier as number) || 1),
                  },
                }
              : s,
          ),
        };
      }

      // Dynamic parameter scaling per resource spent (e.g. Energy Channel 01018: Add 1 counter per energy spent)
      const resourceScalingStep = ability.steps?.find(
        (s) => s.effectParams?.scaling === 'PER_RESOURCE_SPENT',
      );
      if (resourceScalingStep) {
        effectiveAbility = {
          ...effectiveAbility,
          steps: effectiveAbility.steps.map((s) =>
            s === resourceScalingStep
              ? {
                  ...s,
                  effectParams: {
                    ...s.effectParams,
                    amount: resourcesPaid * ((s.effectParams?.multiplier as number) || 1),
                  },
                }
              : s,
          ),
        };
      }

      let abilityTargetId = action.targetInstanceId;
      let requiredAbilityScope: string | undefined;
      let abilityFilterOpts: TargetFilterOptions | undefined;
      for (const step of effectiveAbility.steps || []) {
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
                effectiveAbility,
                sourceCardInst: targetCardInst,
                abilityKey,
                playerId: action.playerId,
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
      const effectRes = executeEffect(nextState, effectiveAbility, {
        playerId: action.playerId,
        sourceCardInstance: targetCardInst,
        targetInstanceId: abilityTargetId,
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
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      const activePrompt = peekDecisionPrompt(nextState);

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
                  dispatchCanonicalDefeatTriggers(
                    poppedState,
                    allyController.id,
                    ally.instanceId,
                    'CHARACTER',
                    'ALLY',
                  );
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

              if (targetPlayer) {
                const toughIdx = targetPlayer.statusCards.indexOf(StatusCard.TOUGH);
                if (toughIdx !== -1) {
                  targetPlayer.statusCards.splice(toughIdx, 1);
                } else {
                  targetPlayer.health = Math.max(0, targetPlayer.health - amount);
                  if (targetPlayer.health <= 0) poppedState.winner = 'VILLAIN';
                }
              } else if (
                targetId === poppedState.villain?.instanceId ||
                targetId === 'villain' ||
                targetId === poppedState.villain?.card?.code
              ) {
                const vToughIdx = poppedState.villain.statusCards.indexOf(StatusCard.TOUGH);
                if (vToughIdx !== -1) {
                  poppedState.villain.statusCards.splice(vToughIdx, 1);
                } else {
                  poppedState.villain.health = Math.max(0, poppedState.villain.health - amount);
                  if (poppedState.villain.health <= 0) {
                    handleVillainDefeat(poppedState, poppedState.villain.instanceId);
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
                      const minionHp = (minion.card as MinionCard).health || 1;
                      if (newDmg >= minionHp) {
                        processHostDefeated(poppedState, minion, { player: p });
                        p.engagedMinions.splice(mIdx, 1);
                        moveDefeatedCardToPile(poppedState, minion, poppedState.encounterDiscard);
                        dispatchCanonicalDefeatTriggers(
                          poppedState,
                          player.id,
                          minion.instanceId,
                          'CHARACTER',
                          'MINION',
                        );
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
            if (
              targetId === 'main_scheme' ||
              targetId === poppedState.mainScheme?.instanceId ||
              targetId === poppedState.mainScheme?.card?.code
            ) {
              poppedState.mainScheme.threat = Math.max(0, poppedState.mainScheme.threat - amount);
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

      if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentMinionChoice)) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const chosenMinionId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const attachmentCard = (selectedOption?.params?.attachmentCard ||
          activePrompt.options[0]?.params?.attachmentCard) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId) as string | undefined;

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
          activePrompt.options[0]?.params?.attachmentCard) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId) as string | undefined;

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
          activePrompt.options[0]?.params?.attachmentCard) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId) as string | undefined;

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
        const chosenTargetId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const playedCardInstance = (selectedOption?.params?.playedCardInstance ||
          activePrompt.options[0]?.params?.playedCardInstance) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId ||
          action.playerId) as string;
        const resourcesSpent = (selectedOption?.params?.resourcesSpent ||
          activePrompt.options[0]?.params?.resourcesSpent) as string[] | undefined;

        if (playedCardInstance) {
          const targetPlayer = getPlayer(poppedState, ownerId) || player;
          const abilities = playedCardInstance.card.enrichment?.abilities || [];

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

          for (const ability of abilities) {
            executeEffect(poppedState, ability, {
              playerId: ownerId,
              targetType,
              targetInstanceId: chosenTargetId,
              sourceCardInstance: playedCardInstance,
              resourcesSpent,
            });
          }
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
        const effectiveAbility = (selectedOption?.params?.effectiveAbility ||
          activePrompt.options[0]?.params?.effectiveAbility) as CardAbility | undefined;
        const sourceCardInst = (selectedOption?.params?.sourceCardInst ||
          activePrompt.options[0]?.params?.sourceCardInst) as CardInstance | undefined;
        const abilityKey = (selectedOption?.params?.abilityKey ||
          activePrompt.options[0]?.params?.abilityKey) as string;
        const executingPlayerId = (selectedOption?.params?.playerId ||
          activePrompt.options[0]?.params?.playerId ||
          action.playerId) as string;

        if (effectiveAbility) {
          const effectRes = executeEffect(poppedState, effectiveAbility, {
            playerId: executingPlayerId,
            sourceCardInstance: sourceCardInst,
            targetInstanceId: chosenTargetId,
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
        activePrompt.options.some(
          (o) =>
            o.effect === 'SEARCH_AND_SELECT_RESOLUTION' || o.effect === 'SEARCH_AND_SELECT_PASS',
        )
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const params = (selectedOption?.params || activePrompt.options[0]?.params) as any;

        const lookedCards: CardInstance[] = params?.lookedCards || [];
        const chosenInstanceId: string = action.selectedOptionId;
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

        if (
          !selectedOption ||
          selectedOption.id === 'pass_search' ||
          selectedOption.effect === 'SEARCH_AND_SELECT_PASS'
        ) {
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

        // Selected Option
        let chosenCard: CardInstance | undefined;
        let chosenCardZone = sourceZone;
        let unchosenCards: CardInstance[] = [];

        if (isLookCountSpliced) {
          chosenCard = lookedCards.find((c) => c.instanceId === chosenInstanceId);
          unchosenCards = lookedCards.filter((c) => c.instanceId !== chosenInstanceId);
        } else {
          // Full search across pile: find and splice chosen card from source zones
          const searchZones = [sourceZone, ...sourceZones.filter((z) => z !== sourceZone)];
          for (const zone of searchZones) {
            let pile: CardInstance[] = targetPlayer.deck;
            if (zone === 'PLAYER_DISCARD') pile = targetPlayer.discard;
            else if (zone === 'PLAYER_HAND') pile = targetPlayer.hand;
            else if (zone === 'ENCOUNTER_DECK') pile = poppedState.encounterDeck;
            else if (zone === 'ENCOUNTER_DISCARD') pile = poppedState.encounterDiscard;

            const matchIdx = pile.findIndex((c) => c.instanceId === chosenInstanceId);
            if (matchIdx !== -1) {
              chosenCard = pile.splice(matchIdx, 1)[0];
              chosenCardZone = zone;
              break;
            }
          }
        }

        if (chosenCard) {
          routeCardInstances(
            poppedState,
            targetPlayer,
            [chosenCard],
            selectedDestination,
            chosenCardZone,
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
            card: chosenCard?.card.name || selectedOption.label,
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
        const targetPlayer = poppedState.players.find((p) => p.id === action.playerId) || player;

        if (
          !selectedOption ||
          action.selectedOptionId === 'pass_play_from_zone' ||
          selectedOption.id === 'pass_play_from_zone' ||
          selectedOption.effect === 'PLAY_CARD_FROM_ZONE_PASS'
        ) {
          if (activePrompt.sourceCardInstanceId || activePrompt.sourceCardCode) {
            const discardIdx = targetPlayer.discard.findIndex(
              (c) =>
                (activePrompt.sourceCardInstanceId &&
                  c.instanceId === activePrompt.sourceCardInstanceId) ||
                (activePrompt.sourceCardCode && c.card.code === activePrompt.sourceCardCode),
            );
            if (discardIdx !== -1) {
              const [refunded] = targetPlayer.discard.splice(discardIdx, 1);
              targetPlayer.hand.push(refunded);
            }
          }

          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: player.name, type: player.currentForm },
            key: 'card.playFromZone.passed',
            params: { player: player.name, prompt: activePrompt.title },
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
