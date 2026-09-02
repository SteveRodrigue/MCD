import { GameState, CardInstance } from '../models';
import { EffectExecutionContext, EffectResult } from '../effects';
import { SpecialAbilityHandler, registerSpecialHandler } from './special-registry';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';
import { getEffectiveMaxHealth } from '../pipeline/stat-calculator';

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
  const code = upgrade.card.code;

  if (code === '01046') {
    // 1. Energy Daggers: 1 damage to villain + engaged minions (2 if final)
    const dmg = isFinalStep ? 2 : 1;
    // Villain damage
    state.villain.health = Math.max(0, state.villain.health - dmg);
    // Engaged minions damage
    for (const minion of player.engagedMinions || []) {
      const curDmg = minion.tokens?.damage || 0;
      minion.tokens = { ...minion.tokens, damage: curDmg + dmg };
    }
    state.log.push({
      id: `log_${Date.now()}_${code}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'ability',
      key: 'special.energy_daggers',
      params: { player: player.name, amount: dmg, isFinal: isFinalStep },
      onomatopoeia: isFinalStep
        ? 'ENERGY DAGGERS FINISHER! (2 DMG AOE)'
        : 'ENERGY DAGGERS! (1 DMG AOE)',
    });
  } else if (code === '01047') {
    // 2. Panther Claws: 2 damage to enemy (4 if final)
    const dmg = isFinalStep ? 4 : 2;
    if (targetEnemyId && targetEnemyId !== 'villain') {
      let targetMinion: CardInstance | undefined;
      for (const p of state.players) {
        targetMinion = p.engagedMinions.find((m) => m.instanceId === targetEnemyId);
        if (targetMinion) break;
      }
      if (targetMinion) {
        const curDmg = targetMinion.tokens?.damage || 0;
        targetMinion.tokens = { ...targetMinion.tokens, damage: curDmg + dmg };
      } else {
        state.villain.health = Math.max(0, state.villain.health - dmg);
      }
    } else {
      state.villain.health = Math.max(0, state.villain.health - dmg);
    }
    state.log.push({
      id: `log_${Date.now()}_${code}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'combat',
      key: 'special.panther_claws',
      params: { player: player.name, amount: dmg, isFinal: isFinalStep },
      onomatopoeia: isFinalStep ? 'PANTHER CLAWS FINISHER! (4 DMG)' : 'PANTHER CLAWS! (2 DMG)',
    });
  } else if (code === '01048') {
    // 3. Tactical Genius: 1 threat removed from scheme (2 if final)
    const thw = isFinalStep ? 2 : 1;
    if (targetSchemeId && targetSchemeId !== 'main_scheme') {
      const sideScheme = state.sideSchemes.find((s) => s.instanceId === targetSchemeId);
      if (sideScheme) {
        sideScheme.threat = Math.max(0, sideScheme.threat - thw);
      } else {
        state.mainScheme.threat = Math.max(0, state.mainScheme.threat - thw);
      }
    } else {
      state.mainScheme.threat = Math.max(0, state.mainScheme.threat - thw);
    }
    state.log.push({
      id: `log_${Date.now()}_${code}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'scheme',
      key: 'special.tactical_genius',
      params: { player: player.name, amount: thw, isFinal: isFinalStep },
      onomatopoeia: isFinalStep
        ? 'TACTICAL GENIUS FINISHER! (2 THREAT)'
        : 'TACTICAL GENIUS! (1 THREAT)',
    });
  } else if (code === '01049') {
    // 4. Panther Suit: Move 1 damage from identity to enemy (2 if final)
    const moveAmt = isFinalStep ? 2 : 1;
    const maxHp = getEffectiveMaxHealth(player, state);
    player.health = Math.min(maxHp, player.health + moveAmt);
    state.villain.health = Math.max(0, state.villain.health - moveAmt);
    state.log.push({
      id: `log_${Date.now()}_${code}`,
      timestamp: Date.now(),
      round: state.roundNumber,
      phase: state.phase,
      category: 'ability',
      key: 'special.panther_suit',
      params: { player: player.name, amount: moveAmt, isFinal: isFinalStep },
      onomatopoeia: isFinalStep
        ? 'PANTHER SUIT FINISHER! (MOVE 2 DMG)'
        : 'PANTHER SUIT! (MOVE 1 DMG)',
    });
  }
}

export const wakandaForeverSpecialHandler: SpecialAbilityHandler = {
  id: 'WAKANDA_FOREVER',
  validatePlayCondition: (state: GameState, context: EffectExecutionContext): boolean => {
    const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
    const upgrades = getPlayerBlackPantherUpgrades(player);
    return upgrades.length > 0;
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

    // 1. Single upgrade in play: Immediately resolves with Finisher bonus
    if (availableUpgrades.length === 1) {
      resolveSingleWakandaUpgrade(
        state,
        availableUpgrades[0],
        player.id,
        true,
        payload?.targetEnemyId,
        payload?.targetSchemeId,
      );
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

      for (let i = 0; i < orderedUpgrades.length; i++) {
        const upgrade = orderedUpgrades[i];
        const isFinal = i === orderedUpgrades.length - 1;
        resolveSingleWakandaUpgrade(
          state,
          upgrade,
          player.id,
          isFinal,
          payload.targetEnemyId,
          payload.targetSchemeId,
        );
      }

      const onomatopoeia = `⚡ WAKANDA FOREVER! (${orderedUpgrades.length} UPGRADES RESOLVED) ⚡`;
      return {
        state,
        success: true,
        mutatedState: true,
        value: orderedUpgrades.length,
        onomatopoeia,
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
