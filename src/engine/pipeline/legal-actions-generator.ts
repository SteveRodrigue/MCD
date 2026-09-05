import { GameState, CardInstance, GameAction } from '../models';
import {
  getPlayer,
  canChangeForm,
  canBasicRecover,
  canBasicAttack,
  canAllyAttack,
  canBasicThwart,
  evaluateCardPlayability,
} from './legality-checker';
import {
  getEffectiveHeroStats,
  getEffectiveAllyStats,
  getEffectiveMaxHealth,
  getEffectiveHandSize,
} from './stat-calculator';
import { canPayAbilityCost, isResourceAbility } from './cost-engine';

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
  cardCode?: string;
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

export function formatTimingBadge(timing: string): string {
  if (timing === 'ALTER_EGO_ACTION') return 'ALTER-EGO ACTION';
  if (timing === 'HERO_ACTION') return 'HERO ACTION';
  return timing.replace(/_/g, ' ');
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
        cardCode: isHero ? player.alterEgo.code : player.hero.code,
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
          cardCode: player.alterEgo.code,
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
          cardCode: player.hero.code,
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
            cardCode: player.hero.code,
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
            cardCode: player.hero.code,
          });
        }
      }

      for (const sideScheme of state.sideSchemes || []) {
        if (sideScheme.threat > 0) {
          const sideThwCheck = canBasicThwart(
            state,
            playerId,
            'side_scheme',
            sideScheme.instanceId,
          );
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
              cardCode: player.hero.code,
            });
          }
        }
      }
    }

    // 1E. Identity In-Play Actions (e.g. Tony Stark Futuristic, Carol Danvers Rechannel)
    const idAbilities = player.activeFormCard.enrichment?.abilities || [];
    for (const ab of idAbilities) {
      if (isResourceAbility(ab.timing)) continue; // Never present resource abilities as standalone turn actions (RR v1.8 p. 25 / ADR-0039)
      if (
        ab.timing === 'ACTION' ||
        (isHero && ab.timing === 'HERO_ACTION') ||
        (!isHero && ab.timing === 'ALTER_EGO_ACTION')
      ) {
        // Limit validation (RR v1.8 p. 21)
        const isUsedRound =
          ab.limit === 'ONCE_PER_ROUND' && (player.usedAbilitiesThisRound?.[ab.id] || 0) >= 1;
        const isUsedPhase =
          ab.limit === 'ONCE_PER_PHASE' && (player.usedAbilitiesThisPhase?.[ab.id] || 0) >= 1;
        if (isUsedRound || isUsedPhase) continue;

        const costCheck = canPayAbilityCost(state, player, ab, undefined, {});
        if (costCheck.allowed) {
          identityActions.push({
            id: `action_id_ability_${ab.id}`,
            category: 'identity',
            headline: `Action: ${ab.id.replace(/_/g, ' ').toUpperCase()}`,
            subtext: ab.steps?.[0]?.params?.description
              ? String(ab.steps[0].params.description)
              : `Trigger ${player.activeFormCard.name}'s special ability`,
            action: {
              type: 'USE_CARD_ABILITY',
              playerId: player.id,
              cardInstanceId: player.activeFormCard.code,
              abilityId: ab.id,
            },
            badge: formatTimingBadge(ab.timing),
            iconType: 'ability',
            cardCode: player.activeFormCard.code,
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
          cardCode: cardInst.card.code,
        });
      }
    }

    // 3. Board Tableau & Ally Actions
    // 3A. Tableau Cards (Upgrades & Supports)
    for (const tableauItem of player.tableau) {
      const abilities = tableauItem.card.enrichment?.abilities || [];
      for (const ab of abilities) {
        if (isResourceAbility(ab.timing)) continue; // Never present resource abilities as standalone turn actions (RR v1.8 p. 25 / ADR-0039)
        if (
          ab.timing === 'ACTION' ||
          (isHero && ab.timing === 'HERO_ACTION') ||
          (!isHero && ab.timing === 'ALTER_EGO_ACTION')
        ) {
          // Limit validation (RR v1.8 p. 21)
          const abilityKey = `${tableauItem.instanceId}_${ab.id}`;
          const isUsedRound =
            ab.limit === 'ONCE_PER_ROUND' &&
            (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1;
          const isUsedPhase =
            ab.limit === 'ONCE_PER_PHASE' &&
            (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1;
          if (isUsedRound || isUsedPhase) continue;

          const costCheck = canPayAbilityCost(state, player, ab, tableauItem, {});
          if (costCheck.allowed) {
            boardActions.push({
              id: `action_tableau_${tableauItem.instanceId}_${ab.id}`,
              category: 'board',
              headline: `Activate ${tableauItem.card.name}`,
              subtext: ab.steps?.[0]?.params?.description
                ? String(ab.steps[0].params.description)
                : `Trigger ${tableauItem.card.name} (${ab.id})`,
              action: {
                type: 'USE_CARD_ABILITY',
                playerId: player.id,
                cardInstanceId: tableauItem.instanceId,
                abilityId: ab.id,
              },
              badge: formatTimingBadge(ab.timing),
              iconType: 'ability',
              targetCardInstance: tableauItem,
              cardCode: tableauItem.card.code,
            });
          }
        }
      }
    }

    // 3B. Ally Activations (Ally Attack / Ally Thwart)
    for (const ally of player.allies) {
      if (!ally.exhausted) {
        const allyStats = getEffectiveAllyStats(state, ally);

        // Ally Attack on Villain
        const villainAtkCheck = canAllyAttack(state, player.id, ally.instanceId, 'villain');
        if (villainAtkCheck.allowed) {
          boardActions.push({
            id: `action_ally_attack_villain_${ally.instanceId}`,
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
            cardCode: ally.card.code,
          });
        }

        // Ally Attack on engaged minions
        for (const minion of player.engagedMinions || []) {
          const minionAtkCheck = canAllyAttack(
            state,
            player.id,
            ally.instanceId,
            'minion',
            minion.instanceId,
          );
          if (minionAtkCheck.allowed) {
            boardActions.push({
              id: `action_ally_attack_minion_${ally.instanceId}_${minion.instanceId}`,
              category: 'board',
              headline: `Ally Strike: ${ally.card.name} ➔ ${minion.card.name}`,
              subtext: `Exhaust ${ally.card.name} to deal ${allyStats.attack} damage to minion`,
              action: {
                type: 'ALLY_ATTACK',
                playerId: player.id,
                allyInstanceId: ally.instanceId,
                targetType: 'minion',
                targetInstanceId: minion.instanceId,
              },
              badge: `${allyStats.attack} ATK`,
              iconType: 'attack',
              targetCardInstance: ally,
              cardCode: ally.card.code,
            });
          }
        }

        // Ally Thwart (Main Scheme)
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
            cardCode: ally.card.code,
          });
        }

        // Ally Thwart (Side Schemes)
        for (const sideScheme of state.sideSchemes || []) {
          if (sideScheme.threat > 0) {
            boardActions.push({
              id: `action_ally_thwart_side_${ally.instanceId}_${sideScheme.instanceId}`,
              category: 'board',
              headline: `Ally Thwart (${ally.card.name} ➔ ${sideScheme.card.name})`,
              subtext: `Exhaust ${ally.card.name} to remove ${allyStats.thwart} threat from ${sideScheme.card.name}`,
              action: {
                type: 'ALLY_THWART',
                playerId: player.id,
                allyInstanceId: ally.instanceId,
                targetType: 'side_scheme',
                targetInstanceId: sideScheme.instanceId,
              },
              badge: `${allyStats.thwart} THW`,
              iconType: 'thwart',
              targetCardInstance: ally,
              cardCode: ally.card.code,
            });
          }
        }
      }
    }

    // 3C. In-Play Attachment Actions (e.g. Discard Caught in a Web, Armored Rhino Suit)
    const allAttachments: { attachment: CardInstance; hostName: string }[] = [];
    for (const att of player.attachments || []) {
      allAttachments.push({ attachment: att, hostName: player.name });
    }
    for (const att of state.villain.attachments || []) {
      allAttachments.push({ attachment: att, hostName: state.villain.card.name });
    }
    for (const m of player.engagedMinions || []) {
      for (const att of m.attachments || []) {
        allAttachments.push({ attachment: att, hostName: m.card.name });
      }
    }
    for (const a of player.allies || []) {
      for (const att of a.attachments || []) {
        allAttachments.push({ attachment: att, hostName: a.card.name });
      }
    }
    for (const att of state.mainScheme.attachments || []) {
      allAttachments.push({ attachment: att, hostName: state.mainScheme.card.name });
    }

    for (const { attachment, hostName } of allAttachments) {
      const abilities = attachment.card.enrichment?.abilities || [];
      for (const ab of abilities) {
        if (
          ab.timing === 'HERO_ACTION' ||
          ab.timing === 'ALTER_EGO_ACTION' ||
          ab.timing === 'ACTION' ||
          ab.steps?.some(
            (s) =>
              s.effect === 'DISCARD_ATTACHMENT' ||
              s.effect === 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT',
          )
        ) {
          // Check form compatibility
          if (ab.timing === 'HERO_ACTION' && player.currentForm !== 'hero') continue;
          if (ab.timing === 'ALTER_EGO_ACTION' && player.currentForm !== 'alter_ego') continue;

          boardActions.push({
            id: `action_attachment_${attachment.instanceId}_${ab.id}`,
            category: 'board',
            headline: `Discard: ${attachment.card.name}`,
            subtext: `Pay resources to discard ${attachment.card.name} from ${hostName}`,
            action: {
              type: 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT',
              playerId: player.id,
              attachmentInstanceId: attachment.instanceId,
            },
            badge: 'DISCARD ATTACHMENT',
            iconType: 'ability',
            targetCardInstance: attachment,
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
      headline: isPassingToVillain
        ? 'End Turn (Begin Villain Phase)'
        : `Pass Turn to ${nextPlayer.name}`,
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
