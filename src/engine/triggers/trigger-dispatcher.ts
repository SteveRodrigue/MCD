import { GameState, TriggerType, AbilityStep } from '@engine/models';
import { executeEffect } from '../effects';
import { executeAbilityCost, canPayAbilityCost } from '../pipeline/cost-engine';
import { enqueueDecisionPrompt } from '../pipeline/prompt-queue';

export interface TriggerContext {
  targetPlayerId: string;
  sourceInstanceId?: string;
  damageAmount?: number;
  preventedDamage?: boolean;
  threatAmount?: number;
  targetType?: string;
  targetInstanceId?: string;
  acceptOptionalTriggers?: boolean;
  encounterCardInstance?: any;
}

export interface TriggerDispatchResult {
  state: GameState;
  preventedDamage?: boolean;
  damageAmount?: number;
  threatAmount?: number;
  cancelled?: boolean;
  hasPendingPrompt?: boolean;
}

/**
 * Format ability steps into a concise summary: 'trigger -> step(s)'.
 * Example: 'VILLAIN_INITIATES_ATTACK -> DRAW_CARDS (1)'
 */
export function formatAbilityStepsSummary(trigger: string, steps: AbilityStep[]): string {
  const stepDescriptions = (steps || [])
    .map((s) => {
      if (s.effect === 'DRAW_CARDS') return `DRAW_CARDS (${s.params?.count ?? 1})`;
      if (s.effect === 'DEAL_DAMAGE') return `DEAL_DAMAGE (${s.params?.amount ?? 1})`;
      if (s.effect === 'REMOVE_THREAT') return `REMOVE_THREAT (${s.params?.amount ?? 1})`;
      if (s.effect === 'HEAL_DAMAGE') return `HEAL_DAMAGE (${s.params?.amount ?? 1})`;
      if (s.effect === 'ADD_STATUS') return `ADD_STATUS (${s.params?.status})`;
      if (s.effect === 'PREVENT_DAMAGE') return `PREVENT_DAMAGE (${s.params?.amount ?? 'ALL'})`;
      return s.effect;
    })
    .join(', ');
  return `${trigger} -> ${stepDescriptions}`;
}

/**
 * Generic Trigger Dispatcher: Resolves all matching declarative abilities for a given trigger event.
 * Eliminates all hardcoded card codes from engine pipelines!
 * Prompts player for optional interrupts and responses per RR v1.8 while auto-executing FORCED_ triggers.
 */
export function dispatchTrigger(
  state: GameState,
  trigger: TriggerType,
  context: TriggerContext,
): TriggerDispatchResult {
  const player = state.players.find((p) => p.id === context.targetPlayerId);
  if (!player) return { state };

  let currentDamage = context.damageAmount ?? 0;
  let isPrevented = context.preventedDamage ?? false;
  let currentThreat = context.threatAmount ?? 0;
  let isCancelled = false;
  let hasPendingPrompt = false;

  // 1. Scan in-play identity card abilities (e.g. Spider-Sense on Spider-Man 01001a)
  const identityAbilities = player.activeFormCard.enrichment?.abilities || [];
  for (const ability of identityAbilities) {
    if (ability.trigger === trigger) {
      const isForced = ability.timing.startsWith('FORCED_');
      if (isForced || context.acceptOptionalTriggers === true) {
        if (ability.cost) {
          executeAbilityCost(state, player, ability);
        }
        executeEffect(state, ability, {
          playerId: player.id,
          targetType: context.targetType as any,
          targetInstanceId: context.targetInstanceId,
        });
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: `ability.${ability.id}.triggered`,
          params: { player: player.name },
          onomatopoeia: 'ABILITY TRIGGERED!',
        });
      } else {
        // Optional Identity Ability: Check cost & limits before prompting
        const costCheck = canPayAbilityCost(state, player, ability);
        if (!costCheck.allowed) continue;

        if (ability.limit === 'ONCE_PER_ROUND' && player.usedAbilitiesThisRound?.[ability.id]) {
          continue;
        }
        if (ability.limit === 'ONCE_PER_PHASE' && player.usedAbilitiesThisPhase?.[ability.id]) {
          continue;
        }

        const cardName = player.activeFormCard.name;
        enqueueDecisionPrompt(state, {
          promptId: `prompt_trigger_${ability.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          playerId: player.id,
          title: `Do you want to use the following ability from ${cardName}?`,
          description: formatAbilityStepsSummary(trigger, ability.steps || []),
          sourceCardName: cardName,
          isVoluntary: true,
          options: [
            {
              id: `trigger_${ability.id}`,
              label: 'Yes',
              effect: 'EXECUTE_OPTIONAL_TRIGGER',
              params: {
                ability,
                context,
              },
            },
            {
              id: 'pass',
              label: 'No',
              effect: 'PASS',
            },
          ],
        });
        hasPendingPrompt = true;
      }
    }
  }

  // 2. Scan tableau, allies & in-play cards
  for (const cardInst of [...player.tableau, ...player.allies, ...(player.attachments || [])]) {
    const abilities = cardInst.card.enrichment?.abilities || [];
    for (const ability of abilities) {
      if (ability.trigger === trigger) {
        if (
          cardInst.card.type === 'ally' &&
          (trigger === 'THWART_RESOLVED' || trigger === 'ATTACK_RESOLVED')
        ) {
          if (context.sourceInstanceId && context.sourceInstanceId !== cardInst.instanceId) {
            continue;
          }
          if (!context.sourceInstanceId) {
            continue;
          }
        }

        const isForced = ability.timing.startsWith('FORCED_');
        if (isForced || context.acceptOptionalTriggers === true) {
          if (ability.cost) {
            const costCheck = canPayAbilityCost(state, player, ability, cardInst);
            if (!costCheck.allowed) continue;
            executeAbilityCost(state, player, ability, cardInst);
          }
          executeEffect(state, ability, {
            playerId: player.id,
            sourceCardInstance: cardInst,
            targetType: context.targetType as any,
            targetInstanceId: context.targetInstanceId,
          });
        } else {
          // Optional In-Play Ability: Check cost & limits before prompting
          const costCheck = canPayAbilityCost(state, player, ability, cardInst);
          if (!costCheck.allowed) continue;

          if (ability.limit === 'ONCE_PER_ROUND' && player.usedAbilitiesThisRound?.[ability.id]) {
            continue;
          }
          if (ability.limit === 'ONCE_PER_PHASE' && player.usedAbilitiesThisPhase?.[ability.id]) {
            continue;
          }

          const cardName = cardInst.card.name;
          enqueueDecisionPrompt(state, {
            promptId: `prompt_trigger_${ability.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            playerId: player.id,
            title: `Do you want to use the following ability from ${cardName}?`,
            description: formatAbilityStepsSummary(trigger, ability.steps || []),
            sourceCardName: cardName,
            isVoluntary: true,
            options: [
              {
                id: `trigger_${ability.id}`,
                label: 'Yes',
                effect: 'EXECUTE_OPTIONAL_TRIGGER',
                params: {
                  ability,
                  context,
                  sourceCardInstanceId: cardInst.instanceId,
                },
              },
              {
                id: 'pass',
                label: 'No',
                effect: 'PASS',
              },
            ],
          });
          hasPendingPrompt = true;
        }
      }
    }
  }

  // 3. Scan in-hand cards for Hand Damage triggers (e.g. Backflip for TAKE_ATTACK_DAMAGE)
  if (trigger === 'TAKE_ATTACK_DAMAGE' && currentDamage > 0) {
    const handInterruptIdx = player.hand.findIndex((c) => {
      const abilities = c.card.enrichment?.abilities || [];
      return abilities.some((a) => a.trigger === trigger && a.zone === 'HAND');
    });

    if (handInterruptIdx !== -1) {
      const interruptCard = player.hand[handInterruptIdx];
      const ability = interruptCard.card.enrichment!.abilities!.find(
        (a) => a.trigger === trigger && a.zone === 'HAND',
      )!;

      const isForced = ability.timing.startsWith('FORCED_');
      if (isForced || context.acceptOptionalTriggers === true) {
        player.hand.splice(handInterruptIdx, 1);
        if (ability.cost?.discardSelf !== false) {
          player.discard.push(interruptCard);
        }
        const firstStep = ability.steps?.[0];
        if (firstStep?.effect === 'PREVENT_DAMAGE') {
          currentDamage = 0;
          isPrevented = true;
          state.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            key: `card.${interruptCard.card.code}.preventedDamage`,
            params: { player: player.name },
            onomatopoeia: 'DEFENSE! (0 DAMAGE)',
          });
        }
      } else {
        const cardName = interruptCard.card.name;
        enqueueDecisionPrompt(state, {
          promptId: `prompt_trigger_${ability.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          playerId: player.id,
          title: `Do you want to use the following ability from ${cardName}?`,
          description: formatAbilityStepsSummary(trigger, ability.steps || []),
          sourceCardName: cardName,
          isVoluntary: true,
          options: [
            {
              id: `trigger_${ability.id}`,
              label: 'Yes',
              effect: 'EXECUTE_OPTIONAL_TRIGGER',
              params: {
                ability,
                context,
                sourceCardInstanceId: interruptCard.instanceId,
              },
            },
            {
              id: 'pass',
              label: 'No',
              effect: 'PASS',
            },
          ],
        });
        hasPendingPrompt = true;
      }
    }
  }

  // 4. Scan in-hand cards for Threat Placement triggers (e.g. Emergency 01085)
  if (trigger === 'THREAT_WOULD_BE_PLACED' && currentThreat > 0) {
    for (const p of state.players) {
      const handInterruptIdx = p.hand.findIndex((c) => {
        const abilities = c.card.enrichment?.abilities || [];
        return abilities.some((a) => a.trigger === trigger && a.zone === 'HAND');
      });

      if (handInterruptIdx !== -1 && currentThreat > 0) {
        const interruptCard = p.hand[handInterruptIdx];
        const ability = interruptCard.card.enrichment!.abilities!.find(
          (a) => a.trigger === trigger && a.zone === 'HAND',
        )!;

        const isForced = ability.timing.startsWith('FORCED_');
        if (isForced || context.acceptOptionalTriggers === true) {
          p.hand.splice(handInterruptIdx, 1);
          if (ability.cost?.discardSelf !== false) {
            p.discard.push(interruptCard);
          }
          const threatStep =
            ability.steps?.find((s) => s.effect === 'REMOVE_THREAT') || ability.steps?.[0];
          if (threatStep?.effect === 'REMOVE_THREAT') {
            const reduction = Number(threatStep.params?.amount ?? 1);
            currentThreat = Math.max(0, currentThreat - reduction);
            state.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              key: `card.${interruptCard.card.code}.threatReduced`,
              params: { player: p.name, reduction },
              onomatopoeia: 'EMERGENCY!',
            });
          }
        } else {
          const cardName = interruptCard.card.name;
          enqueueDecisionPrompt(state, {
            promptId: `prompt_trigger_${ability.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            playerId: p.id,
            title: `Do you want to use the following ability from ${cardName}?`,
            description: formatAbilityStepsSummary(trigger, ability.steps || []),
            sourceCardName: cardName,
            isVoluntary: true,
            options: [
              {
                id: `trigger_${ability.id}`,
                label: 'Yes',
                effect: 'EXECUTE_OPTIONAL_TRIGGER',
                params: {
                  ability,
                  context,
                  sourceCardInstanceId: interruptCard.instanceId,
                },
              },
              {
                id: 'pass',
                label: 'No',
                effect: 'PASS',
              },
            ],
          });
          hasPendingPrompt = true;
        }
      }
    }
  }

  // 5. Scan in-hand cards for Encounter / Treachery triggers (e.g. Enhanced Spider-Sense 01004, Get Behind Me! 01078)
  if (trigger === 'WHEN_REVEALED' || trigger === 'TREACHERY_REVEALED') {
    const handInterruptIdx = player.hand.findIndex((c) => {
      const abilities = c.card.enrichment?.abilities || [];
      return abilities.some((a) => {
        if (a.trigger !== trigger || a.zone !== 'HAND') return false;
        if (a.timing.startsWith('HERO_') && player.currentForm !== 'hero') return false;
        if (a.timing.startsWith('ALTER_EGO_') && player.currentForm !== 'alter_ego') return false;
        const costCheck = canPayAbilityCost(state, player, a, c);
        return costCheck.allowed;
      });
    });

    if (handInterruptIdx !== -1) {
      const interruptCard = player.hand[handInterruptIdx];
      const ability = interruptCard.card.enrichment!.abilities!.find(
        (a) =>
          a.trigger === trigger &&
          a.zone === 'HAND' &&
          (!a.timing.startsWith('HERO_') || player.currentForm === 'hero') &&
          (!a.timing.startsWith('ALTER_EGO_') || player.currentForm === 'alter_ego'),
      )!;

      const isForced = ability.timing.startsWith('FORCED_');
      if (isForced || context.acceptOptionalTriggers === true) {
        player.hand.splice(handInterruptIdx, 1);
        if (ability.cost?.discardSelf !== false) {
          player.discard.push(interruptCard);
        }
        executeEffect(state, ability, {
          playerId: player.id,
          sourceCardInstance: interruptCard,
        });
        isCancelled = true;
        if (state.activeEncounterContext) {
          state.activeEncounterContext.cancelled = true;
        }
      } else {
        const cardName = interruptCard.card.name;
        enqueueDecisionPrompt(state, {
          promptId: `prompt_trigger_${ability.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          playerId: player.id,
          title: `Do you want to use the following ability from ${cardName}?`,
          description: formatAbilityStepsSummary(trigger, ability.steps || []),
          sourceCardName: cardName,
          isVoluntary: true,
          options: [
            {
              id: `trigger_${ability.id}`,
              label: 'Yes',
              effect: 'EXECUTE_OPTIONAL_TRIGGER',
              params: {
                ability,
                context,
                sourceCardInstanceId: interruptCard.instanceId,
              },
            },
            {
              id: 'pass',
              label: 'No',
              effect: 'PASS',
            },
          ],
        });
        hasPendingPrompt = true;
      }
    }
  }

  return {
    state,
    damageAmount: currentDamage,
    preventedDamage: isPrevented,
    threatAmount: currentThreat,
    cancelled: isCancelled,
    hasPendingPrompt,
  };
}
