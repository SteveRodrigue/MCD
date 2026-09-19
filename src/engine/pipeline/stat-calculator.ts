import {
  GameState,
  VillainState,
  CardInstance,
  AllyCard,
  HeroCard,
  AlterEgoCard,
  PlayerState,
  NormalizedCard,
  CardType,
} from '../models';
import { matchesCardFilter } from '../filters/card-filter';
import { parseKeywordItem } from '../models/keyword';
import { getStepEffectParams } from '../../data/supplemental/schema';

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
  _state: GameState,
  villain: VillainState,
): EffectiveVillainStats {
  let attack = villain.card.attack || 0;
  let scheme = villain.card.scheme || 0;
  const keywords: string[] = [];

  for (const attachment of villain.attachments || []) {
    const abilities = attachment.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          const stepParams = getStepEffectParams(step);
          if (step.effect === 'MODIFY_STAT') {
            if (stepParams.stat === 'ATTACK') attack += (stepParams.amount as number) || 0;
            if (stepParams.stat === 'SCHEME') scheme += (stepParams.amount as number) || 0;
          }
          if (step.effect === 'GRANT_KEYWORD' && stepParams.keyword) {
            keywords.push(stepParams.keyword as string);
          }
        }
      }
    }
  }

  return {
    attack: Math.max(0, attack),
    scheme: Math.max(0, scheme),
    keywords,
  };
}

/**
 * Computes dynamic effective stats for an ally, aggregating base card stats,
 * constant abilities (e.g. Jessica Jones side scheme bonus), and in-play attachments (e.g. Inspired).
 */
export function getEffectiveAllyStats(state: GameState, ally: CardInstance): EffectiveAllyStats {
  const allyCard = ally.card as AllyCard;
  let thwart = allyCard.thwart || 0;
  let attack = allyCard.attack || 0;
  const keywords: string[] = [];

  // Check constant abilities on the ally itself
  const selfAbilities = ally.card.enrichment?.abilities || [];
  for (const ab of selfAbilities) {
    if (ab.timing === 'CONSTANT') {
      for (const step of ab.steps || []) {
        const stepParams = getStepEffectParams(step);
        if (step.effect === 'MODIFY_STAT') {
          if (stepParams.stat === 'THWART') {
            if (stepParams.scaling === 'PER_SIDE_SCHEME') {
              const sideSchemeCount = (state.sideSchemes || []).length;
              const maxBonus = (stepParams.maxBonus as number) || 4;
              thwart += Math.min(
                maxBonus,
                sideSchemeCount * ((stepParams.multiplier as number) || 1),
              );
            } else if (stepParams.amount) {
              thwart += (stepParams.amount as number) || 0;
            }
          }
          if (stepParams.stat === 'ATTACK') {
            attack += (stepParams.amount as number) || 0;
          }
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
          const stepParams = getStepEffectParams(step);
          if (step.effect === 'MODIFY_STAT') {
            if (stepParams.stat === 'THWART') thwart += (stepParams.amount as number) || 0;
            if (stepParams.stat === 'ATTACK') attack += (stepParams.amount as number) || 0;
          }
          if (step.effect === 'GRANT_KEYWORD' && stepParams.keyword) {
            keywords.push(stepParams.keyword as string);
          }
        }
      }
    }
  }

  // Add active temporary stat modifiers on this ally (e.g. Vision 01068, Lead from the Front 01070)
  for (const mod of ally.activeStatModifiers || []) {
    if (mod.stat === 'THW' || mod.stat === 'THWART') thwart += mod.amount;
    if (mod.stat === 'ATK' || mod.stat === 'ATTACK') attack += mod.amount;
  }

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

function extractAddTraitEffects(sources: (CardInstance | undefined)[]): string[] {
  const dynamicTraits: string[] = [];
  for (const item of sources) {
    if (!item) continue;
    const abilities = item.card?.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (step.effect === 'ADD_TRAIT') {
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
 * inspecting active form traits, hero/alter-ego printed traits,
 * tableau upgrades with CONSTANT ADD_TRAIT, and identity attachments with CONSTANT ADD_TRAIT.
 */
export function getEffectivePlayerTraitsDetails(player: PlayerState): EffectiveTraitsResult {
  const rawPrinted = [
    ...(player.activeFormCard?.traits || []),
    ...(player.hero?.traits || []),
    ...(player.alterEgo?.traits || []),
  ];
  const printedTraits = dedupeTraits(rawPrinted);

  const dynamicSources = [...(player.tableau || []), ...(player.attachments || [])];
  const dynamicTraits = dedupeTraits(extractAddTraitEffects(dynamicSources));
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
export function getEffectivePlayerTraits(player: PlayerState): string[] {
  return getEffectivePlayerTraitsDetails(player).traits;
}

/**
 * Computes full effective trait details for any card or card instance,
 * delegating to player traits if matching identity, and inspecting attachments for CONSTANT ADD_TRAIT.
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

  const isIdentityCard =
    targetPlayer &&
    (targetPlayer.activeFormCard?.code === card.code ||
      targetPlayer.hero?.code === card.code ||
      targetPlayer.alterEgo?.code === card.code ||
      card.type === CardType.HERO ||
      card.type === CardType.ALTER_EGO ||
      (card as any).type === 'hero' ||
      (card as any).type === 'alter_ego');

  if (targetPlayer && isIdentityCard) {
    const playerDetails = getEffectivePlayerTraitsDetails(targetPlayer);
    if (instance?.attachments && instance.attachments.length > 0) {
      const extraDynamic = dedupeTraits(extractAddTraitEffects(instance.attachments));
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
    (card.type === CardType.VILLAIN || (card as any).type === 'villain') &&
    context.villain.attachments
  ) {
    attachmentSources.push(...context.villain.attachments);
  }

  const dynamicTraits = dedupeTraits(extractAddTraitEffects(attachmentSources));
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
export function hasPlayerTrait(player: PlayerState, trait: string): boolean {
  const lower = trait.toLowerCase().trim();
  return getEffectivePlayerTraits(player).some((t) => t.toLowerCase().trim() === lower);
}

/**
 * Computes dynamic effective stats for a player's hero or alter-ego,
 * aggregating base card stats and in-play upgrades (e.g. Combat Training +1 ATK, Armored Vest +1 DEF, Heroic Intuition +1 THW).
 */
export function getEffectiveHeroStats(_state: GameState, player: PlayerState): EffectiveHeroStats {
  const isHero = player.currentForm === 'hero';
  let thwart = isHero ? (player.hero as HeroCard).thwart || 0 : 0;
  let attack = isHero ? (player.hero as HeroCard).attack || 0 : 0;
  let defense = isHero ? (player.hero as HeroCard).defense || 0 : 0;
  let recovery = !isHero ? (player.alterEgo as AlterEgoCard).recover || 0 : 0;
  const keywords: string[] = [];

  // Inspect in-play upgrades in player tableau
  for (const item of player.tableau || []) {
    const abilities = item.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (step.gate === 'IF_CONDITION_MET' && step.condition === 'TARGET_TRAIT_MATCH') {
            const requiredTrait = (step.gateParams as any)?.trait as string;
            if (!hasPlayerTrait(player, requiredTrait)) continue;
          }

          const stepParams = getStepEffectParams(step);
          if (step.effect === 'MODIFY_STAT') {
            const amount = (stepParams.amount as number) || 0;
            if (stepParams.stat === 'THWART') thwart += amount;
            if (stepParams.stat === 'ATTACK') attack += amount;
            if (stepParams.stat === 'DEFENSE') defense += amount;
            if (stepParams.stat === 'RECOVER' || stepParams.stat === 'RECOVERY') recovery += amount;
          }
          if (step.effect === 'GRANT_KEYWORD' && stepParams.keyword) {
            keywords.push(stepParams.keyword as string);
          }
        }
      }
    }
  }

  // Add active temporary stat modifiers on the player (e.g. Lead from the Front 01070)
  for (const mod of player.activeStatModifiers || []) {
    if (mod.stat === 'THW' || mod.stat === 'THWART') thwart += mod.amount;
    if (mod.stat === 'ATK' || mod.stat === 'ATTACK') attack += mod.amount;
    if (mod.stat === 'DEF' || mod.stat === 'DEFENSE') defense += mod.amount;
    if (mod.stat === 'REC' || mod.stat === 'RECOVER' || mod.stat === 'RECOVERY')
      recovery += mod.amount;
  }

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
export function getEffectiveHandSize(player: PlayerState, _state?: GameState): number {
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
            if (stepParams.scaling === 'PER_MATCHING_CARD') {
              // Count matching cards in player's tableau using universal card filter (ADR-0046)
              const filter = stepParams.filter || step.filter;
              const matches = (player.tableau || []).filter((tableauItem) =>
                matchesCardFilter(tableauItem.card, filter, { player, state: _state }),
              ).length;
              bonus += matches * ((stepParams.multiplier as number) || 1);
            } else if (stepParams.amount) {
              bonus += (stepParams.amount as number) || 0;
            }
          }
        }
      }
    }
  }

  // Clamp effective hand size between 1 and 10
  return Math.max(1, Math.min(10, baseHandSize + bonus));
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
          const stepParams = getStepEffectParams(step);
          if (step.effect === 'MODIFY_MAX_HEALTH') {
            bonus += (stepParams.amount as number) || (stepParams.healthBonus as number) || 0;
          } else if (
            step.effect === 'MODIFY_STAT' &&
            (stepParams.stat === 'HEALTH' || stepParams.stat === 'MAX_HEALTH')
          ) {
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
 * Modifiers: Scans in-play cards for CONSTANT abilities with ALLY_LIMIT_BONUS or MODIFY_ALLY_LIMIT.
 */
export function getEffectiveAllyLimit(player: PlayerState, state?: GameState): number {
  const BASE_ALLY_LIMIT = 3;
  let bonus = 0;

  // 1. Scan player's own tableau (for CONTROLLER / SELF_IDENTITY auras, e.g. The Triskelion 01073)
  for (const item of player.tableau || []) {
    const abilities = item.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          const stepParams = getStepEffectParams(step);
          if (step.effect === 'ALLY_LIMIT_BONUS' || step.effect === 'MODIFY_ALLY_LIMIT') {
            bonus += Number(stepParams.amount) || 1;
          }
        }
      }
    }
  }

  // 2. Scan other players' tableaus for tablewide aura effects (target: 'ALL_PLAYERS')
  if (state) {
    for (const p of state.players) {
      if (p.id === player.id) continue;
      for (const item of p.tableau || []) {
        const abilities = item.card.enrichment?.abilities || [];
        for (const ab of abilities) {
          if (ab.timing === 'CONSTANT') {
            for (const step of ab.steps || []) {
              const stepParams = getStepEffectParams(step);
              if (
                (step.effect === 'ALLY_LIMIT_BONUS' || step.effect === 'MODIFY_ALLY_LIMIT') &&
                stepParams.target === 'ALL_PLAYERS'
              ) {
                bonus += Number(stepParams.amount) || 1;
              }
            }
          }
        }
      }
    }
  }

  return BASE_ALLY_LIMIT + bonus;
}

/**
 * Computes dynamic effective Retaliate magnitude for an entity (Player, Villain, Minion, Ally, or CardInstance),
 * aggregating base card keywords, enrichment keywords, constant abilities, attachments, and tableau upgrades (RR v1.8 p. 24, ADR-0054).
 * "If a character has multiple instances of retaliate, the values of each instance are added together."
 */
export function getEffectiveRetaliate(entity: any, _state?: GameState): number {
  if (!entity) return 0;
  let retaliateTotal = 0;

  const targetCard =
    entity.card || entity.activeFormCard || entity.hero || (entity.type ? entity : undefined);

  // 1. Direct card/entity keywords
  let baseCardRetaliate = 0;
  const directKeywords = entity.keywords || targetCard?.keywords || [];
  for (const k of directKeywords) {
    const parsed = parseKeywordItem(k);
    if (parsed && parsed.name.toLowerCase() === 'retaliate') {
      baseCardRetaliate += parsed.amount;
    }
  }

  // 2. Card enrichment keywords
  const enrichmentKws = entity.enrichment?.keywords || targetCard?.enrichment?.keywords || [];
  for (const k of enrichmentKws) {
    const parsed = parseKeywordItem(k);
    if (parsed && parsed.name.toLowerCase() === 'retaliate') {
      baseCardRetaliate += parsed.amount;
    }
  }

  // 3. Constant abilities on the entity's card itself (e.g. Black Panther 01040a or Whiplash 01172)
  let selfAbilitiesRetaliate = 0;
  const selfAbilities = targetCard?.enrichment?.abilities || entity.abilities || [];
  for (const ab of selfAbilities) {
    if (ab.timing === 'CONSTANT') {
      for (const step of ab.steps || []) {
        const stepParams = getStepEffectParams(step);
        if (step.effect === 'GRANT_KEYWORD') {
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

  // 4. In-play attachments on the entity (e.g. Concussion Blasters on Villain, or upgrade attached to Ally/Minion)
  const attachments = entity.attachments || [];
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
          const stepParams = getStepEffectParams(step);
          if (step.effect === 'GRANT_KEYWORD') {
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

  // 5. In-play tableau upgrades for player (e.g. Electrostatic Armor, Dauntless)
  if (entity.tableau) {
    for (const item of entity.tableau) {
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
            const stepParams = getStepEffectParams(step);
            if (step.effect === 'GRANT_KEYWORD') {
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
export function hasEntityKeyword(entity: any, targetKeyword: string): boolean {
  if (!entity) return false;
  const kw = targetKeyword.toLowerCase().trim();

  // Fast-path for retaliate
  if (kw === 'retaliate' && getEffectiveRetaliate(entity) > 0) {
    return true;
  }

  // 1. Direct keywords array on card/entity
  const directKeywords = entity.keywords || entity.card?.keywords || entity.hero?.keywords || [];
  for (const k of directKeywords) {
    const parsed = parseKeywordItem(k);
    if (parsed && parsed.name.toLowerCase() === kw) return true;
    const s = String(k).toLowerCase().trim();
    if (s === kw || s.startsWith(kw + ' ')) return true;
  }

  // 2. Card enrichment keywords
  const enrichmentKws = entity.enrichment?.keywords || entity.card?.enrichment?.keywords || [];
  for (const k of enrichmentKws) {
    const parsed = parseKeywordItem(k);
    if (parsed && parsed.name.toLowerCase() === kw) return true;
    const s = String(k).toLowerCase().trim();
    if (s === kw || s.startsWith(kw + ' ')) return true;
  }

  // 3. Entity traits check (e.g. traits array)
  const traits = entity.traits || entity.card?.traits || entity.hero?.traits || [];
  if (traits.some((t: any) => String(t).toLowerCase().trim() === kw)) {
    return true;
  }

  // 4. Attachments granting keyword
  const attachments = entity.attachments || [];
  for (const att of attachments) {
    const abilities = att.card?.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          const stepParams = getStepEffectParams(step);
          if (step.effect === 'GRANT_KEYWORD') {
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

  // 5. Tableau upgrades granting keyword to hero (for player)
  if (entity.tableau) {
    for (const item of entity.tableau) {
      const abilities = item.card?.enrichment?.abilities || [];
      for (const ab of abilities) {
        if (ab.timing === 'CONSTANT') {
          for (const step of ab.steps || []) {
            const stepParams = getStepEffectParams(step);
            if (step.effect === 'GRANT_KEYWORD') {
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

  return false;
}

/**
 * Checks if a character is incapacitated by a status card (taking into account Steady - RR v1.8 p. 28).
 */
export function isEntityIncapacitatedByStatus(entity: any, status: any): boolean {
  if (!entity || !entity.statusCards) return false;
  const count = (entity.statusCards as any[]).filter((s) => s === status).length;
  const isSteady = hasEntityKeyword(entity, 'Steady');
  if (isSteady) {
    return count >= 2;
  }
  return count >= 1;
}

/**
 * Consumes status cards when an incapacitated character attempts an action (RR v1.8 p. 28).
 * Discards 2 copies if Steady, or 1 copy if Standard. Returns true if status was consumed.
 */
export function consumeEntityStatusCards(entity: any, status: any): boolean {
  if (!isEntityIncapacitatedByStatus(entity, status)) return false;
  const isSteady = hasEntityKeyword(entity, 'Steady');
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
