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

  it('formats unmapped card.* keys with card.name: remainder (e.g. card.attachment.attached)', () => {
    const cardEffectEntry: GameLogEntry = {
      id: 'log-400',
      timestamp: 4000,
      round: 1,
      key: 'card.attachment.attached',
      actor: { name: 'Tony Stark', type: 'hero' },
      params: { card: 'Arc Reactor', target: 'Iron Man' },
    };

    const formatted = formatComicLogEntry(cardEffectEntry, 'en');
    expect(formatted.narrativeAction).toBe('Arc Reactor: attachment.attached');
  });

  it('maps card.effect.readyCharacter to READY_CHARACTER template', () => {
    const cardEffectEntry: GameLogEntry = {
      id: 'log-400b',
      timestamp: 4000,
      round: 1,
      key: 'card.effect.readyCharacter',
      actor: { name: 'Tony Stark', type: 'hero' },
      params: { card: 'Arc Reactor', target: 'Iron Man' },
    };

    const formatted = formatComicLogEntry(cardEffectEntry, 'en');
    expect(formatted.narrativeAction).toBe('Arc Reactor readies Iron Man.');
  });

  it('formats player.* keys with player.name: remainder (e.g. player.action.allyAttack)', () => {
    const playerActionEntry: GameLogEntry = {
      id: 'log-401',
      timestamp: 4001,
      round: 1,
      key: 'player.action.allyAttack',
      actor: { name: 'Spider-Man', type: 'hero' },
      params: { player: 'Spider-Man', ally: 'Black Cat', damage: 1 },
    };

    const formatted = formatComicLogEntry(playerActionEntry, 'en');
    expect(formatted.narrativeAction).toBe('Spider-Man: action.allyAttack');
  });

  it('formats villain.* keys with villain.name: remainder (e.g. villain.attack, villain.boost)', () => {
    const villainAttackEntry: GameLogEntry = {
      id: 'log-402',
      timestamp: 4002,
      round: 1,
      key: 'villain.attack',
      actor: { name: 'Rhino', type: 'villain' },
      params: { villain: 'Rhino', target: 'Spider-Man' },
    };

    const formattedAttack = formatComicLogEntry(villainAttackEntry, 'en');
    expect(formattedAttack.narrativeAction).toBe('Rhino: attack');

    const villainBoostEntry: GameLogEntry = {
      id: 'log-403',
      timestamp: 4003,
      round: 1,
      key: 'villain.boost.revealed',
      actor: { name: 'Rhino', type: 'villain' },
      params: { villain: 'Rhino', card: 'Hydra Soldier', boostIcons: 2 },
    };

    const formattedBoost = formatComicLogEntry(villainBoostEntry, 'en');
    expect(formattedBoost.narrativeAction).toBe('Rhino: boost.revealed');
  });

  describe('State-Driven Canonical Sentence Formats (Issue #142)', () => {
    const mockGameState = {
      players: [
        {
          id: 'p1',
          name: 'Iron-Man',
          currentForm: 'hero',
          hero: {
            code: '01029a',
            name: 'Iron-Man',
            meta: {
              colors: ['#c2410c', '#f59e0b', '#dc2626', '#ffffff'],
            },
          },
        },
      ],
      villain: {
        card: {
          name: 'Rhino',
          code: '01094',
        },
      },
      mainScheme: {
        card: {
          name: 'The Break-In!',
          code: '01097',
        },
        threat: 1,
        targetThreat: 7,
      },
    } as any;

    it('1. DEAL_DAMAGE: renders canonical attack narrative in English and French', () => {
      const entry: GameLogEntry = {
        id: 'log-deal-dmg',
        timestamp: Date.now(),
        key: 'DEAL_DAMAGE',
        params: {
          who_attacks: 'Iron-Man',
          amount: 2,
          who_is_taking_damage: 'Rhino',
        },
      };

      const enFormatted = formatComicLogEntry(entry, 'en');
      expect(enFormatted.narrativeAction).toBe('Iron-Man dealt 2 damage to Rhino.');

      const frFormatted = formatComicLogEntry(entry, 'fr');
      expect(frFormatted.narrativeAction).toBe('Iron-Man a infligé 2 dégâts à Rhino.');
    });

    it('1b. player.action.attackVillain: maps to DEAL_DAMAGE with state fallback', () => {
      const entry: GameLogEntry = {
        id: 'log-atk-villain',
        timestamp: Date.now(),
        key: 'player.action.attackVillain',
        actor: { name: 'Iron-Man', type: 'hero' },
        params: {
          amount: 2,
        },
      };

      const formatted = formatComicLogEntry(entry, 'en', mockGameState);
      expect(formatted.narrativeAction).toBe('Iron-Man dealt 2 damage to Rhino.');
    });

    it('2. CARD_PLAYED: renders card played narrative in English and French', () => {
      const entry: GameLogEntry = {
        id: 'log-card-played',
        timestamp: Date.now(),
        key: 'CARD_PLAYED',
        params: {
          who: 'Captain Marvel',
          card: 'Photonic Blast',
        },
      };

      const enFormatted = formatComicLogEntry(entry, 'en');
      expect(enFormatted.narrativeAction).toBe('Captain Marvel played Photonic Blast.');

      const frFormatted = formatComicLogEntry(entry, 'fr');
      expect(frFormatted.narrativeAction).toBe('Captain Marvel a joué Photonic Blast.');
    });

    it('3. HERO_DEFENDED: renders hero defense narrative in English and French', () => {
      const entry: GameLogEntry = {
        id: 'log-defended',
        timestamp: Date.now(),
        key: 'combat.hero.defended',
        params: {
          who_defends: 'Spider-Man',
          who_attacks: 'Rhino',
        },
      };

      const enFormatted = formatComicLogEntry(entry, 'en');
      expect(enFormatted.narrativeAction).toBe('Spider-Man defended an attack from Rhino.');

      const frFormatted = formatComicLogEntry(entry, 'fr');
      expect(frFormatted.narrativeAction).toBe('Spider-Man a défendu une attaque de Rhino.');
    });

    it('4. CANCEL_WHEN_REVEALED: renders ability cancellation in English and French', () => {
      const entry: GameLogEntry = {
        id: 'log-cancel',
        timestamp: Date.now(),
        key: 'encounter.whenRevealed.cancelled',
        params: {
          who: 'Spider-Man',
          card: "I Think You're Right",
        },
      };

      const enFormatted = formatComicLogEntry(entry, 'en');
      expect(enFormatted.narrativeAction).toBe(
        "Spider-Man cancelled the 'When Revealed' ability from I Think You're Right.",
      );

      const frFormatted = formatComicLogEntry(entry, 'fr');
      expect(frFormatted.narrativeAction).toBe(
        "Spider-Man a annulé la capacité 'Une fois révélée' de I Think You're Right.",
      );
    });

    it('5. VILLAIN_PHASE_STEP1_THREAT: renders threat escalation in English and French', () => {
      const entry: GameLogEntry = {
        id: 'log-step1',
        timestamp: Date.now(),
        key: 'villainPhase.step1.threatPlaced',
        params: {
          amount: 1,
          scheme: 'The Break-In!',
        },
      };

      const enFormatted = formatComicLogEntry(entry, 'en');
      expect(enFormatted.narrativeAction).toBe(
        'Beginning of the Villain Phase, threat increased by 1 on The Break-In!.',
      );

      const frFormatted = formatComicLogEntry(entry, 'fr');
      expect(frFormatted.narrativeAction).toBe(
        'Début de la Phase du Méchant, la menace a augmenté de 1 sur The Break-In!.',
      );
    });

    it('resolves dynamic color themes for Hero, Villain card back, and Narrator', () => {
      // 1. Hero color resolution from player.hero.meta.colors
      const heroEntry: GameLogEntry = {
        id: 'log-hero-color',
        timestamp: Date.now(),
        key: 'CARD_PLAYED',
        actor: { name: 'Iron-Man', type: 'hero' },
        params: { who: 'Iron-Man', card: 'Arc Reactor' },
      };
      const heroFormatted = formatComicLogEntry(heroEntry, 'en', mockGameState);
      expect(heroFormatted.speakerColor).toBe('#c2410c');
      expect(heroFormatted.speakerBorderColor).toBe('#f59e0b');

      // 2. Villain Card Back fallback palette
      const villainEntry: GameLogEntry = {
        id: 'log-villain-color',
        timestamp: Date.now(),
        key: 'VILLAIN_ATTACK',
        actor: { name: 'Rhino', type: 'villain' },
        params: { villain: 'Rhino' },
      };
      const villainFormatted = formatComicLogEntry(villainEntry, 'en');
      expect(villainFormatted.speakerColor).toBe('#701a75');
      expect(villainFormatted.speakerContrastColor).toBe('#ffffff');
      expect(villainFormatted.speakerBorderColor).toBe('#d97706');

      // 3. Narrator Caption Stan Lee Gold banner
      const narratorEntry: GameLogEntry = {
        id: 'log-narrator-color',
        timestamp: Date.now(),
        key: 'ROUND_STARTED',
        round: 2,
      };
      const narratorFormatted = formatComicLogEntry(narratorEntry, 'en');
      expect(narratorFormatted.speakerColor).toBe('#d97706');
      expect(narratorFormatted.speakerContrastColor).toBe('#0f172a');
      expect(narratorFormatted.speakerBorderColor).toBe('#b45309');
    });

    it('formats card.effect.addStatus into dynamic actor status actions (e.g. Mockingbird stunned Rhino!)', () => {
      const entry: GameLogEntry = {
        id: 'log-mockingbird-stun',
        timestamp: Date.now(),
        round: 1,
        key: 'card.effect.addStatus',
        actor: { name: 'Mockingbird', type: 'ally' },
        params: {
          who: 'Mockingbird',
          card: 'Mockingbird',
          status: 'STUNNED',
          target: 'Rhino',
        },
      };

      const enFormatted = formatComicLogEntry(entry, 'en', mockGameState);
      expect(enFormatted.speakerName).toBe('Mockingbird');
      expect(enFormatted.speakerAvatar).toBe('🤝');
      expect(enFormatted.narrativeAction).toBe('Mockingbird stunned Rhino!');

      const frFormatted = formatComicLogEntry(entry, 'fr', mockGameState);
      expect(frFormatted.narrativeAction).toBe('Mockingbird a sonné Rhino !');
    });

    it('formats player.turn.ended and strips Hero Seat designations to "Spider-Man turns ended."', () => {
      const rawEntry: GameLogEntry = {
        id: 'log-turn-ended',
        timestamp: Date.now(),
        round: 1,
        key: 'player.turn.ended',
        actor: { name: 'Hero Seat (Spider-Man)', type: 'hero' },
        params: { player: 'Hero Seat (Spider-Man)' },
        onomatopoeia: 'PASS',
      };

      const enFormatted = formatComicLogEntry(rawEntry, 'en', mockGameState);
      expect(enFormatted.speakerName).toBe('Spider-Man');
      expect(enFormatted.speakerAvatar).toBe('🕷️');
      expect(enFormatted.narrativeAction).toBe('Spider-Man turns ended.');

      const frFormatted = formatComicLogEntry(rawEntry, 'fr', mockGameState);
      expect(frFormatted.narrativeAction).toBe('Le tour de Spider-Man est terminé.');
    });

    describe('Issue #130: Explicit Combat Log Details & Transparent Card Discards/Draws', () => {
      it('formats villain.attack.hit with attacker, target, damage, and remaining HP', () => {
        const attackHitEntry: GameLogEntry = {
          id: 'log-villain-hit',
          timestamp: Date.now(),
          round: 1,
          phase: GamePhase.VILLAIN_PHASE,
          key: 'villain.attack.hit',
          params: {
            who_attacks: 'Rhino',
            who_is_taking_damage: 'Iron-Man',
            villain: 'Rhino',
            player: 'Iron-Man',
            damage: 3,
            amount: 3,
            remainingHp: 6,
          },
        };

        const enFormatted = formatComicLogEntry(attackHitEntry, 'en', mockGameState);
        expect(enFormatted.type).toBe('villain_shout');
        expect(enFormatted.speakerName).toBe('Rhino');
        expect(enFormatted.speakerAvatar).toBe('🦏');
        expect(enFormatted.narrativeAction).toBe('Rhino attacked Iron-Man for 3 damage!');
        expect(enFormatted.stats?.damage).toBe(3);
        expect(enFormatted.stats?.remainingHp).toBe(6);

        const frFormatted = formatComicLogEntry(attackHitEntry, 'fr', mockGameState);
        expect(frFormatted.narrativeAction).toBe('Rhino a attaqué Iron-Man pour 3 dégâts !');
      });

      it('formats minion.attack.hit with minion name, target, and damage', () => {
        const minionHitEntry: GameLogEntry = {
          id: 'log-minion-hit',
          timestamp: Date.now(),
          round: 1,
          phase: GamePhase.VILLAIN_PHASE,
          key: 'minion.attack.hit',
          params: {
            who_attacks: 'Hydra Soldier',
            who_is_taking_damage: 'Iron-Man',
            minion: 'Hydra Soldier',
            player: 'Iron-Man',
            damage: 2,
            amount: 2,
          },
        };

        const enFormatted = formatComicLogEntry(minionHitEntry, 'en', mockGameState);
        expect(enFormatted.type).toBe('villain_shout');
        expect(enFormatted.speakerName).toBe('Hydra Soldier');
        expect(enFormatted.narrativeAction).toBe('Hydra Soldier attacked Iron-Man for 2 damage!');
        expect(enFormatted.stats?.damage).toBe(2);

        const frFormatted = formatComicLogEntry(minionHitEntry, 'fr', mockGameState);
        expect(frFormatted.narrativeAction).toBe(
          'Hydra Soldier a attaqué Iron-Man pour 2 dégâts !',
        );
      });

      it('formats villain.scheme.threat attributing the scheme to the villain (not hero)', () => {
        const schemeEntry: GameLogEntry = {
          id: 'log-scheme-threat',
          timestamp: Date.now(),
          round: 1,
          phase: GamePhase.VILLAIN_PHASE,
          key: 'villain.scheme.threat',
          params: {
            who: 'Rhino',
            villain: 'Rhino',
            threat: 2,
            amount: 2,
            boost: 1,
            scheme: 'The Break-In!',
          },
        };

        const enFormatted = formatComicLogEntry(schemeEntry, 'en', mockGameState);
        expect(enFormatted.type).toBe('villain_shout');
        expect(enFormatted.speakerName).toBe('Rhino');
        expect(enFormatted.speakerAvatar).toBe('🦏');
        expect(enFormatted.narrativeAction).toBe(
          'Rhino schemed on The Break-In!, placing 2 threat.',
        );
        expect(enFormatted.stats?.threat).toBe(2);

        const frFormatted = formatComicLogEntry(schemeEntry, 'fr', mockGameState);
        expect(frFormatted.narrativeAction).toBe(
          'Rhino a manigancé sur The Break-In!, plaçant 2 menace.',
        );
      });

      it('formats card discards from deck and hand with explicit card names', () => {
        const discardDeckEntry: GameLogEntry = {
          id: 'log-discard-deck',
          timestamp: Date.now(),
          round: 1,
          key: 'card.discarded.fromDeck',
          params: {
            who: 'Iron-Man',
            count: 2,
            source: 'deck',
            cards: 'Repulsor Blast, Haymaker',
          },
        };

        const enDeck = formatComicLogEntry(discardDeckEntry, 'en', mockGameState);
        expect(enDeck.narrativeAction).toBe(
          'Iron-Man discarded 2 card(s) from deck: Repulsor Blast, Haymaker.',
        );

        const frDeck = formatComicLogEntry(discardDeckEntry, 'fr', mockGameState);
        expect(frDeck.narrativeAction).toBe(
          'Iron-Man a défaussé 2 carte(s) de deck : Repulsor Blast, Haymaker.',
        );

        const discardHandEntry: GameLogEntry = {
          id: 'log-discard-hand',
          timestamp: Date.now(),
          round: 1,
          key: 'card.discarded.fromHand',
          params: {
            who: 'Iron-Man',
            count: 1,
            source: 'hand',
            cards: 'Genius',
          },
        };

        const enHand = formatComicLogEntry(discardHandEntry, 'en', mockGameState);
        expect(enHand.narrativeAction).toBe('Iron-Man discarded 1 card(s) from hand: Genius.');
      });

      it('formats card draws with explicit card names (handling both string and array params)', () => {
        const drawArrayEntry: GameLogEntry = {
          id: 'log-draw-array',
          timestamp: Date.now(),
          round: 1,
          key: 'card.effect.drawCards',
          params: {
            who: 'Iron-Man',
            count: 2,
            cards: ['Web-Shooter', 'Backflip'] as any,
          },
        };

        const enDraw = formatComicLogEntry(drawArrayEntry, 'en', mockGameState);
        expect(enDraw.narrativeAction).toBe('Iron-Man drew 2 card(s): Web-Shooter, Backflip.');

        const frDraw = formatComicLogEntry(drawArrayEntry, 'fr', mockGameState);
        expect(frDraw.narrativeAction).toBe(
          'Iron-Man a pioché 2 carte(s) : Web-Shooter, Backflip.',
        );
      });

      it('formats Black Cat fetch retrieval into hand', () => {
        const fetchEntry: GameLogEntry = {
          id: 'log-black-cat-fetch',
          timestamp: Date.now(),
          round: 1,
          key: 'black_cat.fetch',
          params: {
            who: 'Spider-Man',
            card: 'Web-Shooter',
          },
        };

        const enFetch = formatComicLogEntry(fetchEntry, 'en', mockGameState);
        expect(enFetch.narrativeAction).toBe(
          "Black Cat retrieved Web-Shooter into Spider-Man's hand!",
        );

        const frFetch = formatComicLogEntry(fetchEntry, 'fr', mockGameState);
        expect(frFetch.narrativeAction).toBe(
          'Black Cat a récupéré Web-Shooter dans la main de Spider-Man !',
        );
      });
    });
  });
});
