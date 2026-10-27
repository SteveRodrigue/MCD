import {
  GameState,
  PlayerState,
  CardType,
  CardInstance,
  NormalizedCard,
  GamePhase,
  Keyword,
  hasKeyword,
  getKeywordValue,
  CardAbility,
  getActiveMainScheme,
  hasDashPower,
  CharacterPower,
  getVillainsInPlay,
  VillainState,
} from '@engine/models';
import { kernel } from '../kernel';
import { isStep, type TypedStep } from '../effects/handlers/types';
import {
  canPayAbilityCost,
  getEventAbilityExtraCost,
  AbilityPaymentOptions,
  isResourceAbility,
  getEffectiveCardCost,
  getAvailableResources,
  getGeneratorProvidedResources,
  getHandCardResourceValue,
} from './cost-engine';
import { matchesCardFilter } from '../filters/card-filter';
import { getEffectiveAllyLimit, hasPlayerTrait } from './stat-calculator';
import { getStepEffectParams } from '../../data/supplemental/runtime';
import { findInPlayCardInstance } from '../state/state-validator';
import {
  GUARD_BLOCK_REASON,
  MAIN_SCHEME_BLOCK_REASON,
  getMainSchemeThreatBlock,
  isVillainAttackBlockedByGuard,
} from './target-restrictions';

export function getPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find((p) => p.id === playerId);
}

/**
 * Checks if a player can change form (RR v1.8 p. 13-14).
 * Limit: Once per round during the player turn.
 */
export function canChangeForm(
  state: GameState,
  playerId: string,
  targetFormCode?: string,
): { allowed: boolean; reason?: string } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  const window = checkActionWindow(state, playerId);
  if (!window.allowed) return window;

  if (player.basicChangeFormUsedThisRound || player.formChangedThisRound) {
    return {
      allowed: false,
      reason: 'Form has already been changed this round (Limit once per round as a basic action).',
    };
  }

  if (targetFormCode) {
    const targetForm = player.availableForms.find((f) => f.code === targetFormCode);
    if (!targetForm) {
      return { allowed: false, reason: 'Target form is not available for this identity.' };
    }
    if (targetForm.code === player.activeFormCard.code) {
      return { allowed: false, reason: 'Already in the requested form.' };
    }
  }

  return { allowed: true };
}

function dashPowerReason(name: string, power: CharacterPower): string {
  const label = { attack: 'ATK', thwart: 'THW', defense: 'DEF', recover: 'REC', scheme: 'SCH' }[
    power
  ];
  return `${name} has no ${label} (–) and cannot use it.`;
}

/**
 * Checks if player can perform basic Recover (RR v1.8 p. 23).
 * Must be in Alter-Ego form and not exhausted.
 */
export function canBasicRecover(
  state: GameState,
  playerId: string,
): { allowed: boolean; reason?: string } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  const window = checkActionWindow(state, playerId);
  if (!window.allowed) return window;

  if (player.currentForm !== 'alter_ego') {
    return { allowed: false, reason: 'Can only recover while in Alter-Ego form.' };
  }

  if (player.exhausted) {
    return { allowed: false, reason: 'Character is exhausted.' };
  }

  if (hasDashPower(player.alterEgo, 'recover')) {
    return { allowed: false, reason: dashPowerReason(player.alterEgo.name, 'recover') };
  }

  return { allowed: true };
}

/**
 * Who performs a basic attack or thwart: the player's hero, or one of their allies.
 */
export type ActionActor = { kind: 'hero' } | { kind: 'ally'; instanceId: string };

export const HERO_ACTOR: ActionActor = Object.freeze({ kind: 'hero' });

type Check = { allowed: boolean; reason?: string };

/**
 * Basic actions happen in the Player Phase, on the acting player's turn (RR v1.8 p. 19 "Player
 * Turn", "Ask for an Action"). One window check for every basic action and ability.
 */
function checkActionWindow(state: GameState, playerId: string): Check {
  if (state.phase === GamePhase.VILLAIN_PHASE) {
    return { allowed: false, reason: 'Actions can only be taken during the Player Phase.' };
  }
  if (state.phase === GamePhase.PLAYER_PHASE) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer && activePlayer.id !== playerId) {
      return { allowed: false, reason: `Not your turn (Currently ${activePlayer.name}'s turn).` };
    }
  }
  return { allowed: true };
}

/**
 * Whether the actor can attack or thwart at all, before any target is considered: the action
 * window, then a hero in Hero form (RR v1.8 p. 5-6, 29) or a ready ally in play, ready, with the
 * stat printed (a dash means it cannot use that power).
 */
function checkActorCanAct(
  state: GameState,
  player: PlayerState,
  actor: ActionActor,
  power: 'attack' | 'thwart',
): Check {
  const window = checkActionWindow(state, player.id);
  if (!window.allowed) return window;

  if (actor.kind === 'hero') {
    if (player.currentForm !== 'hero') {
      return { allowed: false, reason: `Can only ${power} while in Hero form.` };
    }
    if (player.exhausted) return { allowed: false, reason: 'Character is exhausted.' };
    if (hasDashPower(player.hero, power)) {
      return { allowed: false, reason: dashPowerReason(player.hero.name, power) };
    }
    return { allowed: true };
  }

  const ally = player.allies.find((a) => a.instanceId === actor.instanceId);
  if (!ally) return { allowed: false, reason: 'Ally not found in play.' };
  if (ally.exhausted) return { allowed: false, reason: 'Ally is exhausted.' };
  if (hasDashPower(ally.card, power)) {
    return { allowed: false, reason: dashPowerReason(ally.card.name, power) };
  }
  return { allowed: true };
}

/**
 * Checks if the hero or an ally can attack the villain or a minion (RR v1.8 p. 5-6, 15 "Guard").
 */
export function canAttack(
  state: GameState,
  playerId: string,
  actor: ActionActor,
  targetType: 'villain' | 'minion',
  targetInstanceId?: string,
): Check {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  const actorCheck = checkActorCanAct(state, player, actor, 'attack');
  if (!actorCheck.allowed) return actorCheck;

  if (targetType === 'minion') {
    if (!targetInstanceId) {
      return { allowed: false, reason: 'Minion target instance ID must be specified.' };
    }
    const minion = state.players
      .flatMap((p) => p.engagedMinions)
      .find((m) => m.instanceId === targetInstanceId);
    if (!minion) return { allowed: false, reason: 'Target minion is not in play.' };
  }

  if (targetType === 'villain' && isVillainAttackBlockedByGuard(player)) {
    return { allowed: false, reason: GUARD_BLOCK_REASON };
  }

  return { allowed: true };
}

/**
 * Checks if the hero or an ally can thwart a scheme (RR v1.8 p. 3 "Ally", 11 "Crisis", 20
 * "Patrol", 29 "Thwart").
 */
export function canThwart(
  state: GameState,
  playerId: string,
  actor: ActionActor,
  targetType: 'main_scheme' | 'side_scheme',
  targetInstanceId?: string,
): Check {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  const actorCheck = checkActorCanAct(state, player, actor, 'thwart');
  if (!actorCheck.allowed) return actorCheck;

  if (targetType === 'side_scheme') {
    if (!targetInstanceId) {
      return { allowed: false, reason: 'Side scheme target instance ID must be specified.' };
    }
    const sideScheme = state.sideSchemes.find((s) => s.instanceId === targetInstanceId);
    if (!sideScheme) return { allowed: false, reason: 'Target side scheme is not in play.' };
    if (sideScheme.threat <= 0) {
      return { allowed: false, reason: 'Cannot thwart a scheme with no threat.' };
    }
    return { allowed: true };
  }

  // Cannot thwart a scheme with no threat (RR v1.8 p. 29)
  const mainScheme = getActiveMainScheme(state);
  if (!mainScheme || mainScheme.threat <= 0) {
    return { allowed: false, reason: 'Cannot thwart a scheme with no threat.' };
  }
  const block = getMainSchemeThreatBlock(state, player);
  if (block) return { allowed: false, reason: MAIN_SCHEME_BLOCK_REASON[block] };

  return { allowed: true };
}

/**
 * Checks if a card possesses the Restricted keyword (RR v1.8 p. 25).
 */
export function isCardRestricted(card: NormalizedCard): boolean {
  return hasKeyword(card, Keyword.RESTRICTED);
}

/**
 * Computes the slot weight of a restricted card (RR v1.8 p. 25).
 * Base: 1 slot. Heavy items (e.g. "Counts as 2 restricted cards"): 2 slots.
 */
export function getCardRestrictedWeight(card: NormalizedCard): number {
  if (!isCardRestricted(card)) return 0;
  if (card.restrictedSlots !== undefined) return card.restrictedSlots;
  const kwVal = getKeywordValue(card, Keyword.RESTRICTED);
  if (kwVal !== undefined && kwVal > 1) return kwVal;
  return 1;
}

/**
 * Computes the active restricted card limit for a player dynamically (RR v1.8 p. 25 / ADR-0018).
 * Base: 2 restricted cards max.
 * Modifiers: Scans in-play cards for CONSTANT abilities with MODIFY_RESTRICTED_LIMIT (e.g. Side Holster).
 */
export function getPlayerRestrictedLimit(state: GameState, playerId: string): number {
  const BASE_RESTRICTED_LIMIT = 2;
  let bonus = 0;

  const player = getPlayer(state, playerId);
  if (!player) return BASE_RESTRICTED_LIMIT;

  for (const item of player.tableau) {
    const abilities = item.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      const limitStep = ab.steps?.find((s) => isStep(s, 'MODIFY_RESTRICTED_LIMIT'));
      if (ab.timing === 'CONSTANT' && limitStep && isStep(limitStep, 'MODIFY_RESTRICTED_LIMIT')) {
        bonus += Number(getStepEffectParams(limitStep).amount) || 1;
      }
    }
  }

  return BASE_RESTRICTED_LIMIT + bonus;
}

/**
 * Computes the total restricted slot weight currently occupied in a player's tableau.
 */
export function getPlayerRestrictedCount(player: PlayerState): number {
  let count = 0;
  for (const item of player.tableau) {
    count += getCardRestrictedWeight(item.card);
  }
  return count;
}

/**
 * Helper to determine whether two unique cards or identities collide per RR v1.8 p. 29.
 * Subtitle Rule: If two cards share the same title, but have different subtitles
 * (such as Spider-Man: Peter Parker and Spider-Man: Miles Morales), they are different
 * characters and are not restricted by this rule.
 */
function isUniqueCollision(
  targetName: string,
  targetSubname: string | undefined,
  existingName: string,
  existingSubname: string | undefined,
): boolean {
  // If both have titles and subtitles:
  if (targetSubname && existingSubname) {
    if (targetName === existingName) {
      // Same title: conflict ONLY if subtitles also match
      return targetSubname === existingSubname;
    }
    // Different titles: conflict if subtitles match (same alter-ego persona)
    return targetSubname === existingSubname;
  }

  // If target card has a subtitle, check if subtitle matches existing title or subtitle
  if (targetSubname) {
    if (targetSubname === existingName || (existingSubname && targetSubname === existingSubname)) {
      return true;
    }
  }

  // If existing card has a subtitle, check if target title matches existing subtitle
  if (existingSubname) {
    if (targetName === existingSubname) {
      return true;
    }
  }

  // Default title comparison
  return targetName === existingName;
}

/**
 * Validates that playing a unique card does not violate the Unique Card rule (RR v1.8 p. 29).
 * Unique cards are evaluated globally across all player tableaus, all player allies,
 * all in-game Hero/Alter-Ego identities, and in-play villain/minion cards.
 */
export function checkUniqueCardPlayable(
  state: GameState,
  card: NormalizedCard,
): { allowed: boolean; reason?: string } {
  if (!card.isUnique) return { allowed: true };

  const targetName = card.name.toLowerCase().trim();
  const targetSubname = card.subname ? card.subname.toLowerCase().trim() : undefined;

  // 1. Check against active Hero & Alter-Ego identities in the game
  for (const p of state.players) {
    const heroName = p.hero?.name ? p.hero.name.toLowerCase().trim() : '';
    // In Marvel Champions, a hero identity's persona is defined by their alter-ego persona (RR v1.8 p. 29)
    const heroSubname = p.hero?.subname
      ? p.hero.subname.toLowerCase().trim()
      : p.alterEgo?.name
        ? p.alterEgo.name.toLowerCase().trim()
        : undefined;
    const alterEgoName = p.alterEgo?.name ? p.alterEgo.name.toLowerCase().trim() : '';
    const alterEgoSubname = p.alterEgo?.subname
      ? p.alterEgo.subname.toLowerCase().trim()
      : undefined;

    // Check collision against Hero identity (e.g. Spider-Man / Peter Parker)
    const heroCollision = isUniqueCollision(targetName, targetSubname, heroName, heroSubname);
    // Check collision against Alter-Ego identity (e.g. Peter Parker)
    const alterEgoCollision = isUniqueCollision(
      targetName,
      targetSubname,
      alterEgoName,
      alterEgoSubname,
    );

    if (heroCollision || alterEgoCollision) {
      return {
        allowed: false,
        reason: `Global unicity violation (RR v1.8 p. 29): Unique card '${card.name}' shares identity with player '${p.name}'.`,
      };
    }
  }

  // 2. Check against all in-play cards across ALL players (tableaus and allies)
  for (const p of state.players) {
    // Check in-play allies
    for (const ally of p.allies) {
      if (ally.card.isUnique) {
        const allyName = ally.card.name.toLowerCase().trim();
        const allySubname = ally.card.subname ? ally.card.subname.toLowerCase().trim() : undefined;

        if (isUniqueCollision(targetName, targetSubname, allyName, allySubname)) {
          return {
            allowed: false,
            reason: `Global unicity violation (RR v1.8 p. 29): A unique copy of '${card.name}' is already in play under ${p.name}'s control.`,
          };
        }
      }
    }

    // Check in-play tableau (upgrades/supports)
    for (const item of p.tableau) {
      if (item.card.isUnique) {
        const itemName = item.card.name.toLowerCase().trim();
        const itemSubname = item.card.subname ? item.card.subname.toLowerCase().trim() : undefined;

        if (isUniqueCollision(targetName, targetSubname, itemName, itemSubname)) {
          return {
            allowed: false,
            reason: `Global unicity violation (RR v1.8 p. 29): A unique copy of '${card.name}' is already in play in ${p.name}'s tableau.`,
          };
        }
      }
    }

    // Check engaged unique minions
    for (const minion of p.engagedMinions) {
      if (minion.card.isUnique) {
        const minionName = minion.card.name.toLowerCase().trim();
        const minionSubname = minion.card.subname
          ? minion.card.subname.toLowerCase().trim()
          : undefined;
        if (isUniqueCollision(targetName, targetSubname, minionName, minionSubname)) {
          return {
            allowed: false,
            reason: `Global unicity violation (RR v1.8 p. 29): A unique minion '${card.name}' is already in play.`,
          };
        }
      }
    }
  }

  // 3. Check against every Villain in play
  for (const villain of getVillainsInPlay(state)) {
    if (!villain.card?.isUnique) continue;
    const villainName = villain.card.name.toLowerCase().trim();
    const villainSubname = villain.card.subname
      ? villain.card.subname.toLowerCase().trim()
      : undefined;
    if (isUniqueCollision(targetName, targetSubname, villainName, villainSubname)) {
      return {
        allowed: false,
        reason: `Global unicity violation (RR v1.8 p. 29): Unique card '${card.name}' is already in play as a Villain.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Computes the active maximum ally limit for a player dynamically (ADR-0018).
 * Base: 3 allies (RR v1.8 p. 3).
 * Modifiers: Scans in-play cards for CONSTANT abilities with MODIFY_ALLY_LIMIT.
 */
export function getPlayerAllyLimit(state: GameState, playerId: string): number {
  const player = getPlayer(state, playerId);
  if (!player) return 3;
  return getEffectiveAllyLimit(player, state);
}

/**
 * Evaluates play requirements for cards with PLAY_FROM_ZONE effects (e.g. Make the Call)
 * (Issue #173, ADR-0047, RR v1.8 p. 16, 21).
 */
function evaluatePlayFromZoneRequirement(
  state: GameState,
  player: PlayerState,
  cardInstance: CardInstance,
): { allowed: boolean; reason?: string } {
  const card = cardInstance.card;
  let playFromZoneStep: TypedStep<'PLAY_FROM_ZONE'> | undefined;
  for (const ability of card.enrichment?.abilities || []) {
    for (const step of ability.steps || []) {
      if (isStep(step, 'PLAY_FROM_ZONE')) {
        playFromZoneStep = step;
        break;
      }
    }
    if (playFromZoneStep) break;
  }

  if (!playFromZoneStep) {
    return { allowed: true };
  }

  const stepParams = getStepEffectParams(playFromZoneStep);
  const source = (stepParams.source as string) || 'PLAYER_DISCARD';
  const filter = stepParams.filter;

  let candidates: CardInstance[] = [];
  if (source === 'ANY_PLAYER_DISCARD') {
    candidates = (state.players || []).flatMap((p) => p.discard || []);
  } else if (source === 'PLAYER_DISCARD') {
    candidates = player.discard || [];
  }

  if (filter) {
    candidates = candidates.filter(
      (c) => Boolean(c?.card) && matchesCardFilter(c, filter, { state, player }),
    );
  }

  if (candidates.length === 0) {
    return { allowed: false, reason: 'No eligible allies in any discard pile.' };
  }

  if (player.allies.length >= getPlayerAllyLimit(state, player.id)) {
    return { allowed: false, reason: 'Ally limit reached.' };
  }

  // Filter out candidates that violate unicity (if c.card.isUnique, verify no card with matching code or name is in play across all players' allies or tableaus).
  candidates = candidates.filter((c) => {
    if (!c.card.isUnique) return true;
    for (const p of state.players || []) {
      for (const inPlay of [...(p.allies || []), ...(p.tableau || [])]) {
        if (
          inPlay.card.code === c.card.code ||
          inPlay.card.name.toLowerCase().trim() === c.card.name.toLowerCase().trim()
        ) {
          return false;
        }
      }
    }
    return checkUniqueCardPlayable(state, c.card).allowed;
  });

  if (candidates.length === 0) {
    return {
      allowed: false,
      reason: 'All eligible allies in discard are unique cards already in play.',
    };
  }

  const effectiveAvailable = getAvailableResources(player, state, {
    excludeCardInstanceId: cardInstance.instanceId,
    playedCard: card,
  }).total;
  const minCost = Math.min(...candidates.map((c) => c.card.cost ?? 0));

  if (effectiveAvailable < minCost) {
    return { allowed: false, reason: 'Not enough resources to pay for any ally in discard.' };
  }

  return { allowed: true };
}

/**
 * Validates whether hand cards specified for payment cover the cost of the card being played.
 */
/**
 * Evaluates whether a card requires minion targets (tablewide or locally engaged)
 * and whether those minion targets currently exist in play (RR v1.8 p. 6, 19, 28).
 */
export function evaluateMinionTargetRequirement(
  state: GameState,
  player: PlayerState,
  card: NormalizedCard,
): { allowed: boolean; reason?: string } {
  const abilities = card.enrichment?.abilities || [];

  let requiresTablewideMinion = false;
  let requiresLocalMinion = false;

  for (const ab of abilities) {
    for (const step of ab.steps || []) {
      const stepParams = getStepEffectParams(step);
      const target = stepParams.target;
      if (
        step.effect === 'ATTACH_TO_HOST' &&
        (target === 'CHOSEN_MINION' || target === 'MINION' || target === 'ALL_MINIONS')
      ) {
        requiresTablewideMinion = true;
      } else if (
        step.effect === 'ATTACH_TO_HOST' &&
        (target === 'CHOSEN_ENGAGED_MINION' || target === 'ENGAGED_MINIONS')
      ) {
        requiresLocalMinion = true;
      } else if (
        card.type === CardType.EVENT &&
        (target === 'CHOSEN_MINION' || target === 'MINION' || target === 'ALL_MINIONS')
      ) {
        requiresTablewideMinion = true;
      } else if (card.type === CardType.EVENT && target === 'CHOSEN_ENGAGED_MINION') {
        requiresLocalMinion = true;
      }
    }
  }

  if (requiresLocalMinion) {
    const localCount = player.engagedMinions?.length || 0;
    if (localCount === 0) {
      return {
        allowed: false,
        reason: 'Cannot play this card: requires a minion engaged with you.',
      };
    }
  }

  if (requiresTablewideMinion) {
    const totalMinions = state.players.reduce((acc, p) => acc + (p.engagedMinions?.length || 0), 0);
    if (totalMinions === 0) {
      return { allowed: false, reason: 'Cannot play this card: requires a minion in play.' };
    }
  }

  return { allowed: true };
}

/**
 * Evaluates whether a card requires ally targets (RR v1.8 p. 5, 16, 17)
 * and whether eligible ally targets currently exist in play (respecting maxPerHost).
 */
function evaluateAllyTargetRequirement(
  state: GameState,
  card: NormalizedCard,
): { allowed: boolean; reason?: string } {
  const abilities = card.enrichment?.abilities || [];

  let requiresAlly = false;
  let maxPerHost: number | undefined;

  for (const ab of abilities) {
    for (const step of ab.steps || []) {
      const stepParams = getStepEffectParams(step);
      const target = stepParams.target;
      if (
        step.effect === 'ATTACH_TO_HOST' &&
        (target === 'CHOSEN_ALLY' || target === 'ALLY' || target === 'ALL_ALLIES')
      ) {
        requiresAlly = true;
        if (stepParams.maxPerHost !== undefined) {
          maxPerHost = Number(stepParams.maxPerHost);
        }
      }
    }
  }

  if (requiresAlly) {
    const allAllies: CardInstance[] = [];
    for (const p of state.players) {
      for (const a of p.allies || []) {
        allAllies.push(a);
      }
    }

    if (allAllies.length === 0) {
      return {
        allowed: false,
        reason: 'Cannot play this card: requires an ally in play to attach to.',
      };
    }

    if (maxPerHost !== undefined && maxPerHost > 0) {
      const eligibleAllies = allAllies.filter((ally) => {
        const attachedCount = (ally.attachments || []).filter(
          (att) => att.card.code === card.code || att.card.name === card.name,
        ).length;
        return attachedCount < maxPerHost!;
      });

      if (!eligibleAllies.length) {
        return {
          allowed: false,
          reason: `Cannot play this card: all in-play allies already have the maximum number (${maxPerHost}) of '${card.name}' attached.`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Evaluates whether a card requires enemy targets (RR v1.8 p. 5, 16, 17)
 * and whether eligible enemy targets currently exist in play (respecting maxPerHost).
 */
function evaluateEnemyTargetRequirement(
  state: GameState,
  _player: PlayerState,
  card: NormalizedCard,
  targetEnemyId?: string,
): { allowed: boolean; reason?: string } {
  const abilities = card.enrichment?.abilities || [];

  let requiresEnemy = false;
  let maxPerHost: number | undefined;

  for (const ab of abilities) {
    for (const step of ab.steps || []) {
      const stepParams = getStepEffectParams(step);
      const target = stepParams.target;
      if (
        step.effect === 'ATTACH_TO_HOST' &&
        (target === 'CHOSEN_ENEMY' || target === 'ENEMY' || target === 'ALL_ENEMIES')
      ) {
        requiresEnemy = true;
        if (stepParams.maxPerHost !== undefined) {
          maxPerHost = Number(stepParams.maxPerHost);
        }
      }
    }
  }

  if (requiresEnemy) {
    const allEnemies: {
      entity: VillainState | CardInstance;
      id: string;
      attachments?: CardInstance[];
    }[] = [];
    for (const villain of getVillainsInPlay(state)) {
      allEnemies.push({
        entity: villain,
        id: villain.instanceId || 'villain',
        attachments: villain.attachments,
      });
    }
    for (const p of state.players) {
      for (const m of p.engagedMinions || []) {
        allEnemies.push({
          entity: m,
          id: m.instanceId,
          attachments: m.attachments,
        });
      }
    }

    if (allEnemies.length === 0) {
      return {
        allowed: false,
        reason: 'Cannot play this card: requires an enemy in play to attach to.',
      };
    }

    if (targetEnemyId) {
      const targetEnemy = allEnemies.find(
        (e) => e.id === targetEnemyId || e.entity.card?.code === targetEnemyId,
      );
      if (targetEnemy && maxPerHost !== undefined && maxPerHost > 0) {
        const attachedCount = (targetEnemy.attachments || []).filter(
          (att) => att.card.code === card.code || att.card.name === card.name,
        ).length;
        if (attachedCount >= maxPerHost) {
          return {
            allowed: false,
            reason: `Cannot play this card: target enemy already has the maximum number (${maxPerHost}) of '${card.name}' attached.`,
          };
        }
      }
    }

    if (maxPerHost !== undefined && maxPerHost > 0) {
      const eligibleEnemies = allEnemies.filter((enemy) => {
        const attachedCount = (enemy.attachments || []).filter(
          (att) => att.card.code === card.code || att.card.name === card.name,
        ).length;
        return attachedCount < maxPerHost!;
      });

      if (!eligibleEnemies.length) {
        return {
          allowed: false,
          reason: `Cannot play this card: all in-play enemies already have the maximum number (${maxPerHost}) of '${card.name}' attached.`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * An event executes its abilities when it is played (RR v1.8 p. 12, 15), so each of them needs a
 * valid target to be played (RR v1.8 "Target"). The generic target gate decides (ADR-0090).
 */
function evaluateEventTargetRequirement(
  state: GameState,
  player: PlayerState,
  cardInstance: CardInstance,
  choices: PlayChoices,
): { allowed: boolean; reason?: string } {
  if (cardInstance.card.type !== CardType.EVENT) return { allowed: true };

  for (const ability of cardInstance.card.enrichment?.abilities ?? []) {
    const isAction = isActionTiming(ability) || !ability.timing;
    if (!isAction) continue;
    const check = kernel.checkAbilityTargets(state, player, ability, cardInstance, {
      chosenTargetId: choices.targetInstanceId,
    });
    if (!check.allowed) {
      return { allowed: false, reason: `Cannot play this card: ${check.reason}` };
    }
  }
  return { allowed: true };
}

/**
 * Evaluates the legality of initiating a SEARCH ability step (RR v1.8 p. 2, 28).
 * Ensures at least one eligible target exists to change the game state.
 */
function evaluateSearchLegality(
  state: GameState,
  player: PlayerState,
  step: TypedStep<'SEARCH'>,
): { allowed: boolean; reason?: string } {
  const stepParams = getStepEffectParams(step);
  const source = stepParams.source || 'PLAYER_DECK';
  const target = (stepParams.target as string) || 'SELF';
  const filter = stepParams.filter;

  const sources = Array.isArray(source) ? source : [source];

  if (sources.includes('PLAYER_DISCARD')) {
    if (target === 'CHOSEN_PLAYER' || target === 'ALL_PLAYERS') {
      const anyPlayerHasMatch = (state.players || []).some((p) =>
        (p.discard || []).some(
          (c) => !filter || matchesCardFilter(c, filter, { state, player: p }),
        ),
      );
      if (!anyPlayerHasMatch) {
        return {
          allowed: false,
          reason: 'Cannot trigger ability: No player has a matching card in their discard pile.',
        };
      }
    } else if (target === 'SELF' || target === 'ACTIVE_PLAYER' || !target) {
      const hasMatch = (player.discard || []).some(
        (c) => !filter || matchesCardFilter(c, filter, { state, player }),
      );
      if (!hasMatch) {
        return {
          allowed: false,
          reason: 'Cannot trigger ability: No matching card in your discard pile.',
        };
      }
    }
  }

  if (sources.includes('ENCOUNTER_DISCARD')) {
    const hasMatch = (state.encounterDiscard || []).some(
      (c) => !filter || matchesCardFilter(c, filter, { state, player }),
    );
    if (!hasMatch) {
      return {
        allowed: false,
        reason: 'Cannot trigger ability: No matching card in encounter discard pile.',
      };
    }
  }

  if (sources.includes('PLAYER_DECK')) {
    if ((player.deck || []).length === 0) {
      return {
        allowed: false,
        reason: 'Cannot trigger ability: Player deck is empty.',
      };
    }
  }

  if (sources.includes('ENCOUNTER_DECK')) {
    if ((state.encounterDeck || []).length === 0) {
      return {
        allowed: false,
        reason: 'Cannot trigger ability: Encounter deck is empty.',
      };
    }
  }

  return { allowed: true };
}

/**
 * Evaluates whether an ability on an in-play card or identity can be legally initiated (RR v1.8 p. 15-16, 29, 30; Issue #101).
 * Validates:
 * 1. Active player turn for actions (RR v1.8 p. 19).
 * 2. Identity form requirements (Hero form for HERO_ACTION, Alter-Ego for ALTER_EGO_ACTION).
 * 3. Ability limits (ONCE_PER_ROUND, ONCE_PER_PHASE).
 * 4. Ability costs (via canPayAbilityCost).
 * 5. Valid targets & Potential to change the game state (eligible scheme threat, Crisis, Patrol, Guard, etc.).
 */
export function canInitiateAbility(
  state: GameState,
  playerId: string,
  ability: CardAbility,
  sourceCardInst?: CardInstance,
  options?: AbilityPaymentOptions,
): { allowed: boolean; reason?: string } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found.' };

  // 1. Phase & Obligation Validation for Actions (RR v1.8 p. 5, 23)
  if (
    ability.timing === 'ACTION' ||
    ability.timing === 'HERO_ACTION' ||
    ability.timing === 'ALTER_EGO_ACTION'
  ) {
    if (state.phase === GamePhase.VILLAIN_PHASE) {
      return {
        allowed: false,
        reason: 'Action abilities can only be used during the Player Phase.',
      };
    }

    // RR v1.8 p. 5: Players cannot trigger action abilities on obligations in other players' play areas.
    if (sourceCardInst) {
      const isOtherPlayerObligation = (state.players || []).some(
        (p) =>
          p.id !== playerId &&
          p.obligations?.some((o) => o.instanceId === sourceCardInst.instanceId),
      );
      if (isOtherPlayerObligation) {
        return {
          allowed: false,
          reason: "Cannot trigger action abilities on obligations in other players' play areas.",
        };
      }
    }
  }

  // A resource ability is triggered only while paying a cost (RR v1.8 "Resource Ability"), never as
  // an action of its own (#387); the payment flow reads generators without asking this gate.
  if (isResourceAbility(ability.timing)) {
    return {
      allowed: false,
      reason: 'Resource abilities can only be triggered while paying a cost.',
    };
  }

  // 2. Identity Form Validation
  if (ability.timing.startsWith('HERO_') && player.currentForm !== 'hero') {
    return { allowed: false, reason: 'Can only use this ability in Hero form.' };
  }
  if (ability.timing.startsWith('ALTER_EGO_') && player.currentForm !== 'alter_ego') {
    return { allowed: false, reason: 'Can only use this ability in Alter-Ego form.' };
  }

  // An "Attach to ..." ability runs when the card is played; its timing only names the form the
  // card needs. Once the card is in play it offers no action of its own (#259).
  if (
    sourceCardInst &&
    ability.steps?.some((s) => s.effect === 'ATTACH_TO_HOST') &&
    findInPlayCardInstance(state, sourceCardInst.instanceId)
  ) {
    return { allowed: false, reason: 'This card attaches when it is played.' };
  }

  // 3. Limit Validation (ONCE_PER_ROUND, ONCE_PER_PHASE)
  const abilityKey = sourceCardInst ? `${sourceCardInst.instanceId}_${ability.id}` : ability.id;
  if (
    ability.limit === 'ONCE_PER_ROUND' &&
    (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1
  ) {
    return {
      allowed: false,
      reason: `Ability '${ability.id}' has already been used this round (Limit: once per round).`,
    };
  }
  if (
    ability.limit === 'ONCE_PER_PHASE' &&
    (player.usedAbilitiesThisPhase?.[abilityKey] || 0) >= 1
  ) {
    return {
      allowed: false,
      reason: `Ability '${ability.id}' has already been used this phase (Limit: once per phase).`,
    };
  }

  // 4. Cost Validation
  const costCheck = canPayAbilityCost(state, player, ability, sourceCardInst, options);
  if (!costCheck.allowed) {
    return costCheck;
  }

  // 5. Target & Potential to Change Game State (RR v1.8 p. 15-16, 29, 30)
  for (const step of ability.steps || []) {
    // Search / Deck / Discard Target (RR v1.8 p. 2, 28)
    if (isStep(step, 'SEARCH')) {
      const searchCheck = evaluateSearchLegality(state, player, step);
      if (!searchCheck.allowed) {
        return searchCheck;
      }
    }
  }

  // 6. Valid target for every judged step (RR v1.8 "Target"; ADR-0090): the one generic gate, never
  // an effect- or selector-specific check here.
  const targetCheck = kernel.checkAbilityTargets(state, player, ability, sourceCardInst, {
    chosenTargetId: options?.targetInstanceId,
  });
  if (!targetCheck.allowed) {
    return { allowed: false, reason: `Cannot trigger ability: ${targetCheck.reason}` };
  }

  return { allowed: true };
}

/**
 * Evaluates universal play restrictions declared on card enrichment (RR v1.8 p. 16).
 * Covers identity form, form traits, identity traits, controlled card requirements, and identity names.
 */
export function evaluatePlayRequirements(
  state: GameState,
  player: PlayerState,
  card: NormalizedCard,
): { allowed: boolean; reason?: string } {
  const reqs = card.enrichment?.playRequirements;

  // 1. Identity Form Check
  // Explicit playRequirements.identityForm strictly enforces form.
  // Fallback: Events with Hero/Alter-Ego timing or on-play attachments with Hero/Alter-Ego timing.
  const isEvent = card.type === CardType.EVENT;
  const abilities = card.enrichment?.abilities || [];
  const hasHeroPlayAbility = abilities.some(
    (a) =>
      a.timing &&
      a.timing.startsWith('HERO_') &&
      (isEvent || a.steps?.some((s) => s.effect === 'ATTACH_TO_HOST')),
  );
  const hasAlterEgoPlayAbility = abilities.some(
    (a) =>
      a.timing &&
      a.timing.startsWith('ALTER_EGO_') &&
      (isEvent || a.steps?.some((s) => s.effect === 'ATTACH_TO_HOST')),
  );

  const isHeroFormRequired =
    card.type === CardType.HERO || reqs?.identityForm === 'HERO' || hasHeroPlayAbility;

  const isAlterEgoFormRequired =
    card.type === CardType.ALTER_EGO ||
    reqs?.identityForm === 'ALTER_EGO' ||
    hasAlterEgoPlayAbility;

  if (isHeroFormRequired && player.currentForm !== 'hero') {
    return { allowed: false, reason: 'Requires Hero form' };
  }

  if (isAlterEgoFormRequired && player.currentForm !== 'alter_ego') {
    return { allowed: false, reason: 'Requires Alter-Ego form' };
  }

  if (!reqs) return { allowed: true };

  // 2. Specific Form Trait Requirement (e.g. 'Giant', 'Tiny' for Ant-Man)
  if (reqs.formTrait) {
    const activeFormTraits = (player.activeFormCard.traits || []).map((t) => t.toLowerCase());
    if (!activeFormTraits.includes(reqs.formTrait.toLowerCase())) {
      return { allowed: false, reason: `Requires ${reqs.formTrait} form.` };
    }
  }

  // 3. Identity Traits Requirement (e.g. ['Avenger'], ['X-Men'], ['Mystic'])
  if (reqs.identityTraits && reqs.identityTraits.length > 0) {
    const hasMatchingTrait = reqs.identityTraits.some((reqTrait: string) =>
      hasPlayerTrait(player, reqTrait, state),
    );

    if (!hasMatchingTrait) {
      return {
        allowed: false,
        reason: `Requires identity with trait: ${reqs.identityTraits.join(' or ')}.`,
      };
    }
  }

  // 4. Controlled Cards Filter Requirement (e.g. Wakanda Forever: Black Panther upgrades in play)
  // Evaluates cards currently in play under player control (RR v1.8 p. 11, 16)
  if (reqs.controlFilter) {
    const zones = reqs.controlZones || ['tableau', 'allies', 'identity'];
    const controlledCards: NormalizedCard[] = [];
    if (zones.includes('tableau')) {
      controlledCards.push(...player.tableau.map((c) => c.card));
    }
    if (zones.includes('allies')) {
      controlledCards.push(...player.allies.map((c) => c.card));
    }
    if (zones.includes('identity')) {
      controlledCards.push(player.hero, player.alterEgo);
    }

    const hasMatch = controlledCards.some((c) =>
      matchesCardFilter(c, reqs.controlFilter!, { state, player }),
    );

    if (!hasMatch) {
      return {
        allowed: false,
        reason: 'Play condition not met: required cards not in play under your control.',
      };
    }
  }

  // 5. Identity Names Requirement (e.g. ['Bucky Barnes', 'Sam Wilson'])
  if (reqs.identityNames && reqs.identityNames.length > 0) {
    const heroName = player.hero.name.toLowerCase();
    const alterEgoName = player.alterEgo.name.toLowerCase();
    const matchesName = reqs.identityNames.some((name: string) => {
      const lower = name.toLowerCase();
      return heroName === lower || alterEgoName === lower;
    });

    if (!matchesName) {
      return {
        allowed: false,
        reason: `Can only be played by: ${reqs.identityNames.join(' or ')}.`,
      };
    }
  }

  return { allowed: true };
}

/** Where the dispatcher finds the card it is asked to play. */
type PlaySourceZone =
  'HAND' | 'PLAYER_DISCARD' | 'ANY_PLAYER_DISCARD' | 'DECK_TOP' | 'ATTACHED' | 'TUCKED';

/** Optional choices made with the play that some rules check (Max per player, enemy targets). */
interface PlayChoices {
  targetPlayerId?: string;
  targetInstanceId?: string;
}

const isActionTiming = (ability: CardAbility) =>
  ability.timing === 'ACTION' ||
  ability.timing === 'HERO_ACTION' ||
  ability.timing === 'ALTER_EGO_ACTION';

/**
 * Every rule that stops a card from being played, cost payment aside (RR v1.8 p. 16 "Play").
 * The dispatcher rejects on the first reason; the hand, the legal-action list and the bot show
 * them all, so both read the same rules (AUD-20261017-232534 F002).
 */
function collectPlayRestrictions(
  state: GameState,
  player: PlayerState,
  cardInstance: CardInstance,
  choices: PlayChoices = {},
): string[] {
  const card = cardInstance.card;
  const abilities = card.enrichment?.abilities || [];
  const reasons: string[] = [];
  const check = (result: { allowed: boolean; reason?: string }) => {
    if (!result.allowed && result.reason) reasons.push(result.reason);
  };

  // Universal Play Requirements (RR v1.8 p. 16)
  check(evaluatePlayRequirements(state, player, card));
  // Target requirements (RR v1.8 p. 3, 5, 6, 11, 15-17, 19, 28-30; Issues #101, #173)
  check(evaluateMinionTargetRequirement(state, player, card));
  check(evaluateAllyTargetRequirement(state, card));
  check(evaluateEnemyTargetRequirement(state, player, card, choices.targetInstanceId));
  check(evaluateEventTargetRequirement(state, player, cardInstance, choices));
  check(evaluatePlayFromZoneRequirement(state, player, cardInstance));

  // Player Turn Validation (RR v1.8 p. 19 "Player Turn" & "Ask for an Action")
  if (state.phase === GamePhase.VILLAIN_PHASE) {
    reasons.push('Cannot play cards during the Villain Phase.');
  } else if (state.phase === GamePhase.PLAYER_PHASE) {
    const activePlayer = state.players[state.activePlayerIndex];
    if (activePlayer && activePlayer.id !== player.id) {
      reasons.push(`Not your turn (Currently ${activePlayer.name}'s turn).`);
    }
  }

  // Ambiguity / Blocked Card Check (ADR-0021)
  if (card.enrichment?.audit?.ambiguityFile) {
    reasons.push(
      `Card mechanic is currently under architectural review / blocked (${card.enrichment.audit.ambiguityFile}).`,
    );
  }

  // Reactive Event Restriction (RR v1.8 p. 12, 16, 19): an Interrupt or Response event is played
  // only in its trigger window, never as a standard player action.
  const isReactiveEvent =
    card.type === CardType.EVENT &&
    abilities.length > 0 &&
    !abilities.some(isActionTiming) &&
    abilities.some(
      (a) => a.timing && (a.timing.includes('INTERRUPT') || a.timing.includes('RESPONSE')),
    );
  if (isReactiveEvent) {
    reasons.push('Interrupt/Response events can only be played when their trigger occurs.');
  }

  // Resource Card Restriction (RR v1.8 p. 24): resource cards are discarded to pay costs.
  if (card.type === CardType.RESOURCE && !abilities.some(isActionTiming)) {
    reasons.push('Resource cards cannot be played directly; they are discarded to pay costs.');
  }

  // Dynamic Ally Limit Check (RR v1.8 p. 3, ADR-0018)
  if (card.type === CardType.ALLY) {
    const maxAllies = getPlayerAllyLimit(state, player.id);
    if (player.allies.length >= maxAllies) {
      reasons.push(`Ally limit reached (${maxAllies} allies max).`);
    }
  }

  // Restricted Keyword Limit Check (RR v1.8 p. 25, ADR-0018): a player at the limit can still
  // play a restricted card if enough of their restricted cards in play can be discarded.
  if (isCardRestricted(card)) {
    const cardWeight = getCardRestrictedWeight(card);
    const currentRestricted = getPlayerRestrictedCount(player);
    const maxRestricted = getPlayerRestrictedLimit(state, player.id);
    const neededSlots = currentRestricted + cardWeight - maxRestricted;
    if (neededSlots > 0 && currentRestricted < neededSlots) {
      reasons.push(`Restricted card limit reached (${maxRestricted} restricted cards max).`);
    }
  }

  // Max [X] per player Constraint Check (RR v1.8 p. 17 "Max")
  const maxPerPlayer = card.maxPerPlayer;
  if (maxPerPlayer !== undefined && maxPerPlayer > 0) {
    const sameCard = (c: CardInstance) =>
      c.card.code === card.code ||
      c.card.name.toLowerCase().trim() === card.name.toLowerCase().trim();
    const atLimit = (p: PlayerState) =>
      p.tableau.filter(sameCard).length +
        (card.type === CardType.ALLY ? p.allies.filter(sameCard).length : 0) >=
      maxPerPlayer;
    const limitReason = `Max ${maxPerPlayer} per player limit reached for '${card.name}'.`;

    if (!card.enrichment?.playUnderAnyPlayerControl) {
      if (atLimit(player)) reasons.push(limitReason);
    } else if (choices.targetPlayerId) {
      const targetPlayer = getPlayer(state, choices.targetPlayerId);
      if (!targetPlayer) {
        reasons.push(`Target player ${choices.targetPlayerId} not found.`);
      } else if (atLimit(targetPlayer)) {
        reasons.push(limitReason);
      }
    } else if (state.players.every(atLimit)) {
      reasons.push(
        state.players.length > 1
          ? 'All players have reached max per player limit for this card.'
          : limitReason,
      );
    }
  }

  // Global Unicity Constraint Check (RR v1.8 p. 29)
  check(checkUniqueCardPlayable(state, card));

  // An event's declared extra cost (a hand discard) must be payable with the other cards in hand
  if (card.type === CardType.EVENT) {
    for (const ability of abilities) {
      const extraCost = getEventAbilityExtraCost(ability);
      if (!extraCost) continue;
      check(
        canPayAbilityCost(state, player, extraCost, cardInstance, {
          playedCardInstanceId: cardInstance.instanceId,
        }),
      );
    }
  }

  return reasons;
}

function findCardToPlay(
  state: GameState,
  player: PlayerState,
  cardInstanceId: string,
  sourceZone: PlaySourceZone,
  targetOwnerPlayerId?: string,
): CardInstance | undefined {
  const byId = (c: CardInstance) => c.instanceId === cardInstanceId;
  switch (sourceZone) {
    case 'PLAYER_DISCARD':
      return player.discard.find(byId);
    case 'ANY_PLAYER_DISCARD': {
      const owner = targetOwnerPlayerId ? getPlayer(state, targetOwnerPlayerId) : undefined;
      if (owner) return owner.discard.find(byId);
      for (const p of state.players) {
        const found = p.discard.find(byId);
        if (found) return found;
      }
      return undefined;
    }
    case 'DECK_TOP':
      return player.deck[0]?.instanceId === cardInstanceId ? player.deck[0] : undefined;
    case 'ATTACHED':
    case 'TUCKED':
      return player.attachments?.find(byId) || player.cardsUnderneath?.find(byId);
    default:
      return player.hand.find(byId);
  }
}

export function canPlayCard(
  state: GameState,
  playerId: string,
  cardInstanceOrId: string | CardInstance,
  paymentCardInstanceIds: string[] = [],
  generatorInstanceIds: string[] = [],
  sourceZone: PlaySourceZone = 'HAND',
  targetOwnerPlayerId?: string,
  targetPlayerId?: string,
  targetInstanceId?: string,
): { allowed: boolean; reason?: string; cardToPlay?: NormalizedCard } {
  const player = getPlayer(state, playerId);
  if (!player) return { allowed: false, reason: 'Player not found' };

  const targetCardInstance =
    typeof cardInstanceOrId === 'string'
      ? findCardToPlay(state, player, cardInstanceOrId, sourceZone, targetOwnerPlayerId)
      : cardInstanceOrId;

  if (!targetCardInstance) {
    return {
      allowed: false,
      reason:
        sourceZone === 'HAND'
          ? 'Card to play is not in player hand.'
          : `Card to play is not found in ${sourceZone}.`,
    };
  }

  const [restriction] = collectPlayRestrictions(state, player, targetCardInstance, {
    targetPlayerId,
    targetInstanceId,
  });
  if (restriction) return { allowed: false, reason: restriction };

  const card = targetCardInstance.card;
  const { effectiveCost: cost } = getEffectiveCardCost(state, player, targetCardInstance);
  if (cost > 0) {
    if (paymentCardInstanceIds.includes(targetCardInstance.instanceId)) {
      return { allowed: false, reason: 'The card being played cannot be used to pay for itself.' };
    }

    let generatedResources = 0;
    for (const pId of paymentCardInstanceIds) {
      const pCard = player.hand.find((c) => c.instanceId === pId);
      if (!pCard) {
        return { allowed: false, reason: `Payment card instance ${pId} not found in hand.` };
      }
      generatedResources += getHandCardResourceValue(pCard, card);
    }

    for (const gId of generatorInstanceIds) {
      const isIdentity = gId === 'identity_ability' || gId === player.activeFormCard.code;
      const generatorName = isIdentity
        ? player.activeFormCard.name
        : player.tableau.find((c) => c.instanceId === gId)?.card.name;
      if (!generatorName) {
        return {
          allowed: false,
          reason: `Resource generator instance ${gId} not found in tableau.`,
        };
      }
      const amount = getGeneratorProvidedResources(state, player, gId);
      if (amount <= 0) {
        return { allowed: false, reason: `${generatorName} cannot generate resources now.` };
      }
      generatedResources += amount;
    }

    if (generatedResources < cost) {
      return {
        allowed: false,
        reason: `Insufficient resources: Need ${cost}, but selected payment provides ${generatedResources}.`,
      };
    }
  }

  return { allowed: true, cardToPlay: card };
}

export interface CardPlayabilityStatus {
  isPlayable: boolean;
  reasons: string[];
  availableResources: number;
}

/**
 * Evaluates whether a card in a player's hand can currently be played (ADR-0018): every play
 * restriction, plus whether the other hand cards, ready generators and the identity's resource
 * ability could pay the effective cost.
 */
export function evaluateCardPlayability(
  state: GameState,
  playerId: string,
  cardInstance: CardInstance,
): CardPlayabilityStatus {
  const player = getPlayer(state, playerId);
  if (!player) {
    return { isPlayable: false, reasons: ['Player not found'], availableResources: 0 };
  }

  const reasons = collectPlayRestrictions(state, player, cardInstance);

  const { total: availableResources } = getAvailableResources(player, state, {
    excludeCardInstanceId: cardInstance.instanceId,
    playedCard: cardInstance.card,
  });

  const { effectiveCost: cost } = getEffectiveCardCost(state, player, cardInstance);
  if (cost > 0 && availableResources < cost) {
    reasons.push(`Cannot afford cost (Need ${cost}, max available ${availableResources})`);
  }

  return {
    isPlayable: reasons.length === 0,
    reasons,
    availableResources,
  };
}
