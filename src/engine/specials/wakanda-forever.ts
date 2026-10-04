import { GameState, CardInstance } from '../models';
import { EffectExecutionContext, EffectResult, executeSequence } from '../effects';
import { SpecialAbilityHandler, registerSpecialHandler } from './special-registry';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';
import { cardCatalog } from '../../data/importer/card-loader';

export const BLACK_PANTHER_UPGRADE_CODES = ['01046', '01047', '01048', '01049'];

/**
 * Returns all in-play Black Panther upgrades controlled by the specified player in their tableau (ADR-0038).
 */
export function getPlayerBlackPantherUpgrades(playerState: {
  tableau: CardInstance[];
}): CardInstance[] {
  return (playerState.tableau || []).filter(
    (t) =>
      t.card.traits?.includes('Black Panther') ||
      BLACK_PANTHER_UPGRADE_CODES.includes(t.card.code) ||
      t.card.enrichment?.abilities?.some((a) => a.timing === 'SPECIAL'),
  );
}

/**
 * Resolves a single Black Panther upgrade Special ability (ADR-0038 / RR v1.8 p. 28).
 */
export function resolveSingleWakandaUpgrade(
  state: GameState,
  upgrade: CardInstance,
  playerId: string,
  isFinalStep: boolean,
  targetEnemyId?: string,
  targetSchemeId?: string,
): void {
  const player = state.players.find((p) => p.id === playerId) || state.players[0];

  const specialAbility =
    upgrade.card.enrichment?.abilities?.find((a) => a.timing === 'SPECIAL') ||
    cardCatalog
      .getCard(upgrade.card.code)
      ?.enrichment?.abilities?.find((a) => a.timing === 'SPECIAL');
  if (specialAbility && specialAbility.steps?.length) {
    executeSequence(state, specialAbility.steps, {
      playerId: player.id,
      sourceCardInstance: upgrade,
      targetInstanceId: targetEnemyId || targetSchemeId,
      isFinalStep,
    });
    return;
  }
}

/**
 * Resolves the pending Wakanda Forever! upgrades one at a time, in the chosen order. When a step
 * opens a decision prompt (e.g. Energy Daggers choosing a player) and more steps remain, the
 * sequence pauses with the rest saved in `state.pendingSpecialSequence`; `resume` continues it once
 * the prompt is answered (#207). The finisher flag is fixed by list position (the last step).
 */
function runWakandaSequence(state: GameState): { resolved: number; paused: boolean } {
  const pending = state.pendingSpecialSequence;
  if (!pending) return { resolved: 0, paused: false };
  const player = state.players.find((p) => p.id === pending.playerId) || state.players[0];
  let resolved = 0;

  while (pending.remainingUpgradeIds.length > 0) {
    const upgradeId = pending.remainingUpgradeIds.shift()!;
    const isFinal = pending.remainingUpgradeIds.length === 0;
    const upgrade = player.tableau.find((t) => t.instanceId === upgradeId);
    if (!upgrade) continue;

    const promptsBefore = state.pendingDecisionQueue?.length ?? 0;
    resolveSingleWakandaUpgrade(
      state,
      upgrade,
      player.id,
      isFinal,
      pending.targetEnemyId,
      pending.targetSchemeId,
    );
    resolved++;

    const opensPrompt = (state.pendingDecisionQueue?.length ?? 0) > promptsBefore;
    if (opensPrompt && pending.remainingUpgradeIds.length > 0) {
      return { resolved, paused: true };
    }
  }

  delete state.pendingSpecialSequence;
  return { resolved, paused: false };
}

export const wakandaForeverSpecialHandler: SpecialAbilityHandler = {
  id: 'WAKANDA_FOREVER',
  validatePlayCondition: (state: GameState, context: EffectExecutionContext): boolean => {
    const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
    const upgrades = getPlayerBlackPantherUpgrades(player);
    return upgrades.length > 0;
  },
  resume: (state: GameState): EffectResult => {
    const { resolved, paused } = runWakandaSequence(state);
    return {
      state,
      success: true,
      mutatedState: resolved > 0,
      value: resolved,
      onomatopoeia: paused ? 'SELECT WAKANDA TARGET ➔' : '⚡ WAKANDA FOREVER! ⚡',
    };
  },
  execute: (state: GameState, context: EffectExecutionContext, payload?: any): EffectResult => {
    const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
    const availableUpgrades = getPlayerBlackPantherUpgrades(player);

    if (availableUpgrades.length === 0) {
      return {
        state,
        success: false,
        error: 'No Black Panther upgrades in play to resolve Wakanda Forever!',
      };
    }

    const startSequence = (upgrades: CardInstance[]) => {
      state.pendingSpecialSequence = {
        specialId: 'WAKANDA_FOREVER',
        playerId: player.id,
        remainingUpgradeIds: upgrades.map((u) => u.instanceId),
        targetEnemyId: payload?.targetEnemyId,
        targetSchemeId: payload?.targetSchemeId,
      };
      return runWakandaSequence(state);
    };

    // 1. Single upgrade in play: Immediately resolves with Finisher bonus
    if (availableUpgrades.length === 1) {
      startSequence(availableUpgrades);
      return {
        state,
        success: true,
        mutatedState: true,
        value: 1,
        onomatopoeia: '⚡ WAKANDA FOREVER! ⚡',
      };
    }

    // 2. Explicit sequence order supplied (e.g. from Drag & Drop Modal or test)
    if (payload?.sequenceOrder && Array.isArray(payload.sequenceOrder)) {
      const orderedIds: string[] = payload.sequenceOrder;
      const orderedUpgrades: CardInstance[] = [];

      for (const id of orderedIds) {
        const upg = availableUpgrades.find((u) => u.instanceId === id || u.card.code === id);
        if (upg && !orderedUpgrades.includes(upg)) {
          orderedUpgrades.push(upg);
        }
      }
      for (const upg of availableUpgrades) {
        if (!orderedUpgrades.includes(upg)) {
          orderedUpgrades.push(upg);
        }
      }

      const { resolved, paused } = startSequence(orderedUpgrades);

      return {
        state,
        success: true,
        mutatedState: true,
        value: resolved,
        onomatopoeia: paused
          ? 'SELECT WAKANDA TARGET ➔'
          : `⚡ WAKANDA FOREVER! (${orderedUpgrades.length} UPGRADES RESOLVED) ⚡`,
      };
    }

    // 3. Multiple upgrades in play & no sequence order yet: Enqueue Interactive Decision Prompt (ADR-0038 / ADR-0032)
    enqueueDecisionPrompt(state, {
      promptId: `prompt_wf_${Date.now()}`,
      playerId: player.id,
      title: 'Wakanda Forever! Sequence Order',
      description:
        'Select the resolution order for your Black Panther upgrades. The last upgrade gets its boosted Finisher bonus!',
      sourceCardName: 'Wakanda Forever!',
      options: availableUpgrades.map((u) => ({
        id: u.instanceId,
        label: u.card.name,
        description: u.card.text || 'Black Panther Upgrade Special',
        effect: 'SELECT_WAKANDA_UPGRADE',
      })),
      isVoluntary: false,
    });

    return {
      state,
      success: true,
      mutatedState: true,
      value: 0,
      onomatopoeia: 'SELECT WAKANDA SEQUENCE ➔',
    };
  },
};

// Register default handler
registerSpecialHandler(wakandaForeverSpecialHandler);
