/**
 * Marvel Champions Digital - Comic Book Log & Dialogue Formatter
 * Implements ADR-0005 & ADR-0009 / ADR-0037: Localized Comic Narrative & Dialogue Engine
 */

import { GameLogEntry, GamePhase } from '../../engine/models';
import enCombatLog from '../../locales/en/combat-log.json';
import frCombatLog from '../../locales/fr/combat-log.json';

export type ComicDialogueType =
  | 'hero_speech'
  | 'hero_thought'
  | 'villain_shout'
  | 'narrator_caption';

export interface FormattedComicDialogue {
  id: string;
  type: ComicDialogueType;
  speakerName?: string;
  speakerRole?: 'hero' | 'alter_ego' | 'villain' | 'minion' | 'ally' | 'environment';
  speakerAvatar?: string;
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
  if (name.includes('t\'challa') || name.includes('tchalla')) return '👑';
  if (name.includes('rhino')) return '🦏';
  if (name.includes('klaw')) return '📡';
  if (name.includes('ultron')) return '🤖';
  if (name.includes('hydra')) return '🐙';
  if (name.includes('armored')) return '🛡️';
  if (name.includes('shuri') || name.includes('vision') || name.includes('hellcat')) return '🤝';

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
  params: Record<string, string | number | boolean> = {}
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
  if (
    actorType === 'alter_ego' ||
    key === 'BASIC_RECOVER' ||
    key === 'RESOURCE_GENERATED'
  ) {
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
    key === 'ALLY_ENTERED'
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
  context: 'attack' | 'thwart' | 'recover' | 'defense' | 'play_card' | 'scheme' | 'boost'
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
 * Formats a GameLogEntry into an authentic, localized Comic Book Dialogue entry
 */
export function formatComicLogEntry(
  entry: GameLogEntry,
  locale: string = 'en'
): FormattedComicDialogue {
  const dict = LOCALE_DICTIONARIES[locale] || enCombatLog;
  const dialogueType = classifyDialogueType(entry);
  const params = entry.params || {};

  const speakerName =
    entry.actor?.name ||
    (params.actor ? String(params.actor) : undefined) ||
    (params.villain ? String(params.villain) : undefined) ||
    (params.minion ? String(params.minion) : undefined) ||
    (params.player ? String(params.player) : undefined);

  const speakerRole = entry.actor?.type;
  const speakerAvatar = getSpeakerAvatar(speakerName, speakerRole);
  const speakerKey = getSpeakerDialogueKey(speakerName);

  // 1. Resolve Localized Onomatopoeia Badge
  let onomatopoeia = entry.onomatopoeia;
  if (onomatopoeia && dict.onomatopoeia) {
    const rawKey = onomatopoeia.replace(/[!💥⚡🕷️🛡️💨💀⚠️🦹✨]/g, '').trim().toUpperCase();
    if ((dict.onomatopoeia as Record<string, string>)[rawKey]) {
      onomatopoeia = (dict.onomatopoeia as Record<string, string>)[rawKey];
    }
  } else if (!onomatopoeia) {
    if (entry.key === 'BASIC_ATTACK' || entry.key === 'VILLAIN_ATTACK') onomatopoeia = dict.onomatopoeia.POW;
    else if (entry.key === 'CARD_PLAYED') onomatopoeia = dict.onomatopoeia.ZAP;
    else if (entry.key === 'BASIC_RECOVER') onomatopoeia = dict.onomatopoeia.HEAL;
    else if (entry.key === 'BASIC_THWART') onomatopoeia = dict.onomatopoeia.SWOOSH;
    else if (entry.key === 'DAMAGE_PREVENTED') onomatopoeia = dict.onomatopoeia.SHIELD;
    else if (entry.key === 'CHARACTER_DEFEATED') onomatopoeia = dict.onomatopoeia.DOOM;
  }

  // 2. Resolve Character Dialogue Quote
  let dialogueQuote: string | undefined;
  if (dialogueType === 'hero_speech') {
    if (entry.key === 'BASIC_ATTACK') dialogueQuote = getCharacterQuote(dict, speakerKey, 'attack');
    else if (entry.key === 'BASIC_THWART') dialogueQuote = getCharacterQuote(dict, speakerKey, 'thwart');
    else if (entry.key === 'CARD_PLAYED') dialogueQuote = getCharacterQuote(dict, speakerKey, 'play_card');
  } else if (dialogueType === 'hero_thought') {
    dialogueQuote = getCharacterQuote(dict, speakerKey, 'recover');
  } else if (dialogueType === 'villain_shout') {
    if (entry.key === 'VILLAIN_ATTACK' || entry.key === 'MINION_ATTACK') {
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'attack');
    } else if (entry.key === 'VILLAIN_SCHEME' || entry.key === 'MINION_SCHEME') {
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'scheme');
    } else if (entry.key === 'BOOST_REVEALED') {
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'boost');
    }
  }

  // 3. Resolve Narrative Action Prose
  let narrativeAction = '';
  const templateKey = entry.key;

  if (dialogueType === 'narrator_caption') {
    if (templateKey === 'ROUND_STARTED' || entry.round !== undefined && !templateKey) {
      narrativeAction = interpolateTemplate(dict.narrator.round_header, { round: entry.round ?? 1, ...params });
    } else if (templateKey === 'PHASE_CHANGED') {
      narrativeAction =
        params.phase === GamePhase.PLAYER_PHASE
          ? dict.narrator.player_phase
          : dict.narrator.villain_phase;
    } else if (templateKey === 'GAME_STARTED') {
      narrativeAction = dict.narrator.game_started;
    } else if (templateKey === 'DECK_EXHAUSTED') {
      narrativeAction = interpolateTemplate(dict.narrator.deck_exhausted, params);
    } else if (templateKey === 'ACCELERATION_TOKEN_ADDED') {
      narrativeAction = interpolateTemplate(dict.narrator.acceleration_added, params);
    } else if (templateKey === 'MAIN_SCHEME_ADVANCED') {
      narrativeAction = interpolateTemplate(dict.narrator.main_scheme_advanced, params);
    } else if (templateKey === 'SIDE_SCHEME_DEFEATED') {
      narrativeAction = interpolateTemplate(dict.narrator.side_scheme_defeated, params);
    } else if (templateKey === 'MULLIGAN_RESOLVED') {
      narrativeAction = interpolateTemplate(dict.narrator.mulligan_resolved, params);
    } else if (templateKey === 'FIRST_PLAYER_PASSED') {
      narrativeAction = interpolateTemplate(dict.narrator.first_player_passed, params);
    }
  }

  if (!narrativeAction && (dict.templates as Record<string, string>)[templateKey]) {
    narrativeAction = interpolateTemplate((dict.templates as Record<string, string>)[templateKey], params);
  }

  // Fallback to entry.text or raw key if no template matched
  if (!narrativeAction) {
    narrativeAction = entry.text || templateKey.replace(/_/g, ' ');
  }

  // 4. Extract Structured Stats for Badges
  const stats: FormattedComicDialogue['stats'] = {};
  if (typeof params.damage === 'number') stats.damage = params.damage;
  if (typeof params.threat === 'number') stats.threat = params.threat;
  if (typeof params.recovery === 'number') stats.recovery = params.recovery;
  if (typeof params.cost === 'number') stats.cost = params.cost;
  if (typeof params.remainingHp === 'number') stats.remainingHp = params.remainingHp;

  return {
    id: entry.id || String(entry.timestamp || Math.random()),
    type: dialogueType,
    speakerName,
    speakerRole,
    speakerAvatar,
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
