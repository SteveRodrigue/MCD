import {
  GameState,
  VillainState,
  CardInstance,
  AllyCard,
  HeroCard,
  PlayerState,
} from '@engine/models';

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
        if (ab.effect === 'MODIFY_STAT') {
          if (ab.params?.stat === 'ATTACK') attack += (ab.params.amount as number) || 0;
          if (ab.params?.stat === 'SCHEME') scheme += (ab.params.amount as number) || 0;
        }
        if (ab.effect === 'GRANT_KEYWORD' && ab.params?.keyword) {
          keywords.push(ab.params.keyword as string);
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

  // Special card abilities (e.g. Jessica Jones 01059: gets +1 THW for each side scheme in play)
  if (allyCard.code === '01059') {
    thwart += (state.sideSchemes || []).length;
  }

  // Sum attachments on this ally (e.g. Inspired 01074: +1 THW / +1 ATK)
  for (const attachment of ally.attachments || []) {
    const abilities = attachment.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        if (ab.effect === 'MODIFY_STAT') {
          if (ab.params?.stat === 'THWART') thwart += (ab.params.amount as number) || 0;
          if (ab.params?.stat === 'ATTACK') attack += (ab.params.amount as number) || 0;
        }
        if (ab.effect === 'GRANT_KEYWORD' && ab.params?.keyword) {
          keywords.push(ab.params.keyword as string);
        }
      }
    }
  }

  return {
    thwart: Math.max(0, thwart),
    attack: Math.max(0, attack),
    keywords,
  };
}

/**
 * Computes dynamic effective stats for a player's hero or alter-ego,
 * aggregating base card stats and in-play upgrades (e.g. Combat Training +1 ATK, Armored Vest +1 DEF).
 */
export function getEffectiveHeroStats(_state: GameState, player: PlayerState): EffectiveHeroStats {
  const isHero = player.currentForm === 'hero';
  let thwart = isHero ? (player.hero as HeroCard).thwart || 0 : 0;
  let attack = isHero ? (player.hero as HeroCard).attack || 0 : 0;
  let defense = isHero ? (player.hero as HeroCard).defense || 0 : 0;
  let recovery = !isHero ? player.alterEgo.recover || 0 : 0;
  const keywords: string[] = [];

  // Inspect in-play upgrades in player tableau
  for (const item of player.tableau || []) {
    const abilities = item.card.enrichment?.abilities || [];
    for (const ab of abilities) {
      if (ab.timing === 'CONSTANT') {
        if (ab.effect === 'MODIFY_STAT') {
          if (ab.params?.stat === 'THWART') thwart += (ab.params.amount as number) || 0;
          if (ab.params?.stat === 'ATTACK') attack += (ab.params.amount as number) || 0;
          if (ab.params?.stat === 'DEFENSE') defense += (ab.params.amount as number) || 0;
          if (ab.params?.stat === 'RECOVER' || ab.params?.stat === 'RECOVERY') recovery += (ab.params.amount as number) || 0;
        }
        if (ab.effect === 'GRANT_KEYWORD' && ab.params?.keyword) {
          keywords.push(ab.params.keyword as string);
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
