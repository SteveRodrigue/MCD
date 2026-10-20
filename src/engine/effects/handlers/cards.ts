/** Card movement between zones: draw, discard, search, play, attach (step handlers, AUD-20261017-232534 F010-A). */
import { kernel } from '../../kernel';
import { applyToughnessOnEntry } from '../../state/card-instance';
import {
  GameState,
  CardInstance,
  MinionCard,
  CardType,
  SideSchemeCard,
  DecisionPromptOption,
  PendingDecisionPrompt,
  PlayerState,
  Keyword,
  hasKeyword,
  getActiveVillain,
  getActiveMainScheme,
} from '@engine/models';
import { matchesCardFilter } from '../../filters/card-filter';
import { executeMinionAttackAgainstPlayer } from '../../pipeline/villain-phase';
import type { SearchZone } from '../../../data/supplemental/schema';
import { drawPlayerCard } from '../../pipeline/deck-exhaustion';
import { dealSurgeCard } from '../../pipeline/surge';

import { getEffectiveHandSize } from '../../pipeline/stat-calculator';

import {
  attachCardToHost,
  removeCardFromAllZones,
  initializeCardUses,
} from '../../state/state-validator';
import { getPlayerAllyLimit, checkUniqueCardPlayable } from '../../pipeline/legality-checker';
import { nextEngineId, randomInt, shuffleArray } from '../../state/rng';
import { resolvePlayerTargets } from '../target-resolver';
import { getAvailableResources } from '../../pipeline/cost-engine';
import { appendLog } from '../../state/game-log';
import { placeSideScheme } from '../../state/side-scheme';
import { routeCardInstances } from '../card-routing';
import {
  EffectExecutionContext,
  EffectResult,
  executeDiscard,
  resetCardState,
  resolveNumericAmount,
  resolveSourceHostZone,
} from '../index';
import { getRuntimeParams, type TypedStep, type StepHandlerMap } from './types';
import { getStepEffectParams } from '../../../data/supplemental/runtime';

function handleDiscard(
  state: GameState,
  step: TypedStep<'DISCARD'>,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  return executeDiscard(state, step, context);
}

function handleDraw(
  state: GameState,
  step: TypedStep<'DRAW'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const runtime = getRuntimeParams(step);
  const targetInstanceId = runtime.targetInstanceId || context.chosenTargetInstanceId;
  const rawCount = params.count;
  let count =
    rawCount !== undefined
      ? resolveNumericAmount(rawCount, context, 1, {
          state,
          player,
          sourceCardInstance: context.sourceCardInstance,
          targetInstanceId,
        })
      : undefined;
  if (params.dynamicBonus) {
    const bonus = resolveNumericAmount(params.dynamicBonus, context, 0, {
      state,
      player,
      sourceCardInstance: context.sourceCardInstance,
      targetInstanceId,
    });
    count = (count ?? 1) + bonus;
  }
  const limit = params.limit;
  const targetParam = params.target;
  const targetPlayerId =
    params.targetPlayerId ||
    (context.chosenTargetInstanceId &&
    state.players.some((p) => p.id === context.chosenTargetInstanceId)
      ? context.chosenTargetInstanceId
      : undefined);

  const getPlayerTargetLimit = (p: PlayerState): number | undefined => {
    if (!limit) return undefined;
    if (limit === 'PRINTED_HAND_SIZE') {
      const isHero = p.currentForm === 'hero';
      return isHero
        ? (p.hero?.handSize ?? p.activeFormCard.raw?.hand_size ?? 5)
        : (p.alterEgo?.handSize ?? p.activeFormCard.raw?.hand_size ?? 6);
    }
    // limit === 'HAND_SIZE'
    return getEffectiveHandSize(p, state);
  };

  // If a specific target player was designated (e.g. from decision prompt resolution)
  if (targetPlayerId) {
    const targetP = state.players.find((p) => p.id === targetPlayerId);
    if (targetP) {
      const targetLimit = getPlayerTargetLimit(targetP);
      let drawnForP = 0;
      const drawnCardsForP: CardInstance[] = [];
      while (
        (count === undefined || drawnForP < count) &&
        (targetLimit === undefined || targetP.hand.length < targetLimit)
      ) {
        const drawn = drawPlayerCard(state, targetP.id);
        if (!drawn) break;
        targetP.hand.push(drawn);
        drawnCardsForP.push(drawn);
        drawnForP += 1;
      }
      const drawSource =
        context.sourceCardInstance?.card?.name ||
        (context.ability?.id ? String(context.ability.id) : undefined);
      appendLog(state, {
        key: 'card.effect.drawCards',
        params: {
          actor: targetP.name,
          amount: drawnForP,
          handSize: targetP.hand.length,
          cards: drawnCardsForP.map((c) => c?.card?.name || 'Card').join(', '),
          drawnCards: drawnCardsForP.map((c) => c?.card?.name || 'Card'),
          ...(targetLimit !== undefined ? { targetLimit } : {}),
          ...(drawSource ? { source: drawSource } : {}),
        },
        onomatopoeia: `DRAW +${drawnForP}!`,
      });
      return {
        state,
        success: true,
        mutatedState: drawnForP > 0,
        value: drawnForP,
        onomatopoeia: `DRAW +${drawnForP}!`,
      };
    }
  }

  // If targeting CHOSEN_PLAYER in multiplayer mode, prompt the player to select the recipient
  if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1) {
    const effectiveCount = count ?? 1;
    const sourceCardName =
      context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Ability';
    const promptId = `prompt_${nextEngineId(state, 'id')}_choose_player`;
    state = kernel.enqueueDecisionPrompt(state, {
      promptId,
      playerId: player.id,
      title: 'Choose a Player',
      description: `Choose a player to draw ${effectiveCount} card${effectiveCount > 1 ? 's' : ''}:`,
      sourceCardName,
      options: state.players.map((p) => ({
        id: `draw_${p.id}`,
        label: `${p.name} (${p.hero?.name || 'Hero'})`,
        description: `Give ${effectiveCount} card draw to ${p.name} (Cards in hand: ${p.hand.length})`,
        effect: 'DRAW',
        params: {
          count: rawCount,
          limit,
          targetPlayerId: p.id,
        },
      })),
    });

    appendLog(state, {
      category: 'ability',
      key: 'decision.prompt.opened',
      params: { actor: player.name, promptId, source: sourceCardName },
      onomatopoeia: 'CHOOSE PLAYER!',
    });

    return {
      state,
      success: true,
      onomatopoeia: 'CHOOSE PLAYER!',
    };
  }

  const resolvedPlayers = resolvePlayerTargets(state, targetParam, context);
  const targetPlayers = resolvedPlayers.length > 0 ? resolvedPlayers : [player];
  let totalDrawn = 0;

  for (const p of targetPlayers) {
    const targetLimit = getPlayerTargetLimit(p);
    let drawnForP = 0;
    const drawnCardsForP: CardInstance[] = [];
    const maxDraw = count !== undefined ? count : limit ? Infinity : 1;
    while (drawnForP < maxDraw && (targetLimit === undefined || p.hand.length < targetLimit)) {
      const drawn = drawPlayerCard(state, p.id);
      if (!drawn) break;
      p.hand.push(drawn);
      drawnCardsForP.push(drawn);
      drawnForP += 1;
      totalDrawn += 1;
    }
    const drawSource =
      context.sourceCardInstance?.card?.name ||
      (context.ability?.id ? String(context.ability.id) : undefined);
    appendLog(state, {
      key: 'card.effect.drawCards',
      params: {
        actor: p.name,
        amount: drawnForP,
        handSize: p.hand.length,
        cards: drawnCardsForP.map((c) => c?.card?.name || 'Card').join(', '),
        drawnCards: drawnCardsForP.map((c) => c?.card?.name || 'Card'),
        ...(targetLimit !== undefined ? { targetLimit } : {}),
        ...(drawSource ? { source: drawSource } : {}),
      },
      onomatopoeia: `DRAW +${drawnForP}!`,
    });
  }

  const onomatopoeia = `DRAW +${totalDrawn}!`;
  return {
    state,
    success: true,
    mutatedState: totalDrawn > 0,
    value: totalDrawn,
    onomatopoeia,
  };
}

function handleAttachToHost(
  state: GameState,
  step: TypedStep<'ATTACH_TO_HOST'>,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const targetHost = params.target as string | undefined;
  if (!targetHost) return { state, success: false };
  const sourceCard = context.sourceCardInstance;
  if (!sourceCard) return { state, success: true };

  sourceCard.ownerId = context.playerId;

  attachCardToHost(
    state,
    sourceCard,
    targetHost,
    context.chosenTargetInstanceId || context.targetPlayerId || context.playerId,
  );
  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: 'ATTACHED TO HOST!',
  };
}

function handlePlaceCardUnderHost(
  state: GameState,
  step: TypedStep<'PLACE_CARD_UNDER_HOST'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const targetHost = (params.target as string) || 'SELF';
  const sourceCard = context.sourceCardInstance;
  if (!sourceCard) return { state, success: true };

  if (targetHost === 'VILLAIN' || targetHost === 'ENEMY') {
    const villain = getActiveVillain(state);
    if (!villain.cardsUnderneath) villain.cardsUnderneath = [];
    villain.cardsUnderneath.push(sourceCard);
    return {
      state,
      success: true,
      mutatedState: true,
      onomatopoeia: 'PLACED UNDER VILLAIN!',
    };
  } else if (targetHost === 'MAIN_SCHEME' || targetHost === 'SCHEME') {
    const mainScheme = getActiveMainScheme(state);
    if (!mainScheme.cardsUnderneath) mainScheme.cardsUnderneath = [];
    mainScheme.cardsUnderneath.push(sourceCard);
    return {
      state,
      success: true,
      mutatedState: true,
      onomatopoeia: 'PLACED UNDER SCHEME!',
    };
  } else if (targetHost === 'HERO' || targetHost === 'IDENTITY' || targetHost === 'PLAYER') {
    const targetP =
      state.players.find((p) => p.id === (context.targetPlayerId || context.playerId)) || player;
    if (!targetP.cardsUnderneath) targetP.cardsUnderneath = [];
    targetP.cardsUnderneath.push(sourceCard);
    return {
      state,
      success: true,
      mutatedState: true,
      onomatopoeia: 'PLACED UNDER IDENTITY!',
    };
  }
  return { state, success: true, onomatopoeia: 'PLACED UNDER CARD!' };
}

function handlePutIntoPlay(
  state: GameState,
  step: TypedStep<'PUT_INTO_PLAY'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const fromZone = (params.from as string) || 'SET_ASIDE';
  const toZone = (params.to as string) || 'ENGAGED_WITH_PLAYER';
  const filter = params.filter;

  // "Reveal ... and put it into play" (RR v1.8 glossary R, W): the When Revealed abilities and
  // keyword-provided Surge resolve. A card only put into play never triggers them.
  const reveal = params.reveal === true;

  let sourceList: CardInstance[] = [];
  if (fromZone === 'SET_ASIDE') {
    sourceList = player.setAsideCards || [];
  } else if (fromZone === 'DISCARD') {
    sourceList = player.discard || [];
  } else if (fromZone === 'DECK') {
    sourceList = player.deck || [];
  } else if (fromZone === 'HAND') {
    sourceList = player.hand || [];
  }

  const matches = (
    step.effectParams?.target === 'SELF' && context.sourceCardInstance
      ? [context.sourceCardInstance]
      : sourceList.filter((c) => matchesCardFilter(c, filter, { player, state }))
  ).filter((c) => !c.card.isUnique || checkUniqueCardPlayable(state, c.card).allowed);

  if (matches.length === 0) {
    return {
      state,
      success: true,
      mutatedState: false,
      value: 0,
      selectedCardInstanceIds: [],
      onomatopoeia: 'NO MATCHES FOUND',
    };
  }

  const matchIds = new Set(matches.map((m) => m.instanceId));
  if (fromZone === 'SET_ASIDE') {
    player.setAsideCards = player.setAsideCards.filter((c) => !matchIds.has(c.instanceId));
  } else if (fromZone === 'DISCARD') {
    player.discard = player.discard.filter((c) => !matchIds.has(c.instanceId));
  } else if (fromZone === 'DECK') {
    player.deck = player.deck.filter((c) => !matchIds.has(c.instanceId));
  } else if (fromZone === 'HAND') {
    player.hand = player.hand.filter((c) => !matchIds.has(c.instanceId));
  }

  for (const cardInst of matches) {
    // Cards entering play enter ready with reset transient state (RR v1.8 p. 11, 24)
    resetCardState(cardInst);
    cardInst.exhausted = false;

    // Initialize counters for cards with 'uses' keyword (RR v1.8 p. 30)
    initializeCardUses(cardInst);

    if (toZone === 'SIDE_SCHEMES' || cardInst.card.type === CardType.SIDE_SCHEME) {
      const sideCard = cardInst.card as SideSchemeCard;
      placeSideScheme(state, cardInst);

      if (reveal) {
        const schemeAbilities = sideCard.enrichment?.abilities || [];
        for (const ab of schemeAbilities) {
          if (ab.timing === 'WHEN_REVEALED' || ab.trigger === 'WHEN_REVEALED') {
            kernel.executeEffect(state, ab, {
              playerId: player.id,
              sourceCardInstance: cardInst,
            });
          }
        }
        if (hasKeyword(sideCard, Keyword.SURGE)) {
          dealSurgeCard(state, player, sideCard.name);
        }
      }
    } else if (
      toZone === 'TABLEAU' ||
      [CardType.ALLY, CardType.SUPPORT, CardType.UPGRADE].includes(cardInst.card.type)
    ) {
      if (cardInst.card.type === CardType.ALLY || toZone === 'ALLIES') {
        applyToughnessOnEntry(cardInst);
        player.allies.push(cardInst);
      } else {
        player.tableau.push(cardInst);
      }
    } else if (toZone === 'ENGAGED_WITH_PLAYER' || cardInst.card.type === CardType.MINION) {
      applyToughnessOnEntry(cardInst);

      player.engagedMinions.push(cardInst as MinionCard & CardInstance);

      const hasQuickstrike = hasKeyword(cardInst.card, Keyword.QUICKSTRIKE);
      if (hasQuickstrike && player.currentForm === 'hero') {
        executeMinionAttackAgainstPlayer(state, cardInst as MinionCard & CardInstance, player);
      }

      if (reveal) {
        const abilities = cardInst.card.enrichment?.abilities || [];
        for (const ab of abilities) {
          if (ab.timing === 'WHEN_REVEALED' || ab.trigger === 'WHEN_REVEALED') {
            kernel.executeEffect(state, ab, {
              playerId: player.id,
              sourceCardInstance: cardInst,
            });
          }
        }
        if (hasKeyword(cardInst.card, Keyword.SURGE)) {
          dealSurgeCard(state, player, cardInst.card.name);
        }
      }

      kernel.dispatchTrigger(state, 'MINION_ENTERS_PLAY', {
        targetPlayerId: player.id,
        sourceInstanceId: cardInst.instanceId,
        targetInstanceId: cardInst.instanceId,
        encounterCardInstance: cardInst,
      });
    }
  }

  const cardNames = matches.map((m) => m.card.name).join(', ');
  const onomatopoeia = `ENTERS PLAY! ${cardNames.toUpperCase()}`;
  appendLog(state, {
    category: 'ability',
    key: 'card.putIntoPlay',
    params: {
      actor: player.name,
      cards: cardNames,
      destination: toZone,
    },
    onomatopoeia,
  });

  return {
    state,
    success: true,
    mutatedState: true,
    value: matches.length,
    selectedCardInstanceIds: Array.from(matchIds),
    onomatopoeia,
  };
}

function handleShuffleIntoDeck(
  state: GameState,
  step: TypedStep<'SHUFFLE_INTO_DECK'>,
  _context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const fromZone =
    (params.from as string) || (params.count !== undefined ? 'DISCARD' : 'SET_ASIDE');
  const toDeck =
    (params.toDeck as string) || (params.count !== undefined ? 'PLAYER_DECK' : 'ENCOUNTER_DECK');
  const filter = params.filter;
  const count = params.count;
  let sourceList: CardInstance[] = [];
  if (fromZone === 'SET_ASIDE') {
    sourceList = player.setAsideCards || [];
  } else if (fromZone === 'DISCARD') {
    sourceList = player.discard || [];
  } else if (fromZone === 'HAND') {
    sourceList = player.hand || [];
  }

  let matches = filter
    ? sourceList.filter((c) => matchesCardFilter(c, filter, { player, state }))
    : [...sourceList];

  if (count !== undefined && matches.length > count) {
    matches = matches.slice(0, count);
  }

  if (matches.length === 0) {
    return {
      state,
      success: true,
      mutatedState: false,
      value: 0,
      selectedCardInstanceIds: [],
      onomatopoeia: 'NO CARDS TO SHUFFLE',
    };
  }

  const matchIds = new Set(matches.map((m) => m.instanceId));
  if (fromZone === 'SET_ASIDE') {
    player.setAsideCards = player.setAsideCards.filter((c) => !matchIds.has(c.instanceId));
  } else if (fromZone === 'DISCARD') {
    player.discard = player.discard.filter((c) => !matchIds.has(c.instanceId));
  } else if (fromZone === 'HAND') {
    player.hand = player.hand.filter((c) => !matchIds.has(c.instanceId));
  }

  if (toDeck === 'ENCOUNTER_DECK') {
    state.encounterDeck.push(...matches);
    state.encounterDeck = shuffleArray(state, state.encounterDeck);
  } else if (toDeck === 'PLAYER_DECK') {
    player.deck.push(...matches);
    player.deck = shuffleArray(state, player.deck);
  }

  const onomatopoeia = `SHUFFLE ${matches.length} CARDS!`;
  appendLog(state, {
    category: 'ability',
    key: 'deck.shuffled',
    params: {
      actor: player.name,
      amount: matches.length,
      destination: toDeck,
    },
    onomatopoeia,
  });

  return {
    state,
    success: true,
    mutatedState: true,
    value: matches.length,
    selectedCardInstanceIds: Array.from(matchIds),
    onomatopoeia,
  };
}

function handleRemoveFromGame(
  state: GameState,
  _step: TypedStep<'REMOVE_FROM_GAME'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  // Removes the source card (target SELF) from the game: it ends only in removedFromGame
  const source = context.sourceCardInstance;
  if (!source) return { state, success: false, error: 'No card to remove from the game' };
  removeCardFromAllZones(state, source.instanceId);
  state.removedFromGame.push(source);
  appendLog(state, {
    key: 'card.removedFromGame',
    params: { card: source.card.name, actor: player.name },
    onomatopoeia: 'REMOVED FROM THE GAME!',
  });
  return { state, success: true, mutatedState: true, onomatopoeia: 'REMOVED FROM THE GAME!' };
}

function handleReturnToHand(
  state: GameState,
  _step: TypedStep<'RETURN_TO_HAND'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const underneath = context.sourceCardInstance?.cardsUnderneath;
  if (underneath && underneath.length > 0) {
    for (const card of underneath) {
      const owner = state.players.find((p) => p.id === card.ownerId) || player;
      owner.hand.push(card);
    }
    context.sourceCardInstance!.cardsUnderneath = [];
    return {
      state,
      success: true,
      mutatedState: true,
      onomatopoeia: 'CARDS RETURNED TO HANDS!',
    };
  }
  if (context.sourceCardInstance) {
    const allyIdx = player.allies.indexOf(context.sourceCardInstance);
    if (allyIdx !== -1) {
      player.allies.splice(allyIdx, 1);
      player.hand.push(context.sourceCardInstance);
    } else {
      const tabIdx = player.tableau.indexOf(context.sourceCardInstance);
      if (tabIdx !== -1) {
        player.tableau.splice(tabIdx, 1);
        player.hand.push(context.sourceCardInstance);
      }
    }
  }
  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: 'RETURNED TO HAND!',
  };
}

function getSearchZonePile(
  state: GameState,
  targetPlayer: PlayerState,
  zone: SearchZone,
): { pile: CardInstance[]; isDeck: boolean } {
  switch (zone) {
    case 'PLAYER_DISCARD':
      return { pile: targetPlayer.discard, isDeck: false };
    case 'PLAYER_HAND':
      return { pile: targetPlayer.hand, isDeck: false };
    case 'ENCOUNTER_DECK':
      return { pile: state.encounterDeck, isDeck: true };
    case 'ENCOUNTER_DISCARD':
      return { pile: state.encounterDiscard, isDeck: false };
    case 'PLAYER_DECK':
    default:
      return { pile: targetPlayer.deck, isDeck: true };
  }
}

function shuffleSearchedDecks(
  state: GameState,
  targetPlayer: PlayerState,
  sourceZones: SearchZone[],
): void {
  if (sourceZones.includes('ENCOUNTER_DECK')) {
    state.encounterDeck = shuffleArray(state, state.encounterDeck);
  }
  if (sourceZones.includes('PLAYER_DECK')) {
    targetPlayer.deck = shuffleArray(state, targetPlayer.deck);
  }
}

function collectSearchCandidates(
  state: GameState,
  targetPlayer: PlayerState,
  sourceZones: SearchZone[],
  isLookCountSpliced: boolean,
  resolvedLookCount: number | 'ALL' | undefined,
  fromTop: boolean | undefined,
  cardOriginMap: Map<string, SearchZone>,
): CardInstance[] {
  const lookedCards: CardInstance[] = [];
  if (isLookCountSpliced) {
    let remainingToLook = resolvedLookCount as number;
    for (const zone of sourceZones) {
      if (remainingToLook <= 0) break;
      const { pile } = getSearchZonePile(state, targetPlayer, zone);
      const isDiscardZone = zone === 'PLAYER_DISCARD' || zone === 'ENCOUNTER_DISCARD';
      const shouldReverse = isDiscardZone && fromTop === true;
      const workingPile = shouldReverse ? [...pile].reverse() : pile;
      const sliceCount = Math.min(remainingToLook, workingPile.length);
      const spliced = workingPile.splice(0, sliceCount);
      if (shouldReverse) {
        const splicedIds = new Set(spliced.map((c) => c.instanceId));
        const actualPile = getSearchZonePile(state, targetPlayer, zone).pile;
        for (let i = actualPile.length - 1; i >= 0; i--) {
          if (splicedIds.has(actualPile[i].instanceId)) {
            actualPile.splice(i, 1);
          }
        }
      }
      for (const card of spliced) {
        cardOriginMap.set(card.instanceId, zone);
      }
      lookedCards.push(...spliced);
      remainingToLook -= sliceCount;
    }
  } else {
    for (const zone of sourceZones) {
      const { pile } = getSearchZonePile(state, targetPlayer, zone);
      const isDiscardZone = zone === 'PLAYER_DISCARD' || zone === 'ENCOUNTER_DISCARD';
      const shouldReverse = isDiscardZone && fromTop === true;
      const cardsToLook = shouldReverse ? [...pile].reverse() : pile;
      for (const card of cardsToLook) {
        cardOriginMap.set(card.instanceId, zone);
        lookedCards.push(card);
      }
    }
  }
  return lookedCards;
}

function handleSearch(
  state: GameState,
  step: TypedStep<'SEARCH'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const autoResolveEnabled = state.options?.autoResolveUnambiguous !== false;
  const stepAutoSelect = step.effectParams?.autoSelectIfUnambiguous !== false;
  const allowAutoSelect = autoResolveEnabled && stepAutoSelect;

  const rawSource = step.effectParams?.source;
  const sourceZones: SearchZone[] = (
    Array.isArray(rawSource) ? rawSource : [rawSource || 'PLAYER_DECK']
  ) as SearchZone[];

  let resolvedLookCount: number | 'ALL' | undefined = undefined;
  if (step.effectParams?.lookCount === 'ALL') {
    resolvedLookCount = 'ALL';
  } else if (step.effectParams?.lookCount !== undefined) {
    resolvedLookCount = resolveNumericAmount(step.effectParams.lookCount, context, 0, {
      state,
      player,
    });
  }
  const isFullSearch =
    resolvedLookCount === undefined || resolvedLookCount === 'ALL' || resolvedLookCount === 0;
  const isLookCountSpliced =
    !isFullSearch && typeof resolvedLookCount === 'number' && resolvedLookCount > 0;

  let resolvedTakeCount: number | 'ALL' = 1;
  if (step.effectParams?.takeCount === 'ALL') {
    resolvedTakeCount = 'ALL';
  } else if (step.effectParams?.takeCount !== undefined) {
    resolvedTakeCount = resolveNumericAmount(step.effectParams.takeCount, context, 1, {
      state,
      player,
    });
  }
  const isTakeAll = resolvedTakeCount === 'ALL' || resolvedTakeCount === 0;
  const countToTake = isTakeAll ? 0 : Math.max(1, resolvedTakeCount as number);

  const filter =
    step.effectParams?.filter ??
    (step.effectParams?.targetCardCode ||
    step.effectParams?.targetCardName ||
    step.effectParams?.trait ||
    step.effectParams?.type ||
    step.effectParams?.type_code ||
    step.effectParams?.cardType
      ? {
          targetCardCode: step.effectParams?.targetCardCode,
          targetCardName: step.effectParams?.targetCardName,
          trait: step.effectParams?.trait,
          type:
            step.effectParams?.type || step.effectParams?.type_code || step.effectParams?.cardType,
        }
      : undefined);

  const targetParam = (step.effectParams?.target as string) || 'SELF';
  let targetPlayerId: string | undefined =
    (step.effectParams?.targetPlayerId as string) || context.targetPlayerId;

  if (targetParam === 'CHOSEN_PLAYER' && state.players.length > 1 && !targetPlayerId) {
    const eligiblePlayers = state.players.filter((p) =>
      p.discard.some((c) => matchesCardFilter(c, filter, { state, player: p })),
    );

    if (allowAutoSelect && eligiblePlayers.length === 1) {
      targetPlayerId = eligiblePlayers[0].id;
    } else {
      const promptId = `prompt_${nextEngineId(state, 'id')}_choose_search_player`;
      const sourceCardName =
        context.sourceCardInstance?.card.name || player.activeFormCard?.name || 'Search & Select';

      const prompt: PendingDecisionPrompt = {
        promptId,
        playerId: player.id,
        title: 'Choose a Player',
        description: 'Choose a player to return a card to their hand:',
        sourceCardName,
        sourceCardCode: context.sourceCardInstance?.card.code,
        sourceCardInstanceId: context.sourceCardInstance?.instanceId,
        options: state.players.map((p) => {
          const isEligible = eligiblePlayers.some((ep) => ep.id === p.id);
          return {
            id: `choose_player_${p.id}`,
            label: `${p.name} (${p.hero?.name || 'Hero'})`,
            description: `Choose ${p.name}`,
            effect: 'SEARCH',
            disabled: !isEligible,
            disabledReason: !isEligible ? 'No Tech upgrade in discard pile' : undefined,
            params: {
              ...step.effectParams,
              targetPlayerId: p.id,
              target: 'CHOSEN_PLAYER',
            },
          };
        }),
      };

      state = kernel.enqueueDecisionPrompt(state, prompt);
      appendLog(state, {
        category: 'ability',
        key: 'decision.prompt.opened',
        params: { actor: player.name, promptId, source: sourceCardName },
        onomatopoeia: 'CHOOSE PLAYER!',
      });

      return {
        state,
        success: true,
        mutatedState: false,
        onomatopoeia: 'CHOOSE PLAYER!',
      };
    }
  }

  const targetPlayer =
    (targetPlayerId ? state.players.find((p) => p.id === targetPlayerId) : undefined) || player;

  const selectedDestination = (step.effectParams?.selectedDestination as string) || 'HAND';
  const unselectedDestination = step.effectParams?.unselectedDestination as
    string | null | undefined;
  const shuffleAfter =
    step.effectParams?.shuffleAfter !== undefined
      ? (step.effectParams.shuffleAfter as boolean)
      : isFullSearch;

  const distinctByName = step.effectParams?.distinctBy === 'NAME';
  const rawMinimumTake = step.effectParams?.minimumTake;
  const minimumTake =
    rawMinimumTake === undefined
      ? 1
      : Math.max(0, resolveNumericAmount(rawMinimumTake, context, 1, { state, player }));

  const promptTitle =
    (step.effectParams?.promptTitle as string) ||
    (context.sourceCardInstance
      ? `${context.sourceCardInstance.card.name}: Choose card(s)`
      : 'Search & Select: Choose card(s)');

  const cardOriginMap = new Map<string, SearchZone>();
  const routeSearched = (cards: CardInstance[], destination: string | null | undefined) =>
    routeCardInstances(
      state,
      targetPlayer,
      cards,
      destination,
      (card) => cardOriginMap.get(card.instanceId) || sourceZones[0],
      {
        host: (step.effectParams?.target as string) || 'VILLAIN',
        targetId: context.chosenTargetInstanceId || context.targetPlayerId || targetPlayer.id,
      },
    );

  // Determine candidate pool
  const lookedCards = collectSearchCandidates(
    state,
    targetPlayer,
    sourceZones,
    isLookCountSpliced,
    resolvedLookCount,
    step.effectParams?.fromTop as boolean | undefined,
    cardOriginMap,
  );

  // Filter matching candidate cards
  let matchingCandidates = lookedCards.filter((c) =>
    matchesCardFilter(c, filter, { player: targetPlayer }),
  );
  if (step.effectParams?.fromTop === true) {
    matchingCandidates = matchingCandidates.slice(0, countToTake);
  }

  if (matchingCandidates.length === 0) {
    appendLog(state, {
      category: 'ability',
      actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
      key: 'card.search.nothingFound',
      params: {
        actor: targetPlayer.name,
        source: context.sourceCardInstance?.card.name || promptTitle,
        zone: sourceZones.join(', '),
      },
      onomatopoeia: 'NOTHING FOUND!',
    });
    if (isLookCountSpliced) {
      if (unselectedDestination === 'DISCARD') {
        routeSearched(lookedCards, 'DISCARD');
      } else {
        routeSearched(lookedCards, 'LEAVE_IN_PLACE');
      }
    }
    if (shuffleAfter) {
      shuffleSearchedDecks(state, targetPlayer, sourceZones);
    }
    return {
      state,
      success: true,
      mutatedState: true,
      onomatopoeia: 'NO MATCHING TARGET FOUND',
    };
  }

  // Candidates the player can choose among: one per card name when the search is `distinctBy`.
  const eligibleCandidates = distinctByName
    ? matchingCandidates.filter(
        (c, i) => matchingCandidates.findIndex((o) => o.card.name === c.card.name) === i,
      )
    : matchingCandidates;
  const effectiveTakeCount = Math.min(
    isTakeAll ? matchingCandidates.length : countToTake,
    eligibleCandidates.length,
  );
  const effectiveMinimum = Math.min(minimumTake, effectiveTakeCount);
  // Nothing left to choose: the player must take every eligible card
  const shouldAutoSelect =
    isTakeAll || (allowAutoSelect && eligibleCandidates.length <= effectiveMinimum);

  if (shouldAutoSelect) {
    const selectedCards = eligibleCandidates.slice(0, effectiveTakeCount);
    const selectedIds = new Set(selectedCards.map((card) => card.instanceId));
    const unselectedCards = lookedCards.filter((card) => !selectedIds.has(card.instanceId));

    if (!isLookCountSpliced) {
      for (const selectedCard of selectedCards) {
        const zone = cardOriginMap.get(selectedCard.instanceId) || sourceZones[0];
        const { pile } = getSearchZonePile(state, targetPlayer, zone);
        const selectedIndex = pile.findIndex((card) => card.instanceId === selectedCard.instanceId);
        if (selectedIndex !== -1) pile.splice(selectedIndex, 1);
      }
    }

    routeSearched(selectedCards, selectedDestination);
    if (isLookCountSpliced) {
      routeSearched(unselectedCards, unselectedDestination);
    }
    if (shuffleAfter) {
      shuffleSearchedDecks(state, targetPlayer, sourceZones);
    }

    return {
      state,
      success: true,
      mutatedState: selectedCards.length > 0,
      selectedCardInstanceIds: selectedCards.map((card) => card.instanceId),
      onomatopoeia: `SEARCHED ${selectedCards.length} CARD(S)!`,
    };
  }

  // A single mandatory pick keeps the one-click flow; anything else is a multi-select prompt
  const isMultiSelect = !(effectiveMinimum === 1 && effectiveTakeCount === 1);
  const options: DecisionPromptOption[] = matchingCandidates.map((c) => ({
    id: c.instanceId,
    label: `${c.card.name} (${c.card.type}${c.card.cost !== undefined ? `, Cost: ${c.card.cost}` : ''})`,
    description: c.card.text || `Select ${c.card.name}`,
    effect: 'SEARCH_AND_SELECT_RESOLUTION',
    params: {
      chosenInstanceId: c.instanceId,
      cardName: c.card.name,
      cardCode: c.card.code,
      targetPlayerId: targetPlayer.id,
      lookedCards,
      lookedCardInstanceIds: lookedCards.map((l) => l.instanceId),
      sourceZone: cardOriginMap.get(c.instanceId) || sourceZones[0],
      sourceZones,
      selectedDestination,
      unselectedDestination,
      shuffleAfter: shuffleAfter && sourceZones.some((z) => z.includes('DECK')),
      isLookCountSpliced,
      target: step.effectParams?.target,
    },
  }));

  const prompt: PendingDecisionPrompt = {
    promptId: nextEngineId(state, 'prompt_search'),
    playerId: context.playerId || player.id,
    title: promptTitle,
    description:
      effectiveMinimum === effectiveTakeCount
        ? `Select ${effectiveTakeCount} card(s):`
        : `Select ${effectiveMinimum === 0 ? 'up to' : `${effectiveMinimum} to`} ${effectiveTakeCount} card(s):`,
    sourceCardName: context.sourceCardInstance?.card.name || 'Search & Select',
    sourceCardCode: context.sourceCardInstance?.card.code,
    sourceCardInstanceId: context.sourceCardInstance?.instanceId,
    options,
    isVoluntary: false,
    ...(isMultiSelect && {
      selection: {
        min: effectiveMinimum,
        max: effectiveTakeCount,
        ...(distinctByName && { distinctBy: 'NAME' as const }),
      },
    }),
  };

  const enqueuedState = kernel.enqueueDecisionPrompt(state, prompt);
  return {
    state: enqueuedState,
    success: true,
    onomatopoeia: 'CHOOSE CARD!',
  };
}

function handleAttachFacedownCardsFromHand(
  state: GameState,
  _step: TypedStep<'ATTACH_FACEDOWN_CARDS_FROM_HAND'>,
  context: EffectExecutionContext,
  _player: PlayerState,
): EffectResult {
  // Cards go under the host as it exists in state, not under the reveal-time instance (#238).
  const host = resolveSourceHostZone(state, context.sourceCardInstance);
  if (!host) {
    return { state, success: false, error: 'No host in play to place facedown cards under' };
  }
  for (const p of state.players) {
    if (p.hand.length > 0) {
      const randIdx = randomInt(state, p.hand.length);
      const [removed] = p.hand.splice(randIdx, 1);
      removed.ownerId = p.id;
      if (!host.cardsUnderneath) host.cardsUnderneath = [];
      host.cardsUnderneath.push(removed);
    }
  }
  return {
    state,
    success: true,
    mutatedState: true,
    onomatopoeia: 'CARDS PLACED FACEDOWN!',
  };
}

function handlePlayFromZone(
  state: GameState,
  step: TypedStep<'PLAY_FROM_ZONE'>,
  context: EffectExecutionContext,
  player: PlayerState,
): EffectResult {
  const params = getStepEffectParams(step);
  const source = (params.source as string) || 'PLAYER_DISCARD';
  const filter = params.filter;
  const costMode = (params.costMode as string) || 'PRINTED_COST';
  const costReduction = params.costReduction || 0;
  const destination = (params.destination as string) || 'TABLEAU';
  const control = (params.control as string) || 'SELF';
  const promptTitle =
    params.promptTitle ||
    (context.sourceCardInstance
      ? `${context.sourceCardInstance.card.name}: Choose a card to play`
      : 'Choose a card to play:');

  // 1. Gather candidate cards from designated source
  interface CandidateCard {
    instance: CardInstance;
    owner: PlayerState;
  }
  const candidates: CandidateCard[] = [];

  if (source === 'ANY_PLAYER_DISCARD') {
    for (const p of state.players) {
      for (const cardInst of p.discard) {
        if (matchesCardFilter(cardInst, filter, { player, state })) {
          candidates.push({ instance: cardInst, owner: p });
        }
      }
    }
  } else if (source === 'PLAYER_DISCARD') {
    for (const cardInst of player.discard) {
      if (matchesCardFilter(cardInst, filter, { player, state })) {
        candidates.push({ instance: cardInst, owner: player });
      }
    }
  } else if (source === 'PLAYER_DECK') {
    for (const cardInst of player.deck) {
      if (matchesCardFilter(cardInst, filter, { player, state })) {
        candidates.push({ instance: cardInst, owner: player });
      }
    }
  }

  if (candidates.length === 0) {
    return {
      state,
      success: true,
      mutatedState: false,
      onomatopoeia: 'NO TARGET FOUND',
    };
  }

  // Check Option B: Direct targeted play when targetInstanceId is pre-supplied (e.g. from tests or bot)
  if (context.chosenTargetInstanceId) {
    const matched = candidates.find(
      (c) => c.instance.instanceId === context.chosenTargetInstanceId,
    );
    if (matched) {
      const chosenCard = matched.instance;
      const ownerPlayer = matched.owner;

      // Splice from owner's discard/source
      const spliceIdx = ownerPlayer.discard.findIndex(
        (c) => c.instanceId === chosenCard.instanceId,
      );
      if (spliceIdx !== -1) {
        ownerPlayer.discard.splice(spliceIdx, 1);
      }

      // Track owner for cross-player control per RR v1.8 p. 11
      chosenCard.ownerId = ownerPlayer.id;

      // Reset transient gameplay state and ensure card enters ready (RR v1.8 p. 11, 24)
      resetCardState(chosenCard);
      chosenCard.exhausted = false;

      // Move into controller's tableau / allies
      if (chosenCard.card.type === CardType.ALLY) {
        applyToughnessOnEntry(chosenCard);
        player.allies.push(chosenCard);
      } else {
        player.tableau.push(chosenCard);
      }

      initializeCardUses(chosenCard);

      // Dispatch ENTERS_PLAY only — card is put into play, NOT played (RR v1.8 p.21)
      // CARD_PLAYED does NOT fire here (no cost was paid via the play action)
      kernel.dispatchTrigger(state, 'ENTERS_PLAY', {
        targetPlayerId: player.id,
        sourceInstanceId: chosenCard.instanceId,
      });

      const onomatopoeia = `PLAYED ${chosenCard.card.name.toUpperCase()}!`;
      appendLog(state, {
        category: 'ability',
        key: 'card.playFromZone',
        params: {
          actor: player.name,
          card: chosenCard.card.name,
          source,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia,
      };
    }
  }

  // Option A: If only 1 candidate or no pre-supplied target, enqueue a Decision Prompt
  const available = getAvailableResources(player, state).total;
  const allyLimit = getPlayerAllyLimit(state, player.id);
  const isAllyLimitReached = player.allies.length >= allyLimit;

  const filteredCandidates = candidates.filter((c) => {
    const cost = c.instance.card.cost ?? 0;
    if (cost > available) return false;

    if (c.instance.card.type === CardType.ALLY && isAllyLimitReached) {
      return false;
    }

    if (c.instance.card.isUnique) {
      for (const p of state.players || []) {
        for (const inPlay of [...(p.allies || []), ...(p.tableau || [])]) {
          if (
            inPlay.card.code === c.instance.card.code ||
            inPlay.card.name.toLowerCase().trim() === c.instance.card.name.toLowerCase().trim()
          ) {
            return false;
          }
        }
      }
      if (!checkUniqueCardPlayable(state, c.instance.card).allowed) {
        return false;
      }
    }

    return true;
  });

  const options: DecisionPromptOption[] = filteredCandidates.map((c) => {
    const cost = c.instance.card.cost ?? 0;
    return {
      id: c.instance.instanceId,
      label: `${c.instance.card.name} (Cost: ${cost}${c.owner.id !== player.id ? `, Owner: ${c.owner.name}` : ''})`,
      description:
        c.instance.card.text || `Play ${c.instance.card.name} from ${c.owner.name}'s discard`,
      effect: 'PLAY_CARD_FROM_ZONE_RESOLUTION',
      requiresPayment: cost > 0,
      params: {
        chosenInstanceId: c.instance.instanceId,
        ownerId: c.owner.id,
        source,
        destination,
        control,
        costMode,
        costReduction,
        requiresPayment: cost > 0,
        resourceCost: { amount: cost },
        costCardInstanceId: c.instance.instanceId,
        cardInstance: c.instance,
      },
    };
  });

  options.push({
    id: 'pass_play_from_zone',
    label: 'Pass / Cancel',
    description: 'Do not play a card',
    effect: 'PLAY_CARD_FROM_ZONE_PASS',
    params: {},
  });

  const prompt: PendingDecisionPrompt = {
    promptId: nextEngineId(state, 'prompt_play_from_zone'),
    playerId: player.id,
    title: promptTitle,
    description: 'Choose a card to pay for and play into your tableau:',
    sourceCardName: context.sourceCardInstance?.card.name || 'Make the Call',
    sourceCardCode: context.sourceCardInstance?.card.code,
    sourceCardInstanceId: context.sourceCardInstance?.instanceId,
    options,
    isVoluntary: true,
  };

  const enqueuedState = kernel.enqueueDecisionPrompt(state, prompt);
  return {
    state: enqueuedState,
    success: true,
    onomatopoeia: 'CHOOSE CARD TO PLAY!',
  };
}

export const CARDS_HANDLERS = {
  DISCARD: handleDiscard,
  DRAW: handleDraw,
  ATTACH_TO_HOST: handleAttachToHost,
  PLACE_CARD_UNDER_HOST: handlePlaceCardUnderHost,
  PUT_INTO_PLAY: handlePutIntoPlay,
  SHUFFLE_INTO_DECK: handleShuffleIntoDeck,
  REMOVE_FROM_GAME: handleRemoveFromGame,
  RETURN_TO_HAND: handleReturnToHand,
  SEARCH: handleSearch,
  ATTACH_FACEDOWN_CARDS_FROM_HAND: handleAttachFacedownCardsFromHand,
  PLAY_FROM_ZONE: handlePlayFromZone,
} satisfies Partial<StepHandlerMap>;
