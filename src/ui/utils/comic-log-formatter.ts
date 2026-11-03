/**
 * Marvel Champions Digital - Comic Book Log & Dialogue Formatter
 * Implements ADR-0005 & ADR-0009 / ADR-0037: Localized Comic Narrative & Dialogue Engine
 */

import {
  GameLogEntry,
  GamePhase,
  GameState,
  PlayerState,
  getActiveVillain,
  getActiveMainScheme,
} from '../../engine/models';
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
  sourceCard?: string;
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
function cleanCharacterName(name?: string, player?: any): string {
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
 * The player whose turn it was when the entry was written. Entries outside the player phase have
 * none, so a villain-phase line is never named after the first player.
 */
function turnPlayerOf(entry: GameLogEntry, gameState?: GameState): PlayerState | undefined {
  return entry.turnPlayerId
    ? gameState?.players?.find((pl) => pl.id === entry.turnPlayerId)
    : undefined;
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
    if (speakerRole === 'ally') return '🤝';
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
  if (speakerRole === 'ally') return '🤝';
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

  // 1. Omniscient Narrator / Game engine flow
  if (
    key.startsWith('phase.') ||
    key.startsWith('round.') ||
    key.startsWith('game.setup') ||
    key.startsWith('scenario.setup') ||
    key.startsWith('villainPhase.step1') ||
    key.startsWith('villainPhase.step3') ||
    key === 'first_player.passed' ||
    key === 'ROUND_STARTED' ||
    key === 'deck_exhausted' ||
    key.startsWith('scheme.threat.')
  ) {
    return 'narrator_caption';
  }

  // 2. Villain & Minions -> villain_shout
  if (
    actorType === 'villain' ||
    actorType === 'minion' ||
    key.startsWith('VILLAIN_') ||
    key.startsWith('MINION_') ||
    key.startsWith('villain.') ||
    key.startsWith('minion.') ||
    key.startsWith('encounter.') ||
    key === 'BOOST_REVEALED' ||
    key === 'TREACHERY_SURGED' ||
    key === 'combat.attack.undefended' ||
    key === 'ATTACK_UNDEFENDED' ||
    key === 'SIDE_SCHEME_REVEALED' ||
    key === 'SIDE_SCHEME_DEFEATED' ||
    key.startsWith('side_scheme.') ||
    key.startsWith('attachment.')
  ) {
    return 'villain_shout';
  }

  // 3. Alter-Ego / Planning / Recovery -> hero_thought
  if (
    actorType === 'alter_ego' ||
    key === 'BASIC_RECOVER' ||
    key === 'RESOURCE_GENERATED' ||
    key === 'player.action.recover'
  ) {
    return 'hero_thought';
  }

  // 4. Hero & Allies -> hero_speech
  if (
    actorType === 'hero' ||
    actorType === 'ally' ||
    key.startsWith('player.') ||
    key.startsWith('combat.hero.') ||
    key.startsWith('combat.ally.') ||
    key.startsWith('ability.') ||
    key.startsWith('decision.prompt.') ||
    key.startsWith('damage.applied.') ||
    key.startsWith('damage.prevented.') ||
    key.startsWith('cost.') ||
    key.startsWith('card.effect') ||
    key === 'BASIC_ATTACK' ||
    key === 'BASIC_THWART' ||
    key === 'CARD_PLAYED' ||
    key === 'HERO_ABILITY_TRIGGERED' ||
    key === 'ALLY_ENTERED' ||
    key === 'RETALIATE_DAMAGE' ||
    key === 'card.state.exhausted' ||
    key === 'card.discarded.fromDeck' ||
    key === 'card.discarded.fromHand' ||
    key === 'card.searched.selected' ||
    key === 'ally.defeated' ||
    key === 'damage.transferred'
  ) {
    return 'hero_speech';
  }

  // 5. Omniscient Game Narrator fallback
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
  const params = (entry.params || {}) as Record<string, any>;

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
      (params.actor ? String(params.actor) : undefined) ||
      (params.minion ? String(params.minion) : undefined) ||
      (entry.actor?.type === 'minion' ? entry.actor.name : undefined) ||
      'Minion';
    return `${minionName}: ${remainder}`;
  }

  if (key.startsWith('attachment.')) {
    const remainder = key.slice(11);
    const attachmentName =
      (params.card ? String(params.card) : undefined) ||
      (params.attachment ? String(params.attachment) : undefined) ||
      'Attachment';
    return `${attachmentName}: ${remainder}`;
  }

  if (key.startsWith('identity.')) {
    const remainder = key.slice(9);
    const idName =
      (params.actor ? String(params.actor) : undefined) ||
      (params.hero ? String(params.hero) : undefined) ||
      entry.actor?.name ||
      'Identity';
    return `${idName}: ${remainder}`;
  }

  if (key.startsWith('scheme.')) {
    const remainder = key.slice(7);
    const schemeName =
      (params.card ? String(params.card) : undefined) ||
      (params.target ? String(params.target) : undefined) ||
      (params.scheme ? String(params.scheme) : undefined) ||
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
function mapToCanonicalTemplateKey(key?: string, entry?: GameLogEntry): string | undefined {
  if (!key) return undefined;

  switch (key) {
    case 'DEAL_DAMAGE':
    case 'player.action.attackVillain':
      return 'DEAL_DAMAGE';

    case 'damage.applied.villain':
    case 'damage.applied.minion':
    case 'damage.applied.ally':
    case 'damage.applied.player':
      return entry?.params?.source ? 'DAMAGE_APPLIED' : 'DAMAGE_APPLIED_UNSOURCED';

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
      if (entry?.params?.isImmune) return 'STATUS_IMMUNE';
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

    case 'card.attached.to_host':
    case 'UPGRADE_ATTACHED':
      return 'UPGRADE_ATTACHED';

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

    case 'side_scheme.defeated':
    case 'SIDE_SCHEME_DEFEATED':
      return 'SIDE_SCHEME_DEFEATED';

    case 'villain.attack.hit':
    case 'VILLAIN_ATTACK_HIT':
      return 'VILLAIN_ATTACK_HIT';

    case 'minion.attack.hit':
    case 'MINION_ATTACK_HIT':
      return 'MINION_ATTACK_HIT';

    case 'card.discarded.fromDeck':
    case 'card.discarded.fromHand':
    case 'CARDS_DISCARDED_NAMES':
      return 'CARDS_DISCARDED_NAMES';

    case 'card.effect.drawCards':
    case 'CARDS_DRAWN_NAMES':
      if (entry?.params?.source && entry.params.source !== 'deck') {
        return 'CARDS_DRAWN_FROM_SOURCE';
      }
      return 'CARDS_DRAWN_NAMES';

    case 'black_cat.fetch':
    case 'BLACK_CAT_FETCH':
      return 'BLACK_CAT_FETCH';

    case 'player.tableau.discarded':
    case 'PLAYER_TABLEAU_DISCARDED':
      return 'PLAYER_TABLEAU_DISCARDED';

    default:
      return key;
  }
}

/**
 * Locates the player associated with a speaker, character, card, or log entry.
 */
export function findPlayerForSpeakerOrEntry(
  speakerName: string | undefined,
  entry: GameLogEntry,
  gameState?: GameState,
): PlayerState | undefined {
  if (!gameState?.players?.length) return undefined;

  const params = (entry.params || {}) as Record<string, any>;
  const cleanSpeaker = cleanCharacterName(speakerName);
  const cleanActor = cleanCharacterName(
    entry.actor?.name || (params.actor !== undefined ? String(params.actor) : undefined),
  );
  const cleanPlayerParam = cleanCharacterName(
    params.player !== undefined ? String(params.player) : undefined,
  );
  const cardName = params.card !== undefined ? String(params.card) : undefined;
  const candidates = [cleanSpeaker, cleanActor, cleanPlayerParam, cardName].filter(
    Boolean,
  ) as string[];

  // 1. Direct match on player name, hero name, alter-ego name
  for (const candidate of candidates) {
    const matched = gameState.players.find(
      (p) =>
        p.name === candidate ||
        p.hero?.name === candidate ||
        p.alterEgo?.name === candidate ||
        cleanCharacterName(p.name) === candidate,
    );
    if (matched) return matched;
  }

  // 2. Controlled card match: ally, tableau, discard, hand, or deck
  for (const candidate of candidates) {
    const matched = gameState.players.find(
      (p) =>
        p.allies?.some((a) => a.card?.name === candidate) ||
        p.tableau?.some((t) => t.card?.name === candidate) ||
        p.discard?.some((d) => d.card?.name === candidate) ||
        p.hand?.some((h) => h.card?.name === candidate) ||
        p.deck?.some((d) => d.card?.name === candidate),
    );
    if (matched) return matched;
  }

  // 3. Fallback to turn player
  return turnPlayerOf(entry, gameState);
}

/**
 * Resolves the speaker name, speaker role, and matched player for a dialogue entry.
 */
export function resolveSpeakerInfo(
  dialogueType: ComicDialogueType,
  entry: GameLogEntry,
  gameState?: GameState,
): {
  speakerName?: string;
  speakerRole?: FormattedComicDialogue['speakerRole'];
  matchedPlayer?: PlayerState;
} {
  // Pure narrator captions do not have a character speaker unless explicitly given in entry.actor
  if (dialogueType === 'narrator_caption') {
    if (entry.actor?.name) {
      const matchedPlayer = findPlayerForSpeakerOrEntry(entry.actor.name, entry, gameState);
      return {
        speakerName: cleanCharacterName(entry.actor.name, matchedPlayer),
        speakerRole: entry.actor.type,
        matchedPlayer,
      };
    }
    return {
      speakerName: undefined,
      speakerRole: undefined,
      matchedPlayer: undefined,
    };
  }

  const params = (entry.params || {}) as Record<string, any>;
  const turnPlayer = turnPlayerOf(entry, gameState);

  let rawSpeakerName: string | undefined;
  if (entry.actor?.name) {
    rawSpeakerName = entry.actor.name;
  } else if (params.actor !== undefined) {
    rawSpeakerName = String(params.actor);
  } else if (params.who !== undefined) {
    rawSpeakerName = String(params.who);
  } else if (
    (entry.key === 'card.state.exhausted' ||
      entry.key === 'ally.defeated' ||
      entry.key === 'damage.applied.ally') &&
    (params.card !== undefined || params.target !== undefined)
  ) {
    rawSpeakerName = params.card !== undefined ? String(params.card) : String(params.target);
  } else if (params.player !== undefined) {
    rawSpeakerName = String(params.player);
  } else if (dialogueType === 'hero_speech' || dialogueType === 'hero_thought') {
    rawSpeakerName = turnPlayer?.name;
  }

  const matchedPlayer = findPlayerForSpeakerOrEntry(rawSpeakerName, entry, gameState);
  const speakerName = cleanCharacterName(rawSpeakerName, matchedPlayer);

  let speakerRole: FormattedComicDialogue['speakerRole'] = entry.actor?.type;
  if (!speakerRole) {
    if (dialogueType === 'villain_shout') {
      const isMinion =
        params.minion !== undefined ||
        (gameState?.villains?.every((v) => v.card?.name !== speakerName) &&
          gameState?.players?.some((p) =>
            p.engagedMinions?.some((m) => m.card?.name === speakerName),
          ));
      speakerRole = isMinion ? 'minion' : 'villain';
    } else if (dialogueType === 'hero_thought') {
      speakerRole = 'alter_ego';
    } else if (dialogueType === 'hero_speech') {
      const isAlly =
        entry.key?.startsWith('combat.ally.') ||
        entry.key === 'ally.defeated' ||
        params.ally !== undefined ||
        gameState?.players?.some((p) => p.allies?.some((a) => a.card?.name === speakerName));
      speakerRole = isAlly ? 'ally' : 'hero';
    }
  }

  return { speakerName, speakerRole, matchedPlayer };
}

/**
 * Normalizes log entry parameters into canonical placeholder tokens:
 * actor, target, amount, card, scheme, status, source, form.
 * Uses gameState as fallback when parameters are omitted.
 */
function normalizeLogParams(
  entry: GameLogEntry,
  gameState?: GameState,
  matchedPlayerParam?: PlayerState,
): Record<string, string | number | boolean> {
  const p = (entry.params || {}) as Record<string, any>;

  const matchedPlayer =
    matchedPlayerParam || findPlayerForSpeakerOrEntry(undefined, entry, gameState);

  const defaultHeroName =
    cleanCharacterName(matchedPlayer?.hero?.name || matchedPlayer?.name, matchedPlayer) || 'Hero';
  const defaultVillainName =
    (gameState?.villains.length ? getActiveVillain(gameState) : undefined)?.card?.name || 'Villain';
  const defaultMainSchemeName =
    (gameState?.mainSchemes.length ? getActiveMainScheme(gameState) : undefined)?.card?.name ||
    'Main Scheme';

  const isDefenseKey =
    entry.key === 'HERO_DEFENDED' ||
    entry.key === 'ALLY_DEFENDED' ||
    entry.key?.startsWith('combat.hero.defended') ||
    entry.key?.startsWith('combat.ally.defended');

  // 1. Resolve canonical 'actor'
  const rawActor =
    p.actor !== undefined
      ? p.actor
      : isDefenseKey
        ? (entry.actor?.name ?? defaultHeroName)
        : (entry.actor?.name ?? p.player ?? defaultHeroName);
  const actor = cleanCharacterName(String(rawActor));

  // 2. Resolve canonical 'target'
  const rawTarget =
    p.target !== undefined
      ? p.target
      : entry.actor?.type === 'villain' || entry.actor?.type === 'minion'
        ? defaultHeroName
        : defaultVillainName;
  let target = String(rawTarget);
  if (target.toUpperCase() === 'VILLAIN') {
    target = defaultVillainName;
  }

  // 3. Resolve canonical 'card'
  const rawCard =
    p.card !== undefined
      ? p.card
      : (p.cardName ?? p.upgrade ?? p.attachment ?? p.sourceCard ?? 'Card');
  const card = String(rawCard);

  // 4. Resolve canonical 'amount'
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

  // 5. Resolve canonical 'source'
  const rawSource = p.source !== undefined ? p.source : (p.ability ?? p.sourceCardName ?? 'Source');
  const source = String(rawSource);

  // Additional fields
  const scheme =
    p.scheme !== undefined
      ? String(p.scheme)
      : p.mainScheme !== undefined
        ? String(p.mainScheme)
        : p.sideScheme !== undefined
          ? String(p.sideScheme)
          : p.target !== undefined
            ? String(p.target)
            : p.card !== undefined
              ? String(p.card)
              : defaultMainSchemeName;

  const status = p.status !== undefined ? String(p.status) : 'Status';
  const form =
    p.form !== undefined
      ? String(p.form)
      : p.newForm !== undefined
        ? String(p.newForm)
        : entry.actor?.type === 'alter_ego'
          ? 'alter-ego'
          : 'hero';

  // Format card arrays into comma-separated strings
  let cardsStr = '';
  if (Array.isArray(p.cards)) {
    cardsStr = p.cards
      .map((c: any) => (typeof c === 'string' ? c : c?.name || c?.card?.name || String(c)))
      .join(', ');
  } else if (typeof p.cards === 'string') {
    cardsStr = p.cards;
  } else if (Array.isArray(p.discardedCards)) {
    cardsStr = p.discardedCards
      .map((c: any) => (typeof c === 'string' ? c : c?.name || c?.card?.name || String(c)))
      .join(', ');
  } else if (Array.isArray(p.drawnCards)) {
    cardsStr = p.drawnCards
      .map((c: any) => (typeof c === 'string' ? c : c?.name || c?.card?.name || String(c)))
      .join(', ');
  } else if (p.card !== undefined) {
    cardsStr = String(p.card);
  }

  const normalized: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null) {
      if (Array.isArray(v)) {
        normalized[k] = v
          .map((item: any) =>
            typeof item === 'string' ? item : item?.name || item?.card?.name || String(item),
          )
          .join(', ');
      } else {
        normalized[k] = v as any;
      }
    }
  }

  // Set canonical roles
  normalized.actor = actor;
  normalized.target = target;
  normalized.card = card;
  normalized.amount = amount;
  normalized.source = source;

  normalized.scheme = scheme;
  normalized.status = status;
  normalized.form = form;
  if (cardsStr) {
    normalized.cards = cardsStr;
  }
  if (normalized.count === undefined) {
    if (Array.isArray(p.cards)) normalized.count = p.cards.length;
    else if (Array.isArray(p.discardedCards)) normalized.count = p.discardedCards.length;
    else if (Array.isArray(p.drawnCards)) normalized.count = p.drawnCards.length;
    else if (p.amount !== undefined) normalized.count = amount;
  }

  return normalized;
}

/**
 * Dynamically resolves comic color palette based on character role and GameState.
 */
function resolveComicColors(
  dialogueType: ComicDialogueType,
  gameState?: GameState,
  matchedPlayer?: PlayerState,
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
      (
        (gameState ? getActiveVillain(gameState) : undefined)?.card?.meta as
          { colors?: unknown } | undefined
      )?.colors ??
      (
        (gameState ? getActiveVillain(gameState) : undefined)?.card?.raw?.meta as
          { colors?: unknown } | undefined
      )?.colors;

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
  const { speakerName, speakerRole, matchedPlayer } = resolveSpeakerInfo(
    dialogueType,
    entry,
    gameState,
  );
  const normalizedParams = normalizeLogParams(entry, gameState, matchedPlayer);
  const colors = resolveComicColors(dialogueType, gameState, matchedPlayer);

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
      canonicalKey === 'VILLAIN_ATTACK_HIT' ||
      canonicalKey === 'MINION_ATTACK_HIT' ||
      entry.key === 'BASIC_ATTACK'
    )
      onomatopoeia = dict.onomatopoeia.POW;
    else if (canonicalKey === 'CARD_PLAYED' || canonicalKey === 'BLACK_CAT_FETCH')
      onomatopoeia = dict.onomatopoeia.ZAP;
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
      canonicalKey === 'VILLAIN_ATTACK_HIT' ||
      entry.key === 'MINION_ATTACK'
    ) {
      dialogueQuote = getCharacterQuote(dict, speakerKey, 'attack');
    } else if (canonicalKey === 'VILLAIN_SCHEME_THREAT' || entry.key === 'MINION_SCHEME') {
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
    (canonicalKey === 'DEAL_DAMAGE' ||
      canonicalKey === 'VILLAIN_ATTACK_HIT' ||
      canonicalKey === 'MINION_ATTACK_HIT' ||
      entry.key === 'BASIC_ATTACK')
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

  const sourceCard =
    normalizedParams.source !== 'Source' && normalizedParams.source !== 'deck'
      ? String(normalizedParams.source)
      : undefined;

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
    sourceCard,
    stats,
    phase: entry.phase,
    round: entry.round,
    timestamp: entry.timestamp,
    rawEntry: entry,
  };
}
