import {
  CardType,
  CardInstance,
  CardAbility,
  AbilityStep,
  DecisionPromptOption,
  PendingDecisionPrompt,
  PlayerState,
  SideSchemeCard,
  PlayerSideSchemeCard,
  StatusCard,
  VillainState,
  getPerPlayerCount,
  getVillainsInPlay,
} from '../../models';
import {
  getPlayer,
  canPlayCard,
  isCardRestricted,
  getCardRestrictedWeight,
  getPlayerRestrictedCount,
  getPlayerRestrictedLimit,
} from '../legality-checker';
import {
  canPayAbilityCost,
  getEventAbilityExtraCost,
  getEffectiveCardCost,
  executeResourceCostPayment,
  getApplicableCostReductions,
} from '../cost-engine';
import { resetCardState } from '../../effects';
import { initializeCardUses, attachCardToHost } from '../../state/state-validator';
import { getEffectiveMaxHealth, isEntityIncapacitatedByStatus } from '../stat-calculator';
import { applyToughnessOnEntry } from '../../state/card-instance';
import { dispatchTrigger } from '../../triggers/trigger-dispatcher';
import { recordCardPlay } from '../stats';
import { appendLog } from '../../state/game-log';
import { nextEngineId } from '../../state/rng';
import {
  resolveEntityByInstanceId,
  getEligibleTargets,
  TargetFilterOptions,
} from '../../effects/target-resolver';
import { getStepEffectParams } from '../../../data/supplemental/runtime';
import { isStepGateClosedByState } from '../step-gate-evaluator';
import { enqueueDecisionPrompt } from '../prompt-queue';
import { resolveAttackedVillain, resolveEventAbilities } from './shared';
import type { ActionHandler, TypedAction } from './types';
import type { ActionResult, GameState } from '../../models';

interface HostCandidate {
  id: string;
  /** Label shown in the prompt and written to the log. */
  name: string;
}

interface HostKind {
  hosts: readonly string[];
  /** Prompt id slug, option flag and text for the "choose a host" decision. */
  slug: 'minion' | 'ally' | 'enemy';
  choiceFlag: 'isAttachmentMinionChoice' | 'isAttachmentAllyChoice' | 'isAttachmentEnemyChoice';
  title: string;
  onomatopoeia: string;
  collect: (state: GameState, hasRoom: (host: HostLike) => boolean) => HostCandidate[];
  /** Display name for a host picked explicitly, or the fallback when none is picked. */
  describe: (state: GameState, hostId: string | undefined) => string;
}

type HostLike = { attachments?: CardInstance[] };

const withController = (card: CardInstance, player: PlayerState) =>
  `${card.card.name} (${player.name})`;

const findControlled = (
  state: GameState,
  zone: 'engagedMinions' | 'allies',
  instanceId: string | undefined,
): string | undefined => {
  for (const p of state.players) {
    const found = p[zone]?.find((c) => c.instanceId === instanceId);
    if (found) return withController(found, p);
  }
  return undefined;
};

const controlledCandidates = (state: GameState, zone: 'engagedMinions' | 'allies') =>
  state.players.flatMap((p) =>
    (p[zone] || []).map((c) => ({ host: c, id: c.instanceId, name: withController(c, p) })),
  );

const HOST_KINDS: readonly HostKind[] = [
  {
    hosts: ['CHOSEN_MINION', 'MINION'],
    slug: 'minion',
    choiceFlag: 'isAttachmentMinionChoice',
    title: 'Choose Minion Host',
    onomatopoeia: 'CHOOSE MINION!',
    collect: (state, hasRoom) =>
      controlledCandidates(state, 'engagedMinions').filter((c) => hasRoom(c.host)),
    describe: (state, id) => findControlled(state, 'engagedMinions', id) ?? (id || 'Minion'),
  },
  {
    hosts: ['CHOSEN_ALLY', 'ALLY'],
    slug: 'ally',
    choiceFlag: 'isAttachmentAllyChoice',
    title: 'Choose Ally Host',
    onomatopoeia: 'CHOOSE ALLY!',
    collect: (state, hasRoom) =>
      controlledCandidates(state, 'allies').filter((c) => hasRoom(c.host)),
    describe: (state, id) => findControlled(state, 'allies', id) ?? (id || 'Ally'),
  },
  {
    hosts: ['CHOSEN_ENEMY', 'ENEMY'],
    slug: 'enemy',
    choiceFlag: 'isAttachmentEnemyChoice',
    title: 'Choose Enemy Host',
    onomatopoeia: 'CHOOSE ENEMY!',
    collect: (state, hasRoom) => [
      ...getVillainsInPlay(state)
        .filter(hasRoom)
        .map((v) => ({ id: v.instanceId || 'villain', name: v.card.name })),
      ...controlledCandidates(state, 'engagedMinions').filter((c) => hasRoom(c.host)),
    ],
    describe: (state, id) =>
      findControlled(state, 'engagedMinions', id) ??
      resolveAttackedVillain(state, id)?.card.name ??
      '',
  },
];

// Any other host (e.g. VILLAIN) attaches to the villain the player is attacking.
const VILLAIN_HOST: Pick<HostKind, 'describe'> = {
  describe: (state, id) => resolveAttackedVillain(state, id)?.card.name ?? '',
};

/**
 * Attaches an upgrade or support to a chosen host or enqueues a selection prompt when multiple hosts exist.
 * A host that already holds `maxPerHost` copies of the card is not a candidate.
 */
export function resolveChosenHostAttachment(
  nextState: GameState,
  player: PlayerState,
  action: TypedAction<'PLAY_CARD'>,
  playedCardInstance: CardInstance,
  targetHost: string,
  attachStep: AbilityStep | undefined,
): { state: GameState; result: ActionResult } | undefined {
  const kind = HOST_KINDS.find((k) => k.hosts.includes(targetHost));
  const maxPerHost =
    attachStep?.effectParams?.maxPerHost !== undefined
      ? Number(attachStep.effectParams.maxPerHost)
      : undefined;
  const hasRoom = (host: HostLike) =>
    maxPerHost === undefined ||
    maxPerHost <= 0 ||
    (host.attachments || []).filter(
      (att) =>
        att.card.code === playedCardInstance.card.code ||
        att.card.name === playedCardInstance.card.name,
    ).length < maxPerHost;

  const attachAndLog = (hostId: string | undefined, hostName: string) => {
    attachCardToHost(nextState, playedCardInstance, targetHost, hostId);
    appendLog(nextState, {
      category: 'ability',
      actor: { name: player.name, type: player.currentForm },
      key: 'card.attached.to_host',
      params: {
        actor: player.name,
        player: player.name,
        card: playedCardInstance.card.name,
        target: hostName,
        host: hostName,
      },
      onomatopoeia: 'ATTACHED!',
    });
  };

  const { describe } = kind ?? VILLAIN_HOST;
  if (!kind || action.targetInstanceId) {
    attachAndLog(action.targetInstanceId, describe(nextState, action.targetInstanceId));
    return undefined;
  }

  const candidates = kind.collect(nextState, hasRoom);
  if (candidates.length > 1) {
    const options: DecisionPromptOption[] = candidates.map(({ id, name }) => ({
      id,
      label: name,
      description: `Attach ${playedCardInstance.card.name} to ${name}`,
      effect: 'ATTACH_TO_HOST',
      params: {
        [kind.choiceFlag]: true,
        attachmentCard: playedCardInstance,
        ownerId: action.playerId,
      },
    }));
    const prompt: PendingDecisionPrompt = {
      promptId: `prompt_attach_${kind.slug}_${nextEngineId(nextState, 'id')}`,
      playerId: action.playerId,
      title: kind.title,
      description: `Choose which ${kind.slug} to attach ${playedCardInstance.card.name} to:`,
      sourceCardName: playedCardInstance.card.name,
      options,
      isVoluntary: false,
    };
    return {
      state: enqueueDecisionPrompt(nextState, prompt),
      result: { success: true, onomatopoeia: kind.onomatopoeia },
    };
  }

  // One candidate attaches to it; none attaches without a chosen host.
  const only = candidates[0];
  attachAndLog(only?.id, only?.name ?? describe(nextState, undefined));
  return undefined;
}

export function playUpgradeOrSupport(
  nextState: GameState,
  state: GameState,
  player: PlayerState,
  action: TypedAction<'PLAY_CARD'>,
  playedCardInstance: CardInstance,
  abilities: CardAbility[],
  resourcesSpent?: string[],
  onomatopoeia: string = 'PLAY!',
): { state: GameState; result: ActionResult } {
  const attachAbility = abilities.find((a) => a.steps?.some((s) => s.effect === 'ATTACH_TO_HOST'));

  if (attachAbility) {
    const attachStep = attachAbility.steps.find((s) => s.effect === 'ATTACH_TO_HOST');
    const targetHost = (attachStep?.effectParams?.target as string) || 'VILLAIN';
    playedCardInstance.ownerId = action.playerId;

    const attachResult = resolveChosenHostAttachment(
      nextState,
      player,
      action,
      playedCardInstance,
      targetHost,
      attachStep,
    );
    if (attachResult) return attachResult;
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
            c.card.name.toLowerCase().trim() === playedCardInstance.card.name.toLowerCase().trim(),
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
        promptId: `prompt_choose_player_${nextEngineId(nextState, 'id')}`,
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
      const hpBonus = (matchingStep.effectParams?.amount as number) || 0;
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

  return { state: nextState, result: { success: true, onomatopoeia } };
}

export function playAlly(
  nextState: GameState,
  player: PlayerState,
  action: TypedAction<'PLAY_CARD'>,
  playedCardInstance: CardInstance,
  resourcesSpent?: string[],
  onomatopoeia: string = 'ALLY CALL!',
): { state: GameState; result: ActionResult } {
  applyToughnessOnEntry(playedCardInstance);
  player.allies.push(playedCardInstance);
  dispatchTrigger(nextState, 'CARD_PLAYED', {
    targetPlayerId: action.playerId,
    sourceInstanceId: playedCardInstance.instanceId,
    resourcesSpent,
  });
  dispatchTrigger(nextState, 'ENTERS_PLAY', {
    targetPlayerId: action.playerId,
    sourceInstanceId: playedCardInstance.instanceId,
    resourcesSpent,
  });
  return { state: nextState, result: { success: true, onomatopoeia } };
}

export function playEvent(
  nextState: GameState,
  state: GameState,
  player: PlayerState,
  action: TypedAction<'PLAY_CARD'>,
  playedCardInstance: CardInstance,
  abilities: CardAbility[],
  resourcesSpent?: string[],
  onomatopoeia: string = 'PLAY!',
  initialTargetType:
    | 'villain'
    | 'minion'
    | 'main_scheme'
    | 'side_scheme'
    | 'character'
    | 'identity'
    | 'ally'
    | 'hero' = 'villain',
): { state: GameState; result: ActionResult } {
  let eventTargetId = action.targetInstanceId;
  let targetType = initialTargetType;

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
        if (step.effect === 'HEAL_DAMAGE') {
          filterOpts = { damaged: true };
        } else if (step.effect === 'READY') {
          filterOpts = { exhausted: true };
        } else if (step.effect === 'REMOVE_THREAT') {
          filterOpts = {
            ignoresCrisis: Boolean(stepParams.ignoresCrisis),
          };
        }
        break;
      }
    }
    if (requiredTargetScope) break;
  }

  const willBeCanceledByStatus = (abilities || []).some(
    (a) =>
      (a.labels?.includes('ATTACK') && isEntityIncapacitatedByStatus(player, StatusCard.STUNNED)) ||
      (a.labels?.includes('THWART') && isEntityIncapacitatedByStatus(player, StatusCard.CONFUSED)),
  );

  if (requiredTargetScope && !eventTargetId && !willBeCanceledByStatus) {
    const eligibleTargets = getEligibleTargets(nextState, player, requiredTargetScope, filterOpts);
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
          label = (t.entity as { card?: { name?: string } }).card?.name || t.id;
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
        promptId: `prompt_event_target_${nextEngineId(nextState, 'id')}`,
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

  return { state: nextState, result: { success: true, onomatopoeia } };
}

export function playPlayerSideScheme(
  nextState: GameState,
  player: PlayerState,
  action: TypedAction<'PLAY_CARD'>,
  playedCardInstance: CardInstance,
  resourcesSpent?: string[],
): { state: GameState; result: ActionResult } {
  // Player Side Schemes enter the shared scheme area alongside encounter Side Schemes
  // (RR v1.8 p. 26, ADR-0034), scaled by player count like any other scheme.
  const schemeCard = playedCardInstance.card as unknown as SideSchemeCard | PlayerSideSchemeCard;
  const baseThreat =
    (schemeCard.baseThreat ?? 0) * (schemeCard.baseThreatFixed ? 1 : getPerPlayerCount(nextState));

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

  appendLog(nextState, {
    key: 'encounter.reveal.sideScheme',
    params: { card: playedCardInstance.card.name, amount: baseThreat },
    onomatopoeia: 'SIDE SCHEME!',
  });

  return { state: nextState, result: { success: true, onomatopoeia: 'SIDE SCHEME!' } };
}

export const handlePlayCard: ActionHandler<'PLAY_CARD'> = (nextState, state, action) => {
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
    targetCard = player.deck[0]?.instanceId === action.cardInstanceId ? player.deck[0] : undefined;
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
        promptId: `prompt_discard_restricted_${nextEngineId(nextState, 'id')}`,
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
      appendLog(nextState, {
        category: 'ability',
        key: 'cost.reduction.consumed',
        params: {
          actor: player.name,
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
    const idx = targetOwnerPlayer.discard.findIndex((c) => c.instanceId === action.cardInstanceId);
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
    (a.steps || []).some((s) => ['DEAL_DAMAGE', 'REPULSOR_BLAST', 'EXPLOSION'].includes(s.effect)),
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

  appendLog(nextState, {
    actor: {
      name: player.hero?.name || player.name,
      type: player.currentForm === 'hero' ? 'hero' : 'alter_ego',
    },
    key: 'CARD_PLAYED',
    params: {
      actor: player.hero?.name || player.name,
      card: playedCardInstance.card.name,
      amount: playedCardInstance.card.cost ?? 0,
    },
    onomatopoeia,
  });

  recordCardPlay(nextState, playedCardInstance.card.code);

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
    return playUpgradeOrSupport(
      nextState,
      state,
      player,
      action,
      playedCardInstance,
      abilities,
      resourcesSpent,
      onomatopoeia,
    );
  } else if (cardType === CardType.ALLY) {
    return playAlly(nextState, player, action, playedCardInstance, resourcesSpent, onomatopoeia);
  } else if (cardType === CardType.EVENT) {
    return playEvent(
      nextState,
      state,
      player,
      action,
      playedCardInstance,
      abilities,
      resourcesSpent,
      onomatopoeia,
      targetType,
    );
  } else if (cardType === CardType.PLAYER_SIDE_SCHEME) {
    return playPlayerSideScheme(nextState, player, action, playedCardInstance, resourcesSpent);
  }

  return { state: nextState, result: { success: true, onomatopoeia } };
};

export const PLAY_HANDLERS = {
  PLAY_CARD: handlePlayCard,
};
