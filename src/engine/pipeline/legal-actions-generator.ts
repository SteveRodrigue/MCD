import {
  GameState,
  CardInstance,
  GameAction,
} from '../models';
import {
  getPlayer,
  canChangeForm,
  canBasicRecover,
  canBasicAttack,
  canBasicThwart,
  evaluateCardPlayability,
} from './legality-checker';
import {
  getEffectiveHeroStats,
  getEffectiveAllyStats,
  getEffectiveMaxHealth,
  getEffectiveHandSize,
} from './stat-calculator';
import { canPayAbilityCost } from './cost-engine';

export interface LegalActionItem {
  id: string;
  category: 'identity' | 'hand' | 'board' | 'turn';
  headline: string;
  subtext: string;
  action: GameAction;
  badge?: string;
  iconType?: 'flip' | 'recover' | 'attack' | 'thwart' | 'card' | 'ability' | 'pass';
  requiresModal?: 'payment' | 'target';
  targetCardInstance?: CardInstance;
}

export interface LegalActionReport {
  playerId: string;
  playerName: string;
  isPlayerTurn: boolean;
  activeActionCount: number; // Count of actionable plays excluding 'End Turn'
  identityActions: LegalActionItem[];
  handCardActions: LegalActionItem[];
  boardActions: LegalActionItem[];
  turnAction?: LegalActionItem;
  allActions: LegalActionItem[];
}

/**
 * Pure generator that discovers every legal action currently available to the player (ADR-0018, ADR-0024).
 */
export function getLegalActionsForPlayer(state: GameState, playerId: string): LegalActionReport {
  const player = getPlayer(state, playerId);
  if (!player) {
    return {
      playerId,
      playerName: 'Unknown',
      isPlayerTurn: false,
      activeActionCount: 0,
      identityActions: [],
      handCardActions: [],
      boardActions: [],
      allActions: [],
    };
  }

  const activePlayer = state.players[state.activePlayerIndex];
  const isPlayerTurn = activePlayer?.id === playerId && state.phase === 'PLAYER_PHASE';

  const identityActions: LegalActionItem[] = [];
  const handCardActions: LegalActionItem[] = [];
  const boardActions: LegalActionItem[] = [];

  const isHero = player.currentForm === 'hero';
  const effectiveStats = getEffectiveHeroStats(state, player);
  const effectiveMaxHp = getEffectiveMaxHealth(player, state);
  const effectiveHandSize = getEffectiveHandSize(player, state);

  // 1. Identity Actions
  if (isPlayerTurn) {
    // 1A. Change Form / Flip
    const changeFormCheck = canChangeForm(state, playerId);
    if (changeFormCheck.allowed) {
      identityActions.push({
        id: `action_change_form_${player.id}`,
        category: 'identity',
        headline: isHero ? 'Flip to Alter-Ego' : 'Suit Up (Hero Form)',
        subtext: isHero
          ? `Change form to ${player.alterEgo.name} (Hand Size: ${player.alterEgo.handSize || 6})`
          : `Change form to ${player.hero.name} (Hand Size: ${effectiveHandSize})`,
        action: { type: 'CHANGE_FORM', playerId: player.id },
        badge: 'ONCE / ROUND',
        iconType: 'flip',
      });
    }

    // 1B. Basic Recover (Alter-Ego only)
    if (!isHero) {
      const recCheck = canBasicRecover(state, playerId);
      if (recCheck.allowed && player.health < effectiveMaxHp) {
        const healAmount = Math.min(effectiveStats.recovery, effectiveMaxHp - player.health);
        identityActions.push({
          id: `action_basic_recover_${player.id}`,
          category: 'identity',
          headline: `Rest & Recover (+${healAmount} HP)`,
          subtext: `Exhaust ${player.activeFormCard.name} to heal from ${player.health} to ${player.health + healAmount} HP`,
          action: { type: 'BASIC_RECOVER', playerId: player.id },
          badge: `REC: ${effectiveStats.recovery}`,
          iconType: 'recover',
        });
      }
    }

    // 1C. Basic Attack (Hero only)
    if (isHero) {
      const atkCheck = canBasicAttack(state, playerId, 'villain');
      if (atkCheck.allowed) {
        identityActions.push({
          id: `action_basic_attack_villain_${player.id}`,
          category: 'identity',
          headline: `Hero Strike on ${state.villain.card.name}`,
          subtext: `Exhaust ${player.activeFormCard.name} to deal ${effectiveStats.attack} damage`,
          action: { type: 'BASIC_ATTACK', playerId: player.id, targetType: 'villain' },
          badge: `${effectiveStats.attack} ATK`,
          iconType: 'attack',
        });
      }

      // Attack engaged minions
      for (const minion of player.engagedMinions || []) {
        const minionAtkCheck = canBasicAttack(state, playerId, 'minion', minion.instanceId);
        if (minionAtkCheck.allowed) {
          identityActions.push({
            id: `action_basic_attack_minion_${minion.instanceId}`,
            category: 'identity',
            headline: `Strike Minion: ${minion.card.name}`,
            subtext: `Exhaust ${player.activeFormCard.name} to deal ${effectiveStats.attack} damage to minion`,
            action: {
              type: 'BASIC_ATTACK',
              playerId: player.id,
              targetType: 'minion',
              targetInstanceId: minion.instanceId,
            },
            badge: `${effectiveStats.attack} ATK`,
            iconType: 'attack',
          });
        }
      }

      // 1D. Basic Thwart (Hero only)
      if ((state.mainScheme?.threat || 0) > 0) {
        const thwCheck = canBasicThwart(state, playerId, 'main_scheme');
        if (thwCheck.allowed) {
          identityActions.push({
            id: `action_basic_thwart_main_${player.id}`,
            category: 'identity',
            headline: `Thwart Main Scheme`,
            subtext: `Exhaust ${player.activeFormCard.name} to remove ${effectiveStats.thwart} threat from ${state.mainScheme.card.name}`,
            action: { type: 'BASIC_THWART', playerId: player.id, targetType: 'main_scheme' },
            badge: `${effectiveStats.thwart} THW`,
            iconType: 'thwart',
          });
        }
      }

      for (const sideScheme of state.sideSchemes || []) {
        if (sideScheme.threat > 0) {
          const sideThwCheck = canBasicThwart(state, playerId, 'side_scheme', sideScheme.instanceId);
          if (sideThwCheck.allowed) {
            identityActions.push({
              id: `action_basic_thwart_side_${sideScheme.instanceId}`,
              category: 'identity',
              headline: `Thwart: ${sideScheme.card.name}`,
              subtext: `Exhaust ${player.activeFormCard.name} to remove ${effectiveStats.thwart} threat`,
              action: {
                type: 'BASIC_THWART',
                playerId: player.id,
                targetType: 'side_scheme',
                targetInstanceId: sideScheme.instanceId,
              },
              badge: `${effectiveStats.thwart} THW`,
              iconType: 'thwart',
            });
          }
        }
      }
    }

    // 1E. Identity In-Play Actions (e.g. Tony Stark Futuristic, Carol Danvers Rechannel)
    const idAbilities = player.activeFormCard.enrichment?.abilities || [];
    for (const ab of idAbilities) {
      if (ab.timing === 'ACTION' || (isHero && ab.timing === 'HERO_ACTION') || (!isHero && ab.timing === 'ALTER_EGO_ACTION')) {
        const costCheck = canPayAbilityCost(state, player, ab, undefined, {});
        if (costCheck.allowed) {
          identityActions.push({
            id: `action_id_ability_${ab.id}`,
            category: 'identity',
            headline: `Action: ${ab.id.replace(/_/g, ' ').toUpperCase()}`,
            subtext: ab.params?.description ? String(ab.params.description) : `Trigger ${player.activeFormCard.name}'s special ability`,
            action: {
              type: 'USE_CARD_ABILITY',
              playerId: player.id,
              cardInstanceId: player.activeFormCard.code,
              abilityId: ab.id,
            },
            badge: ab.timing.replace('_', ' '),
            iconType: 'ability',
          });
        }
      }
    }

    // 2. Playable Hand Cards
    for (const cardInst of player.hand) {
      const playability = evaluateCardPlayability(state, playerId, cardInst);
      if (playability.isPlayable) {
        const cost = cardInst.card.cost ?? 0;
        handCardActions.push({
          id: `action_play_hand_${cardInst.instanceId}`,
          category: 'hand',
          headline: `Play ${cardInst.card.name}`,
          subtext: `${cardInst.card.type.toUpperCase()} • Cost: ${cost} • ${cardInst.card.faction?.toUpperCase() || 'NEUTRAL'}`,
          action: {
            type: 'PLAY_CARD',
            playerId: player.id,
            cardInstanceId: cardInst.instanceId,
            paymentCardInstanceIds: [],
          },
          badge: `Cost ${cost}`,
          iconType: 'card',
          requiresModal: cost > 0 ? 'payment' : undefined,
          targetCardInstance: cardInst,
        });
      }
    }

    // 3. Board Tableau & Ally Actions
    // 3A. Tableau Cards (Upgrades & Supports)
    for (const tableauItem of player.tableau) {
      const abilities = tableauItem.card.enrichment?.abilities || [];
      for (const ab of abilities) {
        if (ab.timing === 'ACTION' || (isHero && ab.timing === 'HERO_ACTION') || (!isHero && ab.timing === 'ALTER_EGO_ACTION')) {
          const costCheck = canPayAbilityCost(state, player, ab, tableauItem, {});
          if (costCheck.allowed) {
            boardActions.push({
              id: `action_tableau_${tableauItem.instanceId}_${ab.id}`,
              category: 'board',
              headline: `Activate ${tableauItem.card.name}`,
              subtext: ab.params?.description ? String(ab.params.description) : `Trigger ${tableauItem.card.name} (${ab.id})`,
              action: {
                type: 'USE_CARD_ABILITY',
                playerId: player.id,
                cardInstanceId: tableauItem.instanceId,
                abilityId: ab.id,
              },
              badge: ab.timing.replace('_', ' '),
              iconType: 'ability',
              targetCardInstance: tableauItem,
            });
          }
        }
      }
    }

    // 3B. Ally Activations (Ally Attack / Ally Thwart)
    for (const ally of player.allies) {
      if (!ally.exhausted) {
        const allyStats = getEffectiveAllyStats(state, ally);

        // Ally Attack
        boardActions.push({
          id: `action_ally_attack_${ally.instanceId}`,
          category: 'board',
          headline: `Ally Attack: ${ally.card.name}`,
          subtext: `Exhaust ${ally.card.name} to deal ${allyStats.attack} damage to villain`,
          action: {
            type: 'ALLY_ATTACK',
            playerId: player.id,
            allyInstanceId: ally.instanceId,
            targetType: 'villain',
          },
          badge: `${allyStats.attack} ATK`,
          iconType: 'attack',
          targetCardInstance: ally,
        });

        // Ally Thwart
        if ((state.mainScheme?.threat || 0) > 0) {
          boardActions.push({
            id: `action_ally_thwart_${ally.instanceId}`,
            category: 'board',
            headline: `Ally Thwart: ${ally.card.name}`,
            subtext: `Exhaust ${ally.card.name} to remove ${allyStats.thwart} threat from main scheme`,
            action: {
              type: 'ALLY_THWART',
              playerId: player.id,
              allyInstanceId: ally.instanceId,
              targetType: 'main_scheme',
            },
            badge: `${allyStats.thwart} THW`,
            iconType: 'thwart',
            targetCardInstance: ally,
          });
        }
      }
    }
  }

  // 4. Turn Control Action (End Player Turn)
  let turnAction: LegalActionItem | undefined;
  if (isPlayerTurn) {
    const nextIdx = (state.activePlayerIndex + 1) % state.players.length;
    const isPassingToVillain = nextIdx === state.firstPlayerIndex;
    const nextPlayer = state.players[nextIdx];

    turnAction = {
      id: `action_end_turn_${player.id}`,
      category: 'turn',
      headline: isPassingToVillain ? 'End Turn (Begin Villain Phase)' : `Pass Turn to ${nextPlayer.name}`,
      subtext: isPassingToVillain
        ? 'Conclude the Player Phase and advance to the Villain Phase.'
        : `Pass active turn to Seat ${nextIdx + 1} (${nextPlayer.name}).`,
      action: { type: 'END_PLAYER_TURN', playerId: player.id },
      badge: isPassingToVillain ? 'VILLAIN PHASE ➔' : 'PASS ➔',
      iconType: 'pass',
    };
  }

  const activeActionCount = identityActions.length + handCardActions.length + boardActions.length;
  const allActions = [...identityActions, ...handCardActions, ...boardActions];
  if (turnAction) allActions.push(turnAction);

  return {
    playerId: player.id,
    playerName: player.name,
    isPlayerTurn,
    activeActionCount,
    identityActions,
    handCardActions,
    boardActions,
    turnAction,
    allActions,
  };
}
