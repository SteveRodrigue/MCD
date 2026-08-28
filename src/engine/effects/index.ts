import {
  GameState,
  CardInstance,
  StatusCard,
  MinionCard,
  CardAbility,
} from '@engine/models';
import { handleVillainDefeat } from '../pipeline/scenario-helpers';

export interface EffectExecutionContext {
  playerId: string;
  sourceCardInstance?: CardInstance;
  targetType?: 'villain' | 'minion' | 'main_scheme' | 'side_scheme';
  targetInstanceId?: string;
}

export interface EffectResult {
  state: GameState;
  success: boolean;
  error?: string;
  onomatopoeia?: string;
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

  switch (ability.effect) {
    case 'DRAW_CARDS': {
      const count = (ability.params?.count as number) || 1;
      let drawnCount = 0;
      for (let i = 0; i < count; i++) {
        const drawn = player.deck.shift();
        if (drawn) {
          player.hand.push(drawn);
          drawnCount += 1;
        }
      }
      const onomatopoeia = `DRAW +${drawnCount}!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.drawCards',
        params: {
          player: player.name,
          count: drawnCount,
          handSize: player.hand.length,
        },
        onomatopoeia,
      });
      return {
        state,
        success: true,
        onomatopoeia,
      };
    }

    case 'DEAL_DAMAGE': {
      const amount = (ability.params?.amount as number) || 0;
      const targetParam = ability.params?.target as string | undefined;
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
      const healed = Math.min(player.maxHealth - player.health, amount);
      player.health += healed;

      const onomatopoeia = `HEAL +${healed} HP!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.heal',
        params: {
          player: player.name,
          amount: healed,
          health: player.health,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
        onomatopoeia,
      };
    }

    case 'PREVENT_DAMAGE': {
      return {
        state,
        success: true,
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
      const amount = (ability.params?.amount as number) || 0;
      state.mainScheme.threat = Math.max(0, state.mainScheme.threat - amount);

      const onomatopoeia = `-${amount} THREAT!`;
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: state.roundNumber,
        phase: state.phase,
        key: 'card.effect.removeThreat',
        params: {
          player: player.name,
          amount,
          remainingThreat: state.mainScheme.threat,
        },
        onomatopoeia,
      });

      return {
        state,
        success: true,
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

      if (target === 'VILLAIN' || target === 'CHOSEN_ENEMY') {
        if (!state.villain.statusCards.includes(status)) {
          state.villain.statusCards.push(status);
        }
      } else if (target === 'HERO' || target === 'ALL_HEROES') {
        for (const p of state.players) {
          if (!p.statusCards.includes(status)) {
            p.statusCards.push(status);
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
        },
        onomatopoeia,
      });

      return { state, success: true, onomatopoeia };
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

    default:
      return { state, success: true, onomatopoeia: 'RESOLVED!' };
  }
}
