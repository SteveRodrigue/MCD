/**
 * Marvel Champions Digital - Comic Book Log & Dialogue Formatter
 * Implements ADR-0005 & ADR-0009 / ADR-0037: Localized Comic Narrative & Dialogue Engine
 */

import { GameLogEntry, GamePhase, GameState } from '../../engine/models';
import enCombatLog from '../../locales/en/combat-log.json';
import frCombatLog from '../../locales/fr/combat-log.json';
import { getHeroColorPalette, getContrastTextColor } from './hero-theme';

export type ComicDialogueType =
  'hero_speech' | 'hero_thought' | 'villain_shout' | 'narrator_caption';

export interface FormattedComicDialogue {
  id: string;
  type: ComicDialogueType;
  speakerName?: string;
  speakerRole?: 'hero' | 'alter_ego' | 'villain' | 'minion' | 'ally' | 'environment';
  speakerAvatar?: string;
  speakerColor?: string;
  speakerContrastColor?: string;
  speakerBorderColor?: string;
  dialogueQuote?: string;
  narrativeAction: string;
  onomatopoeia?: string;
  stats?: {
    damage?: number;
    threat?: number;
    recovery?: number;
    cost?: number;
    remainingHp?: number;
  };
  phase?: GamePhase | string;
  round?: number;
  timestamp: number;
  rawEntry: GameLogEntry;
}

const LOCALE_DICTIONARIES: Record<string, typeof enCombatLog> = {
  en: enCombatLog,
  fr: frCombatLog,
};

/**
 * Strips out internal UI seat designations (e.g. "Hero Seat 1 (Spider-Man)" -> "Spider-Man")
 * and resolves player active identity or hero names.
 */
export function cleanCharacterName(name?: string, player?: any): string {
  if (!name) return '';
  const seatMatch = name.match(/^Hero Seat(?:\s+\d+)?\s*\((.*?)\)$/i);
  if (seatMatch && seatMatch[1]) {
    return seatMatch[1].trim();
  }
  if (player && (player.name === name || name.startsWith('Hero Seat'))) {
    if (player.currentForm === 'alter_ego' && player.alterEgo?.name) {
      return player.alterEgo.name;
    }
    if (player.hero?.name) {
      return player.hero.name;
    }
  }
  return name;
}

/**
 * Character Avatar mapping for Core Set Heroes, Villains and Allies
 */
export function getSpeakerAvatar(speakerName?: string, speakerRole?: string): string {
  if (!speakerName) {
    if (speakerRole === 'villain') return '🦹';
    if (speakerRole === 'minion') return '👿';
    if (speakerRole === 'hero') return '🦸';
    if (speakerRole === 'alter_ego') return '🧑';
    return '📜';
  }

  const name = speakerName.toLowerCase();
  if (name.includes('spider-man')) return '🕷️';
  if (name.includes('peter parker')) return '📷';
  if (name.includes('captain marvel')) return '✨';
  if (name.includes('carol danvers')) return '⭐';
  if (name.includes('she-hulk')) return '💚';
  if (name.includes('jennifer walters')) return '⚖️';
  if (name.includes('iron man')) return '⚡';
  if (name.includes('tony stark')) return '🕶️';
  if (name.includes('black panther')) return '🐾';
  if (name.includes("t'challa") || name.includes('tchalla')) return '👑';
  if (name.includes('rhino')) return '🦏';
  if (name.includes('klaw')) return '📡';
  if (name.includes('ultron')) return '🤖';
  if (
    name.includes('shuri') ||
    name.includes('vision') ||
    name.includes('hellcat') ||
    name.includes('mockingbird')
  )
    return '🤝';

  if (speakerRole === 'villain') return '🦹';
  if (speakerRole === 'minion') return '👿';
  if (speakerRole === 'alter_ego') return '🧑';
  if (speakerRole === 'hero') return '🦸';
  return '💬';
}

/**
 * Normalizes speaker name into a key for dialogue lookups
 */
function getSpeakerDialogueKey(speakerName?: string): string | null {
  if (!speakerName) return null;
  const lower = speakerName.toLowerCase().replace(/['\s-]/g, '_');
  if (lower.includes('spider_man')) return 'spider_man';
  if (lower.includes('peter_parker')) return 'peter_parker';
  if (lower.includes('captain_marvel')) return 'captain_marvel';
  if (lower.includes('carol_danvers')) return 'carol_danvers';
  if (lower.includes('she_hulk')) return 'she_hulk';
  if (lower.includes('iron_man')) return 'iron_man';
  if (lower.includes('black_panther')) return 'black_panther';
  if (lower.includes('rhino')) return 'rhino';
  if (lower.includes('klaw')) return 'klaw';
  if (lower.includes('ultron')) return 'ultron';
  return null;
}

/**
 * Interpolates template variables like {{actor}}, {{damage}}, {{target}}
 */
export function interpolateTemplate(
  template: string,
  params: Record<string, string | number | boolean> = {},
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (params[key] !== undefined) {
      return String(params[key]);
    }
    return match;
  });
}

/**
 * Classifies the comic dialogue type based on actor, category, and event key
 */
export function classifyDialogueType(entry: GameLogEntry): ComicDialogueType {
  const actorType = entry.actor?.type;
  const key = entry.key || '';

  // 1. Villain & Minions -> villain_shout
  if (
    actorType === 'villain' ||
    actorType === 'minion' ||
    key.startsWith('VILLAIN_') ||
    key.startsWith('MINION_') ||
    key === 'BOOST_REVEALED' ||
    key === 'TREACHERY_SURGED'
  ) {
    return 'villain_shout';
  }

  // 2. Alter-Ego / Planning / Recovery -> hero_thought
  if (actorType === 'alter_ego' || key === 'BASIC_RECOVER' || key === 'RESOURCE_GENERATED') {
    return 'hero_thought';
  }

  // 3. Hero & Allies -> hero_speech
  if (
    actorType === 'hero' ||
    actorType === 'ally' ||
    key === 'BASIC_ATTACK' ||
    key === 'BASIC_THWART' ||
    key === 'CARD_PLAYED' ||
    key === 'HERO_ABILITY_TRIGGERED' ||
    key === 'ALLY_ENTERED' ||
    key.startsWith('card.effect')
  ) {
    return 'hero_speech';
  }

  // 4. Omniscient Game Narrator -> narrator_caption
  return 'narrator_caption';
}

/**
 * Selects an in-character quote for a speaker and action context
 */
function getCharacterQuote(
  dict: typeof enCombatLog,
  speakerKey: string | null,
  context: 'attack' | 'thwart' | 'recover' | 'defense' | 'play_card' | 'scheme' | 'boost',
): string | undefined {
  if (!speakerKey || !dict.dialogue) return undefined;
  const speakerDict = (dict.dialogue as Record<string, any>)[speakerKey];
  if (!speakerDict) return undefined;

  const quotes = speakerDict[context];
  if (Array.isArray(quotes) && quotes.length > 0) {
    // Pick deterministic or rotating quote based on index
    return quotes[0];
  }
  return undefined;
}

/**
 * Formats dotted hierarchical action keys into readable actor/card prefix strings:
 * - card.effect.readyCharacter -> `${cardName}: effect.readyCharacter`
 * - player.action.allyAttack -> `${playerName}: action.allyAttack`
 * - villain.attack / villain.boost -> `${villainName}: attack` / `${villainName}: boost`
 */
export function formatHierarchicalLogKey(key: string, entry: GameLogEntry): string {
  const params = entry.params || {};

  if (key.startsWith('card.')) {
    const remainder = key.slice(5);
    const cardName =
      (params.card ? String(params.card) : undefined) ||
      (params.cardName ? String(params.cardName) : undefined) ||
      (params.sourceCard ? String(params.sourceCard) : undefined) ||
      (entry.actor?.type === 'ally' || entry.actor?.type === 'minion'
        ? entry.actor.name
        : undefined) ||
      'Card';
    return `${cardName}: ${remainder}`;
  }

  if (key.startsWith('player.')) {
    const remainder = key.slice(7);
    const rawPlayerName =
      entry.actor?.name ||
      (params.player ? String(params.player) : undefined) ||
      (params.actor ? String(params.actor) : undefined) ||
      'Player';
    const playerName = cleanCharacterName(rawPlayerName);
    return `${playerName}: ${remainder}`;
  }

  if (key.startsWith('villain.')) {
    const remainder = key.slice(8);
    const villainName =
      entry.actor?.name ||
      (params.villain ? String(params.villain) : undefined) ||
      (params.actor ? String(params.actor) : undefined) ||
      'Villain';
    return `${villainName}: ${remainder}`;
  }

  if (key.startsWith('minion.')) {
    const remainder = key.slice(7);
    const minionName =
      (params.minion ? String(params.minion) : undefined) ||
      (entry.actor?.type === 'minion' ? entry.actor.name : undefined) ||
      'Minion';
    return `${minionName}: ${remainder}`;
  }

  if (key.startsWith('attachment.')) {
    const remainder = key.slice(11);
    const attachmentName =
      (params.attachment ? String(params.attachment) : undefined) ||
      (params.card ? String(params.card) : undefined) ||
      'Attachment';
    return `${attachmentName}: ${remainder}`;
  }

  if (key.startsWith('identity.')) {
    const remainder = key.slice(9);
    const idName =
      (params.hero ? String(params.hero) : undefined) || entry.actor?.name || 'Identity';
    return `${idName}: ${remainder}`;
  }

  if (key.startsWith('scheme.')) {
    const remainder = key.slice(7);
    const schemeName =
      (params.scheme ? String(params.scheme) : undefined) ||
      (params.target ? String(params.target) : undefined) ||
      'Scheme';
    return `${schemeName}: ${remainder}`;
  }

  if (key.startsWith('encounter.')) {
    const remainder = key.slice(10);
    const encName = (params.card ? String(params.card) : undefined) || 'Encounter';
    return `${encName}: ${remainder}`;
  }

  if (key.startsWith('status.')) {
    const remainder = key.slice(7);
    const statusTarget =
      (params.target ? String(params.target) : undefined) || entry.actor?.name || 'Status';
    return `${statusTarget}: ${remainder}`;
  }

  if (key.includes('.')) {
    const dotIndex = key.indexOf('.');
    const prefix = key.slice(0, dotIndex);
    const remainder = key.slice(dotIndex + 1);
    const capitalPrefix = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    const entityName =
      entry.actor?.name || (params[prefix] ? String(params[prefix]) : undefined) || capitalPrefix;
    return `${entityName}: ${remainder}`;
  }

  return key.replace(/_/g, ' ');
}

/**
 * Maps hierarchical, legacy, or action-specific log keys to canonical combat log template keys.
 */
export function mapToCanonicalTemplateKey(key?: string, entry?: GameLogEntry): string | undefined {
  if (!key) return undefined;

  switch (key) {
    case 'DEAL_DAMAGE':
    case 'player.action.attackVillain':
    case 'card.effect.dealDamage':
      return 'DEAL_DAMAGE';

    case 'HEAL_DAMAGE':
    case 'BASIC_RECOVER':
    case 'card.effect.heal':
      return 'HEAL_DAMAGE';

    case 'REMOVE_THREAT':
    case 'player.action.thwart':
    case 'card.effect.removeThreat':
      return 'REMOVE_THREAT';

    case 'READY':
    case 'READY_CHARACTER':
    case 'card.effect.readyCharacter':
      return 'READY_CHARACTER';

    case 'card.effect.addStatus':
    case 'APPLY_STATUS':
    case 'STATUS_APPLIED': {
      const status = entry?.params?.status ? String(entry.params.status).toUpperCase() : '';
      if (status.includes('STUN')) return 'STATUS_STUNNED';
      if (status.includes('CONFUS')) return 'STATUS_CONFUSED';
      if (status.includes('TOUGH')) return 'STATUS_TOUGH';
      return 'APPLY_STATUS';
    }

    case 'REMOVE_STATUS':
    case 'STATUS_REMOVED':
      return 'REMOVE_STATUS';

    case 'CANCEL_WHEN_REVEALED':
    case 'encounter.whenRevealed.cancelled':
      return 'CANCEL_WHEN_REVEALED';

    case 'PLAY_CARD':
    case 'CARD_PLAYED':
    case 'player.action.playCard':
      return 'CARD_PLAYED';

    case 'cost.reduction.consumed':
    case 'COST_REDUCTION_CONSUMED':
      return 'COST_REDUCTION_CONSUMED';

    case 'CHANGE_FORM':
    case 'FORM_CHANGED':
    case 'player.action.changeForm':
      return 'CHANGE_FORM';

    case 'player.turn.ended':
    case 'PLAYER_TURN_ENDED':
      return 'PLAYER_TURN_ENDED';

    case 'combat.hero.defended':
    case 'HERO_DEFENDED':
      return 'HERO_DEFENDED';

    case 'combat.ally.defended':
    case 'ALLY_DEFENDED':
      return 'ALLY_DEFENDED';

    case 'combat.attack.undefended':
    case 'ATTACK_UNDEFENDED':
      return 'ATTACK_UNDEFENDED';

    case 'BOOST_REVEALED':
    case 'villain.boost':
      return 'BOOST_REVEALED';

    case 'villainPhase.step1.threatPlaced':
    case 'VILLAIN_PHASE_STEP1_THREAT':
      return 'VILLAIN_PHASE_STEP1_THREAT';

    case 'villain.scheme.threat':
    case 'VILLAIN_SCHEME_THREAT':
      return 'VILLAIN_SCHEME_THREAT';

    case 'encounter.reveal.sideScheme':
    case 'SIDE_SCHEME_REVEALED':
      return 'SIDE_SCHEME_REVEALED';

    case 'TREACHERY_SURGED':
      return 'TREACHERY_SURGED';

    case 'CHARACTER_DEFEATED':
      return 'CHARACTER_DEFEATED';

    case 'SIDE_SCHEME_DEFEATED':
      return 'SIDE_SCHEME_DEFEATED';

    default:
      return key;
  }
}

/**
 * Normalizes log entry parameters into canonical placeholder tokens:
 * who, who_attacks, who_is_taking_damage, who_defends, target, amount, card, scheme, status, source, form.
 * Uses gameState as fallback when parameters are omitted.
 */
export function normalizeLogParams(
  entry: GameLogEntry,
  gameState?: GameState,
): Record<string, string | number | boolean> {
  const p = entry.params || {};

  const actorName = cleanCharacterName(entry.actor?.name);
  const paramWho = p.who !== undefined ? cleanCharacterName(String(p.who)) : undefined;
  const paramPlayer = p.player !== undefined ? cleanCharacterName(String(p.player)) : undefined;
  const paramActor = p.actor !== undefined ? cleanCharacterName(String(p.actor)) : undefined;

  const matchedPlayer =
    gameState?.players?.find(
      (pl) =>
        pl.name === actorName ||
        pl.hero?.name === actorName ||
        cleanCharacterName(pl.name) === actorName ||
        pl.name === paramWho ||
        pl.hero?.name === paramWho ||
        pl.name === paramPlayer ||
        pl.name === paramActor,
    ) || gameState?.players?.[0];

  const defaultHeroName =
    cleanCharacterName(matchedPlayer?.hero?.name || matchedPlayer?.name, matchedPlayer) || 'Hero';
  const defaultVillainName = gameState?.villain?.card?.name || 'Villain';
  const defaultMainSchemeName = gameState?.mainScheme?.card?.name || 'Main Scheme';

  // 1. Resolve 'who'
  let who =
    paramWho ??
    actorName ??
    (p.card !== undefined && entry.key?.startsWith('card.effect') ? String(p.card) : undefined) ??
    paramActor ??
    paramPlayer ??
    (p.hero !== undefined ? cleanCharacterName(String(p.hero)) : undefined) ??
    defaultHeroName;
  who = cleanCharacterName(who, matchedPlayer);

  // 2. Resolve 'who_attacks'
  const who_attacks =
    (p.who_attacks !== undefined ? String(p.who_attacks) : undefined) ??
    (p.attacker !== undefined ? String(p.attacker) : undefined) ??
    (entry.actor?.type === 'villain' || entry.actor?.type === 'minion'
      ? entry.actor.name
      : undefined) ??
    (entry.key?.startsWith('villain') ? defaultVillainName : undefined) ??
    actorName ??
    paramActor ??
    paramPlayer ??
    defaultHeroName;

  // 3. Resolve 'who_is_taking_damage' and 'target'
  const isHeroAttacking =
    entry.actor?.type === 'hero' ||
    entry.actor?.type === 'alter_ego' ||
    entry.key === 'BASIC_ATTACK' ||
    entry.key === 'DEAL_DAMAGE' ||
    entry.key === 'player.action.attackVillain';

  const isVillainAttacking =
    entry.actor?.type === 'villain' ||
    entry.actor?.type === 'minion' ||
    entry.key === 'VILLAIN_ATTACK' ||
    entry.key === 'MINION_ATTACK' ||
    entry.key?.startsWith('combat.');

  const isRecovering = entry.key === 'BASIC_RECOVER' || entry.key === 'HEAL_DAMAGE';

  let defaultTarget = 'Target';
  if (isRecovering) {
    defaultTarget = who;
  } else if (isHeroAttacking) {
    defaultTarget = defaultVillainName;
  } else if (isVillainAttacking) {
    defaultTarget = defaultHeroName;
  }

  const explicitTarget =
    (p.who_is_taking_damage !== undefined ? String(p.who_is_taking_damage) : undefined) ??
    (p.target !== undefined ? String(p.target) : undefined) ??
    (p.defender !== undefined ? String(p.defender) : undefined) ??
    (p.victim !== undefined ? String(p.victim) : undefined);

  let who_is_taking_damage = explicitTarget ?? defaultTarget;
  if (who_is_taking_damage.toUpperCase() === 'VILLAIN') {
    who_is_taking_damage = defaultVillainName;
  }

  let target = explicitTarget ?? defaultTarget;
  if (target.toUpperCase() === 'VILLAIN') {
    target = defaultVillainName;
  }

  // 4. Resolve 'who_defends'
  const who_defends =
    (p.who_defends !== undefined ? String(p.who_defends) : undefined) ??
    (p.defender !== undefined ? String(p.defender) : undefined) ??
    (p.hero !== undefined ? String(p.hero) : undefined) ??
    (p.ally !== undefined ? String(p.ally) : undefined) ??
    defaultHeroName;

  // 5. Resolve 'amount'
  let amount: string | number = 0;
  if (typeof p.amount === 'number' || typeof p.amount === 'string') amount = p.amount;
  else if (typeof p.damage === 'number' || typeof p.damage === 'string') amount = p.damage;
  else if (typeof p.threat === 'number' || typeof p.threat === 'string') amount = p.threat;
  else if (typeof p.recovery === 'number' || typeof p.recovery === 'string') amount = p.recovery;
  else if (typeof p.cost === 'number' || typeof p.cost === 'string') amount = p.cost;
  else if (typeof p.totalDamage === 'number' || typeof p.totalDamage === 'string')
    amount = p.totalDamage;
  else if (typeof p.boostIcons === 'number' || typeof p.boostIcons === 'string')
    amount = p.boostIcons;
  else if (typeof p.boost === 'number' || typeof p.boost === 'string') amount = p.boost;

  // 6. Resolve 'card'
  const card =
    (p.card !== undefined ? String(p.card) : undefined) ??
    (p.cardName !== undefined ? String(p.cardName) : undefined) ??
    (p.sourceCard !== undefined ? String(p.sourceCard) : undefined) ??
    (p.attachment !== undefined ? String(p.attachment) : undefined) ??
    'Card';

  // 7. Resolve 'scheme'
  const scheme =
    (p.scheme !== undefined ? String(p.scheme) : undefined) ??
    (p.mainScheme !== undefined ? String(p.mainScheme) : undefined) ??
    (p.sideScheme !== undefined ? String(p.sideScheme) : undefined) ??
    defaultMainSchemeName;

  // 8. Resolve 'status'
  const status =
    (p.status !== undefined ? String(p.status) : undefined) ??
    (p.condition !== undefined ? String(p.condition) : undefined) ??
    'Status';

  // 9. Resolve 'source'
  const source =
    (p.source !== undefined ? String(p.source) : undefined) ??
    (p.sourceCardName !== undefined ? String(p.sourceCardName) : undefined) ??
    (p.ability !== undefined ? String(p.ability) : undefined) ??
    'Source';

  // 10. Resolve 'form'
  const form =
    (p.form !== undefined ? String(p.form) : undefined) ??
    (p.newForm !== undefined ? String(p.newForm) : undefined) ??
    (entry.actor?.type === 'alter_ego' ? 'alter-ego' : 'hero');

  const normalized: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null) {
      normalized[k] = v;
    }
  }

  normalized.who = who;
  normalized.who_attacks = who_attacks;
  normalized.who_is_taking_damage = who_is_taking_damage;
  normalized.target = target;
  normalized.who_defends = who_defends;
  normalized.amount = amount;
  normalized.card = card;
  normalized.scheme = scheme;
  normalized.status = status;
  normalized.source = source;
  normalized.form = form;

  return normalized;
}

/**
 * Dynamically resolves comic color palette based on character role and GameState.
 */
export function resolveComicColors(
  dialogueType: ComicDialogueType,
  entry: GameLogEntry,
  normalizedParams: Record<string, string | number | boolean>,
  gameState?: GameState,
): {
  speakerColor: string;
  speakerContrastColor: string;
  speakerBorderColor: string;
} {
  // 1. Narrator Caption: Classic Stan Lee Gold Banner
  if (dialogueType === 'narrator_caption') {
    return {
      speakerColor: '#d97706',
      speakerContrastColor: '#0f172a',
      speakerBorderColor: '#b45309',
    };
  }

  // 2. Villain / Minion Actions
  if (dialogueType === 'villain_shout') {
    const rawVillainColors =
      (gameState?.villain?.card?.meta as { colors?: unknown } | undefined)?.colors ??
      (gameState?.villain?.card?.raw?.meta as { colors?: unknown } | undefined)?.colors;

    if (
      Array.isArray(rawVillainColors) &&
      rawVillainColors.length > 0 &&
      typeof rawVillainColors[0] === 'string'
    ) {
      const primary = rawVillainColors[0].trim();
      const secondary =
        rawVillainColors.length > 1 && typeof rawVillainColors[1] === 'string'
          ? rawVillainColors[1].trim()
          : '#d97706';
      return {
        speakerColor: primary,
        speakerContrastColor: getContrastTextColor(primary),
        speakerBorderColor: secondary,
      };
    }

    // Official Villain Card Back palette: deep burgundy, gold border, white text
    return {
      speakerColor: '#701a75',
      speakerContrastColor: '#ffffff',
      speakerBorderColor: '#d97706',
    };
  }

  // 3. Hero & Alter-Ego / Player Actions
  const actorName = entry.actor?.name;
  const whoName = normalizedParams.who ? String(normalizedParams.who) : undefined;
  const playerName = normalizedParams.player ? String(normalizedParams.player) : undefined;

  const matchedPlayer =
    gameState?.players?.find(
      (p) =>
        p.name === actorName ||
        p.hero?.name === actorName ||
        p.name === whoName ||
        p.hero?.name === whoName ||
        p.name === playerName,
    ) ?? gameState?.players?.[0];

  const palette = getHeroColorPalette(matchedPlayer);
  return {
    speakerColor: palette.primary,
    speakerContrastColor: palette.contrastText.primary,
    speakerBorderColor: palette.secondary || palette.accent || palette.primary,
  };
}

/**
 * Formats a GameLogEntry into an authentic, localized Comic Book Dialogue entry
 */
export function formatComicLogEntry(
  entry: GameLogEntry,
  locale: string = 'en',
  gameState?: GameState,
): FormattedComicDialogue {
  const dict = LOCALE_DICTIONARIES[locale] || enCombatLog;
  const dialogueType = classifyDialogueType(entry);
  const normalizedParams = normalizeLogParams(entry, gameState);
  const colors = resolveComicColors(dialogueType, entry, normalizedParams, gameState);

  const rawSpeakerName =
    entry.actor?.name ||
    (normalizedParams.who ? String(normalizedParams.who) : undefined) ||
    (normalizedParams.actor ? String(normalizedParams.actor) : undefined) ||
    (normalizedParams.villain ? String(normalizedParams.villain) : undefined) ||
    (normalizedParams.minion ? String(normalizedParams.minion) : undefined) ||
    (normalizedParams.player ? String(normalizedParams.player) : undefined) ||
    (normalizedParams.card ? String(normalizedParams.card) : undefined);

  const matchedPlayer =
    gameState?.players?.find(
      (pl) =>
        pl.name === rawSpeakerName ||
        pl.hero?.name === rawSpeakerName ||
        cleanCharacterName(pl.name) === rawSpeakerName,
    ) || gameState?.players?.[0];

  const speakerName = cleanCharacterName(rawSpeakerName, matchedPlayer);

  const speakerRole = entry.actor?.type;
  const speakerAvatar = getSpeakerAvatar(speakerName, speakerRole);
  const speakerKey = getSpeakerDialogueKey(speakerName);

  const canonicalKey = mapToCanonicalTemplateKey(entry.key, entry);

  // 1. Resolve Localized Onomatopoeia Badge
  let onomatopoeia = entry.onomatopoeia;
  if (onomatopoeia && dict.onomatopoeia) {
    const rawKey = onomatopoeia
      .replace(/[!💥⚡💀🦹✨]|🕷️|🛡️|⚠️/gu, '')
      .trim()
      .toUpperCase();
    if ((dict.onomatopoeia as Record<string, string>)[rawKey]) {
      onomatopoeia = (dict.onomatopoeia as Record<string, string>)[rawKey];
    }
  } else if (!onomatopoeia) {
    if (
      canonicalKey === 'DEAL_DAMAGE' ||
      entry.key === 'BASIC_ATTACK' ||
      entry.key === 'VILLAIN_ATTACK'
    )
      onomatopoeia = dict.onomatopoeia.POW;
    else if (canonicalKey === 'CARD_PLAYED') onomatopoeia = dict.onomatopoeia.ZAP;
    else if (canonicalKey === 'HEAL_DAMAGE') onomatopoeia = dict.onomatopoeia.HEAL;
    else if (canonicalKey === 'REMOVE_THREAT') onomatopoeia = dict.onomatopoeia.SWOOSH;
    else if (
      canonicalKey === 'HERO_DEFENDED' ||
      canonicalKey === 'ALLY_DEFENDED' ||
      entry.key === 'DAMAGE_PREVENTED'
    )
      onomatopoeia = dict.onomatopoeia.SHIELD;
    else if (canonicalKey === 'CHARACTER_DEFEATED') onomatopoeia = dict.onomatopoeia.DOOM;
    else if (
      canonicalKey === 'VILLAIN_PHASE_STEP1_THREAT' ||
      canonicalKey === 'VILLAIN_SCHEME_THREAT'
    )
      onomatopoeia = dict.onomatopoeia.ALERT;
  }

  // 2. Resolve Character Dialogue Quote
  let dialogueQuote: string | undefined;
  if (dialogueType === 'hero_speech') {
    if (canonicalKey === 'DEAL_DAMAGE' || entry.key === 'BASIC_ATTACK')
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'attack');
    else if (canonicalKey === 'REMOVE_THREAT' || entry.key === 'BASIC_THWART')
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'thwart');
    else if (canonicalKey === 'CARD_PLAYED')
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'play_card');
    else if (canonicalKey === 'HERO_DEFENDED')
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'defense');
  } else if (dialogueType === 'hero_thought') {
    dialogueQuote = getCharacterQuote(dict, speakerKey, 'recover');
  } else if (dialogueType === 'villain_shout') {
    if (
      canonicalKey === 'DEAL_DAMAGE' ||
      entry.key === 'VILLAIN_ATTACK' ||
      entry.key === 'MINION_ATTACK'
    ) {
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'attack');
    } else if (
      canonicalKey === 'VILLAIN_SCHEME_THREAT' ||
      entry.key === 'VILLAIN_SCHEME' ||
      entry.key === 'MINION_SCHEME'
    ) {
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'scheme');
    } else if (canonicalKey === 'BOOST_REVEALED') {
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'boost');
    }
  }

  // 3. Resolve Narrative Action Prose
  let narrativeAction = '';
  const templateKey = canonicalKey || entry.key;

  if (dialogueType === 'narrator_caption') {
    if (templateKey === 'ROUND_STARTED' || (entry.round !== undefined && !entry.key)) {
      narrativeAction = interpolateTemplate(dict.narrator.round_header, {
        round: entry.round ?? 1,
        ...normalizedParams,
      });
    } else if (templateKey === 'PHASE_CHANGED') {
      narrativeAction =
        normalizedParams.phase === GamePhase.PLAYER_PHASE
          ? dict.narrator.player_phase
          : dict.narrator.villain_phase;
    } else if (templateKey === 'GAME_STARTED') {
      narrativeAction = dict.narrator.game_started;
    } else if (templateKey === 'DECK_EXHAUSTED') {
      narrativeAction = interpolateTemplate(dict.narrator.deck_exhausted, normalizedParams);
    } else if (templateKey === 'ACCELERATION_TOKEN_ADDED') {
      narrativeAction = interpolateTemplate(dict.narrator.acceleration_added, normalizedParams);
    } else if (templateKey === 'MAIN_SCHEME_ADVANCED') {
      narrativeAction = interpolateTemplate(dict.narrator.main_scheme_advanced, normalizedParams);
    } else if (templateKey === 'SIDE_SCHEME_DEFEATED') {
      narrativeAction = interpolateTemplate(dict.narrator.side_scheme_defeated, normalizedParams);
    } else if (templateKey === 'MULLIGAN_RESOLVED') {
      narrativeAction = interpolateTemplate(dict.narrator.mulligan_resolved, normalizedParams);
    } else if (templateKey === 'FIRST_PLAYER_PASSED') {
      narrativeAction = interpolateTemplate(dict.narrator.first_player_passed, normalizedParams);
    }
  }

  if (!narrativeAction && templateKey && (dict.templates as Record<string, string>)[templateKey]) {
    narrativeAction = interpolateTemplate(
      (dict.templates as Record<string, string>)[templateKey],
      normalizedParams,
    );
  }

  if (!narrativeAction && entry.key && (dict.templates as Record<string, string>)[entry.key]) {
    narrativeAction = interpolateTemplate(
      (dict.templates as Record<string, string>)[entry.key],
      normalizedParams,
    );
  }

  // Fallback to entry.text or hierarchical key formatting if no template matched
  if (!narrativeAction) {
    if (entry.text) {
      narrativeAction = entry.text;
    } else if (entry.key) {
      narrativeAction = formatHierarchicalLogKey(entry.key, entry);
    }
  }

  // 4. Extract Structured Stats for Badges
  const stats: FormattedComicDialogue['stats'] = {};
  if (typeof normalizedParams.damage === 'number') stats.damage = Number(normalizedParams.damage);
  else if (
    typeof normalizedParams.amount === 'number' &&
    (canonicalKey === 'DEAL_DAMAGE' || entry.key === 'BASIC_ATTACK')
  )
    stats.damage = Number(normalizedParams.amount);

  if (typeof normalizedParams.threat === 'number') stats.threat = Number(normalizedParams.threat);
  else if (
    typeof normalizedParams.amount === 'number' &&
    (canonicalKey === 'REMOVE_THREAT' ||
      canonicalKey === 'VILLAIN_PHASE_STEP1_THREAT' ||
      canonicalKey === 'VILLAIN_SCHEME_THREAT')
  )
    stats.threat = Number(normalizedParams.amount);

  if (typeof normalizedParams.recovery === 'number')
    stats.recovery = Number(normalizedParams.recovery);
  else if (typeof normalizedParams.amount === 'number' && canonicalKey === 'HEAL_DAMAGE')
    stats.recovery = Number(normalizedParams.amount);

  if (typeof normalizedParams.cost === 'number') stats.cost = Number(normalizedParams.cost);
  if (typeof normalizedParams.remainingHp === 'number')
    stats.remainingHp = Number(normalizedParams.remainingHp);

  return {
    id: entry.id || String(entry.timestamp || Math.random()),
    type: dialogueType,
    speakerName,
    speakerRole,
    speakerAvatar,
    speakerColor: colors.speakerColor,
    speakerContrastColor: colors.speakerContrastColor,
    speakerBorderColor: colors.speakerBorderColor,
    dialogueQuote,
    narrativeAction,
    onomatopoeia,
    stats,
    phase: entry.phase,
    round: entry.round,
    timestamp: entry.timestamp,
    rawEntry: entry,
  };
}
