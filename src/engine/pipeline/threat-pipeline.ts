import { bindKernel, kernel } from '../kernel';
import {
  GameState,
  PlayerState,
  StatusCard,
  CardInstance,
  SideSchemeState,
  Keyword,
  getActiveMainScheme,
  hasKeyword,
} from '@engine/models';
import { consumeEntityStatusCards } from './stat-calculator';
import { hasCrisisInPlay } from './crisis';
import { handleMainSchemeCompletion } from './scenario-helpers';
import { defeatSideScheme } from '../effects';
import { nextEngineId } from '../state/rng';
import { appendLog } from '../state/game-log';

export type ThreatTargetType = 'main_scheme' | 'side_scheme';

export interface ThreatPlacementRequest {
  targetType: ThreatTargetType;
  targetInstanceId?: string;
  amount: number;
  sourceType:
    | 'VILLAIN_PHASE_STEP_1'
    | 'VILLAIN_SCHEME'
    | 'MINION_SCHEME'
    | 'CARD_EFFECT'
    | 'INCITE'
    | 'HAZARD';
  sourceEntityName?: string;
  sourcePlayerId?: string;
  boostIcons?: number;
}

export interface ThreatPlacementResult {
  initialAmount: number;
  threatPlaced: number;
  preventedAmount: number;
  targetSchemeName: string;
  currentThreat: number;
  targetThreat?: number;
  stageCompleted: boolean;
  onomatopoeia?: string;
  /**
   * True when interrupt prompts are open for this placement (#266): nothing is placed yet, the
   * placement finishes once every prompt is answered (`finishPendingThreatPlacements`).
   */
  paused?: boolean;
}

export interface ThwartRequest {
  thwarterType: 'HERO' | 'ALLY' | 'CARD_EFFECT';
  thwarterEntity?: PlayerState | CardInstance;
  playerId: string;
  targetType: ThreatTargetType;
  targetInstanceId?: string;
  thwartValue: number;
  ignoresCrisis?: boolean;
  ignoresPatrol?: boolean;
  suppressTrigger?: boolean;
  /** Card or character shown as the source in the combat log; defaults to the thwarter's name. */
  sourceName?: string;
}

export interface ThwartResult {
  thwartAttempted: boolean;
  confusedCleared: boolean;
  threatRemoved: number;
  targetSchemeName: string;
  remainingThreat: number;
  schemeDefeated: boolean;
  onomatopoeia?: string;
}

/**
 * Universal RR v1.8 Threat Placement Pipeline.
 * Single source of truth for all threat additions across MCD.
 */
export function applyThreatPlacement(
  state: GameState,
  request: ThreatPlacementRequest,
): { state: GameState; result: ThreatPlacementResult } {
  const { targetType, targetInstanceId, amount, sourceType, sourcePlayerId } = request;

  if (amount <= 0) {
    const schemeName =
      targetType === 'main_scheme'
        ? getActiveMainScheme(state)?.card?.name || 'Main Scheme'
        : state.sideSchemes.find((s) => s.instanceId === targetInstanceId)?.card?.name ||
          'Side Scheme';
    const curThreat =
      targetType === 'main_scheme'
        ? getActiveMainScheme(state)?.threat || 0
        : state.sideSchemes.find((s) => s.instanceId === targetInstanceId)?.threat || 0;

    return {
      state,
      result: {
        initialAmount: amount,
        threatPlaced: 0,
        preventedAmount: 0,
        targetSchemeName: schemeName,
        currentThreat: curThreat,
        stageCompleted: false,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // STEP 1: "When threat would be placed on a scheme..." (RR v1.8 Prevention/Replacement)
  // ---------------------------------------------------------------------------
  const promptsBefore = new Set(
    (state.pendingDecisionQueue ?? []).map((prompt) => prompt.promptId),
  );
  const triggerRes = kernel.dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
    targetPlayerId:
      sourcePlayerId || state.players[state.activePlayerIndex]?.id || state.players[0]?.id,
    threatAmount: amount,
    targetType,
    targetInstanceId,
    threatSource: sourceType,
  });

  const finalThreat = Math.max(0, triggerRes.threatAmount ?? amount);

  // Interrupt prompts opened by the window: the placement waits for every answer (#266).
  if (triggerRes.hasPendingPrompt) {
    const newPrompts = (state.pendingDecisionQueue ?? []).filter(
      (prompt) => !promptsBefore.has(prompt.promptId),
    );
    if (newPrompts.length > 0) {
      const id = nextEngineId(state, 'threat_placement');
      for (const prompt of newPrompts) {
        for (const option of prompt.options) {
          if (option.effect === 'EXECUTE_OPTIONAL_TRIGGER' && option.params) {
            option.params = {
              ...option.params,
              context: { ...(option.params.context as object), threatPlacementId: id },
            };
          }
        }
      }
      state.pendingThreatPlacements = [
        ...(state.pendingThreatPlacements ?? []),
        { id, request: { ...request }, amount: finalThreat },
      ];
      const target =
        targetType === 'main_scheme'
          ? getActiveMainScheme(state)
          : state.sideSchemes.find((s) => s.instanceId === targetInstanceId);
      return {
        state,
        result: {
          initialAmount: amount,
          threatPlaced: 0,
          preventedAmount: 0,
          targetSchemeName: target?.card?.name || 'Scheme',
          currentThreat: target?.threat || 0,
          stageCompleted: false,
          paused: true,
        },
      };
    }
  }

  return placeThreat(state, request, finalThreat);
}

/**
 * Places the threat that is left after the interrupt window (RR v1.8 Scheme (Enemy Activation)
 * steps 2 and 3): tokens, log, main scheme completion, then the THREAT_PLACED triggers.
 */
function placeThreat(
  state: GameState,
  request: ThreatPlacementRequest,
  finalThreat: number,
): { state: GameState; result: ThreatPlacementResult } {
  const {
    targetType,
    targetInstanceId,
    amount,
    sourceType,
    sourceEntityName,
    sourcePlayerId,
    boostIcons,
  } = request;
  const preventedAmount = Math.max(0, amount - finalThreat);

  let targetSchemeName = 'Main Scheme';
  let currentThreat = 0;
  let targetThreat: number | undefined;
  let stageCompleted = false;
  let onomatopoeia = 'SCHEME!';

  // ---------------------------------------------------------------------------
  // STEP 2: Placing of threat tokens on target scheme
  // ---------------------------------------------------------------------------
  if (targetType === 'main_scheme') {
    const mainScheme = getActiveMainScheme(state);
    targetSchemeName = mainScheme?.card?.name || 'Main Scheme';
    mainScheme.threat += finalThreat;
    currentThreat = mainScheme.threat;
    targetThreat = mainScheme.targetThreat;

    if (sourceType === 'VILLAIN_PHASE_STEP_1') {
      onomatopoeia = 'SCHEME GROWS!';
      appendLog(state, {
        key: 'villainPhase.step1.threatPlaced',
        params: {
          amount: finalThreat,
          target: targetSchemeName,
          currentThreat,
          targetThreat,
        },
        onomatopoeia,
      });
    } else if (sourceType === 'VILLAIN_SCHEME' || sourceType === 'MINION_SCHEME') {
      onomatopoeia = 'SCHEME!';
      const targetPlayer = sourcePlayerId
        ? state.players.find((p) => p.id === sourcePlayerId)
        : undefined;
      appendLog(state, {
        key: sourceType === 'MINION_SCHEME' ? 'minion.scheme.threat' : 'villain.scheme.threat',
        params: {
          actor: sourceEntityName || 'Enemy',
          target: targetSchemeName,
          amount: finalThreat,
          boost: boostIcons || 0,
          ...(targetPlayer?.name ? { player: targetPlayer.name } : {}),
        },
        onomatopoeia,
      });
    } else {
      onomatopoeia = `+${finalThreat} THREAT!`;
      appendLog(state, {
        key: 'scheme.threat.added',
        params: {
          target: targetSchemeName,
          amount: finalThreat,
          currentThreat,
        },
        onomatopoeia,
      });
    }

    // ---------------------------------------------------------------------------
    // STEP 3: Main Scheme Threshold Check & Stage Progression
    // ---------------------------------------------------------------------------
    if (mainScheme.targetThreat && mainScheme.threat >= mainScheme.targetThreat) {
      stageCompleted = true;
      state = handleMainSchemeCompletion(state, mainScheme.instanceId);
    }
  } else if (targetType === 'side_scheme') {
    let sideScheme: SideSchemeState | undefined;
    if (targetInstanceId) {
      sideScheme = state.sideSchemes.find(
        (s) => s.instanceId === targetInstanceId || s.card.code === targetInstanceId,
      );
    } else if (state.sideSchemes.length > 0) {
      sideScheme = state.sideSchemes[0];
    }

    if (sideScheme) {
      targetSchemeName = sideScheme.card?.name || 'Side Scheme';
      sideScheme.threat = (sideScheme.threat || 0) + finalThreat;
      currentThreat = sideScheme.threat;

      onomatopoeia = `+${finalThreat} THREAT!`;
      appendLog(state, {
        key: 'scheme.threat.added',
        params: {
          target: targetSchemeName,
          amount: finalThreat,
          currentThreat,
        },
        onomatopoeia,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Post-Placement Triggers
  // ---------------------------------------------------------------------------
  kernel.dispatchTrigger(state, 'THREAT_PLACED', {
    targetPlayerId:
      sourcePlayerId || state.players[state.activePlayerIndex]?.id || state.players[0]?.id || '',
    targetType,
    targetInstanceId,
    threatAmount: finalThreat,
  });

  return {
    state,
    result: {
      initialAmount: amount,
      threatPlaced: finalThreat,
      preventedAmount,
      targetSchemeName,
      currentThreat,
      targetThreat,
      stageCompleted,
      onomatopoeia,
    },
  };
}

/**
 * Keeps the villain phase step event in line with a placement that finished after its prompts
 * (as `finishAttackDamageAndPostResolution` does for damage).
 */
function syncVillainPhaseStepEvent(
  state: GameState,
  request: ThreatPlacementRequest,
  result: ThreatPlacementResult,
): void {
  const event = state.villainPhaseStepEvent;
  if (!event) return;
  const placed = result.threatPlaced;
  const isScheme =
    (request.sourceType === 'VILLAIN_SCHEME' && event.type === 'VILLAIN_SCHEME') ||
    (request.sourceType === 'MINION_SCHEME' && event.type === 'MINION_SCHEME');
  if (isScheme && event.targetPlayerId === request.sourcePlayerId) {
    event.amount = placed;
    event.description = `${event.sourceName} schemed against ${event.targetName} (+${placed} threat).`;
  } else if (request.sourceType === 'VILLAIN_PHASE_STEP_1' && event.type === 'THREAT_PLACED') {
    event.amount = placed;
    event.description = `${placed} threat placed on ${result.targetSchemeName}.`;
  }
}

/**
 * Places every paused threat placement with its live amount, in order (#266). Called once all the
 * interrupt prompts of the window are answered.
 */
export function finishPendingThreatPlacements(state: GameState): GameState {
  const pending = state.pendingThreatPlacements ?? [];
  delete state.pendingThreatPlacements;
  let current = state;
  for (const placement of pending) {
    const placed = placeThreat(current, placement.request, placement.amount);
    current = placed.state;
    syncVillainPhaseStepEvent(current, placement.request, placed.result);
  }
  return current;
}

export interface SchemeThreatRemoval {
  playerId: string;
  /** Resolved from `targetInstanceId` when omitted: the main scheme's id aliases, else a side scheme. */
  targetType?: ThreatTargetType;
  targetInstanceId?: string;
  amount: number;
  /** Card or character responsible, shown in the combat log. */
  sourceName: string;
}

export interface SchemeThreatRemovalResult {
  removed: number;
  targetSchemeName: string;
  remainingThreat: number;
  schemeDefeated: boolean;
  onomatopoeia: string;
}

/**
 * The one place threat leaves a scheme (RR v1.8 "Threat"): removes up to `amount`, writes the
 * `card.effect.removeThreat` entry (actor, source, target, amount actually removed, threat left,
 * also for 0), defeats a side scheme that reaches 0 and announces the "reduced to zero" trigger.
 * Callers decide whether the removal is allowed (Crisis, Patrol, Confused) before calling it.
 */
export function removeThreatFromScheme(
  state: GameState,
  request: SchemeThreatRemoval,
): SchemeThreatRemovalResult {
  const { playerId, targetInstanceId, sourceName } = request;
  const player = state.players.find((p) => p.id === playerId) || state.players[0];
  const amount = Math.max(0, request.amount);
  const mainScheme = getActiveMainScheme(state);
  const targetType: ThreatTargetType =
    request.targetType ??
    (targetInstanceId === 'main_scheme' ||
    targetInstanceId === mainScheme?.instanceId ||
    targetInstanceId === mainScheme?.card?.code
      ? 'main_scheme'
      : 'side_scheme');

  const scheme: { threat: number; card?: { name?: string }; instanceId?: string } | undefined =
    targetType === 'main_scheme'
      ? mainScheme
      : state.sideSchemes.find(
          (s) => s.instanceId === targetInstanceId || s.card.code === targetInstanceId,
        );
  if (!scheme) {
    return {
      removed: 0,
      targetSchemeName: 'Side Scheme',
      remainingThreat: 0,
      schemeDefeated: false,
      onomatopoeia: 'THWARTED!',
    };
  }

  const isMain = targetType === 'main_scheme';
  const targetSchemeName = scheme.card?.name || (isMain ? 'Main Scheme' : 'Side Scheme');
  const currentThreat = scheme.threat || 0;
  const removed = Math.min(currentThreat, amount);
  scheme.threat = currentThreat - removed;
  const remainingThreat = scheme.threat;
  const schemeDefeated = !isMain && remainingThreat <= 0;
  const onomatopoeia = isMain ? 'FOILED!' : schemeDefeated ? 'SCHEME DEFEATED!' : 'THWARTED!';

  appendLog(state, {
    key: 'card.effect.removeThreat',
    params: {
      actor: player.name,
      source: sourceName,
      target: targetSchemeName,
      amount: removed,
      remainingThreat,
    },
    onomatopoeia,
  });

  if (schemeDefeated) {
    defeatSideScheme(state, scheme.instanceId!, player.id);
    appendLog(state, {
      key: 'side_scheme.defeated',
      params: { actor: player.name, target: targetSchemeName, amount: removed, remainingThreat },
      onomatopoeia,
    });
  }

  if (remainingThreat === 0 && removed > 0) {
    kernel.dispatchTrigger(state, 'SCHEME_THREAT_REDUCED_TO_ZERO', {
      targetPlayerId: player.id,
      sourceInstanceId: scheme.instanceId || 'main_scheme',
      entityType: 'SCHEME',
      threatAmount: removed,
    });
  }

  return { removed, targetSchemeName, remainingThreat, schemeDefeated, onomatopoeia };
}

/**
 * Why cards cannot remove threat from the main scheme right now: a Crisis icon in play, or an
 * engaged minion with Patrol (RR v1.8 "Crisis Icon", "Patrol").
 */
function getMainSchemeBlock(
  state: GameState,
  player: PlayerState,
  request: ThwartRequest,
):
  | {
      key: 'card.effect.threatBlockedByCrisis' | 'card.effect.threatBlockedByPatrol';
      onomatopoeia: string;
    }
  | undefined {
  if (!request.ignoresCrisis && hasCrisisInPlay(state)) {
    return { key: 'card.effect.threatBlockedByCrisis', onomatopoeia: 'CRISIS BLOCKS!' };
  }
  if (
    !request.ignoresPatrol &&
    player.engagedMinions.some((m) => hasKeyword(m.card, Keyword.PATROL))
  ) {
    return { key: 'card.effect.threatBlockedByPatrol', onomatopoeia: 'PATROL BLOCKS!' };
  }
  return undefined;
}

/**
 * Universal RR v1.8 Thwart & Threat Removal Pipeline.
 * Single source of truth for all thwarting and threat reduction across MCD.
 */
export function applyThwart(
  state: GameState,
  request: ThwartRequest,
): { state: GameState; result: ThwartResult } {
  const { thwarterType, thwarterEntity, playerId, targetType, targetInstanceId, thwartValue } =
    request;

  const player = state.players.find((p) => p.id === playerId) || state.players[0];
  const thwarterName =
    thwarterType === 'HERO'
      ? (thwarterEntity as PlayerState | undefined)?.activeFormCard?.name ||
        (thwarterEntity as PlayerState | undefined)?.name ||
        player.name
      : (thwarterEntity as CardInstance | undefined)?.card?.name ||
        (thwarterType === 'CARD_EFFECT' ? 'Game Effect' : 'Character');

  // ---------------------------------------------------------------------------
  // STEP 1: Confused Status Replacement Check (RR v1.8 p. 28)
  // ---------------------------------------------------------------------------
  if (thwarterEntity && consumeEntityStatusCards(thwarterEntity, StatusCard.CONFUSED)) {
    const onomatopoeia = 'CONFUSION CLEARED!';
    appendLog(state, {
      key: 'status.confused.cleared',
      params: { actor: thwarterName },
      onomatopoeia,
    });

    return {
      state,
      result: {
        thwartAttempted: true,
        confusedCleared: true,
        threatRemoved: 0,
        targetSchemeName: '',
        remainingThreat: 0,
        schemeDefeated: false,
        onomatopoeia,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // STEP 2: Crisis Icon and Patrol Check (RR v1.8 p. 11, 20)
  // ---------------------------------------------------------------------------
  const mainSchemeBlock =
    targetType === 'main_scheme' && getMainSchemeBlock(state, player, request);
  if (mainSchemeBlock) {
    const { onomatopoeia } = mainSchemeBlock;
    appendLog(state, {
      category: 'ability',
      key: mainSchemeBlock.key,
      params: {
        actor: player.name,
        source: request.sourceName ?? thwarterName,
        target: getActiveMainScheme(state)?.card?.name || 'Main Scheme',
      },
      onomatopoeia,
    });

    return {
      state,
      result: {
        thwartAttempted: false,
        confusedCleared: false,
        threatRemoved: 0,
        targetSchemeName: getActiveMainScheme(state)?.card?.name || 'Main Scheme',
        remainingThreat: getActiveMainScheme(state)?.threat || 0,
        schemeDefeated: false,
        onomatopoeia,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Threat Removal, side scheme defeat at 0 and the "reduced to zero" trigger
  // ---------------------------------------------------------------------------
  const { removed, targetSchemeName, remainingThreat, schemeDefeated, onomatopoeia } =
    removeThreatFromScheme(state, {
      playerId,
      targetType,
      targetInstanceId,
      amount: thwartValue,
      sourceName: request.sourceName ?? thwarterName,
    });

  // ---------------------------------------------------------------------------
  // STEP 4: Post-Thwart Triggers
  // ---------------------------------------------------------------------------

  const sourceInstId =
    thwarterType === 'ALLY'
      ? (thwarterEntity as CardInstance)?.instanceId
      : thwarterType === 'HERO'
        ? playerId
        : undefined;

  const sourceCardCd =
    thwarterType === 'ALLY'
      ? (thwarterEntity as CardInstance)?.card?.code
      : thwarterType === 'HERO'
        ? (thwarterEntity as PlayerState)?.activeFormCard?.code
        : undefined;

  if (!request.suppressTrigger) {
    kernel.dispatchTrigger(state, 'THWART_RESOLVED', {
      targetPlayerId: player.id,
      targetType,
      targetInstanceId,
      threatAmount: removed,
      sourceInstanceId: sourceInstId,
      sourceCardCode: sourceCardCd,
    });
  }

  return {
    state,
    result: {
      thwartAttempted: true,
      confusedCleared: false,
      threatRemoved: removed,
      targetSchemeName,
      remainingThreat,
      schemeDefeated,
      onomatopoeia,
    },
  };
}

bindKernel({ finishPendingThreatPlacements });
