import {
  GameState,
  VillainState,
  CardInstance,
  AllyCard,
  HeroCard,
  AlterEgoCard,
  PlayerState,
} from '../models';

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
export function getEffectiveVillainStats(_state: GameState, villain: VillainState): EffectiveVillainStats {
  let attack = villain.card.attack || 0;
  let scheme = villain.card.scheme || 0;
  const keywords: string[] = [];

  for (const attachment of villain.attachments || []) {
    const abilities = attachment.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (step.effect === 'MODIFY_STAT') {
            if (step.params?.stat === 'ATTACK') attack += (step.params.amount as number) || 0;
            if (step.params?.stat === 'SCHEME') scheme += (step.params.amount as number) || 0;
          }
          if (step.effect === 'GRANT_KEYWORD' && step.params?.keyword) {
            keywords.push(step.params.keyword as string);
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
        if (step.effect === 'MODIFY_STAT') {
          if (step.params?.stat === 'THWART') {
            if (step.params.scaling === 'PER_SIDE_SCHEME') {
              const sideSchemeCount = (state.sideSchemes || []).length;
              const maxBonus = (step.params.maxBonus as number) || 4;
              thwart += Math.min(maxBonus, sideSchemeCount * ((step.params.multiplier as number) || 1));
            } else if (step.params.amount) {
              thwart += (step.params.amount as number) || 0;
            }
          }
          if (step.params?.stat === 'ATTACK') {
            attack += (step.params.amount as number) || 0;
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
          if (step.effect === 'MODIFY_STAT') {
            if (step.params?.stat === 'THWART') thwart += (step.params.amount as number) || 0;
            if (step.params?.stat === 'ATTACK') attack += (step.params.amount as number) || 0;
          }
          if (step.effect === 'GRANT_KEYWORD' && step.params?.keyword) {
            keywords.push(step.params.keyword as string);
          }
        }
      }
    }
  }

  // Add token/temporary stat bonuses (e.g. Vision 01068 or Lead from the Front 01070)
  if (ally.tokens) {
    thwart += (ally.tokens as any).thwBonus || 0;
    attack += (ally.tokens as any).atkBonus || 0;
  }

  return {
    thwart: Math.max(0, thwart),
    attack: Math.max(0, attack),
    keywords,
  };
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

  const hasAerial = Boolean(
    player.hero.traits?.includes('Aerial') ||
    ((player as any).traits || []).includes('Aerial') ||
    player.tableau.some(
      (t) =>
        t.card.code === '01017' ||
        (t.card.enrichment?.abilities || []).some((a) =>
          a.steps?.some((s) => s.effect === 'ADD_TRAIT' && s.params?.trait === 'Aerial'),
        ),
    ),
  );

  // Inspect in-play upgrades in player tableau
  for (const item of player.tableau || []) {
    const abilities = item.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        for (const step of ab.steps || []) {
          if (step.effect === 'MODIFY_STAT') {
            const aerialBonus = (step.params?.aerialBonus as number) || 0;
            const extra = hasAerial ? aerialBonus : 0;

            if (step.params?.stat === 'THWART') thwart += ((step.params.amount as number) || 0) + extra;
            if (step.params?.stat === 'ATTACK') attack += ((step.params.amount as number) || 0) + extra;
            if (step.params?.stat === 'DEFENSE') {
              if (item.card.code === '01016') {
                defense += hasAerial ? 2 : 1;
              } else {
                defense += ((step.params.amount as number) || 0) + extra;
              }
            }
            if (step.params?.stat === 'RECOVER' || step.params?.stat === 'RECOVERY') recovery += ((step.params.amount as number) || 0) + extra;
          }
          if (step.effect === 'GRANT_KEYWORD' && step.params?.keyword) {
            keywords.push(step.params.keyword as string);
          }
        }
      }
    }
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
          if (step.effect === 'MODIFY_HAND_SIZE') {
            if (step.params?.scaling === 'PER_MATCHING_CARD') {
              // Count matching cards in player's tableau
              const filter = step.filter || (step.params?.filter as any) || {};
              let matches = 0;
              for (const tableauItem of player.tableau || []) {
                const card = tableauItem.card;
                let match = true;
                if (filter.trait) {
                  const trait = filter.trait as string;
                  if (!card.traits || !card.traits.some((t) => t.toLowerCase() === trait.toLowerCase())) {
                    match = false;
                  }
                }
                if (filter.type_code && card.type !== (filter.type_code as string) && card.raw?.type_code !== filter.type_code) {
                  match = false;
                }
                if (match) matches++;
              }
              bonus += matches * ((step.params?.multiplier as number) || 1);
            } else if (step.params?.amount) {
              bonus += (step.params.amount as number) || 0;
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
          if (step.effect === 'MODIFY_MAX_HEALTH') {
            bonus += (step.params?.amount as number) || (step.params?.healthBonus as number) || 0;
          } else if (step.effect === 'MODIFY_STAT' && (step.params?.stat === 'HEALTH' || step.params?.stat === 'MAX_HEALTH')) {
            bonus += (step.params?.amount as number) || 0;
          }
        }
      }
    }
  }

  return Math.max(1, baseHealth + bonus);
}
