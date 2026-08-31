import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';

describe('Sub-Milestone 2B-2: 0-to-Many Boost Queue, Star Abilities (★) & Boost Chaining', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    // Set hand to non-interrupt cards so Backflip doesn't auto-prevent damage during headless tests
    state.players[0].hand = [createCardInstance(cardCatalog.getCard('01005')!)];
  });

  describe('0-to-Many Boost Queue (Step 4 & 5)', () => {
    it('deals 0 boost cards for minion attacks', () => {
      const initialEncounterDiscardCount = state.encounterDiscard.length;
      const initialDeckCount = state.encounterDeck.length;

      const minionCard = cardCatalog.getCard('01108')!; // Hydra Mercenary (ATK 1)
      const minionInst = createCardInstance(minionCard);
      state.players[0].engagedMinions.push(minionInst);

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: minionInst },
        'p1',
        'TAKE_UNDEFENDED',
      );

      // Minion dealt exactly 1 damage (base ATK 1, 0 boost cards)
      expect(state.players[0].health).toBe(initialHp - 1);
      expect(state.encounterDeck.length).toBe(initialDeckCount);
      expect(state.encounterDiscard.length).toBe(initialEncounterDiscardCount);
    });

    it('deals 1 base boost card for standard villain attacks and sums icons', () => {
      const initialHp = state.players[0].health;
      // Put a 2-boost card on top of encounter deck (01103 has 2 boost icons)
      const twoBoostCard = cardCatalog.getCard('01103')!;
      state.encounterDeck = [createCardInstance(twoBoostCard), ...state.encounterDeck];

      executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'TAKE_UNDEFENDED',
      );

      // Rhino Base ATK 2 + 2 Boost icons = 4 total damage
      const expectedDamage = 2 + (twoBoostCard.boostIcons || 0);
      expect(state.players[0].health).toBe(initialHp - expectedDamage);
      expect(state.encounterDiscard.some((c) => c.card.code === twoBoostCard.code)).toBe(true);
    });

    it('deals multiple boost cards for villains with innate extra boost abilities (e.g. Klaw)', () => {
      // Set villain to Klaw (01113) with text "give him 1 additional boost card for this activation"
      const klawCard = cardCatalog.getCard('01113')!;
      state.villain.card = klawCard as any;
      state.villain.health = (klawCard as any).health || 12;

      const boost1 = cardCatalog.getCard('01103')!; // 2 boost icons
      const boost2 = cardCatalog.getCard('01103')!; // 2 boost icons
      state.encounterDeck = [createCardInstance(boost1), createCardInstance(boost2), ...state.encounterDeck];

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'TAKE_UNDEFENDED',
      );

      // Klaw deals 2 boost cards: Klaw base ATK 0 + 2 + 2 = 4 total damage
      expect(state.players[0].health).toBe(initialHp - 4);
    });
  });

  describe('★ Star Boost Abilities Execution & Boost Chaining', () => {
    it('executes Titania\'s Fury (01164) dynamic boost chaining: gives +1 additional boost card', () => {
      const titaniaFuryCard = cardCatalog.getCard('01164')!; // Star boost gives +1 boost card (1 boost icon)
      const followUpBoost = cardCatalog.getCard('01103')!; // 2 boost icons

      state.encounterDeck = [
        createCardInstance(titaniaFuryCard),
        createCardInstance(followUpBoost),
        ...state.encounterDeck,
      ];

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'TAKE_UNDEFENDED',
      );

      // Rhino base ATK 2 + Titania's Fury boost (1) + Follow-up boost (2) = 5 damage total!
      expect(state.players[0].health).toBe(initialHp - 5);
      // Both boost cards discarded
      expect(state.encounterDiscard.some((c) => c.card.code === '01164')).toBe(true);
      expect(state.encounterDiscard.some((c) => c.card.code === '01103')).toBe(true);
    });

    it('executes Sweeping Swoop (01168) boost ability to stun defending character', () => {
      expect(state.players[0].statusCards).not.toContain(StatusCard.STUNNED);

      const sweepingSwoopCard = cardCatalog.getCard('01168')!;
      state.encounterDeck = [createCardInstance(sweepingSwoopCard), ...state.encounterDeck];

      executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'TAKE_UNDEFENDED',
      );

      expect(state.players[0].statusCards).toContain(StatusCard.STUNNED);
    });

    it('executes Electric Whip Attack (01173) boost ability to discard an upgrade from player tableau', () => {
      const upgradeCard = cardCatalog.getCard('01081')!; // Armored Vest
      const upgradeInst = createCardInstance(upgradeCard);
      state.players[0].tableau.push(upgradeInst);

      const electricWhipCard = cardCatalog.getCard('01173')!;
      state.encounterDeck = [createCardInstance(electricWhipCard), ...state.encounterDeck];

      executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'TAKE_UNDEFENDED',
      );

      // Upgrade discarded from tableau to discard pile
      expect(state.players[0].tableau.some((t) => t.instanceId === upgradeInst.instanceId)).toBe(false);
      expect(state.players[0].discard.some((c) => c.instanceId === upgradeInst.instanceId)).toBe(true);
    });

    it('executes Kree Manipulator (01178) boost ability to place 1 threat on main scheme', () => {
      const initialThreat = state.mainScheme.threat;

      const kreeManipulatorCard = cardCatalog.getCard('01178')!;
      state.encounterDeck = [createCardInstance(kreeManipulatorCard), ...state.encounterDeck];

      executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'TAKE_UNDEFENDED',
      );

      // 1 threat added to main scheme from Star Boost
      expect(state.mainScheme.threat).toBe(initialThreat + 1);
    });
  });
});
