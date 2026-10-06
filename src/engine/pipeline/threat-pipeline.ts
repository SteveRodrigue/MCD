import {
  GameState,
  PlayerState,
  StatusCard,
  CardInstance,
  SideSchemeState,
  getActiveMainScheme,
} from '@engine/models';
import { consumeEntityStatusCards } from './stat-calculator';
import { hasCrisisInPlay } from './legality-checker';
import { handleMainSchemeCompletion } from './scenario-helpers';
import { defeatSideScheme } from '../effects';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';

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
  const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
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
      const id = `threat_placement_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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
      state.log.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'villainPhase.step1.threatPlaced',
        params: {
          amount: finalThreat,
          scheme: targetSchemeName,
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
      state.log.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: sourceType === 'MINION_SCHEME' ? 'minion.scheme.threat' : 'villain.scheme.threat',
        params: {
          who: sourceEntityName || 'Enemy',
          villain: sourceEntityName || 'Enemy',
          player: targetPlayer?.name || 'Player',
          threat: finalThreat,
          amount: finalThreat,
          boost: boostIcons || 0,
          scheme: targetSchemeName,
        },
        onomatopoeia,
      });
    } else {
      onomatopoeia = `+${finalThreat} THREAT!`;
      state.log.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'scheme.threat.added',
        params: {
          scheme: targetSchemeName,
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
      state.log.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'scheme.threat.added',
        params: {
          scheme: targetSchemeName,
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
  dispatchTrigger(state, 'THREAT_PLACED', {
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

/**
 * Universal RR v1.8 Thwart & Threat Removal Pipeline.
 * Single source of truth for all thwarting and threat reduction across MCD.
 */
export function applyThwart(
  state: GameState,
  request: ThwartRequest,
): { state: GameState; result: ThwartResult } {
  const {
    thwarterType,
    thwarterEntity,
    playerId,
    targetType,
    targetInstanceId,
    thwartValue,
    ignoresCrisis,
  } = request;

  const player = state.players.find((p) => p.id === playerId) || state.players[0];

  // ---------------------------------------------------------------------------
  // STEP 1: Confused Status Replacement Check (RR v1.8 p. 28)
  // ---------------------------------------------------------------------------
  if (thwarterEntity && consumeEntityStatusCards(thwarterEntity, StatusCard.CONFUSED)) {
    const thwarterName =
      thwarterType === 'HERO'
        ? (thwarterEntity as PlayerState).activeFormCard?.name ||
          (thwarterEntity as PlayerState).name
        : (thwarterEntity as CardInstance).card?.name || 'Character';

    const onomatopoeia = 'CONFUSION CLEARED!';
    state.log.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      key: 'status.confused.cleared',
      params: { player: thwarterName },
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
  // STEP 2: Crisis Icon Check (RR v1.8 p. 11)
  // ---------------------------------------------------------------------------
  if (targetType === 'main_scheme' && !ignoresCrisis && hasCrisisInPlay(state)) {
    const onomatopoeia = 'CRISIS BLOCKS!';
    state.log.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'ability',
      key: 'card.effect.threatBlockedByCrisis',
      params: {
        player: player.name,
        scheme: getActiveMainScheme(state)?.card?.name || 'Main Scheme',
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

  let removed = 0;
  let targetSchemeName = 'Main Scheme';
  let remainingThreat = 0;
  let schemeDefeated = false;
  let onomatopoeia = 'FOILED!';

  // ---------------------------------------------------------------------------
  // STEP 3: Threat Removal Application
  // ---------------------------------------------------------------------------
  if (targetType === 'main_scheme') {
    const mainScheme = getActiveMainScheme(state);
    targetSchemeName = mainScheme?.card?.name || 'Main Scheme';
    removed = Math.min(mainScheme.threat, Math.max(0, thwartValue));
    mainScheme.threat -= removed;
    remainingThreat = mainScheme.threat;

    onomatopoeia = 'FOILED!';
    state.log.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      key: 'player.action.thwartMainScheme',
      params: {
        player: player.name,
        removed,
        remainingThreat,
      },
      onomatopoeia,
    });
  } else if (targetType === 'side_scheme' && targetInstanceId) {
    const schemeIndex = state.sideSchemes.findIndex(
      (s) => s.instanceId === targetInstanceId || s.card.code === targetInstanceId,
    );

    if (schemeIndex !== -1) {
      const sideScheme = state.sideSchemes[schemeIndex];
      targetSchemeName = sideScheme.card?.name || 'Side Scheme';
      removed = Math.min(sideScheme.threat, Math.max(0, thwartValue));
      sideScheme.threat -= removed;
      remainingThreat = sideScheme.threat;

      // ---------------------------------------------------------------------------
      // STEP 4: Side Scheme Defeat when threat reaches 0
      // ---------------------------------------------------------------------------
      if (sideScheme.threat <= 0) {
        schemeDefeated = true;
        defeatSideScheme(state, sideScheme.instanceId, player.id);
        onomatopoeia = 'SCHEME DEFEATED!';
      } else {
        onomatopoeia = 'THWARTED!';
      }

      state.log.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: schemeDefeated ? 'side_scheme.defeated' : 'player.action.thwartSideScheme',
        params: {
          player: player.name,
          scheme: targetSchemeName,
          removed,
          remainingThreat,
        },
        onomatopoeia,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Post-Thwart Triggers
  // ---------------------------------------------------------------------------
  if (remainingThreat === 0 && removed > 0) {
    dispatchTrigger(state, 'SCHEME_THREAT_REDUCED_TO_ZERO' as any, {
      targetPlayerId: player.id,
      sourceInstanceId:
        targetType === 'main_scheme'
          ? getActiveMainScheme(state)?.instanceId || 'main_scheme'
          : targetInstanceId,
      entityType: 'SCHEME',
      threatAmount: removed,
    });
  }

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

  dispatchTrigger(state, 'THWART_RESOLVED', {
    targetPlayerId: player.id,
    targetType,
    targetInstanceId,
    threatAmount: removed,
    sourceInstanceId: sourceInstId,
    sourceCardCode: sourceCardCd,
  });

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
