import {
  GameState,
  GameAction,
  ActionResult,
  StatusCard,
  CardType,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  AllyCard,
  CardInstance,
  GamePhase,
} from '@engine/models';
import {
  getPlayer,
  canChangeForm,
  canBasicRecover,
  canBasicAttack,
  canBasicThwart,
  canPlayCard,
} from './legality-checker';
import { executeEffect } from '../effects';
import { executeVillainPhase } from './villain-phase';
import { handleVillainDefeat } from './scenario-helpers';
import { getEffectiveAllyStats, getEffectiveHeroStats } from './stat-calculator';

/**
 * Pure state reducer / action dispatcher executing player commands in accordance with RR v1.8.
 */
export function dispatchAction(
  state: GameState,
  action: GameAction,
): { state: GameState; result: ActionResult } {
  // Clone state immutably for pure state transition
  const nextState: GameState = JSON.parse(JSON.stringify(state));

  switch (action.type) {
    case 'RESOLVE_MULLIGAN': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      if (!nextState.setupState || nextState.setupState.stage !== 'MULLIGAN_PHASE') {
        return { state, result: { success: false, error: 'Game is not currently in the Mulligan Phase' } };
      }

      if (nextState.setupState.mulliganCompleted[action.playerId]) {
        return { state, result: { success: false, error: 'Player has already completed their mulligan' } };
      }

      // 1. Separate chosen discards from hand
      const discardIds = action.discardCardInstanceIds || [];
      const keptHand: typeof player.hand = [];
      const mulliganDiscards: typeof player.hand = [];

      for (const card of player.hand) {
        if (discardIds.includes(card.instanceId)) {
          mulliganDiscards.push(card);
        } else {
          keptHand.push(card);
        }
      }

      // 2. Draw replacements from deck
      const replacementCount = mulliganDiscards.length;
      const drawnReplacements = player.deck.splice(0, replacementCount);
      player.hand = [...keptHand, ...drawnReplacements];

      // 3. Shuffle discards back into player deck (RR v1.8 p. 23-24)
      player.deck = [...player.deck, ...mulliganDiscards].sort(() => Math.random() - 0.5);

      // 4. Mark player mulligan complete
      nextState.setupState.mulliganCompleted[action.playerId] = true;

      const onomatopoeia = 'MULLIGAN RESOLVED!';
      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        phase: GamePhase.SETUP_PHASE,
        key: 'player.setup.mulligan',
        params: {
          player: player.name,
          discardedCount: replacementCount,
          handSize: player.hand.length,
        },
        onomatopoeia,
      });

      // 5. Check if all players have completed mulligan
      const allDone = nextState.players.every((p) => nextState.setupState?.mulliganCompleted[p.id]);
      if (allDone) {
        nextState.setupState.stage = 'GAME_READY';
        nextState.phase = GamePhase.PLAYER_PHASE;
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: 1,
          phase: GamePhase.PLAYER_PHASE,
          key: 'phase.player_phase.start',
          params: { round: 1 },
          onomatopoeia: 'HEROES ACT!',
        });
      }

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'CHANGE_FORM': {
      const check = canChangeForm(nextState, action.playerId, action.targetFormCode);
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      let nextFormCard = player.availableForms.find((f) => f.code !== player.activeFormCard.code);

      if (action.targetFormCode) {
        nextFormCard = player.availableForms.find((f) => f.code === action.targetFormCode);
      }

      if (!nextFormCard) {
        return { state, result: { success: false, error: 'Could not determine next form' } };
      }

      player.activeFormCard = nextFormCard;
      player.currentForm = nextFormCard.type === CardType.HERO ? 'hero' : 'alter_ego';
      player.formChangedThisRound = true;

      const onomatopoeia = player.currentForm === 'hero' ? 'SUIT UP!' : 'IDENTITY FLIP!';

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        key: 'player.action.changeForm',
        params: {
          player: player.name,
          form: nextFormCard.name,
        },
        onomatopoeia,
      });

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'BASIC_RECOVER': {
      const check = canBasicRecover(nextState, action.playerId);
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      const recValue = (player.activeFormCard as AlterEgoCard).recover || 0;
      const healedAmount = Math.min(player.maxHealth - player.health, recValue);

      player.health += healedAmount;
      player.exhausted = true;
      player.recoveryUsedThisRound = true;

      const onomatopoeia = 'REST & RECOVER!';

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        key: 'player.action.recover',
        params: {
          player: player.name,
          amount: healedAmount,
          health: player.health,
        },
        onomatopoeia,
      });

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: player.activeFormCard.name },
        onomatopoeia: 'EXHAUST',
      });

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'BASIC_ATTACK': {
      const check = canBasicAttack(
        nextState,
        action.playerId,
        action.targetType,
        action.targetInstanceId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      player.exhausted = true;

      // 1. Stunned Status Replacement Check (RR v1.8 p. 26)
      const stunIndex = player.statusCards.indexOf(StatusCard.STUNNED);
      if (stunIndex !== -1) {
        player.statusCards.splice(stunIndex, 1);
        const onomatopoeia = 'STUN CLEARED!';
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'status.stunned.cleared',
          params: { player: player.name },
          onomatopoeia,
        });
        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      const heroStats = getEffectiveHeroStats(nextState, player);
      const attackDamage = heroStats.attack;

      // 2. Resolve Attack on Target
      if (action.targetType === 'villain') {
        const toughIndex = nextState.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIndex !== -1) {
          nextState.villain.statusCards.splice(toughIndex, 1);
          const onomatopoeia = 'CLANG! (TOUGH)';
          nextState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: nextState.roundNumber,
            phase: nextState.phase,
            key: 'player.action.attackVillain',
            params: {
              player: player.name,
              damage: 0,
              remainingHealth: nextState.villain.health,
            },
            onomatopoeia,
          });
          nextState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: nextState.roundNumber,
            phase: nextState.phase,
            category: 'status',
            key: 'card.state.exhausted',
            params: { card: player.activeFormCard.name },
            onomatopoeia: 'EXHAUST',
          });
          return { state: nextState, result: { success: true, onomatopoeia } };
        }

        // Check Villain Attachments for Damage Shield (e.g. Armored Rhino Suit 01098)
        const armorIdx = (nextState.villain.attachments || []).findIndex((att) => {
          const abs = att.card.enrichment?.abilities || [];
          return abs.some((a) => a.effect === 'ATTACHMENT_DAMAGE_SHIELD');
        });
        if (armorIdx !== -1) {
          const armor = nextState.villain.attachments.splice(armorIdx, 1)[0];
          nextState.encounterDiscard.push(armor);
          const onomatopoeia = 'ARMORED SUIT ABSORBS DAMAGE!';
          nextState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: nextState.roundNumber,
            phase: nextState.phase,
            category: 'combat',
            key: 'attachment.damageShield.absorbed',
            params: { villain: nextState.villain.card.name, attachment: armor.card.name, damage: attackDamage },
            onomatopoeia,
          });
          nextState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: nextState.roundNumber,
            phase: nextState.phase,
            category: 'status',
            key: 'card.state.exhausted',
            params: { card: player.activeFormCard.name },
            onomatopoeia: 'EXHAUST',
          });
          return { state: nextState, result: { success: true, onomatopoeia } };
        }

        nextState.villain.health = Math.max(0, nextState.villain.health - attackDamage);

        if (nextState.villain.health <= 0) {
          const defeatedState = handleVillainDefeat(nextState, nextState.villain.instanceId);
          return { state: defeatedState, result: { success: true, onomatopoeia: 'POW!' } };
        }

        const onomatopoeia = 'POW!';
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          key: 'player.action.attackVillain',
          params: {
            player: player.name,
            damage: attackDamage,
            remainingHealth: nextState.villain.health,
          },
          onomatopoeia,
        });
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          category: 'status',
          key: 'card.state.exhausted',
          params: { card: player.activeFormCard.name },
          onomatopoeia: 'EXHAUST',
        });

        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      if (action.targetType === 'minion' && action.targetInstanceId) {
        let targetMinionPlayer = nextState.players.find((p) =>
          p.engagedMinions.some((m) => m.instanceId === action.targetInstanceId),
        );

        if (!targetMinionPlayer) {
          return { state, result: { success: false, error: 'Minion not found' } };
        }

        const minionIndex = targetMinionPlayer.engagedMinions.findIndex(
          (m) => m.instanceId === action.targetInstanceId,
        );
        const minion = targetMinionPlayer.engagedMinions[minionIndex];

        // Check Tough on Minion
        const toughIndex = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
        if (toughIndex !== -1) {
          minion.statusCards!.splice(toughIndex, 1);
          const onomatopoeia = 'CLANG!';
          return { state: nextState, result: { success: true, onomatopoeia } };
        }

        const currentDamage = minion.tokens?.damage || 0;
        const newDamage = currentDamage + attackDamage;
        const minionHealth = (minion.card as MinionCard).health || 1;

        if (newDamage >= minionHealth) {
          // Defeated minion -> discard
          targetMinionPlayer.engagedMinions.splice(minionIndex, 1);
          nextState.encounterDiscard.push(minion);

          // Trigger minion attachments (e.g. Spider-Tracer 01007)
          for (const att of minion.attachments || []) {
            const attAbs = att.card.enrichment?.abilities || [];
            for (const ab of attAbs) {
              if (ab.effect === 'WHEN_ATTACHED_HOST_DEFEATED') {
                const removeAmount = (ab.params?.amount as number) || 3;
                nextState.mainScheme.threat = Math.max(0, nextState.mainScheme.threat - removeAmount);
                nextState.log.push({
                  id: `log_${Date.now()}`,
                  timestamp: Date.now(),
                  category: 'scheme',
                  key: 'card.effect.removeThreat',
                  params: { scheme: nextState.mainScheme.card.name, amount: removeAmount, source: att.card.name },
                  onomatopoeia: 'SPIDER-TRACER REMOVES 3 THREAT!',
                });
              }
            }
            player.discard.push(att);
          }

          const onomatopoeia = 'KAPOW! DEFEATED!';
          return { state: nextState, result: { success: true, onomatopoeia } };
        } else {
          minion.tokens = { ...minion.tokens, damage: newDamage };
          const onomatopoeia = 'BAM!';
          return { state: nextState, result: { success: true, onomatopoeia } };
        }
      }

      return { state: nextState, result: { success: true } };
    }

    case 'ALLY_ATTACK': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      const allyIdx = player.allies.findIndex((a) => a.instanceId === action.allyInstanceId);
      if (allyIdx === -1) return { state, result: { success: false, error: 'Ally not found in play' } };

      const ally = player.allies[allyIdx];
      if (ally.exhausted) return { state, result: { success: false, error: 'Ally is exhausted' } };

      ally.exhausted = true;
      const allyCard = ally.card as AllyCard;
      const allyStats = getEffectiveAllyStats(nextState, ally);
      const attackDmg = allyStats.attack;

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        key: 'player.action.allyAttack',
        params: {
          player: player.name,
          ally: allyCard.name,
          damage: attackDmg,
          target: action.targetType,
        },
        onomatopoeia: 'ALLY ATTACK!',
      });

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: allyCard.name },
        onomatopoeia: 'EXHAUST',
      });

      // Deal damage to target
      if (action.targetType === 'villain') {
        const toughIdx = nextState.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          nextState.villain.statusCards.splice(toughIdx, 1);
        } else {
          // Check damage shield on villain
          const armorIdx = (nextState.villain.attachments || []).findIndex((att) => {
            const abs = att.card.enrichment?.abilities || [];
            return abs.some((a) => a.effect === 'ATTACHMENT_DAMAGE_SHIELD');
          });
          if (armorIdx !== -1) {
            const armor = nextState.villain.attachments.splice(armorIdx, 1)[0];
            nextState.encounterDiscard.push(armor);
          } else {
            nextState.villain.health = Math.max(0, nextState.villain.health - attackDmg);
            if (nextState.villain.health <= 0) {
              handleVillainDefeat(nextState, nextState.villain.instanceId);
            }
          }
        }
      }

      // Consequential damage to ally (e.g. 1 damage)
      const consequential = allyCard.attackCost ?? 1;
      ally.tokens = { ...ally.tokens, damage: (ally.tokens?.damage || 0) + consequential };

      // Check Ally Defeat
      const allyHp = allyCard.health || 2;
      if ((ally.tokens?.damage || 0) >= allyHp) {
        player.allies.splice(allyIdx, 1);
        player.discard.push(ally);
      }

      const onomatopoeia = 'ALLY ATTACK!';
      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'ALLY_THWART': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      const allyIdx = player.allies.findIndex((a) => a.instanceId === action.allyInstanceId);
      if (allyIdx === -1) return { state, result: { success: false, error: 'Ally not found in play' } };

      const ally = player.allies[allyIdx];
      if (ally.exhausted) return { state, result: { success: false, error: 'Ally is exhausted' } };

      ally.exhausted = true;
      const allyCard = ally.card as AllyCard;
      const allyStats = getEffectiveAllyStats(nextState, ally);
      const thwValue = allyStats.thwart;

      if (action.targetType === 'main_scheme') {
        nextState.mainScheme.threat = Math.max(0, nextState.mainScheme.threat - thwValue);
      }

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        key: 'player.action.allyThwart',
        params: {
          player: player.name,
          ally: allyCard.name,
          threatRemoved: thwValue,
          target: action.targetType,
        },
        onomatopoeia: 'ALLY THWART!',
      });

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'status',
        key: 'card.state.exhausted',
        params: { card: allyCard.name },
        onomatopoeia: 'EXHAUST',
      });

      // Consequential damage to ally
      const consequential = allyCard.thwartCost ?? 1;
      ally.tokens = { ...ally.tokens, damage: (ally.tokens?.damage || 0) + consequential };

      // Check Ally Defeat
      const allyHp = allyCard.health || 2;
      if ((ally.tokens?.damage || 0) >= allyHp) {
        player.allies.splice(allyIdx, 1);
        player.discard.push(ally);
      }

      const onomatopoeia = 'ALLY THWART!';
      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'BASIC_THWART': {
      const check = canBasicThwart(
        nextState,
        action.playerId,
        action.targetType,
        action.targetInstanceId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      player.exhausted = true;

      // 1. Confused Status Replacement Check (RR v1.8 p. 10)
      const confuseIndex = player.statusCards.indexOf(StatusCard.CONFUSED);
      if (confuseIndex !== -1) {
        player.statusCards.splice(confuseIndex, 1);
        const onomatopoeia = 'CONFUSION CLEARED!';
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          key: 'status.confused.cleared',
          params: { player: player.name },
          onomatopoeia,
        });
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          category: 'status',
          key: 'card.state.exhausted',
          params: { card: player.activeFormCard.name },
          onomatopoeia: 'EXHAUST',
        });
        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      const thwartValue = (player.activeFormCard as HeroCard).thwart || 0;

      if (action.targetType === 'main_scheme') {
        const removed = Math.min(nextState.mainScheme.threat, thwartValue);
        nextState.mainScheme.threat -= removed;

        const onomatopoeia = 'FOILED!';
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          key: 'player.action.thwartMainScheme',
          params: {
            player: player.name,
            removed,
            remainingThreat: nextState.mainScheme.threat,
          },
          onomatopoeia,
        });

        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          category: 'status',
          key: 'card.state.exhausted',
          params: { card: player.activeFormCard.name },
          onomatopoeia: 'EXHAUST',
        });

        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      if (action.targetType === 'side_scheme' && action.targetInstanceId) {
        const schemeIndex = nextState.sideSchemes.findIndex(
          (s) => s.instanceId === action.targetInstanceId,
        );
        const sideScheme = nextState.sideSchemes[schemeIndex];

        const removed = Math.min(sideScheme.threat, thwartValue);
        sideScheme.threat -= removed;

        if (sideScheme.threat <= 0) {
          nextState.sideSchemes.splice(schemeIndex, 1);
          nextState.encounterDiscard.push({
            instanceId: sideScheme.instanceId,
            card: sideScheme.card,
          });
          const onomatopoeia = 'SCHEME DEFEATED!';
          return { state: nextState, result: { success: true, onomatopoeia } };
        }

        const onomatopoeia = 'THWART!';
        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      return { state: nextState, result: { success: true } };
    }

    case 'PLAY_CARD': {
      const check = canPlayCard(
        nextState,
        action.playerId,
        action.cardInstanceId,
        action.paymentCardInstanceIds,
        action.generatorInstanceIds,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;

      // 1. Discard Payment Cards from Hand
      for (const pId of action.paymentCardInstanceIds) {
        const pIndex = player.hand.findIndex((c) => c.instanceId === pId);
        if (pIndex !== -1) {
          const [discarded] = player.hand.splice(pIndex, 1);
          player.discard.push(discarded);
        }
      }

      // 2. Process In-Play & Identity Generator Activations (e.g. Web-Shooter, Helicarrier, Scientist)
      for (const gId of action.generatorInstanceIds || []) {
        if (gId === 'identity_ability' || gId === player.activeFormCard.code) {
          const idAbility = player.activeFormCard.enrichment?.abilities?.find(
            (a) => a.timing === 'RESOURCE' || a.effect === 'GENERATE_RESOURCE',
          );
          if (idAbility) {
            if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
            player.usedAbilitiesThisRound[idAbility.id] =
              (player.usedAbilitiesThisRound[idAbility.id] || 0) + 1;

            if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
            player.usedAbilitiesThisPhase[idAbility.id] =
              (player.usedAbilitiesThisPhase[idAbility.id] || 0) + 1;

            nextState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: nextState.roundNumber,
              phase: nextState.phase,
              category: 'ability',
              actor: { name: player.name, type: player.currentForm },
              key: 'identity.ability.used',
              params: { ability: idAbility.id, hero: player.activeFormCard.name },
              onomatopoeia: 'SCIENTIST!',
            });
          }
          continue;
        }

        const gIdx = player.tableau.findIndex((c) => c.instanceId === gId);
        if (gIdx !== -1) {
          const gCard = player.tableau[gIdx];
          gCard.exhausted = true;

          // Track limits on table abilities if configured
          const tableAbility = gCard.card.enrichment?.abilities?.find(
            (a) => a.timing === 'RESOURCE' || a.effect === 'GENERATE_RESOURCE' || a.effect === 'COST_REDUCER',
          );
          if (tableAbility) {
            const key = `${gCard.instanceId}_${tableAbility.id}`;
            if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
            player.usedAbilitiesThisRound[key] = (player.usedAbilitiesThisRound[key] || 0) + 1;
            if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
            player.usedAbilitiesThisPhase[key] = (player.usedAbilitiesThisPhase[key] || 0) + 1;
          }

          // Generic counter decrement and discardOnEmpty handling (ADR-0018)
          if (gCard.card.enrichment?.uses) {
            const currentCounters = gCard.tokens?.counters || 0;
            gCard.tokens = { ...gCard.tokens, counters: Math.max(0, currentCounters - 1) };
            if (gCard.card.enrichment.uses.discardOnEmpty && (gCard.tokens?.counters ?? 0) <= 0) {
              player.tableau.splice(gIdx, 1);
              player.discard.push(gCard);
            }
          }
        }
      }

      // 3. Play Target Card from Hand
      const targetIndex = player.hand.findIndex((c) => c.instanceId === action.cardInstanceId);
      const [playedCardInstance] = player.hand.splice(targetIndex, 1);

      const cardType = playedCardInstance.card.type;

      // Initialize counters declaratively for cards with 'uses' definition
      const usesDef = playedCardInstance.card.enrichment?.uses;
      if (usesDef) {
        playedCardInstance.tokens = {
          ...playedCardInstance.tokens,
          counters: usesDef.count,
        };
      }

      // Determine onomatopoeia based on card tags / card type
      let onomatopoeia = 'PLAY!';
      const abilities = playedCardInstance.card.enrichment?.abilities || [];
      const hasAttackTag = abilities.some((a) => a.tags?.includes('ATTACK'));
      const hasThwartTag = abilities.some((a) => a.tags?.includes('THWART'));

      if (hasAttackTag) {
        onomatopoeia = 'POW!';
      } else if (hasThwartTag) {
        onomatopoeia = 'FOILED!';
      } else if (cardType === CardType.ALLY) {
        onomatopoeia = 'ALLY CALL!';
      }

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        key: 'player.action.playCard',
        params: {
          player: player.name,
          card: playedCardInstance.card.name,
        },
        onomatopoeia,
      });

      // Target determination (villain/minion/main_scheme/side_scheme)
      let targetType: 'villain' | 'minion' | 'main_scheme' | 'side_scheme' = 'villain';
      if (action.targetInstanceId) {
        const isMinion = nextState.players.some((p) =>
          p.engagedMinions.some((m) => m.instanceId === action.targetInstanceId),
        );
        const isSideScheme = nextState.sideSchemes.some(
          (s) => s.instanceId === action.targetInstanceId,
        );
        if (isMinion) targetType = 'minion';
        else if (isSideScheme) targetType = 'side_scheme';
        else targetType = 'main_scheme';
      }

      if (cardType === CardType.UPGRADE || cardType === CardType.SUPPORT) {
        const attachAbility = abilities.find((a) => a.effect === 'ATTACH_TO_HOST');
        if (attachAbility) {
          const targetHost = attachAbility.params?.target as string;
          if (targetHost === 'CHOSEN_ALLY' || targetHost === 'ALLY') {
            const ally = player.allies.find((a) => a.instanceId === action.targetInstanceId) || player.allies[0];
            if (ally) {
              if (!ally.attachments) ally.attachments = [];
              ally.attachments.push(playedCardInstance);
            } else {
              player.tableau.push(playedCardInstance);
            }
          } else if (targetHost === 'CHOSEN_MINION' || targetHost === 'MINION') {
            let foundMinion: CardInstance | undefined;
            for (const p of nextState.players) {
              foundMinion = p.engagedMinions.find((m) => m.instanceId === action.targetInstanceId) || p.engagedMinions[0];
              if (foundMinion) break;
            }
            if (foundMinion) {
              if (!foundMinion.attachments) foundMinion.attachments = [];
              foundMinion.attachments.push(playedCardInstance);
            } else {
              player.tableau.push(playedCardInstance);
            }
          } else if (targetHost === 'ENEMY' || targetHost === 'VILLAIN') {
            if (!nextState.villain.attachments) nextState.villain.attachments = [];
            nextState.villain.attachments.push(playedCardInstance);
          } else {
            player.tableau.push(playedCardInstance);
          }
        } else {
          player.tableau.push(playedCardInstance);
        }
      } else if (cardType === CardType.ALLY) {
        player.allies.push(playedCardInstance);
        // Execute declarative CARD_PLAYED abilities (e.g. Mockingbird stun, Black Cat filter, Nick Fury)
        for (const ability of abilities) {
          if (ability.trigger === 'CARD_PLAYED' || ability.timing === 'FORCED_RESPONSE' || ability.timing === 'RESPONSE') {
            executeEffect(nextState, ability, {
              playerId: action.playerId,
              targetType,
              targetInstanceId: action.targetInstanceId,
              sourceCardInstance: playedCardInstance,
            });
          }
        }
      } else if (cardType === CardType.EVENT) {
        // Execute declarative event abilities
        for (const ability of abilities) {
          executeEffect(nextState, ability, {
            playerId: action.playerId,
            targetType,
            targetInstanceId: action.targetInstanceId,
            sourceCardInstance: playedCardInstance,
          });
        }
        player.discard.push(playedCardInstance);
      }

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'USE_CARD_ABILITY': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      // Find card in tableau or identity
      let targetCardInst = player.tableau.find((c) => c.instanceId === action.cardInstanceId);
      const isIdentity = player.activeFormCard.code === action.cardInstanceId;

      const enrichment = isIdentity
        ? player.activeFormCard.enrichment
        : targetCardInst?.card.enrichment;

      if (!enrichment || !enrichment.abilities) {
        return { state, result: { success: false, error: 'Card has no registered abilities' } };
      }

      const ability = enrichment.abilities.find((a) => a.id === action.abilityId);
      if (!ability) {
        return { state, result: { success: false, error: 'Ability not found on card' } };
      }

      // Timing / Form validation
      if (ability.timing === 'HERO_ACTION' && player.currentForm !== 'hero') {
        return { state, result: { success: false, error: 'Can only use this ability in Hero form' } };
      }
      if (ability.timing === 'ALTER_EGO_ACTION' && player.currentForm !== 'alter_ego') {
        return { state, result: { success: false, error: 'Can only use this ability in Alter-Ego form' } };
      }

      // Limit validation (e.g. ONCE_PER_ROUND, ONCE_PER_PHASE)
      const abilityKey = targetCardInst ? `${targetCardInst.instanceId}_${ability.id}` : ability.id;
      if (ability.limit === 'ONCE_PER_ROUND' && (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1) {
        return {
          state,
          result: { success: false, error: `Ability '${ability.id}' has already been used this round (Limit: once per round)` },
        };
      }
      if (ability.limit === 'ONCE_PER_PHASE' && (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1) {
        return {
          state,
          result: { success: false, error: `Ability '${ability.id}' has already been used this phase (Limit: once per phase)` },
        };
      }

      // Cost validation and execution
      if (targetCardInst) {
        const costObj = (ability.cost || {}) as any;
        const isExhaust = costObj.exhaustSelf || costObj.exhaust;
        const removeCount = costObj.removeCounter || costObj.spendCounter || 0;

        if (isExhaust && targetCardInst.exhausted) {
          return { state, result: { success: false, error: 'Card is already exhausted' } };
        }
        if (removeCount > 0) {
          const currentCounters = targetCardInst.tokens?.counters || 0;
          if (currentCounters < removeCount) {
            return { state, result: { success: false, error: 'Insufficient counters on card' } };
          }
          targetCardInst.tokens = {
            ...targetCardInst.tokens,
            counters: currentCounters - removeCount,
          };
        }
        if (isExhaust) {
          targetCardInst.exhausted = true;
          nextState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: nextState.roundNumber,
            phase: nextState.phase,
            category: 'status',
            key: 'card.state.exhausted',
            params: { card: targetCardInst.card.name },
            onomatopoeia: 'EXHAUST',
          });
        }

        // Discard on empty counters if configured
        if (
          targetCardInst.card.enrichment?.uses?.discardOnEmpty &&
          (targetCardInst.tokens?.counters || 0) <= 0
        ) {
          const idx = player.tableau.findIndex((c) => c.instanceId === targetCardInst!.instanceId);
          if (idx !== -1) {
            const [discarded] = player.tableau.splice(idx, 1);
            player.discard.push(discarded);
          }
        }
      }

      // Execute effect primitive
      const effectRes = executeEffect(nextState, ability, {
        playerId: action.playerId,
        sourceCardInstance: targetCardInst,
        targetInstanceId: action.targetInstanceId,
      });

      if (effectRes.success) {
        if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
        player.usedAbilitiesThisRound[abilityKey] = (player.usedAbilitiesThisRound[abilityKey] || 0) + 1;
        if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
        player.usedAbilitiesThisPhase[abilityKey] = (player.usedAbilitiesThisPhase[abilityKey] || 0) + 1;
      }

      return {
        state: nextState,
        result: {
          success: effectRes.success,
          error: effectRes.error,
          onomatopoeia: effectRes.onomatopoeia || 'ABILITY ACTIVATED!',
        },
      };
    }

    case 'END_PLAYER_TURN': {
      if (nextState.players[nextState.activePlayerIndex]?.id !== action.playerId) {
        return {
          state,
          result: { success: false, error: 'Cannot end turn when it is not your turn' },
        };
      }

      const currentPlayer = nextState.players[nextState.activePlayerIndex];
      const nextIndex = (nextState.activePlayerIndex + 1) % nextState.players.length;

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'phase',
        actor: { name: currentPlayer.name, type: 'hero' },
        key: 'player.turn.ended',
        params: { player: currentPlayer.name },
        onomatopoeia: 'PASS',
      });

      // If all players have taken their turns in this round -> execute Villain Phase!
      if (nextIndex === nextState.firstPlayerIndex) {
        const finalState = executeVillainPhase(nextState);
        return {
          state: finalState,
          result: { success: true, onomatopoeia: 'NEW ROUND!' },
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
    }

    case 'DEV_ADD_CARD_TO_HAND': {
      const player = nextState.players.find((p) => p.id === action.playerId);
      if (!player) {
        return { state, result: { success: false, error: 'Player not found' } };
      }

      const cardIdx = player.deck.findIndex((c) => c.instanceId === action.cardInstanceId);
      if (cardIdx === -1) {
        return { state, result: { success: false, error: 'Card not found in deck' } };
      }

      const [selectedCard] = player.deck.splice(cardIdx, 1);
      player.hand.push(selectedCard);

      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'ability',
        actor: { name: player.name, type: player.currentForm },
        key: 'dev.card.tutor',
        params: { card: selectedCard.card.name, hero: player.name },
        onomatopoeia: 'DEV TUTOR!',
      });

      return {
        state: nextState,
        result: {
          success: true,
          onomatopoeia: 'CARD ADDED!',
        },
      };
    }

    case 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      const attIdx = (nextState.villain.attachments || []).findIndex(
        (att) => att.instanceId === action.attachmentInstanceId || att.card.code === action.attachmentInstanceId,
      );
      if (attIdx === -1) return { state, result: { success: false, error: 'Attachment not found on villain' } };

      // Discard payment cards from player hand if provided
      if (action.paymentCardInstanceIds) {
        for (const pId of action.paymentCardInstanceIds) {
          const hIdx = player.hand.findIndex((c) => c.instanceId === pId);
          if (hIdx !== -1) {
            const [discarded] = player.hand.splice(hIdx, 1);
            player.discard.push(discarded);
          }
        }
      }

      const [attachment] = nextState.villain.attachments.splice(attIdx, 1);
      nextState.encounterDiscard.push(attachment);

      const onomatopoeia = 'ATTACHMENT DISCARDED!';
      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        round: nextState.roundNumber,
        phase: nextState.phase,
        category: 'ability',
        key: 'attachment.discarded.byPlayer',
        params: { player: player.name, attachment: attachment.card.name },
        onomatopoeia,
      });

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    default:
      return { state, result: { success: false, error: 'Unknown action type' } };
  }
}

