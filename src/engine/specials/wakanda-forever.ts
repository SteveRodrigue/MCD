import { GameState, CardInstance, AbilityStep, CardAbility } from '../models';
import { EffectExecutionContext, EffectResult, executeSequence } from '../effects';
import { SpecialAbilityHandler, registerSpecialHandler } from './special-registry';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';
import { nextEngineId } from '../state/rng';
import { cardCatalog } from '../../data/importer/card-loader';

const BLACK_PANTHER_UPGRADE_CODES = ['01046', '01047', '01048', '01049'];

/**
 * Returns all in-play Black Panther upgrades controlled by the specified player in their tableau (ADR-0038).
 */
function getPlayerBlackPantherUpgrades(playerState: { tableau: CardInstance[] }): CardInstance[] {
  return (playerState.tableau || []).filter(
    (t) =>
      t.card.traits?.includes('Black Panther') ||
      BLACK_PANTHER_UPGRADE_CODES.includes(t.card.code) ||
      t.card.enrichment?.abilities?.some((a) => a.timing === 'SPECIAL'),
  );
}

/** The upgrade's Special ability, from the instance enrichment or the catalog copy of the card. */
function getSpecialAbility(upgrade: CardInstance): CardAbility | undefined {
  return (
    upgrade.card.enrichment?.abilities?.find((a) => a.timing === 'SPECIAL') ||
    cardCatalog
      .getCard(upgrade.card.code)
      ?.enrichment?.abilities?.find((a) => a.timing === 'SPECIAL')
  );
}

const wakandaForeverSpecialHandler: SpecialAbilityHandler = {
  id: 'WAKANDA_FOREVER',
  validatePlayCondition: (state: GameState, context: EffectExecutionContext): boolean => {
    const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
    const upgrades = getPlayerBlackPantherUpgrades(player);
    return upgrades.length > 0;
  },
  execute: (
    state: GameState,
    context: EffectExecutionContext,
    payload?: Record<string, unknown>,
  ): EffectResult => {
    const player = state.players.find((p) => p.id === context.playerId) || state.players[0];
    const availableUpgrades = getPlayerBlackPantherUpgrades(player);

    if (availableUpgrades.length === 0) {
      return {
        state,
        success: false,
        error: 'No Black Panther upgrades in play to resolve Wakanda Forever!',
      };
    }

    const startSequence = (upgrades: CardInstance[]): EffectResult => {
      const allSteps: AbilityStep[] = [];
      for (let i = 0; i < upgrades.length; i++) {
        const upg = upgrades[i];
        const isFinal = i === upgrades.length - 1;
        const special = getSpecialAbility(upg);
        if (special?.steps) {
          for (const step of special.steps) {
            allSteps.push({
              ...step,
              sourceCardInstance: upg,
              isFinalStep: isFinal,
            } as unknown as AbilityStep);
          }
        }
      }
      const seqRes = executeSequence(state, allSteps, {
        playerId: player.id,
        chosenTargetInstanceId:
          (payload?.targetEnemyId as string | undefined) ||
          (payload?.targetSchemeId as string | undefined),
      });
      return {
        ...seqRes,
        value: upgrades.length,
      };
    };

    // 1. Single upgrade in play: Immediately resolves with Finisher bonus
    if (availableUpgrades.length === 1) {
      return startSequence(availableUpgrades);
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

      return startSequence(orderedUpgrades);
    }

    // 3. Multiple upgrades in play & no sequence order yet: Enqueue Interactive Decision Prompt (ADR-0038 / ADR-0032)
    enqueueDecisionPrompt(state, {
      promptId: `prompt_wf_${nextEngineId(state, 'id')}`,
      playerId: player.id,
      title: 'Wakanda Forever! Sequence Order',
      description:
        'Select the resolution order for your Black Panther upgrades. The last upgrade gets its boosted Finisher bonus!',
      sourceCardName: 'Wakanda Forever!',
      options: availableUpgrades.map((u) => {
        // The first Special step carries the amount and its finisher bonus, read from the card data.
        const step = getSpecialAbility(u)?.steps?.[0];
        const amount = step?.effectParams?.amount;
        const finisherBonus = step?.effectParams?.finisherBonus;
        return {
          id: u.instanceId,
          cardCode: u.card.code,
          label: u.card.name,
          description: u.card.text || 'Black Panther Upgrade Special',
          effect: 'SELECT_WAKANDA_UPGRADE',
          params:
            step && typeof amount === 'number'
              ? {
                  specialEffect: step.effect,
                  amount,
                  finisherAmount: amount + (typeof finisherBonus === 'number' ? finisherBonus : 0),
                }
              : undefined,
        };
      }),
      isVoluntary: false,
    });

    return {
      state,
      success: true,
      mutatedState: true,
      value: 0,
      onomatopoeia: 'SELECT WAKANDA SEQUENCE âž”',
    };
  },
};

// Register default handler
registerSpecialHandler(wakandaForeverSpecialHandler);
