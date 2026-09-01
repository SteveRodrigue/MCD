import { describe, it, expect } from 'vitest';
import {
  formatComicLogEntry,
  classifyDialogueType,
  interpolateTemplate,
  getSpeakerAvatar,
} from '../../src/ui/utils/comic-log-formatter';
import { GameLogEntry, GamePhase } from '../../src/engine/models';

describe('Comic Log Formatter & Dialogue Engine (ADR-0005, ADR-0009, ADR-0037)', () => {
  it('correctly classifies dialogue types based on actor and action category', () => {
    // 1. Hero Speech
    const heroAttackEntry: GameLogEntry = {
      id: 'log-1',
      timestamp: Date.now(),
      key: 'BASIC_ATTACK',
      actor: { name: 'Spider-Man', type: 'hero' },
      params: { actor: 'Spider-Man', target: 'Rhino', damage: 2 },
    };
    expect(classifyDialogueType(heroAttackEntry)).toBe('hero_speech');

    // 2. Hero Thought (Alter-Ego Recovery)
    const alterEgoRecoverEntry: GameLogEntry = {
      id: 'log-2',
      timestamp: Date.now(),
      key: 'BASIC_RECOVER',
      actor: { name: 'Peter Parker', type: 'alter_ego' },
      params: { actor: 'Peter Parker', recovery: 3 },
    };
    expect(classifyDialogueType(alterEgoRecoverEntry)).toBe('hero_thought');

    // 3. Villain Shout
    const villainAttackEntry: GameLogEntry = {
      id: 'log-3',
      timestamp: Date.now(),
      key: 'VILLAIN_ATTACK',
      actor: { name: 'Rhino', type: 'villain' },
      params: { villain: 'Rhino', target: 'Spider-Man', totalDamage: 4 },
    };
    expect(classifyDialogueType(villainAttackEntry)).toBe('villain_shout');

    // 4. Narrator Caption (Game Engine Transition)
    const roundStartedEntry: GameLogEntry = {
      id: 'log-4',
      timestamp: Date.now(),
      key: 'ROUND_STARTED',
      round: 2,
    };
    expect(classifyDialogueType(roundStartedEntry)).toBe('narrator_caption');
  });

  it('interpolates template parameters accurately', () => {
    const template = '{{actor}} strikes {{target}} for {{damage}} damage!';
    const result = interpolateTemplate(template, {
      actor: 'Spider-Man',
      target: 'Rhino',
      damage: 8,
    });
    expect(result).toBe('Spider-Man strikes Rhino for 8 damage!');
  });

  it('resolves appropriate speaker avatars for Marvel characters', () => {
    expect(getSpeakerAvatar('Spider-Man', 'hero')).toBe('🕷️');
    expect(getSpeakerAvatar('Peter Parker', 'alter_ego')).toBe('📷');
    expect(getSpeakerAvatar('Captain Marvel', 'hero')).toBe('✨');
    expect(getSpeakerAvatar('Iron Man', 'hero')).toBe('⚡');
    expect(getSpeakerAvatar('Black Panther', 'hero')).toBe('🐾');
    expect(getSpeakerAvatar('Rhino', 'villain')).toBe('🦏');
    expect(getSpeakerAvatar('Klaw', 'villain')).toBe('📡');
    expect(getSpeakerAvatar('Ultron', 'villain')).toBe('🤖');
  });

  it('formats Hero attacks with onomatopoeia, character quotes, and stats (English)', () => {
    const entry: GameLogEntry = {
      id: 'log-100',
      timestamp: 1000,
      round: 1,
      phase: GamePhase.PLAYER_PHASE,
      key: 'BASIC_ATTACK',
      actor: { name: 'Spider-Man', type: 'hero' },
      params: { actor: 'Spider-Man', target: 'Rhino', damage: 2, remainingHp: 12 },
    };

    const formatted = formatComicLogEntry(entry, 'en');
    expect(formatted.type).toBe('hero_speech');
    expect(formatted.speakerName).toBe('Spider-Man');
    expect(formatted.speakerAvatar).toBe('🕷️');
    expect(formatted.onomatopoeia).toBe('💥 POW!');
    expect(formatted.dialogueQuote).toBeDefined();
    expect(formatted.narrativeAction).toBe('Spider-Man strikes Rhino for 2 damage!');
    expect(formatted.stats?.damage).toBe(2);
  });

  it('formats Hero attacks in French locale with translated narrative & onomatopoeia', () => {
    const entry: GameLogEntry = {
      id: 'log-101',
      timestamp: 1001,
      round: 1,
      phase: GamePhase.PLAYER_PHASE,
      key: 'BASIC_ATTACK',
      actor: { name: 'Spider-Man', type: 'hero' },
      params: { actor: 'Spider-Man', target: 'Rhino', damage: 8, remainingHp: 6 },
    };

    const formatted = formatComicLogEntry(entry, 'fr');
    expect(formatted.type).toBe('hero_speech');
    expect(formatted.onomatopoeia).toBe('💥 VLAM !');
    expect(formatted.narrativeAction).toBe('Spider-Man frappe Rhino et inflige 8 dégâts !');
    expect(formatted.stats?.damage).toBe(8);
  });

  it('formats Villain attacks with jagged shout dialogue and stats', () => {
    const entry: GameLogEntry = {
      id: 'log-200',
      timestamp: 2000,
      round: 1,
      phase: GamePhase.VILLAIN_PHASE,
      key: 'VILLAIN_ATTACK',
      actor: { name: 'Rhino', type: 'villain' },
      params: { villain: 'Rhino', target: 'Spider-Man', baseAtk: 2, boost: 1, totalDamage: 3 },
    };

    const formatted = formatComicLogEntry(entry, 'en');
    expect(formatted.type).toBe('villain_shout');
    expect(formatted.speakerName).toBe('Rhino');
    expect(formatted.speakerAvatar).toBe('🦏');
    expect(formatted.dialogueQuote).toBe("I'M GONNA CRUSH YOU FLAT, BUG!");
    expect(formatted.narrativeAction).toContain('Rhino attacks Spider-Man!');
  });

  it('formats Narrator phase transitions and deck exhaustion', () => {
    const deckExhaustEntry: GameLogEntry = {
      id: 'log-300',
      timestamp: 3000,
      round: 3,
      key: 'DECK_EXHAUSTED',
      params: { deckType: 'Encounter' },
    };

    const formatted = formatComicLogEntry(deckExhaustEntry, 'en');
    expect(formatted.type).toBe('narrator_caption');
    expect(formatted.narrativeAction).toContain('The Encounter deck runs completely dry!');
  });
});
