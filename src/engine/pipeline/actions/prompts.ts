import { kernel } from '../../kernel';
import {
  CardAbility,
  CardInstance,
  CardType,
  DecisionPromptOption,
  PendingDecisionPrompt,
  PlayerState,
  ResolveDecisionPromptAction,
  getActiveMainScheme,
  ActionResult,
  GameState,
} from '../../models';
import { getPlayer } from '../legality-checker';
import { executeResourceCostPayment } from '../cost-engine';
import {
  applyDistributedDamage,
  validateDistributionAssignments,
  defeatSideScheme,
  resetCardState,
} from '../../effects';
import { shuffleArray, nextEngineId } from '../../state/rng';
import { completeEncounterAttachment } from '../villain-phase';
import { executePlayerCleanup } from '../player-phase-cleanup';
import { getEffectiveMaxHealth } from '../stat-calculator';
import {
  resolveDecisionPrompt,
  resolveSimultaneousAbilitiesOrderPrompt,
  popDecisionPrompt,
  validateSearchSelection,
} from '../prompt-queue';
import { getSpecialHandler } from '../../specials/special-registry';
import {
  attachCardToHost,
  initializeCardUses,
  findInPlayCardInstance,
} from '../../state/state-validator';
import { applyToughnessOnEntry } from '../../state/card-instance';
import { resolveEntityByInstanceId } from '../../effects/target-resolver';
import { appendLog } from '../../state/game-log';
import { resolveEventAbilities } from './shared';
import { routeCardInstances } from '../../effects/card-routing';
import type { ActionHandler, TypedAction } from './types';

export function resolveDistributionPrompt(
  nextState: GameState,
  state: GameState,
  activePrompt: PendingDecisionPrompt,
  action: TypedAction<'RESOLVE_DECISION_PROMPT'>,
  player: PlayerState,
): { state: GameState; result: ActionResult } {
  const isCancel =
    (action.selectedOptionId === 'cancel' || action.selectedOptionId === 'pass') &&
    (activePrompt.distributionConfig?.canCancel || activePrompt.isVoluntary);

  // A submitted assignment is validated, never trusted: the prompt stays on a bad one (#296)
  if (!isCancel && activePrompt.distributionConfig) {
    const error = validateDistributionAssignments(
      activePrompt.distributionConfig,
      action.assignments || {},
    );
    if (error) return { state, result: { success: false, error } };
  }

  const { state: poppedState } = popDecisionPrompt(nextState);

  if (isCancel) {
    appendLog(poppedState, {
      category: 'ability',
      actor: { name: player.name, type: player.currentForm },
      key: 'decision.distribution.cancelled',
      params: { actor: player.name, source: activePrompt.sourceCardName },
      onomatopoeia: 'CANCELLED',
    });
    return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
  }

  const assignments = action.assignments || {};
  const config = activePrompt.distributionConfig;
  const domain = config?.allocationDomain || 'DAMAGE';

  // Damage goes through the damage pipeline, like any other damage (#296). The source card
  // is the defeat source; an encounter treachery is already in the encounter discard pile.
  if (domain === 'DAMAGE') {
    const sourceCard = activePrompt.sourceCardInstanceId
      ? poppedState.encounterDiscard.find((c) => c.instanceId === activePrompt.sourceCardInstanceId)
      : undefined;
    applyDistributedDamage(poppedState, assignments, player, sourceCard);
  }

  // Apply assignments across targets
  for (const [targetId, amount] of Object.entries(assignments)) {
    if (amount <= 0) continue;

    if (domain === 'THREAT_REMOVAL') {
      const targetMainScheme = getActiveMainScheme(poppedState);
      if (
        targetId === 'main_scheme' ||
        targetId === targetMainScheme?.instanceId ||
        targetId === targetMainScheme?.card?.code
      ) {
        const prevThreat = targetMainScheme.threat;
        targetMainScheme.threat = Math.max(0, targetMainScheme.threat - amount);
        if (prevThreat > 0 && targetMainScheme.threat === 0) {
          kernel.dispatchTrigger(poppedState, 'SCHEME_THREAT_REDUCED_TO_ZERO', {
            targetPlayerId: player.id,
            sourceInstanceId: targetMainScheme.instanceId || 'main_scheme',
            entityType: 'SCHEME',
            threatAmount: prevThreat,
          });
        }
      } else {
        const sideIdx = (poppedState.sideSchemes || []).findIndex(
          (s) => s.instanceId === targetId || s.card.code === targetId,
        );
        if (sideIdx !== -1) {
          const side = poppedState.sideSchemes![sideIdx];
          const prevThreat = side.threat || 0;
          side.threat = Math.max(0, (side.threat || 0) - amount);
          if (side.threat <= 0) {
            defeatSideScheme(poppedState, side.instanceId, player.id);
            if (prevThreat > 0) {
              kernel.dispatchTrigger(poppedState, 'SCHEME_THREAT_REDUCED_TO_ZERO', {
                targetPlayerId: player.id,
                sourceInstanceId: side.instanceId,
                entityType: 'SCHEME',
                threatAmount: prevThreat,
              });
            }
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
          targetPlayer.health = Math.min(targetPlayer.maxHealth, targetPlayer.health + amount);
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
  appendLog(poppedState, {
    category: 'ability',
    actor: { name: player.name, type: player.currentForm },
    key: 'decision.distribution.resolved',
    params: {
      actor: player.name,
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

export function resolveAttachmentChoicePrompt(
  nextState: GameState,
  activePrompt: PendingDecisionPrompt,
  action: TypedAction<'RESOLVE_DECISION_PROMPT'>,
  player: PlayerState,
  targetHost: 'CHOSEN_MINION' | 'CHOSEN_ALLY' | 'CHOSEN_ENEMY',
): { state: GameState; result: ActionResult } {
  const { state: poppedState } = popDecisionPrompt(nextState);
  const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
  const chosenHostId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
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

    appendLog(poppedState, {
      category: 'ability',
      actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
      key: 'decision.prompt.cancelled',
      params: {
        actor: targetPlayer.name,
        source: activePrompt.sourceCardName,
      },
      onomatopoeia: 'CANCELLED',
    });

    return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
  }

  if (attachmentCard) {
    attachmentCard.ownerId = ownerId;
    attachCardToHost(poppedState, attachmentCard, targetHost, chosenHostId);
  }

  appendLog(poppedState, {
    category: 'ability',
    actor: { name: player.name, type: player.currentForm },
    key: 'card.attached.to_host',
    params: {
      actor: player.name,
      player: player.name,
      card: activePrompt.sourceCardName,
      target: selectedOption?.label || chosenHostId || '',
      host: selectedOption?.label || chosenHostId || '',
    },
    onomatopoeia: 'ATTACHED!',
  });

  return { state: poppedState, result: { success: true, onomatopoeia: 'ATTACHED!' } };
}

export function resolveEventOrAbilityTargetPrompt(
  nextState: GameState,
  activePrompt: PendingDecisionPrompt,
  action: TypedAction<'RESOLVE_DECISION_PROMPT'>,
  player: PlayerState,
): { state: GameState; result: ActionResult } {
  if (activePrompt.options.some((o) => o.params?.isEventTargetChoice)) {
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

      appendLog(poppedState, {
        category: 'ability',
        actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
        key: 'decision.prompt.cancelled',
        params: {
          actor: targetPlayer.name,
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
        'villain' | 'minion' | 'main_scheme' | 'side_scheme' | 'character' | 'identity' | 'ally' =
        'villain';
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
      kernel.dispatchTrigger(poppedState, 'CARD_PLAYED', {
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

  // isAbilityTargetChoice
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
    const effectRes = kernel.executeEffect(poppedState, promptAbility, {
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

  return { state: poppedState, result: { success: true } };
}

export function resolveSearchAndSelectPrompt(
  nextState: GameState,
  state: GameState,
  activePrompt: PendingDecisionPrompt,
  action: TypedAction<'RESOLVE_DECISION_PROMPT'>,
): { state: GameState; result: ActionResult } {
  // The chosen cards: a multi-select prompt answers with `selectedOptionIds` (possibly none)
  const chosenIds: string[] = activePrompt.selection
    ? (action.selectedOptionIds ?? [])
    : [action.selectedOptionId];
  const selectionError = validateSearchSelection(activePrompt, chosenIds);
  if (selectionError) {
    return { state, result: { success: false, error: selectionError } };
  }
  const { state: poppedState } = popDecisionPrompt(nextState);
  const params = activePrompt.options[0]?.params as
    | {
        lookedCards?: CardInstance[];
        sourceZone?: string;
        sourceZones?: string[];
        selectedDestination?: string;
        unselectedDestination?: string | null;
        shuffleAfter?: boolean;
        isLookCountSpliced?: boolean;
        targetPlayerId?: string;
        target?: string;
      }
    | undefined;

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
      routeCardInstances(poppedState, targetPlayer, lookedCards, unselectedDestination, sourceZone);
    }
    if (shuffleAfter) {
      if (sourceZones.includes('ENCOUNTER_DECK')) {
        poppedState.encounterDeck = shuffleArray(poppedState, poppedState.encounterDeck);
      }
      if (sourceZones.includes('PLAYER_DECK')) {
        targetPlayer.deck = shuffleArray(poppedState, targetPlayer.deck);
      }
    }

    appendLog(poppedState, {
      category: 'ability',
      actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
      key: 'card.search.passed',
      params: { actor: targetPlayer.name, source: activePrompt.title },
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
    routeCardInstances(poppedState, targetPlayer, [card], selectedDestination, zone, {
      host: params?.target,
    });
  }

  if (isLookCountSpliced && unchosenCards.length > 0) {
    routeCardInstances(poppedState, targetPlayer, unchosenCards, unselectedDestination, sourceZone);
  }

  if (shuffleAfter) {
    if (sourceZones.includes('ENCOUNTER_DECK')) {
      poppedState.encounterDeck = shuffleArray(poppedState, poppedState.encounterDeck);
    }
    if (sourceZones.includes('PLAYER_DECK')) {
      targetPlayer.deck = shuffleArray(poppedState, targetPlayer.deck);
    }
  }

  appendLog(poppedState, {
    category: 'ability',
    actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
    key: 'card.searched.selected',
    params: {
      actor: targetPlayer.name,
      card: chosenCards.map((c) => c.card.card.name).join(', '),
    },
    onomatopoeia: 'SELECTED!',
  });

  return { state: poppedState, result: { success: true, onomatopoeia: 'SELECTED!' } };
}

export function resolveOptionalTriggerOrEffectPrompt(
  nextState: GameState,
  activePrompt: PendingDecisionPrompt,
  action: TypedAction<'RESOLVE_DECISION_PROMPT'>,
  player: PlayerState,
): { state: GameState; result: ActionResult } {
  if (
    activePrompt.options.some(
      (o) =>
        o.effect === 'PLAY_CARD_FROM_ZONE_RESOLUTION' || o.effect === 'PLAY_CARD_FROM_ZONE_PASS',
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

      appendLog(poppedState, {
        category: 'ability',
        actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
        key: 'card.playFromZone.passed',
        params: { actor: targetPlayer.name, source: activePrompt.title },
        onomatopoeia: 'PASSED',
      });

      return { state: poppedState, result: { success: true, onomatopoeia: 'PASSED' } };
    }

    const params = selectedOption.params as
      { chosenInstanceId?: string; ownerId?: string } | undefined;
    const chosenInstanceId = params?.chosenInstanceId;
    const ownerId = params?.ownerId;
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
      kernel.dispatchTrigger(poppedState, 'CARD_PLAYED', {
        targetPlayerId: targetPlayer.id,
        sourceInstanceId: chosenCard.instanceId,
      });
      kernel.dispatchTrigger(poppedState, 'ENTERS_PLAY', {
        targetPlayerId: targetPlayer.id,
        sourceInstanceId: chosenCard.instanceId,
      });

      const onomatopoeia = `PLAYED ${chosenCard.card.name.toUpperCase()}!`;
      appendLog(poppedState, {
        category: 'ability',
        actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
        key: 'card.playFromZone.resolved',
        params: {
          actor: targetPlayer.name,
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
  return resolveDecisionPrompt(nextState, action.playerId, action.selectedOptionId, paymentOptions);
}

function resolvePlayerCleanupPrompt(
  nextState: GameState,
  activePrompt: PendingDecisionPrompt,
  action: TypedAction<'RESOLVE_DECISION_PROMPT'>,
): { state: GameState; result: ActionResult } {
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
      appendLog(poppedState, {
        category: 'phase',
        actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
        key: 'player.phase.cleanup.cardDiscarded',
        params: { actor: targetPlayer.name, card: discarded.card.name },
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
        promptId: `prompt_cleanup_${targetPlayer.id}_${nextEngineId(poppedState, 'id')}`,
        playerId: targetPlayer.id,
        title: 'End of Player Phase: Voluntary Discard',
        description: `${targetPlayer.name}: Select any additional cards in your hand you wish to discard:`,
        sourceCardName: targetPlayer.hero?.name || targetPlayer.name,
        options: remainingOptions,
        isVoluntary: true,
      };

      const enqueuedState = kernel.enqueueDecisionPrompt(poppedState, rePrompt);
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

  return { state: poppedState, result: { success: true } };
}

function resolvePlayUnderPlayerControlPrompt(
  nextState: GameState,
  activePrompt: PendingDecisionPrompt,
  action: TypedAction<'RESOLVE_DECISION_PROMPT'>,
  player: PlayerState,
): { state: GameState; result: ActionResult } {
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
  const params = selectedOption.params as
    | {
        targetPlayerId?: string;
        playedCardInstance?: CardInstance;
        ownerId?: string;
      }
    | undefined;
  const targetPlayerId = params?.targetPlayerId as string;
  const playedCardInstance = params?.playedCardInstance as CardInstance;
  const ownerId = (params?.ownerId as string) || action.playerId;

  const targetPlayer = getPlayer(poppedState, targetPlayerId) || player;
  playedCardInstance.ownerId = ownerId;
  targetPlayer.tableau.push(playedCardInstance);

  const onomatopoeia = 'PLAYED UNDER CONTROL!';
  appendLog(poppedState, {
    category: 'ability',
    actor: { name: player.name, type: player.currentForm },
    key: 'card.playUnderControl.resolved',
    params: {
      actor: player.name,
      card: playedCardInstance.card.name,
      target: targetPlayer.name,
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
      const hpBonus = (matchingStep.effectParams?.amount as number) || 0;
      if (hpBonus > 0) {
        targetPlayer.health += hpBonus;
        targetPlayer.maxHealth = getEffectiveMaxHealth(targetPlayer, poppedState);
      }
    }
  }

  kernel.dispatchTrigger(poppedState, 'CARD_PLAYED', {
    targetPlayerId: ownerId,
    sourceInstanceId: playedCardInstance.instanceId,
  });
  kernel.dispatchTrigger(poppedState, 'ENTERS_PLAY', {
    targetPlayerId: targetPlayer.id,
    sourceInstanceId: playedCardInstance.instanceId,
  });

  return { state: poppedState, result: { success: true, onomatopoeia } };
}

function resolveRestrictedReplacementPrompt(
  nextState: GameState,
  state: GameState,
  activePrompt: PendingDecisionPrompt,
  action: TypedAction<'RESOLVE_DECISION_PROMPT'>,
  player: PlayerState,
): { state: GameState; result: ActionResult } {
  const { state: poppedState } = popDecisionPrompt(nextState);
  const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);

  if (
    !selectedOption ||
    selectedOption.id === 'cancel_play' ||
    selectedOption.effect === 'CANCEL_PLAY'
  ) {
    appendLog(poppedState, {
      category: 'card_play',
      actor: { name: player.name, type: player.currentForm },
      key: 'card.play.cancelled',
      params: { actor: player.name, card: activePrompt.sourceCardName },
      onomatopoeia: 'CANCELLED',
    });

    return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
  }

  if (selectedOption.effect === 'DISCARD_RESTRICTED_REPLACEMENT') {
    const params = selectedOption.params as
      | {
          discardCardInstanceId?: string;
          pendingCardInstanceId?: string;
          paymentCardInstanceIds?: string[];
          generatorInstanceIds?: string[];
          targetInstanceId?: string;
        }
      | undefined;
    if (!params?.pendingCardInstanceId) {
      return {
        state,
        result: { success: false, error: 'Missing pending card for replacement' },
      };
    }
    const discardId = params?.discardCardInstanceId || selectedOption.id;
    const discardIdx = player.tableau.findIndex((c) => c.instanceId === discardId);
    if (discardIdx !== -1) {
      const [discarded] = player.tableau.splice(discardIdx, 1);
      player.discard.push(discarded);

      appendLog(poppedState, {
        category: 'card_play',
        actor: { name: player.name, type: player.currentForm },
        key: 'card.discarded.to_make_room',
        params: {
          actor: player.name,
          card: discarded.card.name,
          source: activePrompt.sourceCardName,
        },
        onomatopoeia: 'REPLACED!',
      });
    }

    return kernel.dispatchAction(poppedState, {
      type: 'PLAY_CARD',
      playerId: action.playerId,
      cardInstanceId: params.pendingCardInstanceId,
      paymentCardInstanceIds: params?.paymentCardInstanceIds || [],
      generatorInstanceIds: params?.generatorInstanceIds || [],
      targetInstanceId: params?.targetInstanceId,
    });
  }

  return { state: poppedState, result: { success: true } };
}

export const handleResolveDecisionPrompt: ActionHandler<'RESOLVE_DECISION_PROMPT'> = (
  nextState,
  state,
  action,
) => {
  const activePrompt = kernel.peekDecisionPrompt(nextState);
  const targetPlayerId = action.playerId || activePrompt?.playerId;
  const player = targetPlayerId ? getPlayer(nextState, targetPlayerId) : undefined;
  if (!player) return { state, result: { success: false, error: 'Player not found' } };

  // Simultaneous Optional Abilities Resolution Order (Issue #287)
  if (activePrompt && activePrompt.kind === 'ORDER_SIMULTANEOUS_ABILITIES') {
    return resolveSimultaneousAbilitiesOrderPrompt(
      nextState,
      activePrompt,
      action.playerId,
      action.selectedOptionId,
      action.sequenceOrder,
    );
  }

  // Distribution Prompt Resolution (ADR-0064)
  if (
    activePrompt &&
    (activePrompt.kind === 'DISTRIBUTE_POINTS' || activePrompt.distributionConfig !== undefined)
  ) {
    return resolveDistributionPrompt(nextState, state, activePrompt, action, player);
  }

  // Wakanda Forever! Sequence Order Prompt Resolution (ADR-0038)
  if (
    activePrompt &&
    (activePrompt.title?.includes('Wakanda Forever') ||
      activePrompt.sourceCardName === 'Wakanda Forever!')
  ) {
    const { state: poppedState } = popDecisionPrompt(nextState);
    const sequenceOrder: string[] =
      (action as ResolveDecisionPromptAction).sequenceOrder ||
      (action.selectedOptionId ? [action.selectedOptionId] : []);
    const wfHandler = getSpecialHandler('WAKANDA_FOREVER');
    if (wfHandler) {
      const res = wfHandler.execute(poppedState, { playerId: action.playerId }, { sequenceOrder });
      return {
        state: res.state,
        result: { success: res.success, onomatopoeia: res.onomatopoeia },
      };
    }
  }

  // End of Player Phase Voluntary Discard & Clean-Up Prompt (RR v1.8 p. 23)
  if (
    activePrompt &&
    activePrompt.options.some(
      (o) => o.effect === 'PLAYER_PHASE_DISCARD_CARD' || o.effect === 'FINISH_PLAYER_CLEANUP',
    )
  ) {
    return resolvePlayerCleanupPrompt(nextState, activePrompt, action);
  }

  // Encounter Attachment Host Choice
  if (activePrompt && activePrompt.options.some((o) => o.params?.isEncounterAttachmentHostChoice)) {
    const { state: poppedState } = popDecisionPrompt(nextState);
    const selectedOption =
      activePrompt.options.find((o) => o.id === action.selectedOptionId) ?? activePrompt.options[0];
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

  // Player Attachment Host Choices (deduplicated via resolveAttachmentChoicePrompt)
  if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentMinionChoice)) {
    return resolveAttachmentChoicePrompt(nextState, activePrompt, action, player, 'CHOSEN_MINION');
  }
  if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentAllyChoice)) {
    return resolveAttachmentChoicePrompt(nextState, activePrompt, action, player, 'CHOSEN_ALLY');
  }
  if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentEnemyChoice)) {
    return resolveAttachmentChoicePrompt(nextState, activePrompt, action, player, 'CHOSEN_ENEMY');
  }

  // Event or Ability Target Choice
  if (
    activePrompt &&
    activePrompt.options.some(
      (o) => o.params?.isEventTargetChoice || o.params?.isAbilityTargetChoice,
    )
  ) {
    return resolveEventOrAbilityTargetPrompt(nextState, activePrompt, action, player);
  }

  // Play Under Player Control Choice
  if (activePrompt && activePrompt.options.some((o) => o.effect === 'PLAY_UNDER_PLAYER_CONTROL')) {
    return resolvePlayUnderPlayerControlPrompt(nextState, activePrompt, action, player);
  }

  // Discard Restricted Replacement Choice
  if (
    activePrompt &&
    activePrompt.options.some(
      (o) => o.effect === 'DISCARD_RESTRICTED_REPLACEMENT' || o.effect === 'CANCEL_PLAY',
    )
  ) {
    return resolveRestrictedReplacementPrompt(nextState, state, activePrompt, action, player);
  }

  // Search and Select Resolution
  if (
    activePrompt &&
    activePrompt.options.some((o) => o.effect === 'SEARCH_AND_SELECT_RESOLUTION')
  ) {
    return resolveSearchAndSelectPrompt(nextState, state, activePrompt, action);
  }

  // Optional Trigger, Play from Zone, or Default Decision Resolution
  if (activePrompt) {
    return resolveOptionalTriggerOrEffectPrompt(nextState, activePrompt, action, player);
  }

  const paymentOptions =
    action.paymentCardInstanceIds || action.generatorInstanceIds
      ? {
          paymentCardInstanceIds: action.paymentCardInstanceIds,
          generatorInstanceIds: action.generatorInstanceIds,
        }
      : undefined;
  return resolveDecisionPrompt(nextState, action.playerId, action.selectedOptionId, paymentOptions);
};

export const PROMPT_HANDLERS = {
  RESOLVE_DECISION_PROMPT: handleResolveDecisionPrompt,
};
