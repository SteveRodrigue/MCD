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
  SideSchemeCard,
  PlayerSideSchemeCard,
  CardInstance,
  GamePhase,
  DecisionPromptOption,
  PendingDecisionPrompt,
  PlayerState,
  Keyword,
  getKeywordValue,
} from '@engine/models';
import {
  getPlayer,
  canChangeForm,
  canBasicRecover,
  canBasicAttack,
  canAllyAttack,
  canBasicThwart,
  canAllyThwart,
  canPlayCard,
  isCardRestricted,
  getCardRestrictedWeight,
  getPlayerRestrictedCount,
  getPlayerRestrictedLimit,
  canInitiateAbility,
} from './legality-checker';
import {
  executeAbilityCost,
  checkAndDiscardZeroCounterCard,
  getApplicableCostReductions,
} from './cost-engine';
import { executeEffect, moveDefeatedCardToPile, processHostDefeated } from '../effects';
import {
  continueVillainPhase,
  executeMinionAttackAgainstPlayer,
  resolveActiveEncounterCardAfterInterrupt,
} from './villain-phase';
import { initiatePlayerPhaseCleanup, executePlayerCleanup } from './player-phase-cleanup';
import { handleVillainDefeat } from './scenario-helpers';
import {
  getEffectiveAllyStats,
  getEffectiveHeroStats,
  getEffectiveMaxHealth,
  getEffectiveRetaliate,
  hasEntityKeyword,
  consumeEntityStatusCards,
} from './stat-calculator';
import {
  resolveDecisionPrompt,
  enqueueDecisionPrompt,
  peekDecisionPrompt,
  popDecisionPrompt,
} from './prompt-queue';
import {
  resolveDefenderDeclaration,
  finishAttackDamageAndPostResolution,
  continueAttackAfterInitiation,
} from './combat-pipeline';
import { getSpecialHandler } from '../specials/special-registry';
import { attachCardToHost, initializeCardUses } from '../state/state-validator';
import { dispatchTrigger } from '../triggers/trigger-dispatcher';

function dispatchCanonicalDefeatTriggers(
  state: GameState,
  targetPlayerId: string,
  sourceInstanceId: string,
  entityType: 'CHARACTER' | 'SCHEME',
): void {
  const context = { targetPlayerId, sourceInstanceId, entityType };
  dispatchTrigger(state, 'DEFEATED', context);
  if (entityType === 'CHARACTER') {
    dispatchTrigger(state, 'CHARACTER_DEFEATED', context);
  } else {
    dispatchTrigger(state, 'SCHEME_DEFEATED', context);
  }
}

/**
 * Scans all in-play zones for a card instance by instanceId or card code (ADR-0055).
 * Searches player tableaus, allies, identity attachments, ally attachments,
 * minion attachments, villain attachments, and scheme attachments.
 */
export function findInPlayCardInstance(
  state: GameState,
  instanceId: string,
): CardInstance | undefined {
  for (const p of state.players || []) {
    const fromTableau = p.tableau.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromTableau) return fromTableau;

    const fromAllies = p.allies.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromAllies) return fromAllies;

    const fromAttachments = p.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromAttachments) return fromAttachments;

    for (const a of p.allies || []) {
      const fromAllyAtt = a.attachments?.find(
        (c) => c.instanceId === instanceId || c.card.code === instanceId,
      );
      if (fromAllyAtt) return fromAllyAtt;
    }

    for (const m of p.engagedMinions || []) {
      const fromMinionAtt = m.attachments?.find(
        (c) => c.instanceId === instanceId || c.card.code === instanceId,
      );
      if (fromMinionAtt) return fromMinionAtt;
    }
  }

  if (state.villain) {
    const fromVillainAtt = state.villain.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromVillainAtt) return fromVillainAtt;
  }

  if (state.mainScheme) {
    const fromMainSchemeAtt = state.mainScheme.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromMainSchemeAtt) return fromMainSchemeAtt;
  }

  for (const s of state.sideSchemes || []) {
    const fromSideSchemeAtt = s.attachments?.find(
      (c) => c.instanceId === instanceId || c.card.code === instanceId,
    );
    if (fromSideSchemeAtt) return fromSideSchemeAtt;
  }

  return undefined;
}

/**
 * Universal Card Routing Helper for Search, Scry, Look and Mulligan Primitives (RR v1.8 p. 19, 26).
 */
export function routeCardInstances(
  state: GameState,
  player: PlayerState,
  cards: CardInstance[],
  destination: string | null | undefined,
  sourceZone: string,
) {
  if (cards.length === 0) return;

  if (!destination || destination === 'LEAVE_IN_PLACE') {
    if (sourceZone === 'PLAYER_DISCARD') {
      player.discard.push(...cards);
    } else if (sourceZone === 'PLAYER_HAND') {
      player.hand.push(...cards);
    } else if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.unshift(...cards);
    } else if (sourceZone === 'ENCOUNTER_DISCARD') {
      state.encounterDiscard.push(...cards);
    } else {
      player.deck.unshift(...cards);
    }
    return;
  }

  if (destination === 'REVEAL') {
    for (const card of cards) {
      resolveActiveEncounterCardAfterInterrupt(state, card, player, false);
    }
    return;
  }

  if (destination === 'HAND') {
    player.hand.push(...cards);
  } else if (destination === 'TABLEAU') {
    for (const card of cards) {
      if (card.card.type === CardType.SIDE_SCHEME) {
        const sideSchemeCard = card.card as SideSchemeCard;
        const baseThreat =
          sideSchemeCard.baseThreat * (sideSchemeCard.baseThreatFixed ? 1 : state.players.length);
        state.sideSchemes.push({
          instanceId: card.instanceId,
          card: sideSchemeCard,
          threat: baseThreat,
        });
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          key: 'encounter.reveal.sideScheme',
          params: { sideScheme: card.card.name, threat: baseThreat },
          onomatopoeia: 'SIDE SCHEME!',
        });
        const abilities = card.card.enrichment?.abilities || [];
        for (const ability of abilities) {
          if (ability.trigger === 'WHEN_REVEALED' || ability.timing === 'WHEN_REVEALED') {
            executeEffect(state, ability, {
              playerId: player.id,
              sourceCardInstance: card,
            });
          }
        }
      } else {
        player.tableau.push(card);
      }
    }
  } else if (destination === 'DISCARD') {
    if (sourceZone.startsWith('ENCOUNTER')) {
      state.encounterDiscard.push(...cards);
    } else {
      player.discard.push(...cards);
    }
  } else if (destination === 'DECK_TOP') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.unshift(...cards);
    } else {
      player.deck.unshift(...cards);
    }
  } else if (destination === 'DECK_BOTTOM') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.push(...cards);
    } else {
      player.deck.push(...cards);
    }
  } else if (destination === 'DECK_SHUFFLE') {
    if (sourceZone === 'ENCOUNTER_DECK') {
      state.encounterDeck.push(...cards);
      state.encounterDeck.sort(() => Math.random() - 0.5);
    } else {
      player.deck.push(...cards);
      player.deck.sort(() => Math.random() - 0.5);
    }
  }
}

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
        return {
          state,
          result: { success: false, error: 'Game is not currently in the Mulligan Phase' },
        };
      }

      if (nextState.setupState.mulliganCompleted[action.playerId]) {
        return {
          state,
          result: { success: false, error: 'Player has already completed their mulligan' },
        };
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

      // 2. Draw replacements from top of player deck
      const replacementCount = mulliganDiscards.length;
      const drawnReplacements = player.deck.splice(0, replacementCount);
      player.hand = [...keptHand, ...drawnReplacements];

      // 3. Rejected cards move directly to the player discard pile (RR v1.8 p. 23 - NO DECK SHUFFLE)
      player.discard.push(...mulliganDiscards);

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
      player.basicChangeFormUsedThisRound = true;
      player.formChangedThisRound = true;
      dispatchTrigger(nextState, 'FORM_CHANGED', {
        targetPlayerId: player.id,
        targetType: player.currentForm,
        sourceInstanceId: player.activeFormCard.code,
      });

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
      const maxHp = getEffectiveMaxHealth(player, nextState);
      const healedAmount = Math.min(maxHp - player.health, recValue);

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

      // 1. Stunned Status Replacement Check (RR v1.8 p. 28, taking into account Steady)
      if (consumeEntityStatusCards(player, StatusCard.STUNNED)) {
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
          return abs.some((a) => a.steps?.some((s) => s.effect === 'ATTACHMENT_DAMAGE_SHIELD'));
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
            params: {
              villain: nextState.villain.card.name,
              attachment: armor.card.name,
              damage: attackDamage,
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
          dispatchCanonicalDefeatTriggers(
            nextState,
            player.id,
            nextState.villain.instanceId || 'villain',
            'CHARACTER',
          );
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

        dispatchTrigger(nextState, 'BASIC_ATTACK_PERFORMED', { targetPlayerId: player.id });
        dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
          targetPlayerId: player.id,
          targetType: 'villain',
        });

        // Retaliate check: If villain survived and has Retaliate X (RR v1.8 p. 24, ADR-0054)
        const villainRetaliate = getEffectiveRetaliate(nextState.villain, nextState);
        if (villainRetaliate > 0) {
          player.health = Math.max(0, player.health - villainRetaliate);
          nextState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: nextState.roundNumber,
            phase: nextState.phase,
            category: 'combat',
            key: 'retaliate.hit',
            params: {
              damage: villainRetaliate,
              source: nextState.villain.card.name,
              player: player.name,
            },
            onomatopoeia: 'RETALIATE!',
          });
        }

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
          // Defeated minion -> trigger attachments & discard (or Victory Display, RR v1.8 p. 30)
          processHostDefeated(nextState, minion, { player: targetMinionPlayer });
          targetMinionPlayer.engagedMinions.splice(minionIndex, 1);
          moveDefeatedCardToPile(nextState, minion, nextState.encounterDiscard);
          dispatchCanonicalDefeatTriggers(
            nextState,
            targetMinionPlayer.id,
            minion.instanceId,
            'CHARACTER',
          );

          dispatchTrigger(nextState, 'BASIC_ATTACK_PERFORMED', { targetPlayerId: player.id });
          dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
            targetPlayerId: player.id,
            targetType: 'minion',
            targetInstanceId: action.targetInstanceId,
          });

          const onomatopoeia = 'KAPOW! DEFEATED!';
          return { state: nextState, result: { success: true, onomatopoeia } };
        } else {
          minion.tokens = { ...minion.tokens, damage: newDamage };

          dispatchTrigger(nextState, 'BASIC_ATTACK_PERFORMED', { targetPlayerId: player.id });
          dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
            targetPlayerId: player.id,
            targetType: 'minion',
            targetInstanceId: action.targetInstanceId,
          });

          // Retaliate check: If minion survived and has Retaliate X (RR v1.8 p. 24, ADR-0054)
          const minionRetaliate = getEffectiveRetaliate(minion, nextState);
          if (minionRetaliate > 0) {
            player.health = Math.max(0, player.health - minionRetaliate);
            nextState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: nextState.roundNumber,
              phase: nextState.phase,
              category: 'combat',
              key: 'retaliate.hit',
              params: {
                damage: minionRetaliate,
                source: minion.card.name,
                player: player.name,
              },
              onomatopoeia: 'RETALIATE!',
            });
          }

          const onomatopoeia = 'BAM!';
          return { state: nextState, result: { success: true, onomatopoeia } };
        }
      }

      return { state: nextState, result: { success: true } };
    }

    case 'ALLY_ATTACK': {
      const check = canAllyAttack(
        nextState,
        action.playerId,
        action.allyInstanceId,
        action.targetType,
        action.targetInstanceId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      const allyIdx = player.allies.findIndex((a) => a.instanceId === action.allyInstanceId);
      const ally = player.allies[allyIdx];
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
            return abs.some((a) => a.steps?.some((s) => s.effect === 'ATTACHMENT_DAMAGE_SHIELD'));
          });
          if (armorIdx !== -1) {
            const armor = nextState.villain.attachments.splice(armorIdx, 1)[0];
            nextState.encounterDiscard.push(armor);
          } else {
            nextState.villain.health = Math.max(0, nextState.villain.health - attackDmg);
            if (nextState.villain.health <= 0) {
              dispatchCanonicalDefeatTriggers(
                nextState,
                player.id,
                nextState.villain.instanceId || 'villain',
                'CHARACTER',
              );
              handleVillainDefeat(nextState, nextState.villain.instanceId);
            } else {
              // Retaliate check: If villain survived and has Retaliate X (RR v1.8 p. 24, ADR-0054)
              const villainRetaliate = getEffectiveRetaliate(nextState.villain, nextState);
              if (villainRetaliate > 0) {
                if (!ally.tokens) ally.tokens = {};
                ally.tokens.damage = (ally.tokens.damage || 0) + villainRetaliate;
                nextState.log.push({
                  id: `log_${Date.now()}`,
                  timestamp: Date.now(),
                  round: nextState.roundNumber,
                  phase: nextState.phase,
                  category: 'combat',
                  key: 'retaliate.hit',
                  params: {
                    damage: villainRetaliate,
                    source: nextState.villain.card.name,
                    player: allyCard.name,
                  },
                  onomatopoeia: 'RETALIATE!',
                });
              }
            }
          }
        }
      } else if (action.targetType === 'minion' && action.targetInstanceId) {
        const targetMinionPlayer = nextState.players.find((p) =>
          p.engagedMinions.some((m) => m.instanceId === action.targetInstanceId),
        );

        if (targetMinionPlayer) {
          const minionIndex = targetMinionPlayer.engagedMinions.findIndex(
            (m) => m.instanceId === action.targetInstanceId,
          );
          const minion = targetMinionPlayer.engagedMinions[minionIndex];

          // Check Tough on Minion
          const toughIndex = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
          if (toughIndex !== -1) {
            minion.statusCards!.splice(toughIndex, 1);
          } else {
            const currentDamage = minion.tokens?.damage || 0;
            const newDamage = currentDamage + attackDmg;
            const minionHealth = (minion.card as MinionCard).health || 1;

            if (newDamage >= minionHealth) {
              // Defeated minion -> trigger attachments & discard (or Victory Display, RR v1.8 p. 30)
              processHostDefeated(nextState, minion, { player: targetMinionPlayer });
              targetMinionPlayer.engagedMinions.splice(minionIndex, 1);
              moveDefeatedCardToPile(nextState, minion, nextState.encounterDiscard);
              dispatchCanonicalDefeatTriggers(
                nextState,
                targetMinionPlayer.id,
                minion.instanceId,
                'CHARACTER',
              );
            } else {
              minion.tokens = { ...minion.tokens, damage: newDamage };
              // Retaliate check: If minion survived and has Retaliate X (RR v1.8 p. 24, ADR-0054)
              const minionRetaliate = getEffectiveRetaliate(minion, nextState);
              if (minionRetaliate > 0) {
                if (!ally.tokens) ally.tokens = {};
                ally.tokens.damage = (ally.tokens.damage || 0) + minionRetaliate;
                nextState.log.push({
                  id: `log_${Date.now()}`,
                  timestamp: Date.now(),
                  round: nextState.roundNumber,
                  phase: nextState.phase,
                  category: 'combat',
                  key: 'retaliate.hit',
                  params: {
                    damage: minionRetaliate,
                    source: minion.card.name,
                    player: allyCard.name,
                  },
                  onomatopoeia: 'RETALIATE!',
                });
              }
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
        processHostDefeated(nextState, ally, { player });
        dispatchCanonicalDefeatTriggers(nextState, player.id, ally.instanceId, 'CHARACTER');
        const owner = (ally.ownerId ? getPlayer(nextState, ally.ownerId) : undefined) || player;
        owner.discard.push(ally);
      }

      dispatchTrigger(nextState, 'ATTACK_RESOLVED', {
        targetPlayerId: player.id,
        targetType: action.targetType,
        targetInstanceId: action.targetInstanceId,
        sourceInstanceId: action.allyInstanceId,
        sourceCardCode: ally.card.code,
        attackerCard: ally,
      });

      const onomatopoeia = 'ALLY ATTACK!';
      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'ALLY_THWART': {
      const check = canAllyThwart(
        nextState,
        action.playerId,
        action.allyInstanceId,
        action.targetType,
        action.targetInstanceId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;
      const allyIdx = player.allies.findIndex((a) => a.instanceId === action.allyInstanceId);
      const ally = player.allies[allyIdx];

      ally.exhausted = true;
      const allyCard = ally.card as AllyCard;
      const allyStats = getEffectiveAllyStats(nextState, ally);
      const thwValue = allyStats.thwart;

      if (action.targetType === 'main_scheme') {
        const removed = Math.min(nextState.mainScheme.threat, thwValue);
        nextState.mainScheme.threat = Math.max(0, nextState.mainScheme.threat - removed);
      } else if (action.targetType === 'side_scheme' && action.targetInstanceId) {
        const schemeIndex = nextState.sideSchemes.findIndex(
          (s) => s.instanceId === action.targetInstanceId,
        );
        if (schemeIndex !== -1) {
          const sideScheme = nextState.sideSchemes[schemeIndex];
          const removed = Math.min(sideScheme.threat, thwValue);
          sideScheme.threat -= removed;

          if (sideScheme.threat <= 0) {
            nextState.sideSchemes.splice(schemeIndex, 1);

            const defeatedInstance: CardInstance = {
              instanceId: sideScheme.instanceId,
              card: sideScheme.card,
            };
            dispatchCanonicalDefeatTriggers(
              nextState,
              player.id,
              defeatedInstance.instanceId,
              'SCHEME',
            );

            // Resolve 'When Defeated' reward abilities declared on the scheme itself
            const defeatedAbilities = sideScheme.card.enrichment?.abilities || [];
            for (const ability of defeatedAbilities) {
              if (
                ability.trigger === 'DEFEATED' &&
                (ability.timing === 'FORCED_RESPONSE' || ability.timing === 'RESPONSE')
              ) {
                executeEffect(nextState, ability, {
                  playerId: sideScheme.ownerId || player.id,
                  sourceCardInstance: defeatedInstance,
                });
              }
            }

            // Route to Victory Display or the appropriate discard pile (RR v1.8 p. 30, ADR-0034)
            const destinationPile = sideScheme.ownerId
              ? getPlayer(nextState, sideScheme.ownerId)!.discard
              : nextState.encounterDiscard;
            moveDefeatedCardToPile(nextState, defeatedInstance, destinationPile);
          }
        }
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
        processHostDefeated(nextState, ally, { player });
        dispatchCanonicalDefeatTriggers(nextState, player.id, ally.instanceId, 'CHARACTER');
        const owner = (ally.ownerId ? getPlayer(nextState, ally.ownerId) : undefined) || player;
        owner.discard.push(ally);
      }

      dispatchTrigger(nextState, 'THWART_RESOLVED', {
        targetPlayerId: player.id,
        targetType: action.targetType,
        targetInstanceId: action.targetInstanceId,
        sourceInstanceId: ally.instanceId,
      });

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

      // 1. Confused Status Replacement Check (RR v1.8 p. 28, taking into account Steady)
      if (consumeEntityStatusCards(player, StatusCard.CONFUSED)) {
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

        dispatchTrigger(nextState, 'THWART_RESOLVED', { targetPlayerId: player.id });

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

          const defeatedInstance: CardInstance = {
            instanceId: sideScheme.instanceId,
            card: sideScheme.card,
          };
          dispatchCanonicalDefeatTriggers(
            nextState,
            player.id,
            defeatedInstance.instanceId,
            'SCHEME',
          );

          // Resolve 'When Defeated' reward abilities declared on the scheme itself (e.g. Highway Robbery 01166)
          const defeatedAbilities = sideScheme.card.enrichment?.abilities || [];
          for (const ability of defeatedAbilities) {
            if (
              ability.trigger === 'DEFEATED' &&
              (ability.timing === 'FORCED_RESPONSE' || ability.timing === 'RESPONSE')
            ) {
              executeEffect(nextState, ability, {
                playerId: sideScheme.ownerId || player.id,
                sourceCardInstance: defeatedInstance,
              });
            }
          }

          // Route to Victory Display or the appropriate discard pile (RR v1.8 p. 30, ADR-0034)
          const destinationPile = sideScheme.ownerId
            ? getPlayer(nextState, sideScheme.ownerId)!.discard
            : nextState.encounterDiscard;
          moveDefeatedCardToPile(nextState, defeatedInstance, destinationPile);

          dispatchTrigger(nextState, 'THWART_RESOLVED', { targetPlayerId: player.id });

          const onomatopoeia = 'SCHEME DEFEATED!';
          return { state: nextState, result: { success: true, onomatopoeia } };
        }

        dispatchTrigger(nextState, 'THWART_RESOLVED', { targetPlayerId: player.id });

        const onomatopoeia = 'THWART!';
        return { state: nextState, result: { success: true, onomatopoeia } };
      }

      return { state: nextState, result: { success: true } };
    }

    case 'PLAY_CARD': {
      const sourceZone = action.sourceZone || 'HAND';
      const check = canPlayCard(
        nextState,
        action.playerId,
        action.cardInstanceId,
        action.paymentCardInstanceIds,
        action.generatorInstanceIds,
        sourceZone,
        action.targetOwnerPlayerId,
        action.targetPlayerId,
      );
      if (!check.allowed) {
        return { state, result: { success: false, error: check.reason } };
      }

      const player = getPlayer(nextState, action.playerId)!;

      let targetCard: CardInstance | undefined;
      let targetOwnerPlayer: PlayerState = player;

      if (sourceZone === 'PLAYER_DISCARD') {
        targetCard = player.discard.find((c) => c.instanceId === action.cardInstanceId);
      } else if (sourceZone === 'ANY_PLAYER_DISCARD') {
        if (action.targetOwnerPlayerId) {
          const owner = getPlayer(nextState, action.targetOwnerPlayerId);
          if (owner) {
            targetCard = owner.discard.find((c) => c.instanceId === action.cardInstanceId);
            targetOwnerPlayer = owner;
          }
        }
        if (!targetCard) {
          for (const p of nextState.players) {
            targetCard = p.discard.find((c) => c.instanceId === action.cardInstanceId);
            if (targetCard) {
              targetOwnerPlayer = p;
              break;
            }
          }
        }
      } else if (sourceZone === 'DECK_TOP') {
        targetCard =
          player.deck[0]?.instanceId === action.cardInstanceId ? player.deck[0] : undefined;
      } else if (sourceZone === 'ATTACHED' || sourceZone === 'TUCKED') {
        targetCard =
          player.attachments?.find((c) => c.instanceId === action.cardInstanceId) ||
          player.cardsUnderneath?.find((c) => c.instanceId === action.cardInstanceId);
      } else {
        targetCard = player.hand.find((c) => c.instanceId === action.cardInstanceId);
      }

      if (!targetCard) {
        return {
          state,
          result: {
            success: false,
            error:
              sourceZone === 'HAND'
                ? 'Target card not found in hand'
                : `Target card not found in ${sourceZone}`,
          },
        };
      }

      // Check Restricted Keyword limit replacement trigger (RR v1.8 p. 25, ADR-0018, ADR-0032)
      if (isCardRestricted(targetCard.card)) {
        const cardWeight = getCardRestrictedWeight(targetCard.card);
        const currentRestricted = getPlayerRestrictedCount(player);
        const maxRestricted = getPlayerRestrictedLimit(nextState, action.playerId);

        if (currentRestricted + cardWeight > maxRestricted) {
          const options: DecisionPromptOption[] = player.tableau
            .filter((c) => isCardRestricted(c.card))
            .map((c) => ({
              id: c.instanceId,
              label: `Discard ${c.card.name}`,
              description: `Discard ${c.card.name} from tableau to make room for ${targetCard.card.name}`,
              effect: 'DISCARD_RESTRICTED_REPLACEMENT',
              params: {
                discardCardInstanceId: c.instanceId,
                pendingCardInstanceId: action.cardInstanceId,
                paymentCardInstanceIds: action.paymentCardInstanceIds,
                generatorInstanceIds: action.generatorInstanceIds,
                targetInstanceId: action.targetInstanceId,
              },
            }));

          options.push({
            id: 'cancel_play',
            label: 'Cancel (Do not play)',
            description: `Cancel playing ${targetCard.card.name}`,
            effect: 'CANCEL_PLAY',
            params: {
              pendingCardInstanceId: action.cardInstanceId,
            },
          });

          const prompt: PendingDecisionPrompt = {
            promptId: `prompt_discard_restricted_${Date.now()}`,
            playerId: player.id,
            title: 'Restricted Limit Reached',
            description: `You have reached your Restricted card limit (${maxRestricted} max). Choose an in-play Restricted card to discard to make room for ${targetCard.card.name}, or Cancel:`,
            sourceCardName: targetCard.card.name,
            options,
            isVoluntary: true,
          };

          const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
          return {
            state: enqueuedState,
            result: { success: true, onomatopoeia: 'CHOOSE RESTRICTED!' },
          };
        }
      }

      // 1. Discard Payment Cards from Hand & Collect Spent Resources
      const resourcesSpent: string[] = [];
      for (const pId of action.paymentCardInstanceIds) {
        const pIndex = player.hand.findIndex((c) => c.instanceId === pId);
        if (pIndex !== -1) {
          const [discarded] = player.hand.splice(pIndex, 1);
          player.discard.push(discarded);

          // Check aspect doubling cards (e.g. The Power of Leadership / Justice / Aggression / Protection)
          const aspectDoubleStep = discarded.card.enrichment?.abilities
            ?.flatMap((a) => a.steps || [])
            .find((s) => s.effect === 'DOUBLE_RESOURCE_FOR_ASPECT');
          const isDoubled = Boolean(
            aspectDoubleStep && aspectDoubleStep.effectParams?.aspect === targetCard.card.faction,
          );
          const multiplier = isDoubled ? 2 : 1;

          const res = discarded.card.resources;
          let added = false;
          for (const type of ['physical', 'energy', 'mental', 'wild'] as const) {
            const count = (res?.[type] || 0) * multiplier;
            for (let i = 0; i < count; i++) {
              resourcesSpent.push(type);
              added = true;
            }
          }
          if (!added) {
            for (let i = 0; i < multiplier; i++) {
              resourcesSpent.push('wild');
            }
          }
        }
      }

      // 2. Process In-Play & Identity Generator Activations (e.g. Web-Shooter, Helicarrier, Scientist)
      for (const gId of action.generatorInstanceIds || []) {
        if (gId === 'identity_ability' || gId === player.activeFormCard.code) {
          const idAbility = player.activeFormCard.enrichment?.abilities?.find(
            (a) =>
              a.timing === 'RESOURCE' ||
              a.timing === 'HERO_RESOURCE' ||
              a.timing === 'ALTER_EGO_RESOURCE' ||
              a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE'),
          );
          if (idAbility) {
            const genStep = idAbility.steps?.find((s) => s.effect === 'GENERATE_RESOURCE');
            const resType = (genStep?.effectParams?.resource as string) || 'wild';
            const amount = Number(genStep?.effectParams?.amount) || 1;
            for (let i = 0; i < amount; i++) {
              resourcesSpent.push(resType);
            }

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
            (a) =>
              a.timing === 'RESOURCE' ||
              a.timing === 'HERO_RESOURCE' ||
              a.timing === 'ALTER_EGO_RESOURCE' ||
              a.steps?.some((s) => s.effect === 'GENERATE_RESOURCE' || s.effect === 'COST_REDUCER'),
          );
          if (tableAbility) {
            const genStep = tableAbility.steps?.find(
              (s) => s.effect === 'GENERATE_RESOURCE' || s.effect === 'COST_REDUCER',
            );
            const resType = (genStep?.effectParams?.resource as string) || 'wild';
            const amount = Number(genStep?.effectParams?.amount) || 1;
            for (let i = 0; i < amount; i++) {
              resourcesSpent.push(resType);
            }

            const key = `${gCard.instanceId}_${tableAbility.id}`;
            if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
            player.usedAbilitiesThisRound[key] = (player.usedAbilitiesThisRound[key] || 0) + 1;
            if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
            player.usedAbilitiesThisPhase[key] = (player.usedAbilitiesThisPhase[key] || 0) + 1;
          } else {
            resourcesSpent.push('wild');
          }

          // Generic counter decrement and discardOnEmpty handling (ADR-0018, ADR-0057)
          if (gCard.card.enrichment?.uses) {
            const counterType = gCard.card.enrichment.uses.type;
            if (counterType && gCard.counters && gCard.counters[counterType] !== undefined) {
              gCard.counters[counterType] = Math.max(0, gCard.counters[counterType] - 1);
            }
            const currentCounters = gCard.tokens?.counters || 0;
            gCard.tokens = { ...gCard.tokens, counters: Math.max(0, currentCounters - 1) };
            checkAndDiscardZeroCounterCard(
              nextState,
              player,
              gCard,
              gCard.card.enrichment.uses.type,
            );
          }
        }
      }

      // 3. Play Target Card from Source Zone
      let playedCardInstance: CardInstance;
      if (sourceZone === 'PLAYER_DISCARD') {
        const idx = player.discard.findIndex((c) => c.instanceId === action.cardInstanceId);
        [playedCardInstance] = player.discard.splice(idx, 1);
      } else if (sourceZone === 'ANY_PLAYER_DISCARD') {
        const idx = targetOwnerPlayer.discard.findIndex(
          (c) => c.instanceId === action.cardInstanceId,
        );
        [playedCardInstance] = targetOwnerPlayer.discard.splice(idx, 1);
      } else if (sourceZone === 'DECK_TOP') {
        playedCardInstance = player.deck.shift()!;
      } else if (sourceZone === 'ATTACHED' || sourceZone === 'TUCKED') {
        const attIdx =
          player.attachments?.findIndex((c) => c.instanceId === action.cardInstanceId) ?? -1;
        if (attIdx !== -1) {
          [playedCardInstance] = player.attachments!.splice(attIdx, 1);
        } else {
          const tuckIdx =
            player.cardsUnderneath?.findIndex((c) => c.instanceId === action.cardInstanceId) ?? -1;
          [playedCardInstance] = player.cardsUnderneath!.splice(tuckIdx, 1);
        }
      } else {
        const targetIndex = player.hand.findIndex((c) => c.instanceId === action.cardInstanceId);
        [playedCardInstance] = player.hand.splice(targetIndex, 1);
      }

      const cardType = playedCardInstance.card.type;

      // Track owner for cross-player control and attachments per RR v1.8 p. 11
      if (sourceZone === 'ANY_PLAYER_DISCARD') {
        playedCardInstance.ownerId = targetOwnerPlayer.id;
      } else if (!playedCardInstance.ownerId) {
        playedCardInstance.ownerId = player.id;
      }

      // Initialize counters declaratively for cards with 'uses' definition (RR v1.8 p. 30)
      initializeCardUses(playedCardInstance);

      // Determine onomatopoeia based on ability effects / card type
      let onomatopoeia = 'PLAY!';
      const abilities = playedCardInstance.card.enrichment?.abilities || [];
      const isAttackEffect = abilities.some((a) =>
        (a.steps || []).some((s) =>
          ['DEAL_DAMAGE', 'REPULSOR_BLAST', 'EXPLOSION'].includes(s.effect),
        ),
      );
      const isThwartEffect = abilities.some((a) =>
        (a.steps || []).some((s) => s.effect === 'REMOVE_THREAT'),
      );

      if (isAttackEffect) {
        onomatopoeia = 'POW!';
      } else if (isThwartEffect) {
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
        const attachAbility = abilities.find((a) =>
          a.steps?.some((s) => s.effect === 'ATTACH_TO_HOST'),
        );
        if (attachAbility) {
          const attachStep = attachAbility.steps.find((s) => s.effect === 'ATTACH_TO_HOST');
          const targetHost = (attachStep?.effectParams?.target as string) || 'VILLAIN';
          (playedCardInstance as any).ownerId = action.playerId;

          // If target is CHOSEN_MINION / MINION and no targetInstanceId was supplied
          if (
            (targetHost === 'CHOSEN_MINION' || targetHost === 'MINION') &&
            !action.targetInstanceId
          ) {
            const allMinions: { minion: CardInstance; player: PlayerState }[] = [];
            for (const p of nextState.players) {
              for (const m of p.engagedMinions || []) {
                allMinions.push({ minion: m, player: p });
              }
            }

            if (allMinions.length > 1) {
              const options: DecisionPromptOption[] = allMinions.map(
                ({ minion, player: engPlayer }) => ({
                  id: minion.instanceId,
                  label: `${minion.card.name} (${engPlayer.name})`,
                  description: `Attach ${playedCardInstance.card.name} to ${minion.card.name}`,
                  effect: 'ATTACH_TO_HOST',
                  params: {
                    isAttachmentMinionChoice: true,
                    attachmentCard: playedCardInstance,
                    ownerId: action.playerId,
                  },
                }),
              );

              const prompt: PendingDecisionPrompt = {
                promptId: `prompt_attach_minion_${Date.now()}`,
                playerId: action.playerId,
                title: 'Choose Minion Host',
                description: `Choose which minion to attach ${playedCardInstance.card.name} to:`,
                sourceCardName: playedCardInstance.card.name,
                options,
                isVoluntary: false,
              };

              const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
              return {
                state: enqueuedState,
                result: { success: true, onomatopoeia: 'CHOOSE MINION!' },
              };
            } else if (allMinions.length === 1) {
              attachCardToHost(
                nextState,
                playedCardInstance,
                targetHost,
                allMinions[0].minion.instanceId,
              );
            } else {
              attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
            }
          } else if (
            (targetHost === 'CHOSEN_ALLY' || targetHost === 'ALLY') &&
            !action.targetInstanceId
          ) {
            const maxPerHost =
              attachStep?.effectParams?.maxPerHost !== undefined
                ? Number(attachStep.effectParams.maxPerHost)
                : undefined;

            const allAllies: { ally: CardInstance; player: PlayerState }[] = [];
            for (const p of nextState.players) {
              for (const a of p.allies || []) {
                if (maxPerHost !== undefined && maxPerHost > 0) {
                  const currentAttached = (a.attachments || []).filter(
                    (att) =>
                      att.card.code === playedCardInstance.card.code ||
                      att.card.name === playedCardInstance.card.name,
                  ).length;
                  if (currentAttached >= maxPerHost) continue;
                }
                allAllies.push({ ally: a, player: p });
              }
            }

            if (allAllies.length > 1) {
              const options: DecisionPromptOption[] = allAllies.map(
                ({ ally, player: ctrlPlayer }) => ({
                  id: ally.instanceId,
                  label: `${ally.card.name} (${ctrlPlayer.name})`,
                  description: `Attach ${playedCardInstance.card.name} to ${ally.card.name}`,
                  effect: 'ATTACH_TO_HOST',
                  params: {
                    isAttachmentAllyChoice: true,
                    attachmentCard: playedCardInstance,
                    ownerId: action.playerId,
                  },
                }),
              );

              const prompt: PendingDecisionPrompt = {
                promptId: `prompt_attach_ally_${Date.now()}`,
                playerId: action.playerId,
                title: 'Choose Ally Host',
                description: `Choose which ally to attach ${playedCardInstance.card.name} to:`,
                sourceCardName: playedCardInstance.card.name,
                options,
                isVoluntary: false,
              };

              const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
              return {
                state: enqueuedState,
                result: { success: true, onomatopoeia: 'CHOOSE ALLY!' },
              };
            } else if (allAllies.length === 1) {
              attachCardToHost(
                nextState,
                playedCardInstance,
                targetHost,
                allAllies[0].ally.instanceId,
              );
            } else {
              attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
            }
          } else {
            attachCardToHost(nextState, playedCardInstance, targetHost, action.targetInstanceId);
          }
        } else if (playedCardInstance.card.enrichment?.playUnderAnyPlayerControl) {
          if (action.targetPlayerId) {
            const targetPlayer = getPlayer(nextState, action.targetPlayerId);
            if (!targetPlayer) {
              return {
                state,
                result: {
                  success: false,
                  error: `Target player ${action.targetPlayerId} not found`,
                },
              };
            }
            playedCardInstance.ownerId = action.playerId;
            targetPlayer.tableau.push(playedCardInstance);
          } else if (nextState.players.length === 1) {
            playedCardInstance.ownerId = player.id;
            player.tableau.push(playedCardInstance);
          } else {
            const options: DecisionPromptOption[] = nextState.players.map((p) => {
              const count = p.tableau.filter(
                (c) =>
                  c.card.code === playedCardInstance.card.code ||
                  c.card.name.toLowerCase().trim() ===
                    playedCardInstance.card.name.toLowerCase().trim(),
              ).length;
              if (
                playedCardInstance.card.maxPerPlayer !== undefined &&
                count >= playedCardInstance.card.maxPerPlayer
              ) {
                return {
                  id: p.id,
                  label: p.name,
                  effect: 'PLAY_UNDER_PLAYER_CONTROL',
                  params: {
                    targetPlayerId: p.id,
                    playedCardInstance,
                    ownerId: action.playerId,
                  },
                  disabled: true,
                  disabledReason: `Max ${playedCardInstance.card.maxPerPlayer} per player limit reached for ${p.name}`,
                };
              }
              return {
                id: p.id,
                label: p.name,
                effect: 'PLAY_UNDER_PLAYER_CONTROL',
                params: {
                  targetPlayerId: p.id,
                  playedCardInstance,
                  ownerId: action.playerId,
                },
              };
            });

            const prompt: PendingDecisionPrompt = {
              promptId: `prompt_choose_player_${Date.now()}`,
              playerId: action.playerId,
              title: 'Choose Player Control',
              description: `Choose which player takes control of ${playedCardInstance.card.name}:`,
              sourceCardName: playedCardInstance.card.name,
              options,
              isVoluntary: false,
            };

            const enqueuedState = enqueueDecisionPrompt(nextState, prompt);
            return {
              state: enqueuedState,
              result: { success: true, onomatopoeia: 'CHOOSE HERO!' },
            };
          }
        } else {
          player.tableau.push(playedCardInstance);
        }

        const controllingPlayer =
          action.targetPlayerId && playedCardInstance.card.enrichment?.playUnderAnyPlayerControl
            ? getPlayer(nextState, action.targetPlayerId) || player
            : player;

        // Apply immediate max health expansion (RR v1.8 p. 11: Current HP increases by same amount)
        for (const ability of abilities) {
          const matchingStep = ability.steps?.find(
            (s) =>
              s.effect === 'MODIFY_MAX_HEALTH' ||
              (s.effect === 'MODIFY_STAT' && s.effectParams?.stat === 'HEALTH'),
          );
          if (ability.timing === 'CONSTANT' && matchingStep) {
            const hpBonus =
              (matchingStep.effectParams?.amount as number) ||
              (matchingStep.effectParams?.healthBonus as number) ||
              0;
            if (hpBonus > 0) {
              controllingPlayer.health += hpBonus;
              controllingPlayer.maxHealth = getEffectiveMaxHealth(controllingPlayer, nextState);
            }
          }
        }

        dispatchTrigger(nextState, 'CARD_PLAYED', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
        dispatchTrigger(nextState, 'ENTERS_PLAY', {
          targetPlayerId: controllingPlayer.id,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
      } else if (cardType === CardType.ALLY) {
        player.allies.push(playedCardInstance);
        // Dispatch CARD_PLAYED trigger (ally was played — cost paid or waived per ADR-0047)
        dispatchTrigger(nextState, 'CARD_PLAYED', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
        // Dispatch ENTERS_PLAY trigger (ally has entered an in-play zone — per RR v1.8 p.11)
        dispatchTrigger(nextState, 'ENTERS_PLAY', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
      } else if (cardType === CardType.EVENT) {
        // Execute declarative event abilities
        for (const ability of abilities) {
          executeEffect(nextState, ability, {
            playerId: action.playerId,
            targetType,
            targetInstanceId: action.targetInstanceId,
            sourceCardInstance: playedCardInstance,
            resourcesSpent,
          });
        }
        player.discard.push(playedCardInstance);
        dispatchTrigger(nextState, 'CARD_PLAYED', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
      } else if (cardType === CardType.PLAYER_SIDE_SCHEME) {
        // Player Side Schemes enter the shared scheme area alongside encounter Side Schemes
        // (RR v1.8 p. 26, ADR-0034), scaled by player count like any other scheme.
        const schemeCard = playedCardInstance.card as unknown as
          SideSchemeCard | PlayerSideSchemeCard;
        const baseThreat =
          (schemeCard.baseThreat ?? 0) *
          (schemeCard.baseThreatFixed ? 1 : nextState.players.length);

        nextState.sideSchemes.push({
          instanceId: playedCardInstance.instanceId,
          card: schemeCard,
          threat: baseThreat,
          ownerId: player.id,
        });

        // Dispatch CARD_PLAYED trigger (side scheme was played — cost paid)
        dispatchTrigger(nextState, 'CARD_PLAYED', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });
        // Dispatch ENTERS_PLAY trigger (side scheme has entered the shared scheme area — per RR v1.8 p.11)
        dispatchTrigger(nextState, 'ENTERS_PLAY', {
          targetPlayerId: action.playerId,
          sourceInstanceId: playedCardInstance.instanceId,
          resourcesSpent,
        });

        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: nextState.roundNumber,
          phase: nextState.phase,
          key: 'encounter.reveal.sideScheme',
          params: { sideScheme: playedCardInstance.card.name, threat: baseThreat },
          onomatopoeia: 'SIDE SCHEME!',
        });
      }

      // Consume applicable active cost reductions (RR v1.8 p. 7, 17, Issue #46)
      const applicableReductions = getApplicableCostReductions(
        player,
        playedCardInstance,
        nextState,
      );
      if (applicableReductions.length > 0) {
        const consumedIds = new Set(applicableReductions.map((r) => r.id));
        player.activeCostReductions = (player.activeCostReductions || []).filter(
          (r) => !consumedIds.has(r.id),
        );
        player.costReductions = player.activeCostReductions.reduce((sum, r) => sum + r.amount, 0);

        for (const r of applicableReductions) {
          nextState.log.push({
            id: `log_${Date.now()}_cost_consumed`,
            timestamp: Date.now(),
            round: nextState.roundNumber,
            phase: nextState.phase,
            category: 'ability',
            key: 'cost.reduction.consumed',
            params: {
              player: player.name,
              source: r.sourceCardName,
              card: playedCardInstance.card.name,
              amount: r.amount,
            },
            onomatopoeia: `${r.sourceCardName.toUpperCase()} DISCOUNT APPLIED!`,
          });
        }
      }

      return { state: nextState, result: { success: true, onomatopoeia } };
    }

    case 'USE_CARD_ABILITY': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      // Find card in all in-play zones or identity (ADR-0055)
      let targetCardInst = findInPlayCardInstance(nextState, action.cardInstanceId);
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
      if (ability.timing.startsWith('HERO_') && player.currentForm !== 'hero') {
        return {
          state,
          result: { success: false, error: 'Can only use this ability in Hero form' },
        };
      }
      if (ability.timing.startsWith('ALTER_EGO_') && player.currentForm !== 'alter_ego') {
        return {
          state,
          result: { success: false, error: 'Can only use this ability in Alter-Ego form' },
        };
      }

      // Limit validation (e.g. ONCE_PER_ROUND, ONCE_PER_PHASE)
      const abilityKey = targetCardInst ? `${targetCardInst.instanceId}_${ability.id}` : ability.id;
      if (
        ability.limit === 'ONCE_PER_ROUND' &&
        (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1
      ) {
        return {
          state,
          result: {
            success: false,
            error: `Ability '${ability.id}' has already been used this round (Limit: once per round)`,
          },
        };
      }
      if (
        ability.limit === 'ONCE_PER_PHASE' &&
        (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1
      ) {
        return {
          state,
          result: {
            success: false,
            error: `Ability '${ability.id}' has already been used this phase (Limit: once per phase)`,
          },
        };
      }

      // Resource payment validation: Player must explicitly select payment cards (RR v1.8 p. 25 / ADR-0055)
      if (ability.cost?.resourceCost) {
        if (!action.paymentCardInstanceIds || action.paymentCardInstanceIds.length === 0) {
          return {
            state,
            result: {
              success: false,
              error: 'Payment cards must be selected to satisfy the resource cost.',
            },
          };
        }
      }

      if (
        ability.cost?.discardCard?.from === 'HAND' &&
        ability.cost.discardCard.mode !== 'RANDOM'
      ) {
        const requiredCount = ability.cost.discardCard.count || 1;
        if (
          !action.discardCardInstanceIds ||
          action.discardCardInstanceIds.length < requiredCount
        ) {
          return {
            state,
            result: {
              success: false,
              error: 'Discard cards must be selected from hand to satisfy the discard cost.',
            },
          };
        }
      }

      // Ability initiation & target validity check (RR v1.8 p. 15-16, 29, 30; Issue #101)
      const initCheck = canInitiateAbility(nextState, action.playerId, ability, targetCardInst, {
        discardCardInstanceIds: action.discardCardInstanceIds,
        paymentCardInstanceIds: action.paymentCardInstanceIds,
        generatorInstanceIds: action.generatorInstanceIds,
        targetInstanceId: action.targetInstanceId,
      });
      if (!initCheck.allowed) {
        return { state, result: { success: false, error: initCheck.reason } };
      }

      // Execute cost payment
      const { discardedCount, resourcesPaid } = executeAbilityCost(
        nextState,
        player,
        ability,
        targetCardInst,
        {
          discardCardInstanceIds: action.discardCardInstanceIds,
          paymentCardInstanceIds: action.paymentCardInstanceIds,
          generatorInstanceIds: action.generatorInstanceIds,
          targetInstanceId: action.targetInstanceId,
        },
      );

      // Discard on empty counters if Uses counters exhausted (RR v1.8 p. 30)
      if (targetCardInst) {
        checkAndDiscardZeroCounterCard(nextState, player, targetCardInst);
      }

      // Dynamic parameter scaling (e.g. Legal Practice 01023: Remove 1 threat per discarded card)
      let effectiveAbility = ability;
      const scalingStep = ability.steps?.find(
        (s) => s.effectParams?.scaling === 'PER_DISCARDED_CARD',
      );
      if (scalingStep) {
        effectiveAbility = {
          ...ability,
          steps: ability.steps.map((s) =>
            s === scalingStep
              ? {
                  ...s,
                  effectParams: {
                    ...s.effectParams,
                    amount: discardedCount * ((s.effectParams?.multiplier as number) || 1),
                  },
                }
              : s,
          ),
        };
      }

      // Dynamic parameter scaling per resource spent (e.g. Energy Channel 01018: Add 1 counter per energy spent)
      const resourceScalingStep = ability.steps?.find(
        (s) => s.effectParams?.scaling === 'PER_RESOURCE_SPENT',
      );
      if (resourceScalingStep) {
        effectiveAbility = {
          ...effectiveAbility,
          steps: effectiveAbility.steps.map((s) =>
            s === resourceScalingStep
              ? {
                  ...s,
                  effectParams: {
                    ...s.effectParams,
                    amount: resourcesPaid * ((s.effectParams?.multiplier as number) || 1),
                  },
                }
              : s,
          ),
        };
      }

      // Execute effect primitive
      const effectRes = executeEffect(nextState, effectiveAbility, {
        playerId: action.playerId,
        sourceCardInstance: targetCardInst,
        targetInstanceId: action.targetInstanceId,
      });

      if (effectRes.success) {
        if (!player.usedAbilitiesThisRound) player.usedAbilitiesThisRound = {};
        player.usedAbilitiesThisRound[abilityKey] =
          (player.usedAbilitiesThisRound[abilityKey] || 0) + 1;
        if (!player.usedAbilitiesThisPhase) player.usedAbilitiesThisPhase = {};
        player.usedAbilitiesThisPhase[abilityKey] =
          (player.usedAbilitiesThisPhase[abilityKey] || 0) + 1;
      }

      return {
        state: effectRes.state,
        result: {
          success: effectRes.success,
          error: effectRes.error,
          onomatopoeia: effectRes.onomatopoeia || 'ABILITY ACTIVATED!',
        },
      };
    }

    case 'END_PLAYER_TURN':
    case 'END_TURN' as any: {
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

      // If all players have taken their turns in this round -> proceed to End of Player Phase Clean-Up (RR v1.8 p. 23)
      if (nextIndex === nextState.firstPlayerIndex) {
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
      // Transitional forwarder to USE_CARD_ABILITY (ADR-0055)
      const targetCard = findInPlayCardInstance(nextState, action.attachmentInstanceId);
      const abilities = targetCard?.card.enrichment?.abilities || [];
      const discardAbility = abilities.find(
        (ab) =>
          ab.steps?.some(
            (s) =>
              s.effect === 'DISCARD_ATTACHMENT' ||
              s.effect === 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT' ||
              (s.effect === 'DISCARD' &&
                (s.effectParams?.source === 'SELF' || s.effectParams?.source === 'HOST')),
          ) || Boolean(ab.cost?.discardSelf),
      );

      return dispatchAction(nextState, {
        type: 'USE_CARD_ABILITY',
        playerId: action.playerId,
        cardInstanceId: action.attachmentInstanceId,
        abilityId: discardAbility ? discardAbility.id : 'ivory_horn_discard_action',
        paymentCardInstanceIds: action.paymentCardInstanceIds,
      });
    }

    case 'RESOLVE_DECISION_PROMPT': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      const activePrompt = peekDecisionPrompt(nextState);

      // Distribution Prompt Resolution (ADR-0064)
      if (
        activePrompt &&
        (activePrompt.kind === 'DISTRIBUTE_POINTS' || activePrompt.distributionConfig !== undefined)
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);

        if (
          (action.selectedOptionId === 'cancel' || action.selectedOptionId === 'pass') &&
          (activePrompt.distributionConfig?.canCancel || activePrompt.isVoluntary)
        ) {
          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: player.name, type: player.currentForm },
            key: 'decision.distribution.cancelled',
            params: { player: player.name, source: activePrompt.sourceCardName },
            onomatopoeia: 'CANCELLED',
          });
          return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
        }

        const assignments = action.assignments || {};
        const config = activePrompt.distributionConfig;
        const domain = config?.allocationDomain || 'DAMAGE';

        // Route assignments to top execution stack frame if one exists
        if (poppedState.executionStack && poppedState.executionStack.length > 0) {
          const topFrame = poppedState.executionStack[poppedState.executionStack.length - 1];
          if (topFrame) {
            topFrame.context = { ...(topFrame.context || {}), assignments };
          }
        }

        // Apply assignments across targets
        for (const [targetId, amount] of Object.entries(assignments)) {
          if (amount <= 0) continue;

          if (domain === 'DAMAGE') {
            let ally: CardInstance | undefined;
            let allyController: PlayerState | undefined;
            for (const p of poppedState.players) {
              const found = p.allies.find((a) => a.instanceId === targetId);
              if (found) {
                ally = found;
                allyController = p;
                break;
              }
            }

            if (ally && allyController) {
              const allyToughIdx = (ally.statusCards || []).indexOf(StatusCard.TOUGH);
              if (allyToughIdx !== -1) {
                ally.statusCards!.splice(allyToughIdx, 1);
              } else {
                const currentDmg = ally.tokens?.damage || 0;
                const newDmg = currentDmg + amount;
                const allyHp = (ally.card as any).health || 1;
                if (newDmg >= allyHp) {
                  const idx = allyController.allies.indexOf(ally);
                  allyController.allies.splice(idx, 1);
                  processHostDefeated(poppedState, ally, { player: allyController });
                  dispatchCanonicalDefeatTriggers(
                    poppedState,
                    allyController.id,
                    ally.instanceId,
                    'CHARACTER',
                  );
                  const owner =
                    (ally.ownerId
                      ? poppedState.players.find((pl) => pl.id === ally.ownerId)
                      : undefined) || allyController;
                  owner.discard.push(ally);
                } else {
                  ally.tokens = { ...ally.tokens, damage: newDmg };
                }
              }
            } else {
              const targetPlayer =
                poppedState.players.find(
                  (pl) =>
                    pl.id === targetId ||
                    pl.activeFormCard?.code === targetId ||
                    pl.hero?.code === targetId,
                ) || (targetId === player.id ? player : undefined);

              if (targetPlayer) {
                const toughIdx = targetPlayer.statusCards.indexOf(StatusCard.TOUGH);
                if (toughIdx !== -1) {
                  targetPlayer.statusCards.splice(toughIdx, 1);
                } else {
                  targetPlayer.health = Math.max(0, targetPlayer.health - amount);
                  if (targetPlayer.health <= 0) poppedState.winner = 'VILLAIN';
                }
              } else if (
                targetId === poppedState.villain?.instanceId ||
                targetId === 'villain' ||
                targetId === poppedState.villain?.card?.code
              ) {
                const vToughIdx = poppedState.villain.statusCards.indexOf(StatusCard.TOUGH);
                if (vToughIdx !== -1) {
                  poppedState.villain.statusCards.splice(vToughIdx, 1);
                } else {
                  poppedState.villain.health = Math.max(0, poppedState.villain.health - amount);
                  if (poppedState.villain.health <= 0) {
                    handleVillainDefeat(poppedState, poppedState.villain.instanceId);
                  }
                }
              } else {
                for (const p of poppedState.players) {
                  const mIdx = p.engagedMinions.findIndex((m) => m.instanceId === targetId);
                  if (mIdx !== -1) {
                    const minion = p.engagedMinions[mIdx];
                    const mToughIdx = (minion.statusCards || []).indexOf(StatusCard.TOUGH);
                    if (mToughIdx !== -1) {
                      minion.statusCards!.splice(mToughIdx, 1);
                    } else {
                      const currentDmg = minion.tokens?.damage || 0;
                      const newDmg = currentDmg + amount;
                      const minionHp = (minion.card as MinionCard).health || 1;
                      if (newDmg >= minionHp) {
                        processHostDefeated(poppedState, minion, { player: p });
                        p.engagedMinions.splice(mIdx, 1);
                        moveDefeatedCardToPile(poppedState, minion, poppedState.encounterDiscard);
                        dispatchCanonicalDefeatTriggers(
                          poppedState,
                          p.id,
                          minion.instanceId,
                          'CHARACTER',
                        );
                      } else {
                        minion.tokens = { ...minion.tokens, damage: newDmg };
                      }
                    }
                    break;
                  }
                }
              }
            }
          } else if (domain === 'THREAT_REMOVAL') {
            if (
              targetId === 'main_scheme' ||
              targetId === poppedState.mainScheme?.instanceId ||
              targetId === poppedState.mainScheme?.card?.code
            ) {
              poppedState.mainScheme.threat = Math.max(0, poppedState.mainScheme.threat - amount);
            } else {
              const sideIdx = (poppedState.sideSchemes || []).findIndex(
                (s) => s.instanceId === targetId || s.card.code === targetId,
              );
              if (sideIdx !== -1) {
                const side = poppedState.sideSchemes![sideIdx];
                side.threat = Math.max(0, (side.threat || 0) - amount);
                if (side.threat <= 0) {
                  poppedState.sideSchemes!.splice(sideIdx, 1);
                  dispatchCanonicalDefeatTriggers(
                    poppedState,
                    player.id,
                    side.instanceId,
                    'SCHEME',
                  );
                  poppedState.encounterDiscard.push(side);
                }
              }
            }
          } else if (domain === 'HEAL') {
            let ally: CardInstance | undefined;
            for (const p of poppedState.players) {
              const found = p.allies.find((a) => a.instanceId === targetId);
              if (found) {
                ally = found;
                break;
              }
            }
            if (ally) {
              const currentDmg = ally.tokens?.damage || 0;
              ally.tokens = { ...ally.tokens, damage: Math.max(0, currentDmg - amount) };
            } else {
              const targetPlayer = poppedState.players.find(
                (pl) =>
                  pl.id === targetId ||
                  pl.activeFormCard?.code === targetId ||
                  pl.hero?.code === targetId,
              );
              if (targetPlayer) {
                targetPlayer.health = Math.min(
                  targetPlayer.maxHealth,
                  targetPlayer.health + amount,
                );
              }
            }
          } else if (domain === 'EXHAUST') {
            const cardInst = findInPlayCardInstance(poppedState, targetId);
            if (cardInst) {
              cardInst.exhausted = true;
            } else {
              const targetPlayer = poppedState.players.find((pl) => pl.id === targetId);
              if (targetPlayer) targetPlayer.exhausted = true;
            }
          } else if (domain === 'COUNTERS') {
            const cardInst = findInPlayCardInstance(poppedState, targetId);
            if (cardInst) {
              cardInst.tokens = {
                ...cardInst.tokens,
                counters: (cardInst.tokens?.counters || 0) + amount,
              };
            }
          }
        }

        const assignedTotal = Object.values(assignments).reduce((sum, n) => sum + (n || 0), 0);
        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'decision.distribution.resolved',
          params: {
            player: player.name,
            domain,
            amount: assignedTotal,
            source: activePrompt.sourceCardName,
          },
          onomatopoeia: 'POINTS ASSIGNED!',
        });

        return {
          state: poppedState,
          result: { success: true, onomatopoeia: 'POINTS ASSIGNED!' },
        };
      }

      // 0. Wakanda Forever! Sequence Order Prompt Resolution (ADR-0038)
      if (
        activePrompt &&
        (activePrompt.title?.includes('Wakanda Forever') ||
          activePrompt.sourceCardName === 'Wakanda Forever!')
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const sequenceOrder: string[] =
          (action as any).sequenceOrder ||
          (action.selectedOptionId ? [action.selectedOptionId] : []);
        const wfHandler = getSpecialHandler('WAKANDA_FOREVER');
        if (wfHandler) {
          const res = wfHandler.execute(
            poppedState,
            { playerId: action.playerId },
            { sequenceOrder },
          );
          return {
            state: res.state,
            result: { success: res.success, onomatopoeia: res.onomatopoeia },
          };
        }
      }

      // 1. End of Player Phase Voluntary Discard & Clean-Up Prompt (RR v1.8 p. 23)
      if (
        activePrompt &&
        activePrompt.options.some(
          (o) => o.effect === 'PLAYER_PHASE_DISCARD_CARD' || o.effect === 'FINISH_PLAYER_CLEANUP',
        )
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const targetPlayer = poppedState.players.find((p) => p.id === action.playerId);
        if (!targetPlayer)
          return { state: poppedState, result: { success: false, error: 'Player not found' } };

        if (
          !selectedOption ||
          selectedOption.id === 'done_cleanup' ||
          selectedOption.effect === 'FINISH_PLAYER_CLEANUP'
        ) {
          // Finish this player's cleanup without any more discards -> refills hand & readies cards
          const finishedState = executePlayerCleanup(poppedState, action.playerId, []);
          return {
            state: finishedState,
            result: { success: true, onomatopoeia: 'CLEAN-UP COMPLETE!' },
          };
        }

        if (selectedOption.effect === 'PLAYER_PHASE_DISCARD_CARD') {
          const cardId = selectedOption.params?.cardInstanceId as string;
          const cardIdx = targetPlayer.hand.findIndex((c) => c.instanceId === cardId);
          if (cardIdx !== -1) {
            const [discarded] = targetPlayer.hand.splice(cardIdx, 1);
            targetPlayer.discard.push(discarded);
            poppedState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: poppedState.roundNumber,
              phase: poppedState.phase,
              category: 'phase',
              actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
              key: 'player.phase.cleanup.cardDiscarded',
              params: { player: targetPlayer.name, card: discarded.card.name },
              onomatopoeia: 'DISCARD',
            });
          }

          // If still has cards in hand, re-enqueue prompt with remaining hand cards
          if (targetPlayer.hand.length > 0) {
            const remainingOptions: DecisionPromptOption[] = targetPlayer.hand.map((c) => ({
              id: `discard_${c.instanceId}`,
              label: `Discard ${c.card.name}`,
              description: `Discard ${c.card.name} to discard pile`,
              effect: 'PLAYER_PHASE_DISCARD_CARD',
              params: { cardInstanceId: c.instanceId, playerId: targetPlayer.id },
            }));

            remainingOptions.push({
              id: 'done_cleanup',
              label: 'Done / Keep Remaining Cards',
              description: 'Proceed to refill hand and ready all cards',
              effect: 'FINISH_PLAYER_CLEANUP',
              params: { playerId: targetPlayer.id },
            });

            const rePrompt: PendingDecisionPrompt = {
              promptId: `prompt_cleanup_${targetPlayer.id}_${Date.now()}`,
              playerId: targetPlayer.id,
              title: 'End of Player Phase: Voluntary Discard',
              description: `${targetPlayer.name}: Select any additional cards in your hand you wish to discard:`,
              sourceCardName: targetPlayer.hero?.name || targetPlayer.name,
              options: remainingOptions,
              isVoluntary: true,
            };

            const enqueuedState = enqueueDecisionPrompt(poppedState, rePrompt);
            return { state: enqueuedState, result: { success: true, onomatopoeia: 'DISCARDED' } };
          } else {
            // No more cards in hand -> finish cleanup
            const finishedState = executePlayerCleanup(poppedState, action.playerId, []);
            return {
              state: finishedState,
              result: { success: true, onomatopoeia: 'CLEAN-UP COMPLETE!' },
            };
          }
        }
      }

      if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentMinionChoice)) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const chosenMinionId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const attachmentCard = (selectedOption?.params?.attachmentCard ||
          activePrompt.options[0]?.params?.attachmentCard) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId) as string | undefined;

        if (attachmentCard) {
          (attachmentCard as any).ownerId = ownerId;
          attachCardToHost(poppedState, attachmentCard, 'CHOSEN_MINION', chosenMinionId);
        }

        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'card.attached.to_host',
          params: {
            player: player.name,
            card: activePrompt.sourceCardName,
            host: selectedOption?.label || chosenMinionId,
          },
          onomatopoeia: 'ATTACHED!',
        });

        return { state: poppedState, result: { success: true, onomatopoeia: 'ATTACHED!' } };
      }

      if (activePrompt && activePrompt.options.some((o) => o.params?.isAttachmentAllyChoice)) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const chosenAllyId = selectedOption ? selectedOption.id : activePrompt.options[0].id;
        const attachmentCard = (selectedOption?.params?.attachmentCard ||
          activePrompt.options[0]?.params?.attachmentCard) as CardInstance | undefined;
        const ownerId = (selectedOption?.params?.ownerId ||
          activePrompt.options[0]?.params?.ownerId) as string | undefined;

        if (attachmentCard) {
          (attachmentCard as any).ownerId = ownerId;
          attachCardToHost(poppedState, attachmentCard, 'CHOSEN_ALLY', chosenAllyId);
        }

        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'card.attached.to_host',
          params: {
            player: player.name,
            card: activePrompt.sourceCardName,
            host: selectedOption?.label || chosenAllyId,
          },
          onomatopoeia: 'ATTACHED!',
        });

        return { state: poppedState, result: { success: true, onomatopoeia: 'ATTACHED!' } };
      }

      if (
        activePrompt &&
        activePrompt.options.some((o) => o.effect === 'PLAY_UNDER_PLAYER_CONTROL')
      ) {
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        if (!selectedOption) {
          return { state: nextState, result: { success: false, error: 'Option not found' } };
        }

        if (selectedOption.disabled) {
          return {
            state: nextState,
            result: {
              success: false,
              error: selectedOption.disabledReason || 'Option is disabled',
            },
          };
        }

        const { state: poppedState } = popDecisionPrompt(nextState);
        const params = selectedOption.params as any;
        const targetPlayerId = params?.targetPlayerId as string;
        const playedCardInstance = params?.playedCardInstance as CardInstance;
        const ownerId = (params?.ownerId as string) || action.playerId;

        const targetPlayer = getPlayer(poppedState, targetPlayerId) || player;
        playedCardInstance.ownerId = ownerId;
        targetPlayer.tableau.push(playedCardInstance);

        const onomatopoeia = 'PLAYED UNDER CONTROL!';
        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: player.name, type: player.currentForm },
          key: 'card.playUnderControl.resolved',
          params: {
            player: player.name,
            card: playedCardInstance.card.name,
            targetPlayer: targetPlayer.name,
          },
          onomatopoeia,
        });

        // Apply immediate max health expansion if needed
        const cardAbilities = playedCardInstance.card.enrichment?.abilities || [];
        for (const ability of cardAbilities) {
          const matchingStep = ability.steps?.find(
            (s) =>
              s.effect === 'MODIFY_MAX_HEALTH' ||
              (s.effect === 'MODIFY_STAT' && s.effectParams?.stat === 'HEALTH'),
          );
          if (ability.timing === 'CONSTANT' && matchingStep) {
            const hpBonus =
              (matchingStep.effectParams?.amount as number) ||
              (matchingStep.effectParams?.healthBonus as number) ||
              0;
            if (hpBonus > 0) {
              targetPlayer.health += hpBonus;
              targetPlayer.maxHealth = getEffectiveMaxHealth(targetPlayer, poppedState);
            }
          }
        }

        dispatchTrigger(poppedState, 'CARD_PLAYED', {
          targetPlayerId: ownerId,
          sourceInstanceId: playedCardInstance.instanceId,
        });
        dispatchTrigger(poppedState, 'ENTERS_PLAY', {
          targetPlayerId: targetPlayer.id,
          sourceInstanceId: playedCardInstance.instanceId,
        });

        return { state: poppedState, result: { success: true, onomatopoeia } };
      }

      if (
        activePrompt &&
        activePrompt.options.some(
          (o) => o.effect === 'DISCARD_RESTRICTED_REPLACEMENT' || o.effect === 'CANCEL_PLAY',
        )
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);

        if (
          !selectedOption ||
          selectedOption.id === 'cancel_play' ||
          selectedOption.effect === 'CANCEL_PLAY'
        ) {
          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'card_play',
            actor: { name: player.name, type: player.currentForm },
            key: 'card.play.cancelled',
            params: { player: player.name, card: activePrompt.sourceCardName },
            onomatopoeia: 'CANCELLED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'CANCELLED' } };
        }

        if (selectedOption.effect === 'DISCARD_RESTRICTED_REPLACEMENT') {
          const params = selectedOption.params as any;
          const discardId = params?.discardCardInstanceId || selectedOption.id;
          const discardIdx = player.tableau.findIndex((c) => c.instanceId === discardId);
          if (discardIdx !== -1) {
            const [discarded] = player.tableau.splice(discardIdx, 1);
            player.discard.push(discarded);

            poppedState.log.push({
              id: `log_${Date.now()}`,
              timestamp: Date.now(),
              round: poppedState.roundNumber,
              phase: poppedState.phase,
              category: 'card_play',
              actor: { name: player.name, type: player.currentForm },
              key: 'card.discarded.to_make_room',
              params: {
                player: player.name,
                discardedCard: discarded.card.name,
                incomingCard: activePrompt.sourceCardName,
              },
              onomatopoeia: 'REPLACED!',
            });
          }

          return dispatchAction(poppedState, {
            type: 'PLAY_CARD',
            playerId: action.playerId,
            cardInstanceId: params.pendingCardInstanceId,
            paymentCardInstanceIds: params.paymentCardInstanceIds || [],
            generatorInstanceIds: params.generatorInstanceIds || [],
            targetInstanceId: params.targetInstanceId,
          });
        }
      }

      if (
        activePrompt &&
        activePrompt.options.some(
          (o) =>
            o.effect === 'SEARCH_AND_SELECT_RESOLUTION' || o.effect === 'SEARCH_AND_SELECT_PASS',
        )
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);
        const params = (selectedOption?.params || activePrompt.options[0]?.params) as any;

        const lookedCards: CardInstance[] = params?.lookedCards || [];
        const chosenInstanceId: string = action.selectedOptionId;
        const sourceZone: string = params?.sourceZone || 'PLAYER_DECK';
        const sourceZones: string[] = Array.isArray(params?.sourceZones)
          ? params.sourceZones
          : params?.sourceZone
            ? [params.sourceZone]
            : ['PLAYER_DECK'];
        const selectedDestination: string = params?.selectedDestination || 'HAND';
        const unselectedDestination: string | null | undefined = params?.unselectedDestination;
        const shuffleAfter: boolean = !!params?.shuffleAfter;
        const isLookCountSpliced: boolean = !!params?.isLookCountSpliced;

        const targetPlayer = poppedState.players.find((p) => p.id === action.playerId)!;

        if (
          !selectedOption ||
          selectedOption.id === 'pass_search' ||
          selectedOption.effect === 'SEARCH_AND_SELECT_PASS'
        ) {
          if (isLookCountSpliced) {
            routeCardInstances(
              poppedState,
              targetPlayer,
              lookedCards,
              unselectedDestination,
              sourceZone,
            );
          }
          if (shuffleAfter) {
            if (sourceZones.includes('ENCOUNTER_DECK')) {
              poppedState.encounterDeck.sort(() => Math.random() - 0.5);
            }
            if (sourceZones.includes('PLAYER_DECK')) {
              targetPlayer.deck.sort(() => Math.random() - 0.5);
            }
          }

          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'card.search.passed',
            params: { player: targetPlayer.name, prompt: activePrompt.title },
            onomatopoeia: 'PASSED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'PASSED' } };
        }

        // Selected Option
        let chosenCard: CardInstance | undefined;
        let chosenCardZone = sourceZone;
        let unchosenCards: CardInstance[] = [];

        if (isLookCountSpliced) {
          chosenCard = lookedCards.find((c) => c.instanceId === chosenInstanceId);
          unchosenCards = lookedCards.filter((c) => c.instanceId !== chosenInstanceId);
        } else {
          // Full search across pile: find and splice chosen card from source zones
          const searchZones = [sourceZone, ...sourceZones.filter((z) => z !== sourceZone)];
          for (const zone of searchZones) {
            let pile: CardInstance[] = targetPlayer.deck;
            if (zone === 'PLAYER_DISCARD') pile = targetPlayer.discard;
            else if (zone === 'PLAYER_HAND') pile = targetPlayer.hand;
            else if (zone === 'ENCOUNTER_DECK') pile = poppedState.encounterDeck;
            else if (zone === 'ENCOUNTER_DISCARD') pile = poppedState.encounterDiscard;

            const matchIdx = pile.findIndex((c) => c.instanceId === chosenInstanceId);
            if (matchIdx !== -1) {
              chosenCard = pile.splice(matchIdx, 1)[0];
              chosenCardZone = zone;
              break;
            }
          }
        }

        if (chosenCard) {
          routeCardInstances(
            poppedState,
            targetPlayer,
            [chosenCard],
            selectedDestination,
            chosenCardZone,
          );
        }

        if (isLookCountSpliced && unchosenCards.length > 0) {
          routeCardInstances(
            poppedState,
            targetPlayer,
            unchosenCards,
            unselectedDestination,
            sourceZone,
          );
        }

        if (shuffleAfter) {
          if (sourceZones.includes('ENCOUNTER_DECK')) {
            poppedState.encounterDeck.sort(() => Math.random() - 0.5);
          }
          if (sourceZones.includes('PLAYER_DECK')) {
            targetPlayer.deck.sort(() => Math.random() - 0.5);
          }
        }

        poppedState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          round: poppedState.roundNumber,
          phase: poppedState.phase,
          category: 'ability',
          actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
          key: 'card.searched.selected',
          params: {
            player: targetPlayer.name,
            card: chosenCard?.card.name || selectedOption.label,
          },
          onomatopoeia: 'SELECTED!',
        });

        return { state: poppedState, result: { success: true, onomatopoeia: 'SELECTED!' } };
      }

      if (
        activePrompt &&
        activePrompt.options.some(
          (o) =>
            o.effect === 'PLAY_CARD_FROM_ZONE_RESOLUTION' ||
            o.effect === 'PLAY_CARD_FROM_ZONE_PASS',
        )
      ) {
        const { state: poppedState } = popDecisionPrompt(nextState);
        const selectedOption = activePrompt.options.find((o) => o.id === action.selectedOptionId);

        if (
          !selectedOption ||
          selectedOption.id === 'pass_play_from_zone' ||
          selectedOption.effect === 'PLAY_CARD_FROM_ZONE_PASS'
        ) {
          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: player.name, type: player.currentForm },
            key: 'card.playFromZone.passed',
            params: { player: player.name, prompt: activePrompt.title },
            onomatopoeia: 'PASSED',
          });

          return { state: poppedState, result: { success: true, onomatopoeia: 'PASSED' } };
        }

        const params = selectedOption.params as any;
        const chosenInstanceId = params.chosenInstanceId;
        const ownerId = params.ownerId;
        const ownerPlayer = poppedState.players.find((p) => p.id === ownerId) || player;
        const targetPlayer = poppedState.players.find((p) => p.id === action.playerId) || player;

        // Splice from owner discard
        const matchIdx = ownerPlayer.discard.findIndex((c) => c.instanceId === chosenInstanceId);
        if (matchIdx !== -1) {
          const [chosenCard] = ownerPlayer.discard.splice(matchIdx, 1);

          // Deduct cost if resources available in hand
          const cost = chosenCard.card.cost ?? 0;
          if (cost > 0) {
            // Deduct up to cost cards from player hand if present
            const countToDiscard = Math.min(cost, targetPlayer.hand.length);
            const discarded = targetPlayer.hand.splice(0, countToDiscard);
            targetPlayer.discard.push(...discarded);
          }

          // Track owner for cross-player control per RR v1.8 p. 11
          chosenCard.ownerId = ownerPlayer.id;

          if (chosenCard.card.type === CardType.ALLY) {
            targetPlayer.allies.push(chosenCard);
          } else {
            targetPlayer.tableau.push(chosenCard);
          }

          initializeCardUses(chosenCard);

          // Trigger CARD_PLAYED (card was played, cost paid per ADR-0047) and ENTERS_PLAY (per RR v1.8 p.11)
          dispatchTrigger(poppedState, 'CARD_PLAYED', {
            targetPlayerId: targetPlayer.id,
            sourceInstanceId: chosenCard.instanceId,
          });
          dispatchTrigger(poppedState, 'ENTERS_PLAY', {
            targetPlayerId: targetPlayer.id,
            sourceInstanceId: chosenCard.instanceId,
          });

          const onomatopoeia = `PLAYED ${chosenCard.card.name.toUpperCase()}!`;
          poppedState.log.push({
            id: `log_${Date.now()}`,
            timestamp: Date.now(),
            round: poppedState.roundNumber,
            phase: poppedState.phase,
            category: 'ability',
            actor: { name: targetPlayer.name, type: targetPlayer.currentForm },
            key: 'card.playFromZone.resolved',
            params: {
              player: targetPlayer.name,
              card: chosenCard.card.name,
            },
            onomatopoeia,
          });

          return { state: poppedState, result: { success: true, onomatopoeia } };
        }
      }

      const promptRes = resolveDecisionPrompt(nextState, action.playerId, action.selectedOptionId);
      let resultingState = promptRes.state;

      // If resolving an initiation trigger prompt for an active attack, continue attack
      if (resultingState.activeAttackContext?.phase === 'INITIATION') {
        const attackCtx = resultingState.activeAttackContext;
        resultingState = continueAttackAfterInitiation(resultingState, attackCtx);
      }

      // If resolving a damage prevention interrupt for an active attack, finish damage calculation and post-resolution
      if (
        activePrompt &&
        resultingState.activeAttackContext?.pendingDamage !== undefined &&
        (activePrompt.description?.includes('DAMAGE_WOULD_BE_TAKEN') ||
          activePrompt.options.some(
            (o) => (o.params as any)?.ability?.trigger === 'DAMAGE_WOULD_BE_TAKEN',
          ))
      ) {
        const attackCtx = resultingState.activeAttackContext;
        let preventedDamage = 0;
        if (action.selectedOptionId !== 'pass' && action.selectedOptionId !== 'PASS') {
          const optAbility = (
            activePrompt?.options.find((o) => o.id === action.selectedOptionId)?.params as any
          )?.ability;
          const preventStep = optAbility?.steps?.find((s: any) => s.effect === 'PREVENT_DAMAGE');
          if (preventStep) {
            const isAll =
              preventStep.effectParams?.amount === 'ALL' ||
              preventStep.effectParams?.preventAll ||
              preventStep.effectParams?.amount === undefined;
            preventedDamage = isAll
              ? (attackCtx.pendingDamage ?? 0)
              : Number(preventStep.effectParams?.amount || 0);
          }
        }
        resultingState = finishAttackDamageAndPostResolution(
          resultingState,
          attackCtx,
          preventedDamage,
        );
      }

      // If in villain phase and no decision prompts are pending, continue villain phase sequence
      if (
        resultingState.phase === GamePhase.VILLAIN_PHASE &&
        !resultingState.pendingDecisionPrompt
      ) {
        resultingState = continueVillainPhase(resultingState);
      }

      return {
        ...promptRes,
        state: resultingState,
      };
    }

    case 'DECLARE_DEFENDER': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      let updatedState = resolveDefenderDeclaration(nextState, {
        type: action.defenderType,
        playerId: action.playerId,
        allyInstanceId: action.allyInstanceId,
      });

      if (updatedState.phase === GamePhase.VILLAIN_PHASE && !updatedState.pendingDecisionPrompt) {
        updatedState = continueVillainPhase(updatedState);
      }

      return {
        state: updatedState,
        result: { success: true, onomatopoeia: 'DEFENSE RESOLVED!' },
      };
    }

    case 'MINION_ENGAGES_PLAYER': {
      const player = getPlayer(nextState, action.playerId);
      if (!player) return { state, result: { success: false, error: 'Player not found' } };

      const minionInst = (action as any).minionInstance as CardInstance;
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
    }

    case 'REVEAL_ENCOUNTER_CARD': {
      const targetPlayer =
        getPlayer(nextState, (action as any).targetPlayerId || (action as any).playerId) ||
        nextState.players[0];
      const encounterCard = (action as any).encounterCard as CardInstance;
      if (!encounterCard)
        return { state, result: { success: false, error: 'Encounter card required' } };

      // Incite X Keyword check (RR v1.8 p. 16, ADR-0019)
      const inciteAmount =
        (encounterCard.card.enrichment as any)?.incite ||
        getKeywordValue(encounterCard.card, Keyword.INCITE) ||
        0;
      if (inciteAmount > 0) {
        nextState.mainScheme.threat += inciteAmount;
        nextState.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'scheme',
          key: 'card.effect.incite',
          params: {
            scheme: nextState.mainScheme.card.name,
            amount: inciteAmount,
            source: encounterCard.card.name,
          },
          onomatopoeia: `INCITE ${inciteAmount}!`,
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
    }

    default:
      return { state, result: { success: false, error: 'Unknown action type' } };
  }
}
