import { CardType, Keyword, getKeywordValue } from '../../models';
import { getPlayer } from '../legality-checker';
import { expireLastingEffects } from '../player-phase';
import { initiatePlayerPhaseCleanup } from '../player-phase-cleanup';
import { peekDecisionPrompt } from '../prompt-queue';
import { advanceVillainPhaseStep, executeMinionAttackAgainstPlayer } from '../villain-phase';
import { hasEntityKeyword } from '../stat-calculator';
import { applyThreatPlacement } from '../threat-pipeline';
import { appendLog } from '../../state/game-log';
import type { ActionHandler } from './types';

export const handleEndPlayerTurn: ActionHandler<'END_PLAYER_TURN'> = (nextState, state, action) => {
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

  appendLog(nextState, {
    category: 'phase',
    actor: {
      name: characterName,
      type: currentPlayer.currentForm || 'hero',
    },
    key: 'player.turn.ended',
    params: {
      actor: characterName,
    },
    onomatopoeia: 'PASS',
  });

  // Effects lasting until the end of the turn end (RR v1.8 Lasting Effects)
  expireLastingEffects([currentPlayer], ['TURN']);

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
};

export const handleAdvanceVillainPhase: ActionHandler<'ADVANCE_VILLAIN_PHASE'> = (
  nextState,
  state,
  _action,
) => {
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
};

export const handleMinionEngagesPlayer: ActionHandler<'MINION_ENGAGES_PLAYER'> = (
  nextState,
  state,
  action,
) => {
  const player = getPlayer(nextState, action.playerId);
  if (!player) return { state, result: { success: false, error: 'Player not found' } };

  const minionInst = action.minionInstance;
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
};

export const handleRevealEncounterCard: ActionHandler<'REVEAL_ENCOUNTER_CARD'> = (
  nextState,
  state,
  action,
) => {
  const targetPlayer =
    getPlayer(nextState, action.targetPlayerId || action.playerId || '') || nextState.players[0];
  const encounterCard = action.encounterCard;
  if (!encounterCard)
    return { state, result: { success: false, error: 'Encounter card required' } };

  // Incite X Keyword check (RR v1.8 p. 16, ADR-0019)
  const inciteAmount =
    (encounterCard.card.enrichment as { incite?: number } | undefined)?.incite ||
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
};

export const PHASE_HANDLERS = {
  END_PLAYER_TURN: handleEndPlayerTurn,
  ADVANCE_VILLAIN_PHASE: handleAdvanceVillainPhase,
  MINION_ENGAGES_PLAYER: handleMinionEngagesPlayer,
  REVEAL_ENCOUNTER_CARD: handleRevealEncounterCard,
};
