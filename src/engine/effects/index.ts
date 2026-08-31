import {
  GameState,
  CardInstance,
  StatusCard,
  MinionCard,
  CardAbility,
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

export interface EffectExecutionContext {
  playerId: string;
  sourceCardInstance?: CardInstance;
  targetType?: 'villain' | 'minion' | 'main_scheme' | 'side_scheme';
  targetInstanceId?: string;
  resourcesSpent?: string[];
  previousResult?: StepResolutionResult;
  collectedCardInstanceIds?: string[];
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
  step: CardAbility,
  context: EffectExecutionContext,
): boolean {
  if (!gate || gate === 'ALWAYS') return true;

  if (gate === 'THEN' || gate === 'IF_PREVIOUS_SUCCESS') {
    return !!prevResult && prevResult.success && prevResult.mutatedState;
  }

  if (gate === 'IF_AMOUNT_ZERO' || gate === 'IF_ZERO_HEALED') {
    return !!prevResult && (!prevResult.mutatedState || (prevResult.value ?? 0) === 0);
  }

  if (gate === 'IF_FAILED') {
    return !prevResult || !prevResult.success || !prevResult.mutatedState;
  }

  if (gate === 'IF_ALREADY_HAS_STATUS') {
    if (prevResult && prevResult.conditionMet !== undefined) {
      return prevResult.conditionMet;
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
  sequence: CardAbility[],
  context: EffectExecutionContext,
): EffectResult {
  let currentState = state;
  let prevResult: StepResolutionResult | undefined = context.previousResult;
  const onomatopoeias: string[] = [];

  for (const step of sequence) {
    const shouldRun = shouldExecuteStep(step.gate, prevResult, currentState, step, context);
    if (!shouldRun) {
      continue;
    }

    const stepContext: EffectExecutionContext = {
      ...context,
      previousResult: prevResult,
      targetInstanceId:
        step.params?.target === 'PREVIOUS_TARGET' ? prevResult?.targetId : context.targetInstanceId,
    };

    const res = executeEffect(currentState, step, stepContext);
    currentState = res.state;
    if (res.onomatopoeia) onomatopoeias.push(res.onomatopoeia);

    prevResult = {
      success: res.success,
      mutatedState: res.mutatedState ?? res.success,
      value: res.value,
      selectedCardInstanceIds: res.selectedCardInstanceIds,
      targetId: res.targetId,
      conditionMet: res.conditionMet,
    };
  }

  return {
    state: currentState,
    success: true,
    onomatopoeia: onomatopoeias.join(' -> ') || 'SEQUENCE RESOLVED!',
    mutatedState: prevResult?.mutatedState ?? true,
    value: prevResult?.value,
  };
}

/**
 * Executes a declarative effect primitive on the GameState.
 */
export function executeEffect(
  state: GameState,
  ability: CardAbility,
  context: EffectExecutionContext,
): EffectResult {
  const player = state.players.find((p) => p.id === context.playerId);
  if (!player) return { state, success: false, error: 'Player not found' };

  if (Array.isArray(ability.sequence) && ability.sequence.length > 0) {
    return executeSequence(state, ability.sequence, context);
  }

  switch (ability.effect) {
    case 'DRAW_CARDS': {
      const count = (ability.params?.count as number) || 1;
      const targetParam = ability.params?.target as string | undefined;
      const targetPlayers = targetParam === 'ALL_PLAYERS' ? state.players : [player];
      let totalDrawn = 0;

      for (const p of targetPlayers) {
        let drawnForP = 0;
        for (let i = 0; i < count; i++) {
          const drawn = p.deck.shift();
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
      const amount = (ability.params?.amount as number) || 0;
      const targetParam = ability.params?.target as string | undefined;

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

      if (targetType === 'villain') {
        const toughIdx = state.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          state.villain.statusCards.splice(toughIdx, 1);
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
          return abs.some((a) => a.effect === 'ATTACHMENT_DAMAGE_SHIELD');
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
      }

      if (targetType === 'minion' && context.targetInstanceId) {
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
              p.engagedMinions.splice(minionIdx, 1);
              state.encounterDiscard.push(minion);

              // Process attached cards on defeated minion (e.g. Spider-Tracer 01008)
              for (const att of minion.attachments || []) {
                const attAbs = att.card.enrichment?.abilities || [];
                for (const ab of attAbs) {
                  if (ab.effect === 'WHEN_ATTACHED_HOST_DEFEATED') {
                    const removeAmount = (ab.params?.amount as number) || 3;
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
                player.discard.push(att);
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

      return { state, success: false, error: 'Target not found for damage effect' };
    }

    case 'HEAL_DAMAGE': {
      const amount = (ability.params?.amount as number) || 0;
      const target = (ability.params?.target as string) || 'SELF';
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
      return {
        state,
        success: true,
        mutatedState: true,
        onomatopoeia: 'DAMAGE PREVENTED!',
      };
    }

    case 'GENERATE_RESOURCE': {
      const resourceType = (ability.params?.resource as string) || 'wild';
      const amount = (ability.params?.amount as number) || 1;

      return {
        state,
        success: true,
        onomatopoeia: `+${amount} [${resourceType}] RESOURCE!`,
      };
    }

    case 'REMOVE_THREAT': {
      const amount = (ability.params?.amount as number) || 1;
      const targetParam = (ability.params?.target as string) || 'MAIN_SCHEME';
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
      const statusParam = ability.params?.status;
      if (statusParam === 'TOUGH' || statusParam === StatusCard.TOUGH) status = StatusCard.TOUGH;
      if (statusParam === 'CONFUSED' || statusParam === StatusCard.CONFUSED) status = StatusCard.CONFUSED;
      if (statusParam === 'STUNNED' || statusParam === StatusCard.STUNNED) status = StatusCard.STUNNED;

      const target = (ability.params?.target as string) || 'VILLAIN';
      let mutatedState = false;
      let alreadyHadStatus = false;

      if (target === 'VILLAIN' || target === 'CHOSEN_ENEMY') {
        if (!state.villain.statusCards.includes(status)) {
          state.villain.statusCards.push(status);
          mutatedState = true;
        } else {
          alreadyHadStatus = true;
        }
      } else if (target === 'HERO' || target === 'ALL_HEROES') {
        for (const p of state.players) {
          if (!p.statusCards.includes(status)) {
            p.statusCards.push(status);
            mutatedState = true;
          } else {
            alreadyHadStatus = true;
          }
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
      const count = (ability.params?.count as number) || 2;
      const filterRes = (ability.params?.filterResource as string) || 'mental';
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
      const lookCount = (ability.params?.lookCount as number) || 3;
      const trait = (ability.params?.trait as string) || 'Tech';

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

      state.pendingDecisionPrompt = {
        promptId: `futurist_${Date.now()}`,
        playerId: player.id,
        title: 'FUTURIST (Tony Stark)',
        description: `Revealed top ${scryedCards.length} cards from your deck. Select a ${trait} card to add to your hand, or choose to discard all:`,
        sourceCardName: 'Tony Stark',
        options,
        revealedCards,
      };

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
      const takeId = ability.params?.takeInstanceId as string | null | undefined;
      const scryedIds = (ability.params?.scryedInstanceIds as string[]) || [];

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
      const amount = (ability.params?.amount as number) || 4;
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
      const amountPerPlayer = (ability.params?.amount as number) || 1;
      const totalToAdd = amountPerPlayer * state.players.length;
      const target = (ability.params?.target as string) || 'THIS_SIDE_SCHEME';

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
      const targetHost = ability.params?.target as string;
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
      const count = (ability.params?.count as number) || 1;
      for (let i = 0; i < count; i++) {
        const card = state.encounterDeck.shift();
        if (card) state.encounterDiscard.push(card);
      }
      return { state, success: true, onomatopoeia: `DISCARDED ${count} ENCOUNTER CARDS!` };
    }

    case 'PLAYER_CHOICE': {
      const options = (ability.params?.options as any[]) || [];
      const title = (ability.params?.title as string) || 'Choose an Option';
      const description = (ability.params?.description as string) || '';
      const sourceCardName = context.sourceCardInstance?.card.name || ability.id;

      state.pendingDecisionPrompt = {
        promptId: `prompt_${Date.now()}_${ability.id}`,
        playerId: context.playerId || player.id,
        title,
        description,
        sourceCardName,
        options,
      };

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'decision.prompt.opened',
        params: { player: player.name, promptId: state.pendingDecisionPrompt.promptId, source: sourceCardName },
        onomatopoeia: 'CHOICE REQUIRED!',
      });

      return { state, success: true, onomatopoeia: 'CHOOSE AN OPTION!' };
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
        executeVillainAttackAgainstPlayer(state, player);
        for (const minion of [...player.engagedMinions]) {
          executeMinionAttackAgainstPlayer(state, minion, player);
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
      const amount = (ability.params?.amount as number) || 4;
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

    case 'SPAWN_NEMESIS': {
      const heroSetCode = player.hero.setCode || '';
      const nemesisSetCode = heroSetCode ? `${heroSetCode}_nemesis` : '';

      // 1. Find all set-aside cards belonging specifically to this hero's nemesis set
      const nemesisCards = player.setAsideCards.filter(
        (c) => c.card.setCode === nemesisSetCode || (c.card.setCode && c.card.setCode.includes('nemesis')),
      );

      // 2. Find all nemesis minions in this subset (supports 1 or more minions)
      const nemesisMinions = nemesisCards.filter((c) => c.card.type === CardType.MINION);

      // If no nemesis minion is in the set-aside pool, the card gains surge
      if (nemesisMinions.length === 0) {
        const surgeCard = state.encounterDeck.shift();
        if (surgeCard) player.dealtEncounterCards.push(surgeCard);

        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: state.roundNumber,
          phase: state.phase,
          category: 'ability',
          key: 'nemesis.spawn.surge',
          params: { player: player.name },
          onomatopoeia: 'SURGE! (NEMESIS UNAVAILABLE)',
        });

        return { state, success: true, onomatopoeia: 'SURGE!' };
      }

      // 3. Put all nemesis minions into play engaged with this player
      for (const minion of nemesisMinions) {
        // Check Toughness
        const hasToughness =
          (minion.card.traits || []).includes('Toughness') ||
          (minion.card.text || '').toLowerCase().includes('toughness');
        if (hasToughness) {
          if (!minion.statusCards) minion.statusCards = [];
          if (!minion.statusCards.includes(StatusCard.TOUGH)) {
            minion.statusCards.push(StatusCard.TOUGH);
          }
        }

        player.engagedMinions.push(minion);

        // Check Quickstrike (attacks immediately if player is in Hero form)
        const hasQuickstrike =
          (minion.card.traits || []).includes('Quickstrike') ||
          (minion.card.text || '').includes('Quickstrike');
        if (hasQuickstrike && player.currentForm === 'hero') {
          executeMinionAttackAgainstPlayer(state, minion, player);
        }

        // Execute minion When Revealed / Forced Response abilities
        const abilities = minion.card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'FORCED_RESPONSE') {
            executeEffect(state, ability, { playerId: player.id, sourceCardInstance: minion });
          }
        }
      }

      // 4. Reveal the Nemesis Side Scheme
      const nemesisScheme = nemesisCards.find((c) => c.card.type === CardType.SIDE_SCHEME);
      if (nemesisScheme) {
        const sideCard = nemesisScheme.card as SideSchemeCard;
        const baseThreat = sideCard.baseThreat * (sideCard.baseThreatFixed ? 1 : state.players.length);
        state.sideSchemes.push({
          instanceId: nemesisScheme.instanceId,
          card: sideCard,
          threat: baseThreat,
        });

        const schemeAbilities = sideCard.enrichment?.abilities || [];
        for (const ability of schemeAbilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'FORCED_RESPONSE') {
            executeEffect(state, ability, { playerId: player.id, sourceCardInstance: nemesisScheme });
          }
        }
      }

      // 5. Shuffle remaining nemesis cards for this hero into the encounter deck
      const spawnedInstanceIds = new Set([
        ...nemesisMinions.map((m) => m.instanceId),
        ...(nemesisScheme ? [nemesisScheme.instanceId] : []),
      ]);
      const remainingCards = nemesisCards.filter((c) => !spawnedInstanceIds.has(c.instanceId));
      state.encounterDeck.push(...remainingCards);
      state.encounterDeck.sort(() => Math.random() - 0.5);

      // 6. Cleanly prune ONLY this hero's nemesis cards from player.setAsideCards (leaving other set-aside cards untouched)
      player.setAsideCards = player.setAsideCards.filter(
        (c) => c.card.setCode !== nemesisSetCode && !nemesisCards.some((nc) => nc.instanceId === c.instanceId),
      );

      const minionNames = nemesisMinions.map((m) => m.card.name).join(', ');
      const onomatopoeia = `NEMESIS ARRIVES! ${minionNames.toUpperCase()}!`;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        category: 'ability',
        key: 'nemesis.spawn.success',
        params: {
          player: player.name,
          minions: minionNames,
          sideScheme: nemesisScheme?.card.name || 'None',
        },
        onomatopoeia,
      });

      return { state, success: true, onomatopoeia };
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
      const amount = (ability.params?.amount as number) || 1;
      const target = (ability.params?.target as string) || 'MAIN_SCHEME';
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
          { id: 'step_1_flip', timing: 'ACTION', effect: 'FLIP_FORM' },
          { id: 'step_2_draw', timing: 'ACTION', effect: 'DRAW_UP_TO_HAND_SIZE' },
        ],
        context,
      );
    }

    default:
      return { state, success: true, onomatopoeia: 'RESOLVED!' };
  }
}
