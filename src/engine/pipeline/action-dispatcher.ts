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

      const attackDamage = (player.activeFormCard as HeroCard).attack || 0;

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

        nextState.villain.health = Math.max(0, nextState.villain.health - attackDamage);

        if (nextState.villain.health <= 0) {
          nextState.winner = 'HEROES';
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

      const attackDmg = allyCard.attack || 1;

      // Deal damage to target
      if (action.targetType === 'villain') {
        const toughIdx = nextState.villain.statusCards.indexOf(StatusCard.TOUGH);
        if (toughIdx !== -1) {
          nextState.villain.statusCards.splice(toughIdx, 1);
        } else {
          nextState.villain.health = Math.max(0, nextState.villain.health - attackDmg);
          if (nextState.villain.health <= 0) nextState.winner = 'HEROES';
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

      let thwValue = allyCard.thwart || 1;

      // Jessica Jones THW boost: +1 for each side scheme in play
      if (allyCard.code === '01059') {
        thwValue += nextState.sideSchemes.length;
      }

      if (action.targetType === 'main_scheme') {
        nextState.mainScheme.threat = Math.max(0, nextState.mainScheme.threat - thwValue);
      }

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

      // 2. Play Target Card from Hand
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

      if (cardType === CardType.UPGRADE || cardType === CardType.SUPPORT) {
        player.tableau.push(playedCardInstance);
      } else if (cardType === CardType.ALLY) {
        player.allies.push(playedCardInstance);
        // Execute declarative CARD_PLAYED abilities (e.g. Mockingbird stun, Black Cat filter)
        const abilities = playedCardInstance.card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'CARD_PLAYED' || ability.timing === 'FORCED_RESPONSE') {
            executeEffect(nextState, ability, {
              playerId: action.playerId,
              targetType: 'villain',
              targetInstanceId: action.targetInstanceId,
              sourceCardInstance: playedCardInstance,
            });
          }
        }
      } else if (cardType === CardType.EVENT) {
        // Execute declarative event abilities
        const abilities = playedCardInstance.card.enrichment?.abilities || [];
        for (const ability of abilities) {
          executeEffect(nextState, ability, {
            playerId: action.playerId,
            targetType: 'villain',
            targetInstanceId: action.targetInstanceId,
          });
        }
        player.discard.push(playedCardInstance);
      }

      const onomatopoeia = 'PLAY!';
      nextState.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        key: 'player.action.playCard',
        params: {
          player: player.name,
          card: playedCardInstance.card.name,
        },
        onomatopoeia,
      });

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

      // Cost validation and execution
      if (targetCardInst) {
        if (ability.cost?.exhaustSelf && targetCardInst.exhausted) {
          return { state, result: { success: false, error: 'Card is already exhausted' } };
        }
        if (ability.cost?.removeCounter) {
          const currentCounters = targetCardInst.tokens?.counters || 0;
          if (currentCounters < ability.cost.removeCounter) {
            return { state, result: { success: false, error: 'Insufficient counters on card' } };
          }
          targetCardInst.tokens = {
            ...targetCardInst.tokens,
            counters: currentCounters - ability.cost.removeCounter,
          };
        }
        if (ability.cost?.exhaustSelf) {
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
      return { state: nextState, result: { success: true } };
    }

    default:
      return { state, result: { success: false, error: 'Unknown action type' } };
  }
}

