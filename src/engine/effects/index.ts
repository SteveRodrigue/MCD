import {
  GameState,
  CardInstance,
  StatusCard,
  MinionCard,
  CardAbility,
  AbilityStep,
  CardType,
  SideSchemeCard,
  ConditionGate,
  StepResolutionResult,
} from '@engine/models';
import { handleVillainDefeat } from '../pipeline/scenario-helpers';
import {
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
} from '../pipeline/villain-phase';
import { drawEncounterCard, drawPlayerCard } from '../pipeline/deck-exhaustion';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';
import { resolveDefenderDeclaration } from '../pipeline/combat-pipeline';
import { getEffectiveHeroStats, getEffectiveMaxHealth } from '../pipeline/stat-calculator';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';

export interface EffectExecutionContext {
  playerId: string;
  sourceCardInstance?: CardInstance;
  targetType?: 'villain' | 'minion' | 'main_scheme' | 'side_scheme' | 'ally' | 'hero' | 'character';
  targetInstanceId?: string;
  resourcesSpent?: string[];
  previousResult?: StepResolutionResult;
  collectedCardInstanceIds?: string[];
  threatAmount?: number;
  damageAmount?: number;
  choice?: string;
}

export interface EffectResult {
  state: GameState;
  success: boolean;
  error?: string;
  onomatopoeia?: string;
  mutatedState?: boolean;
  value?: number;
  selectedCardInstanceIds?: string[];
  targetId?: string;
  conditionMet?: boolean;
}

/**
 * Evaluates whether a sequential step gate condition is satisfied (RR v1.8 p. 2, 24).
 */
export function shouldExecuteStep(
  gate: ConditionGate | undefined,
  prevResult: StepResolutionResult | undefined,
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
  stepResultsMap?: Map<string, StepResolutionResult>,
): boolean {
  if (!gate || gate === 'ALWAYS') return true;

  const targetStepId = step.params?.targetStepId as string | undefined;
  const evaluatedResult =
    targetStepId && stepResultsMap?.has(targetStepId)
      ? stepResultsMap.get(targetStepId)
      : prevResult;

  if (gate === 'THEN' || gate === 'IF_PREVIOUS_SUCCESS') {
    return !!evaluatedResult && evaluatedResult.success && evaluatedResult.mutatedState;
  }

  if (gate === 'IF_AMOUNT_ZERO' || gate === 'IF_ZERO_HEALED') {
    return !!evaluatedResult && (!evaluatedResult.mutatedState || (evaluatedResult.value ?? 0) === 0);
  }

  if (gate === 'IF_FAILED') {
    if (targetStepId && stepResultsMap?.has(targetStepId)) {
      const targetRes = stepResultsMap.get(targetStepId);
      return !targetRes || !targetRes.success || !targetRes.mutatedState;
    }
    return !evaluatedResult || !evaluatedResult.success || !evaluatedResult.mutatedState;
  }

  if (gate === 'IF_ALREADY_HAS_STATUS') {
    if (evaluatedResult && evaluatedResult.conditionMet !== undefined) {
      return evaluatedResult.conditionMet;
    }
    const statusParam = (step.params?.status as StatusCard) || StatusCard.TOUGH;
    const targetParam = (step.params?.target as string) || 'VILLAIN';
    if (targetParam === 'VILLAIN') {
      return state.villain.statusCards.includes(statusParam as StatusCard);
    }
    return false;
  }

  if (gate === 'IF_RESOURCE_MATCH') {
    const reqAspect = (step.params?.aspect as string) || (step.params?.resource as string);
    return !!context.resourcesSpent?.includes(reqAspect);
  }

  return true;
}

/**
 * Executes a declarative sequence of sub-action steps.
 */
export function executeSequence(
  state: GameState,
  steps: AbilityStep[],
  context: EffectExecutionContext,
): EffectResult {
  let currentState = state;
  let prevResult: StepResolutionResult | undefined = context.previousResult;
  const stepResultsMap = new Map<string, StepResolutionResult>();
  const onomatopoeias: string[] = [];

  for (const step of steps) {
    const shouldRun = shouldExecuteStep(
      step.gate,
      prevResult,
      currentState,
      step,
      context,
      stepResultsMap,
    );
    if (!shouldRun) {
      continue;
    }

    const stepContext: EffectExecutionContext = {
      ...context,
      previousResult: prevResult,
      targetInstanceId:
        step.params?.target === 'PREVIOUS_TARGET' ? prevResult?.targetId : context.targetInstanceId,
    };

    const res = executeStep(currentState, step, stepContext);
    currentState = res.state;

    prevResult = {
      success: res.success,
      mutatedState: res.mutatedState ?? res.success,
      value: res.value,
      conditionMet: res.conditionMet,
      targetId: res.selectedCardInstanceIds?.[0],
    };

    if (step.id) {
      stepResultsMap.set(step.id, prevResult);
    }

    if (res.onomatopoeia) {
      onomatopoeias.push(res.onomatopoeia);
    }
  }

  return {
    state: currentState,
    success: true,
    mutatedState: Array.from(stepResultsMap.values()).some((r) => r.mutatedState),
    onomatopoeia: onomatopoeias.length > 0 ? onomatopoeias.join(' ➔ ') : 'SEQUENCE RESOLVED!',
  };
}

/**
 * Executes a declarative effect or ability on the GameState.
 */
export function executeEffect(
  state: GameState,
  abilityOrStep: CardAbility | AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  // Handle ability cost (e.g. discardSelf on in-play upgrades/attachments)
  if ('cost' in abilityOrStep && (abilityOrStep as CardAbility).cost?.discardSelf && context.sourceCardInstance) {
    const player = state.players.find((p) => p.id === context.playerId);
    if (player) {
      const tableauIdx = player.tableau.findIndex((c) => c.instanceId === context.sourceCardInstance!.instanceId);
      if (tableauIdx !== -1) {
        const [discarded] = player.tableau.splice(tableauIdx, 1);
        player.discard.push(discarded);
      }
    }
  }

  if ('steps' in abilityOrStep && Array.isArray(abilityOrStep.steps) && abilityOrStep.steps.length > 0) {
    return executeSequence(state, abilityOrStep.steps, context);
  }

  if ('sequence' in abilityOrStep && Array.isArray((abilityOrStep as any).sequence) && (abilityOrStep as any).sequence.length > 0) {
    return executeSequence(state, (abilityOrStep as any).sequence, context);
  }

  if ('effect' in abilityOrStep && abilityOrStep.effect) {
    return executeStep(state, abilityOrStep as AbilityStep, context);
  }

  return { state, success: true, onomatopoeia: 'RESOLVED!' };
}

/**
 * Executes a single declarative ability step primitive on the GameState.
 */
export function executeStep(
  state: GameState,
  step: AbilityStep,
  context: EffectExecutionContext,
): EffectResult {
  const player = state.players.find((p) => p.id === context.playerId);
  if (!player) return { state, success: false, error: 'Player not found' };

  switch (step.effect) {
    case 'DRAW_CARDS': {
      const count = (step.params?.count as number) || 1;
      const targetParam = step.params?.target as string | undefined;
      const targetPlayers = targetParam === 'ALL_PLAYERS' ? state.players : [player];
      let totalDrawn = 0;

      for (const p of targetPlayers) {
        let drawnForP = 0;
        for (let i = 0; i < count; i++) {
          const drawn = drawPlayerCard(state, p.id);
          if (drawn) {
            p.hand.push(drawn);
            drawnForP += 1;
            totalDrawn += 1;
          }
        }
        state.log.push({
          id: `log_${Date.now()}_${p.id}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.drawCards',
          params: {
            player: p.name,
            count: drawnForP,
            handSize: p.hand.length,
          },
          onomatopoeia: `DRAW +${drawnForP}!`,
        });
      }

      const onomatopoeia = `DRAW +${totalDrawn}!`;
      return {
        state,
        success: true,
        onomatopoeia,
      };
    }

    case 'DEAL_DAMAGE': {
      let amount = (step.params?.amount as number) || 0;
      if (step.params?.amountFormula === 'HERO_ATK' || (step.params?.amount as any) === 'HERO_ATK') {
        amount = getEffectiveHeroStats(state, player).attack;
      } else if (step.params?.amountFormula === 'SUFFERED_DAMAGE') {
        const max = (step.params?.max as number) || 15;
        const damageSustained = Math.max(0, getEffectiveMaxHealth(player, state) - player.health);
        amount = Math.min(max, damageSustained);
      }
      const targetParam = step.params?.target as string | undefined;

      if (targetParam === 'ALL_ENEMIES') {
        // Deal damage to villain
        const villainToughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (villainToughIdx !== -1) {
          state.villain.statusCards.splice(villainToughIdx, 1);
        } else {
          state.villain.health = Math.max(0, state.villain.health - amount);
          if (state.villain.health <= 0) {
            state = handleVillainDefeat(state, state.villain.instanceId);
          }
        }

        // Deal damage to all minions across all players
        for (const p of state.players) {
          for (let i = p.engagedMinions.length - 1; i >= 0; i--) {
            const minion = p.engagedMinions[i];
            const minionToughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
            if (minionToughIdx !== -1) {
              minion.statusCards!.splice(minionToughIdx, 1);
            } else {
              const currentDmg = minion.tokens?.damage || 0;
              const newDmg = currentDmg + amount;
              const minionHp = (minion.card as MinionCard).health || 1;
              if (newDmg >= minionHp) {
                p.engagedMinions.splice(i, 1);
                state.encounterDiscard.push(minion);
              } else {
                minion.tokens = { ...minion.tokens, damage: newDmg };
              }
            }
          }
        }

        const onomatopoeia = `BOOM! ${amount} DAMAGE TO ALL ENEMIES!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'all_enemies', amount },
          onomatopoeia,
        });

        return { state, success: true, onomatopoeia };
      }

      const targetType = (targetParam === 'ALL_HEROES' || targetParam === 'HERO') ? 'hero' : (context.targetType || 'villain');

      if (targetParam === 'ALL_HEROES' || (targetType === 'hero' && !context.targetInstanceId)) {
        for (const p of state.players) {
          const toughIdx = p.statusCards.indexOf(StatusCard.TOUGH);
          if (toughIdx !== -1) {
            p.statusCards.splice(toughIdx, 1);
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: state.roundNumber,
              phase: state.phase,
              key: 'card.effect.dealDamage',
              params: { player: p.name, target: 'hero', amount: 0, toughAbsorbed: true },
              onomatopoeia: 'CLANG! (TOUGH)',
            });
          } else {
            p.health = Math.max(0, p.health - amount);
            if (p.health <= 0) state.winner = 'VILLAIN';
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: state.roundNumber,
              phase: state.phase,
              key: 'card.effect.dealDamage',
              params: { player: p.name, target: 'hero', amount, remainingHealth: p.health },
              onomatopoeia: `OUCH! ${amount} DAMAGE!`,
            });
          }
        }
        return { state, success: true, onomatopoeia: `SHOCK! ${amount} DAMAGE TO HEROES!` };
      }

      // 1. If targetInstanceId is specified, check engaged minions first
      if (context.targetInstanceId) {
        for (const p of state.players) {
          const minionIdx = p.engagedMinions.findIndex(
            (m) => m.instanceId === context.targetInstanceId,
          );
          if (minionIdx !== -1) {
            const minion = p.engagedMinions[minionIdx];
            const toughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
            if (toughIdx !== -1) {
              minion.statusCards!.splice(toughIdx, 1);
              const onomatopoeia = 'CLANG!';
              state.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: state.roundNumber,
                phase: state.phase,
                key: 'card.effect.dealDamage',
                params: { player: player.name, target: minion.card.name, amount: 0, toughAbsorbed: true },
                onomatopoeia,
              });
              return { state, success: true, onomatopoeia };
            }

            const currentDmg = minion.tokens?.damage || 0;
            const newDmg = currentDmg + amount;
            const minionHp = (minion.card as MinionCard).health || 1;

            if (newDmg >= minionHp) {
              const excessDmg = newDmg - minionHp;
              p.engagedMinions.splice(minionIdx, 1);
              state.encounterDiscard.push(minion);

              // Overkill routing to villain if attack has Overkill
              const isOverkill = Boolean(
                step.params?.overkill ||
                step.params?.keyword === 'Overkill' ||
                (context.sourceCardInstance?.card as any)?.keywords?.includes('Overkill') ||
                (context.sourceCardInstance?.card.raw as any)?.keywords?.includes('Overkill')
              );

              if (isOverkill && excessDmg > 0) {
                state.villain.health = Math.max(0, state.villain.health - excessDmg);
                state.log.push({
                  id: `log_${Date.now()}`,
                  timestamp: Date.now(),
                  round: state.roundNumber,
                  phase: state.phase,
                  category: 'combat',
                  key: 'overkill.villain.hit',
                  params: { damage: excessDmg, villain: state.villain.card.name },
                  onomatopoeia: `OVERKILL! ${excessDmg} DAMAGE TO VILLAIN!`,
                });
              }

              // Process attached cards on defeated minion (e.g. Spider-Tracer 01008)
              for (const att of minion.attachments || []) {
                const attAbs = att.card.enrichment?.abilities || [];
                for (const ab of attAbs) {
                  const hostDefStep = ab.steps?.find((s) => s.effect === 'WHEN_ATTACHED_HOST_DEFEATED');
                  if (hostDefStep) {
                    const removeAmount = (hostDefStep.params?.amount as number) || 3;
                    state.mainScheme.threat = Math.max(0, state.mainScheme.threat - removeAmount);
                    state.log.push({
                      id: `log_${Date.now()}`,
                      timestamp: Date.now(),
                      category: 'scheme',
                      key: 'card.effect.removeThreat',
                      params: { scheme: state.mainScheme.card.name, amount: removeAmount, source: att.card.name },
                      onomatopoeia: 'SPIDER-TRACER REMOVES 3 THREAT!',
                    });
                  }
                }
                p.discard.push(att);
              }

              const onomatopoeia = 'SMASH! MINION DEFEATED!';
              state.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: state.roundNumber,
                phase: state.phase,
                key: 'card.effect.dealDamage',
                params: { player: player.name, target: minion.card.name, amount, defeated: true },
                onomatopoeia,
              });
              return { state, success: true, onomatopoeia };
            } else {
              minion.tokens = { ...minion.tokens, damage: newDmg };

              // Retaliate check if minion survives
              const minionText = (minion.card.text || '').toLowerCase();
              let retaliateX = 0;
              if (minionText.includes('retaliate 1') || (minion.card as any).keywords?.includes('Retaliate 1') || (minion.card as any).keywords?.includes('Retaliate')) {
                retaliateX = 1;
              }
              if (retaliateX > 0) {
                player.health = Math.max(0, player.health - retaliateX);
                state.log.push({
                  id: `log_${Date.now()}`,
                  timestamp: Date.now(),
                  round: state.roundNumber,
                  phase: state.phase,
                  category: 'combat',
                  key: 'retaliate.hit',
                  params: { damage: retaliateX, source: minion.card.name, player: player.name },
                  onomatopoeia: 'RETALIATE!',
                });
              }

              const onomatopoeia = 'WHAM!';
              state.log.push({
                id: `log_${Date.now()}`,
                timestamp: Date.now(),
                round: state.roundNumber,
                phase: state.phase,
                key: 'card.effect.dealDamage',
                params: { player: player.name, target: minion.card.name, amount, remainingHealth: minionHp - newDmg },
                onomatopoeia,
              });
              return { state, success: true, onomatopoeia };
            }
          }
        }
      }

      // 2. Default: Deal damage to Villain
      const toughIndex = state.villain.statusCards.indexOf(StatusCard.TOUGH);
      if (toughIndex !== -1) {
        state.villain.statusCards.splice(toughIndex, 1);
        const onomatopoeia = 'CLANG! (TOUGH)';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: { player: player.name, target: 'villain', amount: 0, toughAbsorbed: true },
          onomatopoeia,
        });
        return { state, success: true, onomatopoeia };
      }

      // Check damage shield on villain (e.g. Armored Rhino Suit 01098)
      const armorIdx = (state.villain.attachments || []).findIndex((att) => {
        const abs = att.card.enrichment?.abilities || [];
        return abs.some((a) => a.steps?.some((s) => s.effect === 'ATTACHMENT_DAMAGE_SHIELD'));
      });
      if (armorIdx !== -1) {
        const armor = state.villain.attachments.splice(armorIdx, 1)[0];
        state.encounterDiscard.push(armor);
        const onomatopoeia = 'ARMORED SUIT ABSORBS DAMAGE!';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'attachment.damageShield.absorbed',
          params: { villain: state.villain.card.name, attachment: armor.card.name, damage: amount },
          onomatopoeia,
        });
        return { state, success: true, onomatopoeia };
      }

      state.villain.health = Math.max(0, state.villain.health - amount);
      if (state.villain.health <= 0) {
        const defeatedState = handleVillainDefeat(state, state.villain.instanceId);
        return { state: defeatedState, success: true, onomatopoeia: `KAPOW! ${amount} DAMAGE!` };
      }

      const onomatopoeia = `KAPOW! ${amount} DAMAGE!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.dealDamage',
        params: {
          player: player.name,
          target: 'villain',
          amount,
          remainingHealth: state.villain.health,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        onomatopoeia,
      };

      return { state, success: false, error: 'Target not found for damage effect' };
    }

    case 'HEAL_DAMAGE': {
      const amount = (step.params?.amount as number) || 0;
      const target = (step.params?.target as string) || 'SELF';
      let healed = 0;

      if (target === 'VILLAIN') {
        const currentHp = state.villain.health;
        const maxHp = state.villain.maxHealth || 100;
        healed = Math.min(maxHp - currentHp, amount);
        state.villain.health += healed;
      } else {
        healed = Math.min(player.maxHealth - player.health, amount);
        player.health += healed;
      }

      const onomatopoeia = `HEAL +${healed} HP!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.heal',
        params: {
          player: player.name,
          target,
          amount: healed,
          health: target === 'VILLAIN' ? state.villain.health : player.health,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: healed > 0,
        value: healed,
        onomatopoeia,
      };
    }

    case 'PREVENT_DAMAGE': {
      const amount = (step.params?.amount as number) || (step.params?.preventAll ? 999 : 3);
      const onomatopoeia = `PREVENTED ${amount} DAMAGE!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'combat.damage.prevented',
        params: { player: player.name, amount },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        mutatedState: true,
        value: amount,
        onomatopoeia,
      };
    }

    case 'GENERATE_RESOURCE': {
      const resourceType = (step.params?.resource as string) || 'wild';
      const amount = (step.params?.amount as number) || 1;

      return {
        state,
        success: true,
        onomatopoeia: `+${amount} [${resourceType}] RESOURCE!`,
      };
    }

    case 'REMOVE_THREAT': {
      const amount = (step.params?.amount as number) || 1;
      const targetParam = (step.params?.target as string) || 'MAIN_SCHEME';
      let removed = 0;

      if (targetParam === 'MAIN_SCHEME') {
        removed = Math.min(state.mainScheme.threat, amount);
        state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
      } else if (context.targetInstanceId) {
        const sideScheme = (state.sideSchemes || []).find(
          (s) => s.instanceId === context.targetInstanceId,
        );
        if (sideScheme) {
          const current = sideScheme.threat || 0;
          removed = Math.min(current, amount);
          sideScheme.threat = Math.max(0, current - amount);
        }
      } else {
        removed = Math.min(state.mainScheme.threat, amount);
        state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);
      }

      const onomatopoeia = `-${removed} THREAT!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.removeThreat',
        params: {
          player: player.name,
          amount: removed,
          remainingThreat: state.mainScheme.threat,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState: removed > 0,
        value: removed,
        onomatopoeia,
      };
    }

    case 'ADD_STATUS': {
      let status: StatusCard = StatusCard.STUNNED;
      const statusParam = step.params?.status;
      if (statusParam === 'TOUGH' || statusParam === StatusCard.TOUGH) status = StatusCard.TOUGH;
      if (statusParam === 'CONFUSED' || statusParam === StatusCard.CONFUSED) status = StatusCard.CONFUSED;
      if (statusParam === 'STUNNED' || statusParam === StatusCard.STUNNED) status = StatusCard.STUNNED;

      const target = (step.params?.target as string) || 'VILLAIN';
      let mutatedState = false;
      let alreadyHadStatus = false;

      if (
        target === 'VILLAIN' ||
        target === 'CHOSEN_ENEMY' ||
        target === 'ATTACK_TARGET' ||
        target === 'ATTACKED_ENEMY' ||
        target === 'TARGET_ENEMY'
      ) {
        if (context.targetType === 'minion' && context.targetInstanceId) {
          const minion = player.engagedMinions.find((m) => m.instanceId === context.targetInstanceId);
          if (minion) {
            if (!minion.statusCards) minion.statusCards = [];
            if (!minion.statusCards.includes(status)) {
              minion.statusCards.push(status);
              mutatedState = true;
            } else {
              alreadyHadStatus = true;
            }
          }
        } else {
          if (!state.villain.statusCards.includes(status)) {
            state.villain.statusCards.push(status);
            mutatedState = true;
          } else {
            alreadyHadStatus = true;
          }
        }
      } else if (target === 'HERO' || target === 'ALL_HEROES' || target === 'DEFENDING_CHARACTER' || target === 'DEFENDING_PLAYER') {
        const targetPlayer = state.players.find((p) => p.id === context.playerId) || player;
        if (!targetPlayer.statusCards.includes(status)) {
          targetPlayer.statusCards.push(status);
          mutatedState = true;
        } else {
          alreadyHadStatus = true;
        }
      }

      const onomatopoeia = `${status} APPLIED!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.addStatus',
        params: {
          status,
          target,
          mutatedState,
          alreadyHadStatus,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        mutatedState,
        value: mutatedState ? 1 : 0,
        conditionMet: alreadyHadStatus,
        onomatopoeia,
      };
    }

    case 'DISCARD_TOP_DECK_FILTER': {
      // Black Cat: Discard top 2 cards, add each Mental resource to hand
      const count = (step.params?.count as number) || 2;
      const filterRes = (step.params?.filterResource as string) || 'mental';
      let matchedCount = 0;

      for (let i = 0; i < count; i++) {
        const discarded = player.deck.shift();
        if (discarded) {
          const hasResource = discarded.card.resources[filterRes as keyof typeof discarded.card.resources] > 0;
          if (hasResource) {
            player.hand.push(discarded);
            matchedCount += 1;
          } else {
            player.discard.push(discarded);
          }
        }
      }

      const onomatopoeia = `BLACK CAT FOUND +${matchedCount} CARDS!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.drawCards',
        params: {
          player: player.name,
          card: 'Black Cat',
          count: matchedCount,
          handSize: player.hand.length,
        },
        onomatopoeia,
      });

      return { state, success: true, onomatopoeia };
    }

    case 'SCRY_AND_SELECT_TRAIT': {
      // Tony Stark Futurist: Look at top lookCount (3) cards of deck, allow player to select 1 matching trait ('Tech') card to add to hand, discard rest.
      const lookCount = (step.params?.lookCount as number) || 3;
      const trait = (step.params?.trait as string) || 'Tech';

      const scryedCards: CardInstance[] = [];
      for (let i = 0; i < lookCount; i++) {
        const c = player.deck.shift();
        if (c) scryedCards.push(c);
      }

      if (!player.setAsideCards) player.setAsideCards = [];
      player.setAsideCards.push(...scryedCards);

      const matchingCards = scryedCards.filter((c) => (c.card.traits || []).includes(trait));

      const options = matchingCards.map((c) => ({
        id: `take_${c.instanceId}`,
        label: `Take ${c.card.name} to Hand`,
        description: `${c.card.type.toUpperCase()} • Cost: ${c.card.cost ?? 0} (Discard remaining ${scryedCards.length - 1} cards)`,
        effect: 'RESOLVE_SCRY_SELECTION',
        params: {
          takeInstanceId: c.instanceId,
          scryedInstanceIds: scryedCards.map((sc) => sc.instanceId),
        },
      }));

      // Player always has the choice to take nothing / decline (RR v1.8 p. 19 "Player Choice")
      options.push({
        id: 'take_none',
        label: 'Do not take any card',
        description: `Discard all ${scryedCards.length} revealed cards to discard pile`,
        effect: 'RESOLVE_SCRY_SELECTION',
        params: {
          takeInstanceId: '',
          scryedInstanceIds: scryedCards.map((sc) => sc.instanceId),
        },
      });

      const revealedCards = scryedCards.map((c) => {
        const isMatch = (c.card.traits || []).includes(trait);
        return {
          instanceId: c.instanceId,
          card: c.card,
          isSelectable: isMatch,
          selectableOptionId: isMatch ? `take_${c.instanceId}` : undefined,
          dimmedReason: isMatch ? undefined : `Non-${trait}`,
        };
      });

      state = enqueueDecisionPrompt(state, {
        promptId: `futurist_${Date.now()}`,
        playerId: player.id,
        title: 'FUTURIST (Tony Stark)',
        description: `Revealed top ${scryedCards.length} cards from your deck. Select a ${trait} card to add to your hand, or choose to discard all:`,
        sourceCardName: 'Tony Stark',
        options,
        revealedCards,
      });

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        actor: { name: player.name, type: player.currentForm },
        key: 'card.effect.futurist.prompt',
        params: {
          player: player.name,
          scryedCards: scryedCards.map((c) => c.card.name).join(', '),
        },
        onomatopoeia: 'FUTURIST SCAN!',
      });

      return { state, success: true, onomatopoeia: 'FUTURIST SCAN!' };
    }

    case 'RESOLVE_SCRY_SELECTION': {
      const takeId = step.params?.takeInstanceId as string | null | undefined;
      const scryedIds = (step.params?.scryedInstanceIds as string[]) || [];

      let takenCardName = '';
      if (!player.setAsideCards) player.setAsideCards = [];

      for (const id of scryedIds) {
        const idx = player.setAsideCards.findIndex((c) => c.instanceId === id);
        if (idx !== -1) {
          const [cardInst] = player.setAsideCards.splice(idx, 1);
          if (takeId && cardInst.instanceId === takeId) {
            player.hand.push(cardInst);
            takenCardName = cardInst.card.name;
          } else {
            player.discard.push(cardInst);
          }
        }
      }

      const onomatopoeia = takenCardName ? `FUTURIST! +${takenCardName.toUpperCase()}` : 'FUTURIST (DISCARDED ALL)';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        actor: { name: player.name, type: player.currentForm },
        key: 'card.effect.futurist.resolved',
        params: {
          player: player.name,
          taken: takenCardName || 'None',
        },
        onomatopoeia,
      });

      return { state, success: true, onomatopoeia };
    }

    case 'HEAL_DAMAGE_WITH_SURGE': {
      // Hard to Keep Down (01104): Rhino heals 4 HP. If 0 healed -> surge
      const amount = (step.params?.amount as number) || 4;
      const healed = Math.min(state.villain.maxHealth - state.villain.health, amount);
      if (healed > 0) {
        state.villain.health += healed;
        return { state, success: true, onomatopoeia: `RHINO HEALED +${healed} HP!` };
      } else {
        // Surge -> deal 1 extra encounter card
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'ADD_STATUS_WITH_SURGE': {
      // "I'm Tough" (01105): Give Rhino Tough. If already Tough -> surge
      if (!state.villain.statusCards.includes(StatusCard.TOUGH)) {
        state.villain.statusCards.push(StatusCard.TOUGH);
        return { state, success: true, onomatopoeia: 'RHINO GAINS TOUGH!' };
      } else {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'ADD_THREAT_PER_PLAYER': {
      const amountPerPlayer = (step.params?.amount as number) || 1;
      const totalToAdd = amountPerPlayer * state.players.length;
      const target = (step.params?.target as string) || 'THIS_SIDE_SCHEME';

      if (target === 'THIS_SIDE_SCHEME' && context.sourceCardInstance) {
        const scheme = state.sideSchemes.find(
          (s) =>
            s.instanceId === context.sourceCardInstance!.instanceId ||
            s.card.code === context.sourceCardInstance!.card.code,
        );
        if (scheme) {
          scheme.threat += totalToAdd;
          const onomatopoeia = `SIDE SCHEME +${totalToAdd} THREAT!`;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'card.effect.addThreat',
            params: { target: scheme.card.name, amount: totalToAdd, currentThreat: scheme.threat },
            onomatopoeia,
          });
          return { state, success: true, onomatopoeia };
        }
      }

      state.mainScheme.threat += totalToAdd;
      const onomatopoeia = `MAIN SCHEME +${totalToAdd} THREAT!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.addThreat',
        params: { target: state.mainScheme.card.name, amount: totalToAdd, currentThreat: state.mainScheme.threat },
        onomatopoeia,
      });
      return { state, success: true, onomatopoeia };
    }

    case 'NICK_FURY_CHOICE': {
      // Dynamic AI evaluation: Threat -> Hand -> Damage
      if (state.mainScheme.threat >= 3) {
        state.mainScheme.threat = Math.max(0, state.mainScheme.threat - 2);
        const onomatopoeia = 'NICK FURY REMOVES 2 THREAT!';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.removeThreat',
          params: {
            player: player.name,
            card: 'Nick Fury',
            amount: 2,
            remainingThreat: state.mainScheme.threat,
          },
          onomatopoeia,
        });
        return { state, success: true, onomatopoeia };
      }
      if (player.hand.length <= 3) {
        let drawnCount = 0;
        for (let i = 0; i < 3; i++) {
          const drawn = player.deck.shift();
          if (drawn) {
            player.hand.push(drawn);
            drawnCount += 1;
          }
        }
        const onomatopoeia = `NICK FURY DRAWS +${drawnCount} CARDS!`;
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.drawCards',
          params: {
            player: player.name,
            card: 'Nick Fury',
            count: drawnCount,
            handSize: player.hand.length,
          },
          onomatopoeia,
        });
        return { state, success: true, onomatopoeia };
      }
      const toughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
      if (toughIdx !== -1) {
        state.villain.statusCards.splice(toughIdx, 1);
        const onomatopoeia = 'NICK FURY BREAKS TOUGH!';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          key: 'card.effect.dealDamage',
          params: {
            player: player.name,
            card: 'Nick Fury',
            amount: 0,
            toughAbsorbed: true,
          },
          onomatopoeia,
        });
        return { state, success: true, onomatopoeia };
      }
      state.villain.health = Math.max(0, state.villain.health - 4);
      if (state.villain.health <= 0) state.winner = 'HEROES';
      const onomatopoeia = 'NICK FURY DEALS 4 DAMAGE!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.dealDamage',
        params: {
          player: player.name,
          card: 'Nick Fury',
          damage: 4,
          remainingHealth: state.villain.health,
        },
        onomatopoeia,
      });
      return { state, success: true, onomatopoeia };
    }

    case 'FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE': {
      if (player.currentForm === 'alter_ego') {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      } else {
        // Villain attacks hero immediately (ATK damage)
        const atkDmg = (state.villain.card as any).attack || 2;
        const toughIdx = player.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          player.statusCards.splice(toughIdx, 1);
          return { state, success: true, onomatopoeia: 'CLANG! (TOUGH ABSORBS ATTACK)' };
        }
        player.health = Math.max(0, player.health - atkDmg);
        if (player.health <= 0) state.winner = 'VILLAIN';
        return { state, success: true, onomatopoeia: `VILLAIN ATTACKS! ${atkDmg} DAMAGE!` };
      }
    }

    case 'DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE': {
      if (player.tableau.length > 0) {
        const [discarded] = player.tableau.splice(0, 1);
        player.discard.push(discarded);
        return { state, success: true, onomatopoeia: `DISCARDED ${discarded.card.name}!` };
      } else {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'ATTACH_TO_HOST': {
      const targetHost = step.params?.target as string;
      const sourceCard = context.sourceCardInstance;
      if (!sourceCard) return { state, success: true };

      if (targetHost === 'VILLAIN' || targetHost === 'ENEMY') {
        if (!state.villain.attachments) state.villain.attachments = [];
        state.villain.attachments.push(sourceCard);
        return { state, success: true, onomatopoeia: 'ATTACHED TO VILLAIN!' };
      } else if (targetHost === 'CHOSEN_ALLY' || targetHost === 'ALLY') {
        const ally = player.allies.find((a) => a.instanceId === context.targetInstanceId) || player.allies[0];
        if (ally) {
          if (!ally.attachments) ally.attachments = [];
          ally.attachments.push(sourceCard);
          return { state, success: true, onomatopoeia: `ATTACHED TO ${ally.card.name}!` };
        }
      } else if (targetHost === 'CHOSEN_MINION' || targetHost === 'MINION') {
        let foundMinion: CardInstance | undefined;
        for (const p of state.players) {
          foundMinion = p.engagedMinions.find((m) => m.instanceId === context.targetInstanceId) || p.engagedMinions[0];
          if (foundMinion) break;
        }
        if (foundMinion) {
          if (!foundMinion.attachments) foundMinion.attachments = [];
          foundMinion.attachments.push(sourceCard);
          return { state, success: true, onomatopoeia: `ATTACHED TO ${foundMinion.card.name}!` };
        }
      }
      return { state, success: true, onomatopoeia: 'ATTACHED!' };
    }

    case 'MODIFY_STAT':
    case 'GRANT_KEYWORD':
    case 'ATTACHMENT_DAMAGE_SHIELD':
    case 'INTERCEPT_ATTACK':
    case 'WHEN_ATTACHED_HOST_DEFEATED': {
      // These are declarative constant/trigger primitives evaluated dynamically by stat-calculator and combat pipelines
      return { state, success: true };
    }

    case 'READY_IDENTITY':
    case 'READY_CHARACTER':
    case 'READY_ALLY':
    case 'READY_CARD': {
      const targetParam = step.params?.target as string | undefined;
      if (targetParam === 'CHOSEN_ALLY' || targetParam === 'ALLY' || context.targetType === 'ally') {
        const ally = player.allies.find((a) => a.instanceId === context.targetInstanceId) || player.allies[0];
        if (ally) {
          ally.exhausted = false;
        }
      } else {
        player.exhausted = false;
      }
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.effect.readyCharacter',
        params: { player: player.name },
        onomatopoeia: 'READY!',
      });
      return { state, success: true, mutatedState: true, onomatopoeia: 'READY!' };
    }

    case 'CANCEL_TREACHERY_AND_VILLAIN_ATTACKS':
    case 'CANCEL_WHEN_REVEALED_AND_ATTACK': {
      executeVillainAttackAgainstPlayer(state, player);
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.effect.getBehindMe',
        params: { player: player.name },
        onomatopoeia: 'GET BEHIND ME! (VILLAIN ATTACKS)',
      });
      return { state, success: true, onomatopoeia: 'GET BEHIND ME! VILLAIN ATTACKS!' };
    }

    case 'TAKE_THREAT_AS_DAMAGE': {
      const amount = (context.threatAmount ?? (step.params?.amount as number)) || 1;
      player.health = Math.max(0, player.health - amount);
      if (player.health <= 0) state.winner = 'VILLAIN';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.effect.greatResponsibility',
        params: { player: player.name, damage: amount },
        onomatopoeia: 'GREAT RESPONSIBILITY! (DAMAGE TAKEN)',
      });
      return { state, success: true, onomatopoeia: 'GREAT RESPONSIBILITY!' };
    }

    case 'DISCARD_ATTACHMENT': {
      if (context.sourceCardInstance) {
        const vIdx = (state.villain.attachments || []).indexOf(context.sourceCardInstance);
        if (vIdx !== -1) {
          state.villain.attachments.splice(vIdx, 1);
          state.encounterDiscard.push(context.sourceCardInstance);
          return { state, success: true, onomatopoeia: 'ATTACHMENT DISCARDED!' };
        }
      }
      return { state, success: true };
    }

    case 'EXHAUST_IDENTITY':
    case 'EXHAUST_HERO': {
      player.exhausted = true;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: player.activeFormCard.name },
        onomatopoeia: 'EXHAUST',
      });
      return { state, success: true, onomatopoeia: 'EXHAUSTED!' };
    }

    case 'DISCARD_ENCOUNTER_DECK': {
      const count = (step.params?.count as number) || 1;
      for (let i = 0; i < count; i++) {
        const card = state.encounterDeck.shift();
        if (card) state.encounterDiscard.push(card);
      }
      return { state, success: true, onomatopoeia: `DISCARDED ${count} ENCOUNTER CARDS!` };
    }

    case 'GIVE_ADDITIONAL_BOOST_CARD':
    case 'DEAL_ADDITIONAL_BOOST_CARD': {
      if (state.activeAttackContext) {
        const extraCard = drawEncounterCard(state);
        if (extraCard) {
          state.activeAttackContext.boostQueue.push(extraCard);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'villain.boost.added',
            params: { card: extraCard.card.name },
            onomatopoeia: 'CHAIN BOOST ADDED!',
          });
        }
      }
      return { state, success: true, onomatopoeia: 'CHAIN BOOST ADDED!' };
    }

    case 'PUT_INTO_PLAY_ENGAGED':
    case 'SPAWN_MINION_ENGAGED': {
      const minionInst = context.sourceCardInstance;
      if (minionInst) {
        if (state.activeAttackContext) {
          (state.activeAttackContext as any).skipBoostDiscard = true;
        }
        player.engagedMinions.push(minionInst);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'minion.entered.play',
          params: { minion: minionInst.card.name, player: player.name },
          onomatopoeia: 'MINION ENTERS THE FRAY!',
        });
      }
      return { state, success: true, onomatopoeia: 'MINION ENGAGED!' };
    }

    case 'DISCARD_CARDS_FROM_HAND_AT_RANDOM':
    case 'DISCARD_RANDOM_HAND': {
      const count = (step.params?.count as number) || 1;
      for (let i = 0; i < count; i++) {
        if (player.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * player.hand.length);
          const [discarded] = player.hand.splice(randIdx, 1);
          player.discard.push(discarded);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            category: 'combat',
            key: 'player.hand.randomDiscard',
            params: { player: player.name, card: discarded.card.name },
            onomatopoeia: 'RANDOM DISCARD!',
          });
        }
      }
      return { state, success: true, onomatopoeia: 'RANDOM DISCARD!' };
    }

    case 'DISCARD_UPGRADE_OR_SUPPORT': {
      if (player.tableau.length > 0) {
        const [discarded] = player.tableau.splice(0, 1);
        player.discard.push(discarded);
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'combat',
          key: 'player.tableau.discarded',
          params: { player: player.name, card: discarded.card.name },
          onomatopoeia: 'TABLEAU DISCARDED!',
        });
      }
      return { state, success: true, onomatopoeia: 'TABLEAU DISCARDED!' };
    }

    case 'PLAYER_CHOICE': {
      const options = (step.params?.options as any[]) || [];
      const title = (step.params?.title as string) || (step.params?.promptTitle as string) || 'Choose an Option';
      const description = (step.params?.description as string) || '';
      const sourceCardName = context.sourceCardInstance?.card.name || step.id || 'Card Ability';
      const promptId = `prompt_${Date.now()}_${step.id || 'choice'}`;
      state = enqueueDecisionPrompt(state, {
        promptId,
        playerId: context.playerId || player.id,
        title,
        description,
        sourceCardName,
        options,
        isVoluntary: (step.params?.isVoluntary as boolean) ?? false,
      });

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'decision.prompt.opened',
        params: { player: player.name, promptId, source: sourceCardName },
        onomatopoeia: 'CHOICE REQUIRED!',
      });

      return { state, success: true, onomatopoeia: 'CHOOSE AN OPTION!' };
    }

    case 'DECLARE_DEFENDER': {
      const defenderType = (step.params?.defenderType as 'HERO' | 'ALLY' | 'UNDEFENDED') || 'UNDEFENDED';
      const allyInstanceId = step.params?.allyInstanceId as string | undefined;
      const playerId = context.playerId || (step.params?.playerId as string) || player.id;
      const resState = resolveDefenderDeclaration(state, {
        type: defenderType,
        playerId,
        allyInstanceId,
      });
      return { state: resState, success: true, onomatopoeia: 'DEFENSE RESOLVED!' };
    }

    case 'VILLAIN_SCHEMES': {
      executeVillainSchemeAgainstPlayer(state, player);
      return { state, success: true, onomatopoeia: 'VILLAIN SCHEMES!' };
    }

    case 'VILLAIN_ATTACKS': {
      if (player.currentForm === 'alter_ego') {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      } else {
        executeVillainAttackAgainstPlayer(state, player);
        return { state, success: true, onomatopoeia: 'VILLAIN ATTACKS!' };
      }
    }

    case 'VILLAIN_AND_ENGAGED_MINIONS_ATTACK': {
      if (player.currentForm === 'alter_ego') {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      } else {
        const activations: { type: 'VILLAIN' | 'MINION'; playerId: string; minionInstanceId?: string }[] = [
          { type: 'VILLAIN', playerId: player.id },
          ...player.engagedMinions.map((m) => ({ type: 'MINION' as const, playerId: player.id, minionInstanceId: m.instanceId })),
        ];
        (state as any).pendingActivations = [
          ...((state as any).pendingActivations || []),
          ...activations,
        ];

        if ((state as any).pendingActivations.length > 0) {
          const act = (state as any).pendingActivations.shift()!;
          if (act.type === 'VILLAIN') {
            executeVillainAttackAgainstPlayer(state, player);
          } else {
            const minion = player.engagedMinions.find((m) => m.instanceId === act.minionInstanceId);
            if (minion) executeMinionAttackAgainstPlayer(state, minion, player);
          }
        }
        return { state, success: true, onomatopoeia: 'GANG UP!' };
      }
    }

    case 'EXPLOSION':
    case 'HERO_FORM_BRANCH': {
      const bombScare = state.sideSchemes.find(
        (s) => s.card.code === '01109' || (s.card.name || '').includes('Bomb Scare'),
      );
      if (bombScare) {
        const damage = bombScare.threat || 1;
        player.health = Math.max(0, player.health - damage);
        if (player.health <= 0) state.winner = 'VILLAIN';
        return { state, success: true, onomatopoeia: 'EXPLOSION!' };
      } else {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);
        return { state, success: true, onomatopoeia: 'SURGE!' };
      }
    }

    case 'PLACE_THREAT_PER_SIDE_SCHEME': {
      const amount = (step.params?.amount as number) || 4;
      if (state.sideSchemes.length > 0) {
        for (const s of state.sideSchemes) {
          s.threat += amount;
        }
        return { state, success: true, onomatopoeia: `+${amount} THREAT TO SIDE SCHEMES!` };
      } else {
        // Discard until a side scheme is found, then reveal it
        let foundSideScheme: CardInstance | undefined;
        while (state.encounterDeck.length > 0) {
          const card = state.encounterDeck.shift()!;
          if (card.card.type === CardType.SIDE_SCHEME) {
            foundSideScheme = card;
            break;
          }
          state.encounterDiscard.push(card);
        }
        if (foundSideScheme) {
          const sideCard = foundSideScheme.card as SideSchemeCard;
          const baseThreat = sideCard.baseThreat * (sideCard.baseThreatFixed ? 1 : state.players.length);
          state.sideSchemes.push({
            instanceId: foundSideScheme.instanceId,
            card: sideCard,
            threat: baseThreat,
          });
          return { state, success: true, onomatopoeia: 'SIDE SCHEME REVEALED!' };
        }
        return { state, success: true, onomatopoeia: 'NO SIDE SCHEMES FOUND' };
      }
    }

    case 'REVEAL_ENCOUNTER_CARD_WITH_SURGE': {
      // 1. Surge: deal 1 card facedown to player
      const surgeCard = state.encounterDeck.shift();
      if (surgeCard) player.dealtEncounterCards.push(surgeCard);

      // 2. Extra card drawn to be revealed immediately
      const extraCard = state.encounterDeck.shift();
      if (extraCard) player.dealtEncounterCards.unshift(extraCard);

      return { state, success: true, onomatopoeia: 'UNDER FIRE!' };
    }

    case 'PUT_INTO_PLAY': {
      const fromZone = (step.params?.from as string) || 'SET_ASIDE';
      const toZone = (step.params?.to as string) || 'ENGAGED_WITH_PLAYER';
      const filter = (step.params?.filter as Record<string, any>) || {};

      const heroSetCode = player.hero?.setCode || '';
      const nemesisSetCode = heroSetCode ? `${heroSetCode}_nemesis` : '';

      let sourceList: CardInstance[] = [];
      if (fromZone === 'SET_ASIDE') {
        sourceList = player.setAsideCards || [];
      } else if (fromZone === 'DISCARD') {
        sourceList = player.discard || [];
      } else if (fromZone === 'DECK') {
        sourceList = player.deck || [];
      }

      const matches = sourceList.filter((c) => {
        if (filter.set === 'PLAYER_NEMESIS') {
          const isNemesis = c.card.setCode === nemesisSetCode || (c.card.setCode && c.card.setCode.includes('nemesis'));
          if (!isNemesis) return false;
        }
        if (filter.type) {
          const expectedType = filter.type === 'side_scheme' ? CardType.SIDE_SCHEME : filter.type === 'minion' ? CardType.MINION : filter.type;
          if (c.card.type !== expectedType && c.card.type !== filter.type) return false;
        }
        if (filter.code && c.card.code !== filter.code) return false;
        return true;
      });

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
      }

      for (const cardInst of matches) {
        if (toZone === 'ENGAGED_WITH_PLAYER' || cardInst.card.type === CardType.MINION) {
          const hasToughness =
            (cardInst.card.traits || []).includes('Toughness') ||
            (cardInst.card.text || '').toLowerCase().includes('toughness');
          if (hasToughness) {
            if (!cardInst.statusCards) cardInst.statusCards = [];
            if (!cardInst.statusCards.includes(StatusCard.TOUGH)) {
              cardInst.statusCards.push(StatusCard.TOUGH);
            }
          }

          player.engagedMinions.push(cardInst as MinionCard & CardInstance);

          const hasQuickstrike =
            (cardInst.card.traits || []).includes('Quickstrike') ||
            (cardInst.card.text || '').includes('Quickstrike');
          if (hasQuickstrike && player.currentForm === 'hero') {
            executeMinionAttackAgainstPlayer(state, cardInst as MinionCard & CardInstance, player);
          }

          const abilities = cardInst.card.enrichment?.abilities || [];
          for (const ab of abilities) {
            if (ab.trigger === 'WHEN_REVEALED' || ab.timing === 'FORCED_RESPONSE') {
              executeEffect(state, ab, { playerId: player.id, sourceCardInstance: cardInst });
            }
          }
        } else if (toZone === 'SIDE_SCHEMES' || cardInst.card.type === CardType.SIDE_SCHEME) {
          const sideCard = cardInst.card as SideSchemeCard;
          const baseThreat = sideCard.baseThreat * (sideCard.baseThreatFixed ? 1 : state.players.length);
          state.sideSchemes.push({
            instanceId: cardInst.instanceId,
            card: sideCard,
            threat: baseThreat,
          });

          const schemeAbilities = sideCard.enrichment?.abilities || [];
          for (const ab of schemeAbilities) {
            if (ab.trigger === 'WHEN_REVEALED' || ab.timing === 'FORCED_RESPONSE') {
              executeEffect(state, ab, { playerId: player.id, sourceCardInstance: cardInst });
            }
          }
        } else if (toZone === 'TABLEAU') {
          player.tableau.push(cardInst);
        }
      }

      const cardNames = matches.map((m) => m.card.name).join(', ');
      const onomatopoeia = `ENTERS PLAY! ${cardNames.toUpperCase()}`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'card.putIntoPlay',
        params: {
          player: player.name,
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

    case 'SHUFFLE_INTO_DECK': {
      const fromZone = (step.params?.from as string) || 'SET_ASIDE';
      const toDeck = (step.params?.toDeck as string) || 'ENCOUNTER_DECK';
      const filter = (step.params?.filter as Record<string, any>) || {};

      const heroSetCode = player.hero?.setCode || '';
      const nemesisSetCode = heroSetCode ? `${heroSetCode}_nemesis` : '';

      let sourceList: CardInstance[] = [];
      if (fromZone === 'SET_ASIDE') {
        sourceList = player.setAsideCards || [];
      } else if (fromZone === 'DISCARD') {
        sourceList = player.discard || [];
      } else if (fromZone === 'HAND') {
        sourceList = player.hand || [];
      }

      const matches = sourceList.filter((c) => {
        if (filter.set === 'PLAYER_NEMESIS') {
          const isNemesis = c.card.setCode === nemesisSetCode || (c.card.setCode && c.card.setCode.includes('nemesis'));
          if (!isNemesis) return false;
        }
        if (filter.type && c.card.type !== filter.type) return false;
        return true;
      });

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
        state.encounterDeck.sort(() => Math.random() - 0.5);
      } else if (toDeck === 'PLAYER_DECK') {
        player.deck.push(...matches);
        player.deck.sort(() => Math.random() - 0.5);
      }

      const onomatopoeia = `SHUFFLE ${matches.length} CARDS!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'deck.shuffled',
        params: {
          player: player.name,
          count: matches.length,
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

    case 'SPAWN_NEMESIS': {
      return executeSequence(
        state,
        [
          {
            id: 'step_1_spawn_nemesis_minion',
            effect: 'PUT_INTO_PLAY',
            params: {
              from: 'SET_ASIDE',
              to: 'ENGAGED_WITH_PLAYER',
              filter: { type: 'minion', set: 'PLAYER_NEMESIS' },
            },
          },
          {
            id: 'step_2_spawn_nemesis_scheme',
            effect: 'PUT_INTO_PLAY',
            params: {
              from: 'SET_ASIDE',
              to: 'SIDE_SCHEMES',
              filter: { type: 'side_scheme', set: 'PLAYER_NEMESIS' },
            },
          },
          {
            id: 'step_3_shuffle_remaining_cards',
            effect: 'SHUFFLE_INTO_DECK',
            params: {
              from: 'SET_ASIDE',
              toDeck: 'ENCOUNTER_DECK',
              filter: { set: 'PLAYER_NEMESIS' },
            },
          },
          {
            id: 'step_4_fallback_surge',
            effect: 'TRIGGER_SURGE',
            gate: 'IF_FAILED',
          },
        ],
        context,
      );
    }

    case 'FLIP_FORM':
    case 'CHANGE_FORM': {
      const nextFormCard = player.availableForms.find((f) => f.code !== player.activeFormCard.code);
      if (nextFormCard) {
        player.activeFormCard = nextFormCard;
        player.currentForm = nextFormCard.type === CardType.HERO ? 'hero' : 'alter_ego';
      }
      const onomatopoeia = 'FLIP FORM!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.flipForm',
        params: { player: player.name, form: player.activeFormCard.name },
        onomatopoeia,
      });
      return { state, success: true, mutatedState: true, value: 1, onomatopoeia };
    }

    case 'DRAW_UP_TO_HAND_SIZE': {
      const targetHandSize =
        player.currentForm === 'hero'
          ? (player.hero.handSize || 5)
          : (player.alterEgo.handSize || 6);

      let drawnCount = 0;
      while (player.hand.length < targetHandSize && player.deck.length > 0) {
        const card = player.deck.shift();
        if (card) {
          player.hand.push(card);
          drawnCount += 1;
        }
      }

      const onomatopoeia = `REFILL HAND (+${drawnCount})!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.drawUpToHandSize',
        params: { player: player.name, drawnCount, targetHandSize },
        onomatopoeia,
      });
      return { state, success: true, mutatedState: drawnCount > 0, value: drawnCount, onomatopoeia };
    }

    case 'TRIGGER_SURGE':
    case 'SURGE': {
      const surgeCard = state.encounterDeck.shift();
      if (surgeCard) {
        player.dealtEncounterCards.push(surgeCard);
      }
      const onomatopoeia = 'SURGE!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'encounter.surge.triggered',
        params: { player: player.name },
        onomatopoeia,
      });
      return { state, success: true, mutatedState: true, value: 1, onomatopoeia };
    }

    case 'REVEAL_ENCOUNTER_CARD': {
      const extraCard = state.encounterDeck.shift();
      if (extraCard) {
        player.dealtEncounterCards.push(extraCard);
      }
      const onomatopoeia = 'REVEAL ENCOUNTER CARD!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'encounter.card.revealed',
        params: { player: player.name },
        onomatopoeia,
      });
      return { state, success: true, mutatedState: true, value: 1, onomatopoeia };
    }

    case 'ADD_THREAT': {
      const amount = (step.params?.amount as number) || 1;
      const target = (step.params?.target as string) || 'MAIN_SCHEME';
      state.mainScheme.threat = (state.mainScheme.threat || 0) + amount;
      const onomatopoeia = `SCHEME THREAT +${amount}!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'scheme.threat.added',
        params: { target, amount, total: state.mainScheme.threat },
        onomatopoeia,
      });
      return { state, success: true, mutatedState: amount > 0, value: amount, onomatopoeia };
    }

    case 'CANCEL_WHEN_REVEALED': {
      const onomatopoeia = 'CANCELLED!';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'encounter.whenRevealed.cancelled',
        params: { player: player.name },
        onomatopoeia,
      });
      return { state, success: true, mutatedState: true, value: 1, onomatopoeia };
    }

    case 'CHANGE_FORM_DRAW_TO_HAND_SIZE': {
      return executeSequence(
        state,
        [
          { id: 'step_1_flip', effect: 'FLIP_FORM' },
          { id: 'step_2_draw', effect: 'DRAW_UP_TO_HAND_SIZE' },
        ],
        context,
      );
    }

    case 'HULK_DISCARD_RESOLUTION': {
      const discarded = player.deck.shift();
      if (discarded) {
        player.discard.push(discarded);
        const cardRaw = discarded.card.raw || ({} as any);
        const hasPhysical = Boolean(cardRaw.resource_physical || (discarded.card as any).resource === 'physical');
        const hasEnergy = Boolean(cardRaw.resource_energy || (discarded.card as any).resource === 'energy');
        const hasMental = Boolean(cardRaw.resource_mental || (discarded.card as any).resource === 'mental');
        const hasWild = Boolean(cardRaw.resource_wild || (discarded.card as any).resource === 'wild');

        // Physical or Wild: Deal 2 damage to an enemy
        if (hasPhysical || hasWild) {
          state.villain.health = Math.max(0, state.villain.health - 2);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'hulk.physical.damage',
            params: { damage: 2, villain: state.villain.card.name },
            onomatopoeia: 'HULK SMASH! 2 DAMAGE!',
          });
        }

        // Energy or Wild: Deal 1 damage to each character
        if (hasEnergy || hasWild) {
          for (const p of state.players) {
            p.health = Math.max(0, p.health - 1);
            for (const a of p.allies) {
              if (!a.tokens) a.tokens = {};
              a.tokens.damage = (a.tokens.damage || 0) + 1;
            }
            for (const m of p.engagedMinions) {
              if (!m.tokens) m.tokens = {};
              m.tokens.damage = (m.tokens.damage || 0) + 1;
            }
          }
          state.villain.health = Math.max(0, state.villain.health - 1);
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: state.roundNumber,
            phase: state.phase,
            key: 'hulk.energy.aoe',
            params: { damage: 1 },
            onomatopoeia: 'ENERGY BURST! 1 DAMAGE TO ALL!',
          });
        }

        // Mental or Wild: Discard Hulk
        if (hasMental || hasWild) {
          const hulkIdx = player.allies.findIndex((a) => a.card.code === '01050');
          if (hulkIdx !== -1) {
            const [hulkAlly] = player.allies.splice(hulkIdx, 1);
            player.discard.push(hulkAlly);
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: state.roundNumber,
              phase: state.phase,
              key: 'hulk.mental.discard',
              params: { ally: 'Hulk' },
              onomatopoeia: 'HULK CALMS DOWN AND DISCARDS!',
            });
          }
        }
      }
      return { state, success: true, mutatedState: true, value: 1, onomatopoeia: 'HULK RESOLVED!' };
    }

    case 'ADD_COUNTER':
    case 'MODIFY_COUNTER': {
      const amount = (step.params?.amount as number) || 1;
      if (context.sourceCardInstance) {
        if (!context.sourceCardInstance.tokens) {
          context.sourceCardInstance.tokens = { damage: 0, threat: 0, counters: 0 };
        }
        context.sourceCardInstance.tokens.counters = (context.sourceCardInstance.tokens.counters || 0) + amount;
      }
      return { state, success: true, mutatedState: true, value: amount, onomatopoeia: `+${amount} COUNTERS!` };
    }

    case 'RETURN_TO_HAND': {
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
      return { state, success: true, mutatedState: true, onomatopoeia: 'RETURNED TO HAND!' };
    }

    case 'REPULSOR_BLAST':
    case 'REPULSOR_BLAST_DAMAGE': {
      const discardCount = (step.params?.discardCount as number) || 5;
      let energyCount = 0;

      for (let i = 0; i < discardCount; i++) {
        const drawn = drawPlayerCard(state, player.id);
        if (drawn) {
          player.discard.push(drawn);
          const raw = drawn.card.raw || ({} as any);
          const cardEnergy = raw.resource_energy || drawn.card.resources?.energy || 0;
          const cardWild = raw.resource_wild || drawn.card.resources?.wild || 0;
          energyCount += cardEnergy + cardWild;
        }
      }

      const totalDmg = 1 + energyCount * 2;
      const targetEnemy = context.targetType === 'minion' && context.targetInstanceId ? 'minion' : 'villain';

      if (targetEnemy === 'villain') {
        const toughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          state.villain.statusCards.splice(toughIdx, 1);
        } else {
          state.villain.health = Math.max(0, state.villain.health - totalDmg);
        }
      }

      const onomatopoeia = `REPULSOR BLAST! ${totalDmg} DAMAGE (${energyCount} ENERGY)!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'iron_man.repulsor_blast',
        params: { totalDmg, energyCount, villain: state.villain.card.name },
        onomatopoeia,
      });
      return { state, success: true, mutatedState: true, value: totalDmg, onomatopoeia };
    }

    case 'GENERATE_TOP_DISCARD_RESOURCES': {
      const topCard = player.discard[player.discard.length - 1];
      let resCount = 1;
      if (topCard) {
        resCount = topCard.card.resources?.total || 1;
      }
      return { state, success: true, mutatedState: true, value: resCount, onomatopoeia: `+${resCount} RESOURCES FROM DISCARD!` };
    }

    case 'RETRIEVE_CARD_FROM_DISCARD':
    case 'RETRIEVE_TECH_UPGRADE_FROM_DISCARD': {
      const traitFilter = (step.params?.trait as string) || 'Tech';
      // Search from top of discard (last item) downwards
      for (let i = player.discard.length - 1; i >= 0; i--) {
        const item = player.discard[i];
        if (item.card.traits?.includes(traitFilter) && item.card.type === CardType.UPGRADE) {
          const [retrieved] = player.discard.splice(i, 1);
          player.hand.push(retrieved);
          return { state, success: true, mutatedState: true, onomatopoeia: `RETRIEVED ${retrieved.card.name}!` };
        }
      }
      return { state, success: true, mutatedState: false, onomatopoeia: 'NO TECH UPGRADE IN DISCARD' };
    }

    case 'SEARCH_DECK_FOR_CARD':
    case 'SEARCH_AND_PLAY_UPGRADE': {
      const traitFilter = step.params?.trait as string | undefined;
      const typeFilter = (step.params?.type as string) || (step.params?.type_code as string) || 'upgrade';

      const matchIdx = player.deck.findIndex((c) => {
        const typeMatch = !typeFilter || c.card.type === typeFilter || c.card.raw.type_code === typeFilter;
        const traitMatch = !traitFilter || c.card.traits?.includes(traitFilter);
        return typeMatch && traitMatch;
      });

      if (matchIdx !== -1) {
        const [foundCard] = player.deck.splice(matchIdx, 1);
        if (step.effect === 'SEARCH_AND_PLAY_UPGRADE') {
          player.tableau.push(foundCard);
        } else {
          player.hand.push(foundCard);
        }
        // Shuffle deck after search
        player.deck = [...player.deck].sort(() => Math.random() - 0.5);
        return { state, success: true, mutatedState: true, onomatopoeia: `FOUND ${foundCard.card.name}!` };
      }

      // Target not found: shuffle deck
      player.deck = [...player.deck].sort(() => Math.random() - 0.5);
      return { state, success: true, mutatedState: false, onomatopoeia: 'TARGET NOT FOUND IN DECK' };
    }

    case 'SHUFFLE_DISCARD_INTO_DECK': {
      const count = (step.params?.count as number) || 3;
      const toShuffle = player.discard.splice(0, count);
      player.deck.push(...toShuffle);
      player.deck = [...player.deck].sort(() => Math.random() - 0.5);
      return { state, success: true, mutatedState: true, value: toShuffle.length, onomatopoeia: `SHUFFLED ${toShuffle.length} CARDS INTO DECK!` };
    }

    case 'TRIGGER_WAKANDA_UPGRADES':
    case 'EXECUTE_WAKANDA_FOREVER': {
      // Find all in-play Black Panther upgrades in player tableau
      const bpUpgrades = player.tableau.filter((t) =>
        t.card.traits?.includes('Black Panther') ||
        ['01046', '01047', '01048', '01049'].includes(t.card.code),
      );

      let executed = 0;
      for (let i = 0; i < bpUpgrades.length; i++) {
        const upgrade = bpUpgrades[i];
        const isFinal = i === bpUpgrades.length - 1;
        const code = upgrade.card.code;

        if (code === '01046') {
          // Energy Daggers: 1 damage to villain + minion (2 if final)
          const dmg = isFinal ? 2 : 1;
          dealDirectDamage(state, 'VILLAIN', dmg);
          for (const m of player.engagedMinions) {
            dealDirectDamage(state, { type: 'MINION', instanceId: m.instanceId }, dmg);
          }
        } else if (code === '01047') {
          // Panther Claws: 2 damage to enemy (4 if final)
          const dmg = isFinal ? 4 : 2;
          dealDirectDamage(state, 'VILLAIN', dmg);
        } else if (code === '01048') {
          // Tactical Genius: 1 threat removed (2 if final)
          const thw = isFinal ? 2 : 1;
          state.mainScheme.threat = Math.max(0, state.mainScheme.threat - thw);
        } else if (code === '01049') {
          // Vibranium Suit: Move 1 damage from BP to enemy (2 if final)
          const moveAmt = isFinal ? 2 : 1;
          player.health = Math.min(getEffectiveMaxHealth(player, state), player.health + moveAmt);
          dealDirectDamage(state, 'VILLAIN', moveAmt);
        }
        executed += 1;
      }

      const onomatopoeia = `WAKANDA FOREVER! (${executed} UPGRADES RESOLVED)`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'black_panther.wakanda_forever',
        params: { executed },
        onomatopoeia,
      });
      return { state, success: true, mutatedState: executed > 0, value: executed, onomatopoeia };
    }

    case 'DEAL_DAMAGE_ALL_ENEMIES': {
      const baseAmt = (step.params?.baseAmount as number) || (step.params?.amount as number) || 1;
      dealDirectDamage(state, 'VILLAIN', baseAmt);
      for (const m of player.engagedMinions) {
        dealDirectDamage(state, { type: 'MINION', instanceId: m.instanceId }, baseAmt);
      }
      return { state, success: true, mutatedState: true, value: baseAmt, onomatopoeia: `ALL ENEMIES HIT FOR ${baseAmt}!` };
    }

    case 'TRANSFER_DAMAGE': {
      const amount = (step.params?.baseAmount as number) || (step.params?.amount as number) || 1;
      player.health = Math.min(getEffectiveMaxHealth(player, state), player.health + amount);
      dealDirectDamage(state, 'VILLAIN', amount);
      return { state, success: true, mutatedState: true, value: amount, onomatopoeia: `TRANSFERRED ${amount} DAMAGE!` };
    }

    case 'BOOST_STAT_CHOICE': {
      const amount = (step.params?.amount as number) || 2;
      const chosenStat = (context.choice as string) || (step.params?.stat as string) || 'ATK';
      if (context.sourceCardInstance) {
        if (!context.sourceCardInstance.tokens) {
          context.sourceCardInstance.tokens = { damage: 0, threat: 0, counters: 0 };
        }
        if (chosenStat === 'THW' || chosenStat === 'THWART') {
          (context.sourceCardInstance.tokens as any).thwBonus = ((context.sourceCardInstance.tokens as any).thwBonus || 0) + amount;
        } else {
          (context.sourceCardInstance.tokens as any).atkBonus = ((context.sourceCardInstance.tokens as any).atkBonus || 0) + amount;
        }
      }
      return { state, success: true, mutatedState: true, value: amount, onomatopoeia: `+${amount} ${chosenStat}!` };
    }

    case 'BUFF_ALL_FRIENDLY_CHARACTERS': {
      const atkBonus = (step.params?.atkBonus as number) || 1;
      const thwBonus = (step.params?.thwBonus as number) || 1;
      for (const a of player.allies) {
        if (!a.tokens) a.tokens = { damage: 0, threat: 0, counters: 0 };
        (a.tokens as any).atkBonus = ((a.tokens as any).atkBonus || 0) + atkBonus;
        (a.tokens as any).thwBonus = ((a.tokens as any).thwBonus || 0) + thwBonus;
      }
      return { state, success: true, mutatedState: true, onomatopoeia: `+${atkBonus} ATK / +${thwBonus} THW TO ALL CHARACTERS!` };
    }

    case 'CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER': {
      const replacement = drawEncounterCard(state);
      if (replacement) {
        player.dealtEncounterCards.push(replacement);
      }
      return { state, success: true, mutatedState: true, onomatopoeia: 'CANCELLED & REVEALED ANOTHER!' };
    }

    case 'ATTACH_FACEDOWN_CARDS_FROM_HAND': {
      for (const p of state.players) {
        if (p.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * p.hand.length);
          const [removed] = p.hand.splice(randIdx, 1);
          if (context.sourceCardInstance) {
            if (!context.sourceCardInstance.attachments) context.sourceCardInstance.attachments = [];
            context.sourceCardInstance.attachments.push({ ...removed, ownerId: p.id } as any);
          }
        }
      }
      return { state, success: true, mutatedState: true, onomatopoeia: 'CARDS ATTACHED FACEDOWN!' };
    }

    case 'RETURN_FACEDOWN_CARDS_TO_OWNERS': {
      if (context.sourceCardInstance && context.sourceCardInstance.attachments) {
        for (const card of context.sourceCardInstance.attachments) {
          const ownerId = (card as any).ownerId;
          const owner = state.players.find((p) => p.id === ownerId) || player;
          owner.hand.push(card);
        }
        context.sourceCardInstance.attachments = [];
      }
      return { state, success: true, mutatedState: true, onomatopoeia: 'CARDS RETURNED TO HANDS!' };
    }

    default:
      return { state, success: true, onomatopoeia: 'RESOLVED!' };
  }
}

/**
 * Executes direct damage dealing outside standard basic/event combat attacks.
 * Direct damage bypasses Hero DEF and Ally block mitigation, but is absorbed by Tough and universal prevention.
 */
export function dealDirectDamage(
  state: GameState,
  target: 'HERO' | 'VILLAIN' | { type: 'MINION'; instanceId: string } | { type: 'ALLY'; instanceId: string },
  amount: number,
  playerId?: string,
): { damageDealt: number; absorbedByTough: boolean } {
  if (amount <= 0) return { damageDealt: 0, absorbedByTough: false };

  if (target === 'HERO') {
    const player = state.players.find((p) => p.id === playerId) || state.players[0];
    const toughIdx = player.statusCards.indexOf(StatusCard.TOUGH);
    if (toughIdx !== -1) {
      player.statusCards.splice(toughIdx, 1);
      return { damageDealt: 0, absorbedByTough: true };
    }
    const prevResult = dispatchTrigger(state, 'TAKE_DAMAGE', {
      targetPlayerId: player.id,
      damageAmount: amount,
    });
    const finalDmg = prevResult.damageAmount ?? amount;
    player.health = Math.max(0, player.health - finalDmg);
    return { damageDealt: finalDmg, absorbedByTough: false };
  }

  if (target === 'VILLAIN') {
    const toughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
    if (toughIdx !== -1) {
      state.villain.statusCards.splice(toughIdx, 1);
      return { damageDealt: 0, absorbedByTough: true };
    }
    state.villain.health = Math.max(0, state.villain.health - amount);
    return { damageDealt: amount, absorbedByTough: false };
  }

  return { damageDealt: amount, absorbedByTough: false };
}
