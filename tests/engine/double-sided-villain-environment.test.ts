import path from 'node:path';
import { beforeAll, describe, it, expect } from 'vitest';
import { applyContent } from '@data/content/apply';
import { NodeFsDriver } from '@data/content/drivers/node-fs';
import { loadContent } from '@data/content/loader';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { createCardInstance } from '@engine/state/card-instance';
import { HeroCard, AlterEgoCard, StatusCard, VillainCard } from '@engine/models';
import { kernel } from '@engine/kernel';
import { canAttack, HERO_ACTOR } from '@engine/pipeline/legality-checker';
import {
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
} from '@engine/pipeline/villain-phase';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';
import { advanceVillainStage } from '@engine/scenarios/advance-villain-stage';

describe('Double-Sided Villain & Environment Mechanics (MC02 Risky Business)', () => {
  beforeAll(async () => {
    const root = path.resolve(__dirname, '../../content');
    applyContent(await loadContent(new NodeFsDriver(root), { packs: ['core', 'gob'] }));
  });

  const spiderManHero = () => cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = () => cardCatalog.getCard('01001b') as AlterEgoCard;

  const createTestState = () => {
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      modularSetCodes: ['bomb_scare'],
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero(),
          alterEgo: peterParkerAlterEgo(),
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });
    state.players[0].currentForm = 'hero';

    // Set up Norman Osborn as villain and Criminal Enterprise as environment
    const normanCard = cardCatalog.getCard('02001a') as VillainCard;
    state.villains[0] = {
      instanceId: 'villain_norman_osborn',
      card: normanCard,
      health: 14,
      maxHealth: 14,
      exhausted: false,
      statusCards: [],
      attachments: [],
      activeSide: 'a',
      alternateCard: cardCatalog.getCard('02001b') as VillainCard,
    };

    const criminalEnterprise = createCardInstance(cardCatalog.getCard('02006a')!);
    criminalEnterprise.counters = { infamy: 2 };
    state.environments = [criminalEnterprise];

    return state;
  };

  describe('Form Flipping & State Preservation', () => {
    it('flips villain from Norman Osborn to Green Goblin, retaining attachments and damage, and triggers When Revealed', () => {
      const state = createTestState();
      const villain = state.villains[0];
      villain.health = 10; // 4 damage taken
      villain.statusCards = [StatusCard.TOUGH];
      const glider = createCardInstance(cardCatalog.getCard('02033')!);
      villain.attachments.push(glider);

      const initialPlayerHp = state.players[0].health;

      // Flip villain
      kernel.runStepHandler(
        state,
        { effect: 'FLIP_CARD', effectParams: { target: 'VILLAIN' } },
        { playerId: 'p1' },
        state.players[0],
      );

      // Now Green Goblin
      expect(state.villains[0].card.code).toBe('02001b');
      expect(state.villains[0].card.name).toBe('Green Goblin');
      expect(state.villains[0].activeSide).toBe('b');

      // State preserved: attachments, status, damage
      expect(state.villains[0].attachments).toHaveLength(1);
      expect(state.villains[0].attachments[0].card.code).toBe('02033');
      expect(state.villains[0].statusCards).toContain(StatusCard.TOUGH);
      expect(state.villains[0].health).toBe(10);

      // Green Goblin When Revealed triggered (3 damage to hero)
      expect(state.players[0].health).toBe(initialPlayerHp - 3);
    });

    it('flips environment from Criminal Enterprise to State of Madness', () => {
      const state = createTestState();
      const env = state.environments[0];
      expect(env.card.code).toBe('02006a');

      kernel.runStepHandler(
        state,
        { effect: 'FLIP_CARD', effectParams: { target: 'ENVIRONMENT' } },
        { playerId: 'p1' },
        state.players[0],
      );

      expect(state.environments[0].card.code).toBe('02006b');
      expect(state.environments[0].card.name).toBe('State of Madness');
    });
  });

  describe('Norman Osborn Attack & Damage Replacements', () => {
    it('Norman Osborn cannot be attacked by the hero', () => {
      const state = createTestState();
      const check = canAttack(state, 'p1', HERO_ACTOR, 'villain');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('cannot be attacked');
    });

    it('When Norman Osborn would attack, places 1 infamy counter on Criminal Enterprise instead', () => {
      const state = createTestState();
      const initialInfamy = state.environments[0].counters?.infamy ?? 0;
      const initialPlayerHp = state.players[0].health;

      executeVillainAttackAgainstPlayer(state, state.players[0]);

      // Attack was cancelled; no damage dealt to player
      expect(state.players[0].health).toBe(initialPlayerHp);
      // Infamy counter placed
      expect(state.environments[0].counters?.infamy).toBe(initialInfamy + 1);
    });

    it('When Norman Osborn would take damage, removes that many infamy counters from Criminal Enterprise instead', () => {
      const state = createTestState();
      state.environments[0].counters = { infamy: 4 };

      // Deal 2 damage to Norman Osborn
      applyDamageToTarget(state, {
        target: { type: 'villain', entity: state.villains[0], name: 'Norman Osborn' },
        amount: 2,
      });

      // Norman Osborn took 0 damage
      expect(state.villains[0].health).toBe(14);
      // 2 infamy counters removed
      expect(state.environments[0].counters?.infamy).toBe(2);
    });

    it('When all infamy counters are removed, flips Norman Osborn and Criminal Enterprise', () => {
      const state = createTestState();
      state.environments[0].counters = { infamy: 2 };

      // Deal 2 damage to remove the remaining 2 counters
      applyDamageToTarget(state, {
        target: { type: 'villain', entity: state.villains[0], name: 'Norman Osborn' },
        amount: 2,
      });

      // Flips to Green Goblin and State of Madness
      expect(state.villains[0].card.code).toBe('02001b');
      expect(state.villains[0].card.name).toBe('Green Goblin');
      expect(state.environments[0].card.code).toBe('02006b');
      expect(state.environments[0].card.name).toBe('State of Madness');
    });
  });

  describe('Green Goblin Scheme Replacement', () => {
    it('When Green Goblin would scheme, removes 1 madness counter from State of Madness instead', () => {
      const state = createTestState();
      // Flip to Green Goblin & State of Madness
      state.villains[0].card = cardCatalog.getCard('02001b') as VillainCard;
      state.villains[0].activeSide = 'b';
      state.environments[0] = createCardInstance(cardCatalog.getCard('02006b')!);
      state.environments[0].counters = { madness: 3 };

      const initialThreat = state.mainSchemes[0].threat;
      executeVillainSchemeAgainstPlayer(state, state.players[0]);

      // Scheme cancelled; no threat placed on main scheme
      expect(state.mainSchemes[0].threat).toBe(initialThreat);
      // 1 madness counter removed
      expect(state.environments[0].counters?.madness).toBe(2);
    });

    it('When all madness counters are removed from State of Madness, flips back to Norman Osborn and Criminal Enterprise', () => {
      const state = createTestState();
      state.villains[0].card = cardCatalog.getCard('02001b') as VillainCard;
      state.villains[0].activeSide = 'b';
      state.environments[0] = createCardInstance(cardCatalog.getCard('02006b')!);
      state.environments[0].counters = { madness: 1 };

      executeVillainSchemeAgainstPlayer(state, state.players[0]);

      // Flips back to Norman Osborn and Criminal Enterprise
      expect(state.villains[0].card.code).toBe('02001a');
      expect(state.villains[0].card.name).toBe('Norman Osborn');
      expect(state.environments[0].card.code).toBe('02006a');
      expect(state.environments[0].card.name).toBe('Criminal Enterprise');
    });
  });

  describe('Stage Progression for Double-Sided Villains', () => {
    it('advancing villain stage preserves the active form side and attachments', () => {
      const state = createTestState();
      // Green Goblin Stage I with Goblin Glider attached
      state.villains[0].card = cardCatalog.getCard('02001b') as VillainCard;
      state.villains[0].activeSide = 'b';
      const glider = createCardInstance(cardCatalog.getCard('02033')!);
      state.villains[0].attachments.push(glider);
      state.villains[0].statusCards = [StatusCard.STUNNED];

      // Advance to Stage II (02002a)
      advanceVillainStage(state, state.villains[0].instanceId!, '02002a');

      // Preserved active form side 'b' -> enters on Green Goblin Stage II (02002b)!
      expect(state.villains[0].card.code).toBe('02002b');
      expect(state.villains[0].card.name).toBe('Green Goblin');
      expect(state.villains[0].card.stage).toBe('II');

      // Attachments & status preserved
      expect(state.villains[0].attachments).toHaveLength(1);
      expect(state.villains[0].attachments[0].card.code).toBe('02033');
      expect(state.villains[0].statusCards).toContain(StatusCard.STUNNED);
    });
  });

  describe('Declarative abilities and triggers coverage', () => {
    it('verifies WOULD_ATTACK, WOULD_SCHEME, CANNOT_BE_ATTACKED, and WHEN_COMPLETED abilities', () => {
      const norman = cardCatalog.getCard('02001a')!;
      const abilities = norman.enrichment?.abilities ?? [];
      const cannotBeAttacked = abilities.find((a) =>
        a.steps?.some((s) => s.effect === 'CANNOT_BE_ATTACKED'),
      );
      expect(cannotBeAttacked).toBeDefined();

      const wouldAttack = abilities.find((a) => a.trigger === 'WOULD_ATTACK');
      expect(wouldAttack).toBeDefined();

      const goblin = cardCatalog.getCard('02001b')!;
      const wouldScheme = goblin.enrichment?.abilities?.find((a) => a.trigger === 'WOULD_SCHEME');
      expect(wouldScheme).toBeDefined();

      const scheme = cardCatalog.getCard('02004b')!;
      const whenCompleted = scheme.enrichment?.abilities?.find(
        (a) => a.timing === 'WHEN_COMPLETED',
      );
      expect(whenCompleted).toBeDefined();
    });
  });
});
