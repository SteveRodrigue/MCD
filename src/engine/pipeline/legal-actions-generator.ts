import {
  GameState,
  CardInstance,
  GameAction,
  getActiveVillain,
  getActiveMainScheme,
  getVillainsInPlay,
  getMainSchemesInPlay,
  PlayerState,
} from '../models';
import {
  getPlayer,
  canChangeForm,
  canBasicRecover,
  canAttack,
  canThwart,
  evaluateCardPlayability,
  canInitiateAbility,
  HERO_ACTOR,
} from './legality-checker';
import {
  getEffectiveHeroStats,
  getEffectiveAllyStats,
  getEffectiveMaxHealth,
  getEffectiveHandSize,
} from './stat-calculator';
import { isResourceAbility, getEffectiveCardCost } from './cost-engine';
import type { ResourceCost } from '../../data/supplemental/schema';

export interface LegalActionItem {
  id: string;
  category: 'identity' | 'hand' | 'board' | 'turn' | 'villain' | 'call_for_action';
  headline: string;
  subtext: string;
  action: GameAction;
  badge?: string;
  iconType?: 'flip' | 'recover' | 'attack' | 'thwart' | 'card' | 'ability' | 'pass';
  requiresModal?: 'payment' | 'target';
  targetCardInstance?: CardInstance;
  cardCode?: string;
  ownerName?: string;
}

export interface LegalActionReport {
  playerId: string;
  playerName: string;
  isPlayerTurn: boolean;
  activeActionCount: number; // Count of actionable plays excluding 'End Turn'
  identityActions: LegalActionItem[];
  handCardActions: LegalActionItem[];
  boardActions: LegalActionItem[];
  callForActionItems: LegalActionItem[];
  callForActionCount: number;
  villainActionItems: LegalActionItem[];
  villainActionCount: number;
  turnAction?: LegalActionItem;
  allActions: LegalActionItem[];
}

export function formatTimingBadge(timing: string): string {
  if (timing === 'ALTER_EGO_ACTION') return 'ALTER-EGO ACTION';
  if (timing === 'HERO_ACTION') return 'HERO ACTION';
  return timing.replace(/_/g, ' ');
}

/**
 * Discovers legal Action abilities on a player's in-play tableau (Supports & Upgrades).
 * Reusable for both the active player's turn report and cooperative teammate call-for-actions (RR v1.8 p. 5, 23).
 */
function getTableauActionItems(
  state: GameState,
  player: PlayerState,
  isCallingPlayerTurn: boolean,
): LegalActionItem[] {
  const items: LegalActionItem[] = [];
  const isHero = player.currentForm === 'hero';

  for (const tableauItem of player.tableau || []) {
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
          ab.limit === 'ONCE_PER_ROUND' && (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1;
        const isUsedPhase =
          ab.limit === 'ONCE_PER_PHASE' && (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1;
        if (isUsedRound || isUsedPhase) continue;

        const costCheck = canInitiateAbility(state, player.id, ab, tableauItem, {});
        if (costCheck.allowed) {
          let badge = formatTimingBadge(ab.timing);
          let requiresModal: 'payment' | undefined = undefined;

          if (ab.cost?.resourceCost) {
            requiresModal = 'payment';
            const requiredType = Object.keys(ab.cost.resourceCost)[0] as
              keyof ResourceCost | undefined;
            const requiredAmount = requiredType ? ab.cost.resourceCost[requiredType] || 1 : 1;
            badge = requiredType
              ? `${requiredAmount} ${requiredType.toUpperCase()}`
              : `${requiredAmount} RESOURCES`;
          } else if (ab.cost?.discardCard && ab.cost.discardCard.from === 'HAND') {
            requiresModal = 'payment';
            const count = ab.cost.discardCard.count || 1;
            badge = `DISCARD ${count} CARD${count > 1 ? 'S' : ''}`;
          }

          items.push({
            id: isCallingPlayerTurn
              ? `action_tableau_${tableauItem.instanceId}_${ab.id}`
              : `action_call_tableau_${tableauItem.instanceId}_${ab.id}`,
            category: isCallingPlayerTurn ? 'board' : 'call_for_action',
            headline: isCallingPlayerTurn
              ? `Activate ${tableauItem.card.name}`
              : tableauItem.card.name,
            subtext: ab.steps?.[0]?.effectParams?.description
              ? String(ab.steps[0].effectParams.description)
              : tableauItem.card.text || `Trigger ${tableauItem.card.name} (${ab.id})`,
            action: {
              type: 'USE_CARD_ABILITY',
              playerId: player.id,
              cardInstanceId: tableauItem.instanceId,
              abilityId: ab.id,
            },
            badge,
            iconType: 'ability',
            requiresModal,
            targetCardInstance: tableauItem,
            cardCode: tableauItem.card.code,
            ownerName: player.name,
          });
        }
      }
    }
  }

  return items;
}

/**
 * Discovers legal Action abilities on a player's active identity card (Alter-Ego or Hero).
 * Reusable for both the active player's turn report and cooperative teammate call-for-actions (RR v1.8 p. 5, 23).
 */
function getIdentityActionItems(
  state: GameState,
  player: PlayerState,
  isCallingPlayerTurn: boolean,
): LegalActionItem[] {
  const items: LegalActionItem[] = [];
  const isHero = player.currentForm === 'hero';
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

      const costCheck = canInitiateAbility(state, player.id, ab, undefined, {});
      if (costCheck.allowed) {
        let badge = formatTimingBadge(ab.timing);
        if (isCallingPlayerTurn && ab.cost?.discardCard && ab.cost.discardCard.from === 'HAND') {
          const count = ab.cost.discardCard.count || 1;
          badge = `DISCARD ${count} CARD${count > 1 ? 'S' : ''}`;
        }

        const headline = isCallingPlayerTurn
          ? `Action: ${ab.id.replace(/_/g, ' ').toUpperCase()}`
          : `${player.activeFormCard.name}: ${ab.id.replace(/_/g, ' ').toUpperCase()}`;

        const subtext = ab.steps?.[0]?.effectParams?.description
          ? String(ab.steps[0].effectParams.description)
          : player.activeFormCard.text || `Trigger ${player.activeFormCard.name}'s special ability`;

        items.push({
          id: isCallingPlayerTurn
            ? `action_id_ability_${ab.id}`
            : `action_call_id_${player.id}_${ab.id}`,
          category: isCallingPlayerTurn ? 'identity' : 'call_for_action',
          headline,
          subtext,
          action: {
            type: 'USE_CARD_ABILITY',
            playerId: player.id,
            cardInstanceId: player.activeFormCard.code,
            abilityId: ab.id,
          },
          badge,
          iconType: 'ability',
          requiresModal:
            ab.cost?.resourceCost || (ab.cost?.discardCard && ab.cost.discardCard.from === 'HAND')
              ? 'payment'
              : undefined,
          targetCardInstance: {
            instanceId: player.activeFormCard.code,
            card: player.activeFormCard,
            exhausted: player.exhausted,
          } as CardInstance,
          cardCode: player.activeFormCard.code,
          ownerName: isCallingPlayerTurn ? undefined : player.name,
        });
      }
    }
  }

  return items;
}

/**
 * Discovers legal Action abilities on encounter cards, villain/player attachments,
 * active player's obligations, and in-play side schemes payable by the player (RR v1.8 p. 5).
 */
function getEncounterLegalActions(state: GameState, player: PlayerState): LegalActionItem[] {
  const items: LegalActionItem[] = [];
  const isHero = player.currentForm === 'hero';

  // 1. Collect all potential encounter sources
  const encounterSources: { cardInst: CardInstance; hostName?: string }[] = [];

  // 1A. Villain attachments
  for (const villain of getVillainsInPlay(state)) {
    for (const att of villain.attachments || []) {
      encounterSources.push({ cardInst: att, hostName: villain.card.name });
    }
  }

  // 1B. Player attachments (identity, minions, allies across all seats)
  for (const p of state.players || []) {
    for (const att of p.attachments || []) {
      encounterSources.push({ cardInst: att, hostName: p.name });
    }
    for (const m of p.engagedMinions || []) {
      for (const att of m.attachments || []) {
        encounterSources.push({ cardInst: att, hostName: m.card.name });
      }
    }
    for (const a of p.allies || []) {
      for (const att of a.attachments || []) {
        encounterSources.push({ cardInst: att, hostName: a.card.name });
      }
    }
  }

  // 1C. Scheme attachments (main scheme & side schemes)
  for (const ms of getMainSchemesInPlay(state)) {
    for (const att of ms.attachments || []) {
      encounterSources.push({ cardInst: att, hostName: ms.card.name });
    }
  }
  for (const ss of state.sideSchemes || []) {
    for (const att of ss.attachments || []) {
      encounterSources.push({ cardInst: att, hostName: ss.card.name });
    }
  }

  // 1D. Environment attachments
  for (const env of state.environments || []) {
    for (const att of env.attachments || []) {
      encounterSources.push({ cardInst: att, hostName: env.card.name });
    }
  }

  // 1E. Active player's obligations (RR v1.8 p. 5: cannot trigger obligations in other players' play areas)
  for (const ob of player.obligations || []) {
    encounterSources.push({ cardInst: ob, hostName: player.name });
  }

  // 1F. In-play side schemes
  for (const ss of state.sideSchemes || []) {
    encounterSources.push({ cardInst: ss, hostName: ss.card.name });
  }

  // 1G. In-play engaged minions
  for (const p of state.players || []) {
    for (const m of p.engagedMinions || []) {
      encounterSources.push({ cardInst: m, hostName: m.card.name });
    }
  }

  // 1H. In-play environments
  for (const env of state.environments || []) {
    encounterSources.push({ cardInst: env, hostName: env.card.name });
  }

  // Deduplicate sources by instanceId
  const seenInstanceIds = new Set<string>();
  const uniqueSources: { cardInst: CardInstance; hostName?: string }[] = [];
  for (const s of encounterSources) {
    if (!seenInstanceIds.has(s.cardInst.instanceId)) {
      seenInstanceIds.add(s.cardInst.instanceId);
      uniqueSources.push(s);
    }
  }

  for (const { cardInst, hostName } of uniqueSources) {
    const abilities = cardInst.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (isResourceAbility(ab.timing)) continue;

      const isAction =
        ab.timing === 'ACTION' ||
        (isHero && ab.timing === 'HERO_ACTION') ||
        (!isHero && ab.timing === 'ALTER_EGO_ACTION');

      if (!isAction) continue;

      // Limit validation
      const abilityKey = `${cardInst.instanceId}_${ab.id}`;
      const isUsedRound =
        ab.limit === 'ONCE_PER_ROUND' && (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1;
      const isUsedPhase =
        ab.limit === 'ONCE_PER_PHASE' && (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1;
      if (isUsedRound || isUsedPhase) continue;

      // Cost & legality validation
      const costCheck = canInitiateAbility(state, player.id, ab, cardInst, {});
      if (!costCheck.allowed) continue;

      let badge: string;
      let requiresModal: 'payment' | undefined = undefined;

      if (ab.cost?.resourceCost) {
        requiresModal = 'payment';
        const requiredType = Object.keys(ab.cost.resourceCost)[0] as keyof ResourceCost | undefined;
        const requiredAmount = requiredType ? ab.cost.resourceCost[requiredType] || 1 : 1;
        badge = requiredType
          ? `${requiredAmount} ${requiredType.toUpperCase()}`
          : `${requiredAmount} RESOURCES`;
      } else if (ab.cost?.discardCard && ab.cost.discardCard.from === 'HAND') {
        requiresModal = 'payment';
        const count = ab.cost.discardCard.count || 1;
        badge = `DISCARD ${count} CARD${count > 1 ? 'S' : ''}`;
      } else {
        badge = formatTimingBadge(ab.timing);
      }

      const isDiscard =
        cardInst.card.type === 'attachment' ||
        ab.steps?.some(
          (s) =>
            s.effect === 'DISCARD' &&
            (s.effectParams?.source === 'SELF' || s.effectParams?.source === 'HOST'),
        ) ||
        Boolean(ab.cost?.discardSelf);

      const headline = isDiscard
        ? `Discard: ${cardInst.card.name}`
        : `Encounter Action: ${cardInst.card.name}`;

      const subtext = ab.steps?.[0]?.effectParams?.description
        ? String(ab.steps[0].effectParams.description)
        : hostName
          ? `Spend resources or trigger ${cardInst.card.name} from ${hostName}`
          : `Trigger ${cardInst.card.name} (${ab.id})`;

      items.push({
        id:
          cardInst.card.type === 'attachment'
            ? `action_attachment_${cardInst.instanceId}_${ab.id}`
            : `action_encounter_${cardInst.instanceId}_${ab.id}`,
        category: 'villain',
        headline,
        subtext,
        action: {
          type: 'USE_CARD_ABILITY',
          playerId: player.id,
          cardInstanceId: cardInst.instanceId,
          abilityId: ab.id,
        },
        badge,
        iconType: 'ability',
        requiresModal,
        targetCardInstance: cardInst,
        cardCode: cardInst.card.code,
      });
    }
  }

  return items;
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
      callForActionItems: [],
      callForActionCount: 0,
      villainActionItems: [],
      villainActionCount: 0,
      allActions: [],
    };
  }

  const activePlayer = state.players[state.activePlayerIndex];
  const isPlayerTurn = activePlayer?.id === playerId && state.phase === 'PLAYER_PHASE';

  const identityActions: LegalActionItem[] = [];
  const handCardActions: LegalActionItem[] = [];
  const boardActions: LegalActionItem[] = [];
  const callForActionItems: LegalActionItem[] = [];
  const villainActionItems: LegalActionItem[] = [];

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
      const atkCheck = canAttack(state, playerId, HERO_ACTOR, 'villain');
      if (atkCheck.allowed) {
        identityActions.push({
          id: `action_basic_attack_villain_${player.id}`,
          category: 'identity',
          headline: `Hero Strike on ${getActiveVillain(state).card.name}`,
          subtext: `Exhaust ${player.activeFormCard.name} to deal ${effectiveStats.attack} damage`,
          action: { type: 'BASIC_ATTACK', playerId: player.id, targetType: 'villain' },
          badge: `${effectiveStats.attack} ATK`,
          iconType: 'attack',
          cardCode: player.hero.code,
        });
      }

      // Attack engaged minions (tablewide per RR v1.8 p. 5, 10)
      for (const p of state.players) {
        for (const minion of p.engagedMinions || []) {
          const minionAtkCheck = canAttack(
            state,
            playerId,
            HERO_ACTOR,
            'minion',
            minion.instanceId,
          );
          if (minionAtkCheck.allowed) {
            const headline =
              p.id === player.id
                ? `Strike Minion: ${minion.card.name}`
                : `Strike Minion: ${minion.card.name} (${p.name})`;
            identityActions.push({
              id: `action_basic_attack_minion_${minion.instanceId}`,
              category: 'identity',
              headline,
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
      }

      // 1D. Basic Thwart (Hero only)
      if ((getActiveMainScheme(state)?.threat || 0) > 0) {
        const thwCheck = canThwart(state, playerId, HERO_ACTOR, 'main_scheme');
        if (thwCheck.allowed) {
          identityActions.push({
            id: `action_basic_thwart_main_${player.id}`,
            category: 'identity',
            headline: `Thwart Main Scheme`,
            subtext: `Exhaust ${player.activeFormCard.name} to remove ${effectiveStats.thwart} threat from ${getActiveMainScheme(state).card.name}`,
            action: { type: 'BASIC_THWART', playerId: player.id, targetType: 'main_scheme' },
            badge: `${effectiveStats.thwart} THW`,
            iconType: 'thwart',
            cardCode: player.hero.code,
          });
        }
      }

      for (const sideScheme of state.sideSchemes || []) {
        if (sideScheme.threat > 0) {
          const sideThwCheck = canThwart(
            state,
            playerId,
            HERO_ACTOR,
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
    identityActions.push(...getIdentityActionItems(state, player, true));

    // 2. Playable Hand Cards
    for (const cardInst of player.hand) {
      const playability = evaluateCardPlayability(state, playerId, cardInst);
      if (playability.isPlayable) {
        const { effectiveCost, baseCost, reductions } = getEffectiveCardCost(
          state,
          player,
          cardInst,
        );
        const costBadge =
          reductions.length > 0 ? `Cost ${effectiveCost} (${baseCost})` : `Cost ${effectiveCost}`;
        handCardActions.push({
          id: `action_play_hand_${cardInst.instanceId}`,
          category: 'hand',
          headline: `Play ${cardInst.card.name}`,
          subtext: `${cardInst.card.type.toUpperCase()} • ${costBadge} • ${cardInst.card.faction?.toUpperCase() || 'NEUTRAL'}`,
          action: {
            type: 'PLAY_CARD',
            playerId: player.id,
            cardInstanceId: cardInst.instanceId,
            paymentCardInstanceIds: [],
          },
          badge: costBadge,
          iconType: 'card',
          requiresModal: effectiveCost > 0 ? 'payment' : undefined,
          targetCardInstance: cardInst,
          cardCode: cardInst.card.code,
        });
      }
    }

    // 3. Board Tableau & Ally Actions
    // 3A. Tableau Cards (Upgrades & Supports)
    boardActions.push(...getTableauActionItems(state, player, true));

    // 3B. Ally Activations (Ally Attack / Ally Thwart)
    for (const ally of player.allies) {
      if (!ally.exhausted) {
        const allyStats = getEffectiveAllyStats(state, ally);

        // Ally Attack on Villain
        const villainAtkCheck = canAttack(
          state,
          player.id,
          { kind: 'ally', instanceId: ally.instanceId },
          'villain',
        );
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

        // Ally Attack on engaged minions (tablewide per RR v1.8 p. 5, 10)
        for (const p of state.players) {
          for (const minion of p.engagedMinions || []) {
            const minionAtkCheck = canAttack(
              state,
              player.id,
              { kind: 'ally', instanceId: ally.instanceId },
              'minion',
              minion.instanceId,
            );
            if (minionAtkCheck.allowed) {
              const headline =
                p.id === player.id
                  ? `Ally Strike: ${ally.card.name} ➔ ${minion.card.name}`
                  : `Ally Strike: ${ally.card.name} ➔ ${minion.card.name} (${p.name})`;
              boardActions.push({
                id: `action_ally_attack_minion_${ally.instanceId}_${minion.instanceId}`,
                category: 'board',
                headline,
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
        }

        // Ally Thwart (Main Scheme)
        if (
          (getActiveMainScheme(state)?.threat || 0) > 0 &&
          canThwart(state, player.id, { kind: 'ally', instanceId: ally.instanceId }, 'main_scheme')
            .allowed
        ) {
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
          if (
            sideScheme.threat > 0 &&
            canThwart(
              state,
              player.id,
              { kind: 'ally', instanceId: ally.instanceId },
              'side_scheme',
              sideScheme.instanceId,
            ).allowed
          ) {
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

    // 3C. Villain & Encounter Actions (ADR-0055, RR v1.8 p. 5)
    villainActionItems.push(...getEncounterLegalActions(state, player));

    // 3D. Teammate Tableau & Identity Scan (Call for Action - RR v1.8 p. 5, 23)
    for (const otherPlayer of state.players || []) {
      if (otherPlayer.id !== playerId) {
        callForActionItems.push(...getTableauActionItems(state, otherPlayer, false));
        callForActionItems.push(...getIdentityActionItems(state, otherPlayer, false));
      }
    }
  } else if (state.phase === 'PLAYER_PHASE') {
    // Non-active player during Player Phase: can trigger their own tableau Action abilities by request
    boardActions.push(...getTableauActionItems(state, player, false));
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

  const activeActionCount =
    identityActions.length +
    handCardActions.length +
    boardActions.length +
    villainActionItems.length;
  const allActions = [
    ...identityActions,
    ...handCardActions,
    ...boardActions,
    ...villainActionItems,
    ...callForActionItems,
  ];
  if (turnAction) allActions.push(turnAction);

  return {
    playerId: player.id,
    playerName: player.name,
    isPlayerTurn,
    activeActionCount,
    identityActions,
    handCardActions,
    boardActions,
    callForActionItems,
    callForActionCount: callForActionItems.length,
    villainActionItems,
    villainActionCount: villainActionItems.length,
    turnAction,
    allActions,
  };
}
