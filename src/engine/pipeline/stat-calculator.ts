import {
  GameState,
  VillainState,
  VillainCard,
  CardInstance,
  AllyCard,
  HeroCard,
  AlterEgoCard,
  PlayerState,
  NormalizedCard,
  CardType,
  hasDashPower,
  StatusCard,
  CardAbility,
  Keyword,
  getActiveVillain,
  getPerPlayerCount,
  getVillainsInPlay,
  AttackExecutionContext,
} from '../models';
import { parseKeywordItem } from '../models/keyword';
import { getStepEffectParams } from '../../data/supplemental/runtime';
import type { DynamicValueSource, UniversalCardFilter } from '../../data/supplemental/schema';
import { AbilityStep } from '../models/abilities';
import { kernel } from '../kernel';
import { findInPlayCardInstance } from '../state/state-validator';
import { isStep } from '../effects/handlers/types';
import { matchesCardFilter } from '../filters/card-filter';

export interface EntityWithStatusCards {
  statusCards?: StatusCard[];
  card?: NormalizedCard;
  activeFormCard?: NormalizedCard;
  hero?: HeroCard;
  alterEgo?: AlterEgoCard;
  type?: CardType | string;
  keywords?: (Keyword | string | { keyword?: string; amount?: number })[];
  abilities?: CardAbility[];
  traits?: string[];
  currentForm?: string;
  attachments?: CardInstance[];
  tableau?: CardInstance[];
}

export type StatEntity =
  PlayerState | CardInstance | VillainState | NormalizedCard | EntityWithStatusCards;

export interface EffectiveTraitsResult {
  traits: string[]; // Deduplicated canonical traits (printed + dynamic)
  dynamicTraits: string[]; // Only traits granted dynamically via ADD_TRAIT
  printedTraits: string[]; // Base printed traits
}

export interface EffectiveVillainStats {
  attack: number;
  scheme: number;
  keywords: string[];
}

/**
 * What the CONSTANT abilities in play add to one stat of a minion: its own and its attachments'
 * steps, plus the auras (`target: ALL_MINIONS` with an optional `filter`) of the villains, the
 * environments and the cards attached to them ("Each Drone minion gets +1 ATK").
 */
function sumMinionConstantModifiers(
  state: GameState,
  minion: CardInstance,
  stat: 'ATTACK' | 'SCHEME' | 'HIT_POINTS',
): number {
  const stepAmount = (source: CardInstance, aura: boolean): number => {
    let total = 0;
    for (const ab of source.card.enrichment?.abilities || []) {
      if (ab.timing !== 'CONSTANT') continue;
      for (const step of ab.steps || []) {
        const modifiesStat =
          stat === 'HIT_POINTS'
            ? step.effect === 'MODIFY_MAX_HEALTH'
            : isStep(step, 'MODIFY_STAT') &&
              (getStepEffectParams(step).stat === stat ||
                (stat === 'SCHEME' && getStepEffectParams(step).stat === 'THWART'));
        if (!modifiesStat) continue;
        const params = getStepEffectParams(step as AbilityStep) as {
          amount?: number | DynamicValueSource;
          target?: string;
          filter?: UniversalCardFilter;
        };
        if ((params.target === 'ALL_MINIONS') !== aura) continue;
        if (aura && !matchesCardFilter(minion, params.filter, { state })) continue;
        total += kernel.evaluateDynamicAmount(
          params.amount,
          {},
          { state, sourceCardInstance: source, targetCardInstance: minion },
        );
      }
    }
    return total;
  };

  const villains = getVillainsInPlay(state);
  const environments = state.environments || [];
  const auraSources = [
    ...villains,
    ...villains.flatMap((v) => v.attachments || []),
    ...environments,
    ...environments.flatMap((e) => e.attachments || []),
  ] as CardInstance[];

  return (
    stepAmount(minion, false) +
    (minion.attachments || []).reduce((sum, a) => sum + stepAmount(a, false), 0) +
    auraSources.reduce((sum, source) => sum + stepAmount(source, true), 0)
  );
}

/**
 * A minion's effective attack: the printed value (an X attack is stored as -1 and counts as 0)
 * plus CONSTANT modifiers (`sumMinionConstantModifiers`) and active modifiers.
 */
export function getEffectiveMinionAttack(state: GameState, minion: CardInstance): number {
  const printed = (minion.card as { attack?: number }).attack;
  let attack = printed === undefined ? 1 : Math.max(0, printed);
  attack += sumMinionConstantModifiers(state, minion, 'ATTACK');
  for (const mod of minion.activeStatModifiers || []) {
    if (mod.stat === 'ATTACK') {
      attack += mod.amount;
    }
  }
  // A dash (–) power is an unmodifiable 0 (RR v1.8 "Dash (Value)")
  if (hasDashPower(minion.card, 'attack')) return 0;
  return Math.max(0, attack);
}

/**
 * A minion's effective scheme: the printed value (an X scheme is stored as -1 and counts as 0)
 * plus CONSTANT modifiers (`sumMinionConstantModifiers`) and active modifiers.
 */
export function getEffectiveMinionScheme(state: GameState, minion: CardInstance): number {
  const printed = (minion.card as { scheme?: number }).scheme;
  let scheme = printed === undefined ? 1 : Math.max(0, printed);
  scheme += sumMinionConstantModifiers(state, minion, 'SCHEME');
  for (const mod of minion.activeStatModifiers || []) {
    if (mod.stat === 'THWART' || (mod.stat as string) === 'SCHEME') {
      scheme += mod.amount;
    }
  }
  // A dash (–) power is an unmodifiable 0 (RR v1.8 "Dash (Value)")
  if (hasDashPower(minion.card, 'scheme')) return 0;
  return Math.max(0, scheme);
}

/**
 * The attack value of an attack in progress: its base attack plus the "until the end of the attack"
 * modifiers. These are read now, so a count they depend on follows the game (FAQ, Ultron II).
 */
export function getAttackValue(state: GameState, attack: AttackExecutionContext): number {
  const bonus = (attack.attackModifiers || []).reduce((sum, modifier) => {
    const player = state.players.find((p) => p.id === modifier.playerId);
    return (
      sum +
      kernel.evaluateDynamicAmount(
        modifier.amount,
        { state, player, playerId: modifier.playerId },
        { state },
      )
    );
  }, 0);
  return Math.max(0, attack.baseAttack + bonus);
}

/**
 * Sum of the CONSTANT `MODIFY_MAX_HEALTH` steps on `sources` (attachments, side schemes), skipping
 * steps aimed at a different `target` (a step without a target applies to whatever it modifies).
 */
function sumConstantMaxHealthBonus(
  state: GameState,
  sources: CardInstance[],
  targetCardInstance?: CardInstance,
  target?: string,
): number {
  let bonus = 0;
  for (const source of sources) {
    for (const ab of source.card.enrichment?.abilities || []) {
      if (ab.timing !== 'CONSTANT') continue;
      for (const step of ab.steps || []) {
        if (step.effect !== 'MODIFY_MAX_HEALTH') continue;
        const params = getStepEffectParams(step);
        if (target && params.target && params.target !== target) continue;
        bonus += kernel.evaluateDynamicAmount(
          params.amount as number | DynamicValueSource | undefined,
          {},
          { state, sourceCardInstance: source, targetCardInstance },
        );
      }
    }
  }
  return bonus;
}

/**
 * A minion's effective hit points: the printed value plus its CONSTANT `MODIFY_MAX_HEALTH` modifiers
 * (Genetically Enhanced: "Attached minion gets +3 hit points"; Ultron III: "Each Drone minion gets
 * +1 hit point"). Damage stays on the minion when a bonus is lost; only the ceiling changes.
 */
export function getEffectiveMinionHitPoints(state: GameState, minion: CardInstance): number {
  const printed = (minion.card as { health?: number }).health || 1;
  return Math.max(1, printed + sumMinionConstantModifiers(state, minion, 'HIT_POINTS'));
}

export interface EffectiveAllyStats {
  thwart: number;
  attack: number;
  keywords: string[];
}

export interface EffectiveHeroStats {
  thwart: number;
  attack: number;
  defense: number;
  recovery: number;
  keywords: string[];
}

/**
 * Computes dynamic effective stats for the active villain, aggregating base card stats,
 * constant abilities, and in-play attachments (e.g. Enhanced Ivory Horn, Charge, Webbed Up).
 */
export function getEffectiveVillainStats(
  state: GameState,
  villain: VillainState,
): EffectiveVillainStats {
  let attack = villain.card?.attack ?? (villain.card as { atk?: number })?.atk ?? 0;
  let scheme = villain.card?.scheme ?? (villain.card as { sch?: number })?.sch ?? 0;
  const keywords: string[] = [];

  for (const attachment of villain.attachments || []) {
    const abilities = attachment.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (isStep(step, 'MODIFY_STAT')) {
            const stepParams = getStepEffectParams(step);
            const amount = kernel.evaluateDynamicAmount(
              stepParams.amount as number | DynamicValueSource | undefined,
              {},
              { state, sourceCardInstance: attachment },
            );
            if (stepParams.stat === 'ATTACK') attack += amount;
            if (stepParams.stat === 'SCHEME') scheme += amount;
          }
          if (isStep(step, 'GRANT_KEYWORD')) {
            const stepParams = getStepEffectParams(step);
            if (stepParams.keyword) {
              keywords.push(stepParams.keyword as string);
            }
          }
        }
      }
    }
  }

  // A dash (–) power is an unmodifiable 0 (RR v1.8 "Dash (Value)")
  if (villain.card && hasDashPower(villain.card, 'attack')) attack = 0;
  if (villain.card && hasDashPower(villain.card, 'scheme')) scheme = 0;

  return {
    attack: Math.max(0, attack),
    scheme: Math.max(0, scheme),
    keywords,
  };
}

/** Printed hit points of a villain stage: per player when the card says so (RR v1.8 hit points). */
export function villainStageHitPoints(card: VillainCard, playerCount: number): number {
  return card.health * (card.healthPerHero ? playerCount || 1 : 1);
}

/**
 * Effective maximum hit points of a villain: the printed stage value plus constant modifiers on its
 * attachments and, for the active villain, on side schemes in play (The "Immortal" Klaw: "Klaw gets
 * +10 hit points"; RR v1.8 'Hit Points').
 */
export function getEffectiveVillainMaxHealth(state: GameState, villain?: VillainState): number {
  const target = villain ?? getActiveVillain(state);
  if (!target?.card) return 0;

  const isActive = target.instanceId === getActiveVillain(state)?.instanceId;
  const schemes = isActive ? state.sideSchemes || [] : [];
  const bonus =
    sumConstantMaxHealthBonus(state, target.attachments || [], undefined, 'VILLAIN') +
    sumConstantMaxHealthBonus(state, schemes as unknown as CardInstance[], undefined, 'VILLAIN');
  return Math.max(1, villainStageHitPoints(target.card, getPerPlayerCount(state)) + bonus);
}

/**
 * Brings a villain's maxHealth and remaining health in line with its constant max hit point
 * modifiers (damage stays on the villain). Returns true when that leaves it at 0 or fewer hit
 * points; the caller defeats it once its own bookkeeping is done.
 */
export function syncVillainMaxHealth(state: GameState, villain?: VillainState): boolean {
  const target = villain ?? getActiveVillain(state);
  if (!target) return false;
  const delta = getEffectiveVillainMaxHealth(state, target) - target.maxHealth;
  target.maxHealth += delta;
  target.health += delta;
  return target.health <= 0;
}

/**
 * Computes dynamic effective stats for an ally, aggregating base card stats,
 * constant abilities (e.g. Jessica Jones side scheme bonus), and in-play attachments (e.g. Inspired).
 */
export function getEffectiveAllyStats(state: GameState, ally: CardInstance): EffectiveAllyStats {
  const allyCard = ally.card as AllyCard;
  let thwart = allyCard.thwart ?? (allyCard as { thw?: number }).thw ?? 0;
  let attack = allyCard.attack ?? (allyCard as { atk?: number }).atk ?? 0;
  const keywords: string[] = [];

  // Check constant abilities on the ally itself
  const selfAbilities = ally.card.enrichment?.abilities || [];
  for (const ab of selfAbilities) {
    if (ab.timing === 'CONSTANT') {
      for (const step of ab.steps || []) {
        if (isStep(step, 'MODIFY_STAT')) {
          const stepParams = getStepEffectParams(step);
          const amount = kernel.evaluateDynamicAmount(
            stepParams.amount as number | DynamicValueSource | undefined,
            {},
            { state, sourceCardInstance: ally, targetCardInstance: ally },
          );
          if (stepParams.stat === 'THWART') thwart += amount;
          if (stepParams.stat === 'ATTACK') attack += amount;
        }
      }
    }
  }

  // Sum attachments on this ally (e.g. Inspired 01074: +1 THW / +1 ATK)
  for (const attachment of ally.attachments || []) {
    const abilities = attachment.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (isStep(step, 'MODIFY_STAT')) {
            const stepParams = getStepEffectParams(step);
            const amount = kernel.evaluateDynamicAmount(
              stepParams.amount as number | DynamicValueSource | undefined,
              {},
              { state, sourceCardInstance: attachment, targetCardInstance: ally },
            );
            if (stepParams.stat === 'THWART') thwart += amount;
            if (stepParams.stat === 'ATTACK') attack += amount;
          }
          if (isStep(step, 'GRANT_KEYWORD')) {
            const stepParams = getStepEffectParams(step);
            if (stepParams.keyword) {
              keywords.push(stepParams.keyword as string);
            }
          }
        }
      }
    }
  }

  // Add active temporary stat modifiers on this ally (e.g. Vision 01068, Lead from the Front 01070)
  for (const mod of ally.activeStatModifiers || []) {
    if (mod.stat === 'THWART') thwart += mod.amount;
    if (mod.stat === 'ATTACK') attack += mod.amount;
  }

  // A dash (–) power is an unmodifiable 0 (RR v1.8 "Dash (Value)")
  if (hasDashPower(allyCard, 'thwart')) thwart = 0;
  if (hasDashPower(allyCard, 'attack')) attack = 0;

  return {
    thwart: Math.max(0, thwart),
    attack: Math.max(0, attack),
    keywords,
  };
}

function dedupeTraits(traits: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of traits) {
    if (!t) continue;
    const trimmed = t.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

function evaluateConstantStepGate(
  step: AbilityStep,
  player: PlayerState,
  state?: GameState,
): boolean {
  if (!step.gate) return true;
  if (step.gate === 'IF_FORM') {
    return kernel.evaluateStepGate(step, undefined, state ?? ({} as unknown as GameState), {
      playerId: player.id,
      player,
    });
  }
  if (!state) return false;
  return kernel.evaluateStepGate(step, undefined, state, { playerId: player.id, player });
}

function extractAddTraitEffects(
  sources: (CardInstance | undefined)[],
  player?: PlayerState,
  state?: GameState,
): string[] {
  const dynamicTraits: string[] = [];
  for (const item of sources) {
    if (!item) continue;
    const abilities = item.card?.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (isStep(step, 'ADD_TRAIT')) {
            if (step.gate && !player) continue;
            if (player && !evaluateConstantStepGate(step, player, state)) continue;
            const stepParams = getStepEffectParams(step);
            const trait = stepParams.trait as string | undefined;
            if (trait && trait.trim()) {
              dynamicTraits.push(trait.trim());
            }
          }
        }
      }
    }
  }
  return dynamicTraits;
}

/**
 * Computes full effective trait details for a player identity,
 * inspecting active form printed traits, tableau upgrades with CONSTANT ADD_TRAIT,
 * and identity attachments with CONSTANT ADD_TRAIT.
 */
export function getEffectivePlayerTraitsDetails(
  player: PlayerState,
  state?: GameState,
): EffectiveTraitsResult {
  const isAlterEgo = player.currentForm === 'alter_ego';
  const activeSide = isAlterEgo ? player.alterEgo : player.hero;
  const rawPrinted = [...(player.activeFormCard?.traits || []), ...(activeSide?.traits || [])];
  const printedTraits = dedupeTraits(rawPrinted);

  const dynamicSources = [...(player.tableau || []), ...(player.attachments || [])];
  const timedTraits = (player.activeTraitModifiers || [])
    .filter(
      (m) =>
        m.duration ||
        (state && m.sourceInstanceId && findInPlayCardInstance(state, m.sourceInstanceId)),
    )
    .map((m) => m.trait);
  const dynamicTraits = dedupeTraits([
    ...extractAddTraitEffects(dynamicSources, player, state),
    ...timedTraits,
  ]);
  const traits = dedupeTraits([...printedTraits, ...dynamicTraits]);

  return {
    traits,
    dynamicTraits,
    printedTraits,
  };
}

/**
 * Computes active and dynamic traits for a player identity (deduplicated).
 */
export function getEffectivePlayerTraits(player: PlayerState, state?: GameState): string[] {
  return getEffectivePlayerTraitsDetails(player, state).traits;
}

/**
 * Computes full effective trait details for any card or card instance,
 * delegating to player traits if matching active identity form, and inspecting attachments for CONSTANT ADD_TRAIT.
 */
export function getEffectiveCardTraitsDetails(
  card: NormalizedCard,
  instance?: CardInstance,
  context?: { player?: PlayerState; state?: GameState; villain?: VillainState },
): EffectiveTraitsResult {
  const targetPlayer =
    context?.player ||
    (context?.state?.players || []).find(
      (p) =>
        p.activeFormCard?.code === card.code ||
        p.hero?.code === card.code ||
        p.alterEgo?.code === card.code,
    );

  const isActiveFormCard =
    targetPlayer &&
    (targetPlayer.activeFormCard
      ? targetPlayer.activeFormCard.code === card.code
      : (targetPlayer.currentForm === 'alter_ego' && targetPlayer.alterEgo?.code === card.code) ||
        (targetPlayer.currentForm !== 'alter_ego' && targetPlayer.hero?.code === card.code));

  if (targetPlayer && isActiveFormCard) {
    const playerDetails = getEffectivePlayerTraitsDetails(targetPlayer, context?.state);
    if (instance?.attachments && instance.attachments.length > 0) {
      const extraDynamic = dedupeTraits(
        extractAddTraitEffects(instance.attachments, targetPlayer, context?.state),
      );
      const combinedDynamic = dedupeTraits([...playerDetails.dynamicTraits, ...extraDynamic]);
      const combinedTraits = dedupeTraits([...playerDetails.traits, ...extraDynamic]);
      return {
        traits: combinedTraits,
        dynamicTraits: combinedDynamic,
        printedTraits: playerDetails.printedTraits,
      };
    }
    return playerDetails;
  }

  const printedTraits = dedupeTraits(card.traits || []);

  const attachmentSources: CardInstance[] = [];
  if (instance?.attachments) {
    attachmentSources.push(...instance.attachments);
  }
  if (
    context?.villain &&
    (card.type === CardType.VILLAIN || (card.type as string) === 'villain') &&
    context.villain.attachments
  ) {
    attachmentSources.push(...context.villain.attachments);
  }

  const dynamicTraits = dedupeTraits(
    extractAddTraitEffects(attachmentSources, context?.player, context?.state),
  );
  const traits = dedupeTraits([...printedTraits, ...dynamicTraits]);

  return {
    traits,
    dynamicTraits,
    printedTraits,
  };
}

/**
 * Computes active effective traits for any card or card instance.
 */
export function getEffectiveCardTraits(
  card: NormalizedCard,
  instance?: CardInstance,
  context?: { player?: PlayerState; state?: GameState; villain?: VillainState },
): string[] {
  return getEffectiveCardTraitsDetails(card, instance, context).traits;
}

/**
 * Checks whether a player identity currently has a given trait (case-insensitive),
 * evaluating active form traits, hero/alter-ego printed traits, tableau CONSTANT ADD_TRAIT upgrades,
 * and identity attachments with CONSTANT ADD_TRAIT.
 */
export function hasPlayerTrait(player: PlayerState, trait: string, state?: GameState): boolean {
  const lower = trait.toLowerCase().trim();
  return getEffectivePlayerTraits(player, state).some((t) => t.toLowerCase().trim() === lower);
}

/**
 * Computes dynamic effective stats for a player's hero or alter-ego,
 * aggregating base card stats and in-play upgrades (e.g. Combat Training +1 ATK, Armored Vest +1 DEF, Heroic Intuition +1 THW).
 */
export function getEffectiveHeroStats(state: GameState, player: PlayerState): EffectiveHeroStats {
  const isHero = player.currentForm === 'hero';
  type FormCardWithStats = { thw?: number; atk?: number; def?: number; rec?: number };
  let thwart = isHero
    ? ((player.hero as HeroCard).thwart ??
      (player.hero as FormCardWithStats)?.thw ??
      (player.activeFormCard as FormCardWithStats)?.thw ??
      0)
    : 0;
  let attack = isHero
    ? ((player.hero as HeroCard).attack ??
      (player.hero as FormCardWithStats)?.atk ??
      (player.activeFormCard as FormCardWithStats)?.atk ??
      0)
    : 0;
  let defense = isHero
    ? ((player.hero as HeroCard).defense ??
      (player.hero as FormCardWithStats)?.def ??
      (player.activeFormCard as FormCardWithStats)?.def ??
      0)
    : 0;
  let recovery = !isHero
    ? ((player.alterEgo as AlterEgoCard).recover ??
      (player.alterEgo as FormCardWithStats)?.rec ??
      (player.activeFormCard as FormCardWithStats)?.rec ??
      0)
    : 0;
  const keywords: string[] = [];

  // Inspect in-play upgrades in player tableau
  for (const item of player.tableau || []) {
    const abilities = item.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (!evaluateConstantStepGate(step, player, state)) continue;

          if (isStep(step, 'MODIFY_STAT')) {
            const stepParams = getStepEffectParams(step);
            const amount = kernel.evaluateDynamicAmount(
              stepParams.amount as number | DynamicValueSource | undefined,
              {},
              { state, player, sourceCardInstance: item },
            );
            if (stepParams.stat === 'THWART') thwart += amount;
            if (stepParams.stat === 'ATTACK') attack += amount;
            if (stepParams.stat === 'DEFENSE') defense += amount;
            if (stepParams.stat === 'RECOVERY') recovery += amount;
          }
          if (isStep(step, 'GRANT_KEYWORD')) {
            const stepParams = getStepEffectParams(step);
            if (stepParams.keyword) {
              keywords.push(stepParams.keyword as string);
            }
          }
        }
      }
    }
  }

  // Add active temporary stat modifiers on the player (e.g. Lead from the Front 01070)
  for (const mod of player.activeStatModifiers || []) {
    if (mod.stat === 'THWART') thwart += mod.amount;
    if (mod.stat === 'ATTACK') attack += mod.amount;
    if (mod.stat === 'DEFENSE') defense += mod.amount;
    if (mod.stat === 'RECOVERY') recovery += mod.amount;
  }

  // A dash (–) power is an unmodifiable 0 (RR v1.8 "Dash (Value)")
  if (hasDashPower(player.hero, 'thwart')) thwart = 0;
  if (hasDashPower(player.hero, 'attack')) attack = 0;
  if (hasDashPower(player.hero, 'defense')) defense = 0;
  if (hasDashPower(player.alterEgo, 'recover')) recovery = 0;

  return {
    thwart: Math.max(0, thwart),
    attack: Math.max(0, attack),
    defense: Math.max(0, defense),
    recovery,
    keywords,
  };
}

/**
 * Computes dynamic effective Hand Size for a player, aggregating base form hand size
 * and continuous aura modifiers (e.g. Iron Man 01029a scaled by in-play Tech upgrades).
 */
export function getEffectiveHandSize(player: PlayerState, state: GameState): number {
  const isHero = player.currentForm === 'hero';

  // Base printed hand size
  let baseHandSize = isHero
    ? (player.hero as HeroCard).handSize || 5
    : (player.alterEgo as AlterEgoCard).handSize || 6;

  let bonus = 0;

  // Scan constant abilities on identity and tableau cards
  const allCards = [
    { card: player.activeFormCard, enrichment: player.activeFormCard.enrichment },
    ...(player.tableau || []).map((t) => ({ card: t.card, enrichment: t.card.enrichment })),
  ];

  for (const item of allCards) {
    const abilities = item.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          const stepParams = getStepEffectParams(step);
          if (step.effect === 'MODIFY_HAND_SIZE') {
            bonus += kernel.evaluateDynamicAmount(
              stepParams.amount as number | DynamicValueSource | undefined,
              {},
              { state, player },
            );
          }
        }
      }
    }
  }

  // A hand size can never be negative; the rules set no other bound (printed caps such as
  // "to a maximum of +6" are declared on the modifier with `clamp.max`).
  return Math.max(0, baseHandSize + bonus);
}

/**
 * Computes dynamic effective Maximum Health for a player, aggregating base identity health
 * and continuous upgrade modifiers (e.g. Mark V Armor +6 HP, Rocket Boots +1 HP).
 */
export function getEffectiveMaxHealth(player: PlayerState, _state?: GameState): number {
  const heroCard = player.hero as HeroCard;
  const baseHealth = heroCard.health || player.maxHealth || 10;
  let bonus = 0;

  for (const item of player.tableau || []) {
    const abilities = item.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (isStep(step, 'MODIFY_MAX_HEALTH')) {
            const stepParams = getStepEffectParams(step);
            bonus += (stepParams.amount as number) || 0;
          }
        }
      }
    }
  }

  return Math.max(1, baseHealth + bonus);
}

/**
 * Computes dynamic effective Ally Limit for a player (RR v1.8 p. 3 'Ally Limit', ADR-0018).
 * Base: 3 allies.
 * Modifiers: Scans in-play cards for CONSTANT abilities with MODIFY_ALLY_LIMIT.
 */
export function getEffectiveAllyLimit(player: PlayerState, state?: GameState): number {
  const BASE_ALLY_LIMIT = 3;
  let bonus = 0;

  // A controller's card raises their own limit (The Triskelion 01073) or, with target ALL_PLAYERS,
  // everyone's. Its gate reads the controller's board ("each of your allies", Avengers Tower 03024).
  for (const controller of state?.players ?? [player]) {
    for (const item of controller.tableau || []) {
      for (const ab of item.card.enrichment?.abilities || []) {
        if (ab.timing !== 'CONSTANT') continue;
        for (const step of ab.steps || []) {
          if (step.effect !== 'MODIFY_ALLY_LIMIT') continue;
          const stepParams = getStepEffectParams(step);
          const reachesPlayer = controller.id === player.id || stepParams.target === 'ALL_PLAYERS';
          if (reachesPlayer && evaluateConstantStepGate(step, controller, state)) {
            bonus += Number(stepParams.amount) || 1;
          }
        }
      }
    }
  }

  return BASE_ALLY_LIMIT + bonus;
}

/**
 * Computes dynamic effective Retaliate magnitude for an entity (Player, Villain, Minion, Ally, or CardInstance),
 * aggregating base card keywords, constant abilities, attachments, and tableau upgrades (RR v1.8 p. 24, ADR-0054).
 * "If a character has multiple instances of retaliate, the values of each instance are added together."
 */
export function getEffectiveRetaliate(
  entity: StatEntity | undefined | null,
  _state?: GameState,
): number {
  if (!entity) return 0;
  let retaliateTotal = 0;

  const ent = entity as Record<string, unknown>;
  const targetCard = (ent.card ||
    ent.activeFormCard ||
    ent.hero ||
    (ent.type ? ent : undefined)) as NormalizedCard | undefined;

  // 1. Direct card/entity keywords
  let baseCardRetaliate = 0;
  const directKeywords =
    (ent.keywords as (Keyword | string | { keyword?: string; amount?: number })[] | undefined) ||
    targetCard?.keywords ||
    [];
  for (const k of directKeywords) {
    const parsed = parseKeywordItem(k);
    if (parsed && parsed.name.toLowerCase() === 'retaliate') {
      baseCardRetaliate += parsed.amount;
    }
  }

  // 2. Constant abilities on the entity's card itself (e.g. Black Panther 01040a or Whiplash 01172)
  let selfAbilitiesRetaliate = 0;
  const selfAbilities =
    targetCard?.enrichment?.abilities || (ent.abilities as CardAbility[] | undefined) || [];
  for (const ab of selfAbilities) {
    if (ab.timing === 'CONSTANT') {
      for (const step of ab.steps || []) {
        if (isStep(step, 'GRANT_KEYWORD')) {
          const stepParams = getStepEffectParams(step);
          const parsed = parseKeywordItem({
            keyword: stepParams.keyword,
            amount: stepParams.amount,
          });
          if (parsed && parsed.name.toLowerCase() === 'retaliate') {
            selfAbilitiesRetaliate += parsed.amount;
          }
        }
      }
    }
  }

  // Base character retaliate takes the maximum of printed keywords or declarative ability declaration
  retaliateTotal += Math.max(baseCardRetaliate, selfAbilitiesRetaliate);

  // 3. In-play attachments on the entity (e.g. Concussion Blasters on Villain, or upgrade attached to Ally/Minion)
  const attachments = (ent.attachments as CardInstance[] | undefined) || [];
  for (const att of attachments) {
    for (const k of att.card?.keywords || []) {
      const parsed = parseKeywordItem(k);
      if (parsed && parsed.name.toLowerCase() === 'retaliate') {
        retaliateTotal += parsed.amount;
      }
    }
    const attAbilities = att.card?.enrichment?.abilities || [];
    for (const ab of attAbilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (isStep(step, 'GRANT_KEYWORD')) {
            const stepParams = getStepEffectParams(step);
            const parsed = parseKeywordItem({
              keyword: stepParams.keyword,
              amount: stepParams.amount,
            });
            if (parsed && parsed.name.toLowerCase() === 'retaliate') {
              retaliateTotal += parsed.amount;
            }
          }
        }
      }
    }
  }

  // 4. In-play tableau upgrades for player (e.g. Electrostatic Armor, Dauntless)
  const tableau = ent.tableau as CardInstance[] | undefined;
  if (tableau) {
    for (const item of tableau) {
      for (const k of item.card?.keywords || []) {
        const parsed = parseKeywordItem(k);
        if (parsed && parsed.name.toLowerCase() === 'retaliate') {
          retaliateTotal += parsed.amount;
        }
      }
      const itemAbilities = item.card?.enrichment?.abilities || [];
      for (const ab of itemAbilities) {
        if (ab.timing === 'CONSTANT') {
          for (const step of ab.steps || []) {
            if (isStep(step, 'GRANT_KEYWORD')) {
              const stepParams = getStepEffectParams(step);
              const parsed = parseKeywordItem({
                keyword: stepParams.keyword,
                amount: stepParams.amount,
              });
              if (parsed && parsed.name.toLowerCase() === 'retaliate') {
                retaliateTotal += parsed.amount;
              }
            }
          }
        }
      }
    }
  }

  return retaliateTotal;
}

/**
 * Checks if an entity (Player, Villain, Minion, CardInstance, or Card) has a specific keyword (ADR-0054).
 */
export function hasEntityKeyword(
  entity: StatEntity | undefined | null,
  targetKeyword: string,
  state: GameState,
): boolean {
  if (!entity) return false;
  const kw = targetKeyword.toLowerCase().trim();

  // Fast-path for retaliate
  if (kw === 'retaliate' && getEffectiveRetaliate(entity) > 0) {
    return true;
  }

  const ent = entity as Record<string, unknown>;

  // 1. Direct keywords array on card/entity
  const directKeywords =
    (ent.keywords as (Keyword | string | { keyword?: string; amount?: number })[] | undefined) ||
    (ent.card as NormalizedCard | undefined)?.keywords ||
    (ent.hero as HeroCard | undefined)?.keywords ||
    [];
  for (const k of directKeywords) {
    const parsed = parseKeywordItem(k);
    if (parsed && parsed.name.toLowerCase() === kw) return true;
    const s = String(k).toLowerCase().trim();
    if (s === kw || s.startsWith(kw + ' ')) return true;
  }

  // 2. Entity traits check (e.g. traits array)
  const traits =
    (ent.traits as string[] | undefined) ||
    (ent.card as NormalizedCard | undefined)?.traits ||
    (ent.activeFormCard as NormalizedCard | undefined)?.traits ||
    (ent.currentForm === 'alter_ego'
      ? (ent.alterEgo as AlterEgoCard | undefined)?.traits
      : (ent.hero as HeroCard | undefined)?.traits) ||
    (ent.hero as HeroCard | undefined)?.traits ||
    [];
  if (traits.some((t: unknown) => String(t).toLowerCase().trim() === kw)) {
    return true;
  }

  // 3. Attachments granting keyword
  const attachments = (ent.attachments as CardInstance[] | undefined) || [];
  for (const att of attachments) {
    const abilities = att.card?.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (isStep(step, 'GRANT_KEYWORD')) {
            const stepParams = getStepEffectParams(step);
            const parsed = parseKeywordItem({
              keyword: stepParams.keyword,
              amount: stepParams.amount,
            });
            if (parsed && parsed.name.toLowerCase() === kw) return true;
            const granted = String(stepParams.keyword || '')
              .toLowerCase()
              .trim();
            if (granted === kw || granted.startsWith(kw + ' ')) return true;
          }
        }
      }
    }
  }

  // 4. Tableau upgrades granting keyword to hero (for player)
  const tableau = ent.tableau as CardInstance[] | undefined;
  if (tableau) {
    for (const item of tableau) {
      const abilities = item.card?.enrichment?.abilities || [];
      for (const ab of abilities) {
        if (ab.timing === 'CONSTANT') {
          for (const step of ab.steps || []) {
            if (isStep(step, 'GRANT_KEYWORD')) {
              const stepParams = getStepEffectParams(step);
              const parsed = parseKeywordItem({
                keyword: stepParams.keyword,
                amount: stepParams.amount,
              });
              if (parsed && parsed.name.toLowerCase() === kw) return true;
              const granted = String(stepParams.keyword || '')
                .toLowerCase()
                .trim();
              if (granted === kw || granted.startsWith(kw + ' ')) return true;
            }
          }
        }
      }
    }
  }

  // 5. Environments granting keyword to a scope ("The villain gains steady", "Each minion gains guard")
  const entityType = (ent.card as NormalizedCard | undefined)?.type;
  const inScope = (target: unknown): boolean => {
    if (target === 'ALL_CHARACTERS') return true;
    if (target === 'VILLAIN') return entityType === CardType.VILLAIN;
    if (target === 'ALL_MINIONS') return entityType === CardType.MINION;
    if (target === 'ALL_ENEMIES') {
      return entityType === CardType.VILLAIN || entityType === CardType.MINION;
    }
    return false;
  };
  for (const environment of state.environments ?? []) {
    for (const ab of environment.card?.enrichment?.abilities ?? []) {
      if (ab.timing !== 'CONSTANT') continue;
      for (const step of ab.steps ?? []) {
        if (!isStep(step, 'GRANT_KEYWORD')) continue;
        const stepParams = getStepEffectParams(step);
        if (!inScope(stepParams.target)) continue;
        if (
          String(stepParams.keyword ?? '')
            .toLowerCase()
            .trim() === kw
        )
          return true;
      }
    }
  }

  return false;
}

/**
 * Checks if a character is incapacitated by a status card (taking into account Steady - RR v1.8 p. 28).
 */
export function isEntityIncapacitatedByStatus(
  entity: EntityWithStatusCards | undefined | null,
  status: StatusCard | string,
  state: GameState,
): boolean {
  if (!entity || !entity.statusCards) return false;
  const count = entity.statusCards.filter((s) => s === status).length;
  const isSteady = hasEntityKeyword(entity, 'Steady', state);
  if (isSteady) {
    return count >= 2;
  }
  return count >= 1;
}

/**
 * Consumes status cards when an incapacitated character attempts an action (RR v1.8 p. 28).
 * Discards 2 copies if Steady, or 1 copy if Standard. Returns true if status was consumed.
 */
export function consumeEntityStatusCards(
  entity: EntityWithStatusCards | undefined | null,
  status: StatusCard | string,
  state: GameState,
): boolean {
  if (!entity || !entity.statusCards) return false;
  if (!isEntityIncapacitatedByStatus(entity, status, state)) return false;
  const isSteady = hasEntityKeyword(entity, 'Steady', state);
  const discardCount = isSteady ? 2 : 1;

  let discarded = 0;
  for (let i = entity.statusCards.length - 1; i >= 0 && discarded < discardCount; i--) {
    if (entity.statusCards[i] === status) {
      entity.statusCards.splice(i, 1);
      discarded++;
    }
  }
  return discarded > 0;
}
