import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  CardInstance,
} from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import {
  getEffectiveMinionAttack,
  getEffectiveMinionScheme,
} from '../../src/engine/pipeline/stat-calculator';

describe('Minion Dynamic Stat Calculations (#386, RR v1.8 Non-Numerical Variable / Base Value)', () => {
  let state: GameState;
  const TITANIA = '01162';
  const ARMORED_GUARD = '01103';

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: cardCatalog.getCard('01019a') as HeroCard,
          alterEgo: cardCatalog.getCard('01019b') as AlterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  describe('Titania (01162): X Attack equal to remaining hit points', () => {
    it('evaluates Titania attack as 6 when entering play with 0 damage', () => {
      const titaniaCard = cardCatalog.getCard(TITANIA) as MinionCard;
      const titania = createCardInstance(titaniaCard);
      state.players[0].engagedMinions = [titania];

      const attack = getEffectiveMinionAttack(state, titania);
      expect(attack).toBe(6);
    });

    it('evaluates Titania attack dynamically as her hit points decrease (damage tokens)', () => {
      const titaniaCard = cardCatalog.getCard(TITANIA) as MinionCard;
      const titania = createCardInstance(titaniaCard);
      titania.tokens = { damage: 2 };
      state.players[0].engagedMinions = [titania];

      expect(getEffectiveMinionAttack(state, titania)).toBe(4);

      titania.tokens = { damage: 5 };
      expect(getEffectiveMinionAttack(state, titania)).toBe(1);

      titania.tokens = { damage: 6 };
      expect(getEffectiveMinionAttack(state, titania)).toBe(0);
    });

    it('handles damage stored directly on card instance damage property', () => {
      const titaniaCard = cardCatalog.getCard(TITANIA) as MinionCard;
      const titania = createCardInstance(titaniaCard) as CardInstance & { damage?: number };
      titania.damage = 3;
      state.players[0].engagedMinions = [titania];

      expect(getEffectiveMinionAttack(state, titania)).toBe(3);
    });
  });

  describe('Standard minion attack and scheme calculation', () => {
    it('evaluates Armored Guard base ATK and SCH', () => {
      const guardCard = cardCatalog.getCard(ARMORED_GUARD) as MinionCard;
      const guard = createCardInstance(guardCard);
      state.players[0].engagedMinions = [guard];

      expect(getEffectiveMinionAttack(state, guard)).toBe(2);
      expect(getEffectiveMinionScheme(state, guard)).toBe(1);
    });

    it('applies activeStatModifiers to minion attack', () => {
      const guardCard = cardCatalog.getCard(ARMORED_GUARD) as MinionCard;
      const guard = createCardInstance(guardCard);
      guard.activeStatModifiers = [
        {
          stat: 'ATTACK',
          amount: 2,
          duration: 'PHASE',
          sourceCardName: 'Test Buff',
        },
      ];
      state.players[0].engagedMinions = [guard];

      expect(getEffectiveMinionAttack(state, guard)).toBe(4);
    });

    it('applies activeStatModifiers to minion scheme (THWART stat)', () => {
      const guardCard = cardCatalog.getCard(ARMORED_GUARD) as MinionCard;
      const guard = createCardInstance(guardCard);
      guard.activeStatModifiers = [
        {
          stat: 'THWART',
          amount: 1,
          duration: 'PHASE',
          sourceCardName: 'Test Scheme Buff',
        },
      ];
      state.players[0].engagedMinions = [guard];

      expect(getEffectiveMinionScheme(state, guard)).toBe(2);
    });
  });
});
