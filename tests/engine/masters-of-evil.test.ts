import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { createCardInstance, resetInstanceCounter } from '@engine/state/card-instance';
import {
  HeroCard,
  AlterEgoCard,
  CardInstance,
  GamePhase,
  StatusCard,
  getActiveVillain,
} from '@engine/models';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import {
  executeEnemyAttackSynchronously,
  initiateEnemyAttack,
} from '@engine/pipeline/combat-pipeline';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { canDeclareDefender } from '@engine/pipeline/legality-checker';
import { executeEffect } from '@engine/effects';
import { runMatch } from '@engine/simulation/match-simulator';
import { getStarterDeck } from '@engine/decks/starter-decks';

const THE_MASTERS_OF_EVIL = '01128';
const RADIOACTIVE_MAN = '01129';
const WHIRLWIND = '01130';
const TIGER_SHARK = '01131';
const MELTER = '01132';
const MASTERS_OF_MAYHEM = '01133';

function createMinion(code: string): CardInstance {
  const card = cardCatalog.getCard(code);
  if (!card) throw new Error(`Card ${code} not found in catalog`);
  return createCardInstance(card);
}

function createAlly(code: string): CardInstance {
  const card = cardCatalog.getCard(code);
  if (!card) throw new Error(`Card ${code} not found in catalog`);
  return createCardInstance(card);
}

function createTreachery(code: string): CardInstance {
  const card = cardCatalog.getCard(code);
  if (!card) throw new Error(`Card ${code} not found in catalog`);
  return createCardInstance(card);
}

describe('Masters of Evil Modular Set Integration with Rhino (#501)', () => {
  beforeEach(() => {
    resetInstanceCounter();
  });

  describe('1. Scenario Setup & Modular Deck Composition', () => {
    it('initializes Rhino scenario with Masters of Evil modular set (7 cards) and excludes Bomb Scare', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
      });

      // Bomb Scare cards (01109 to 01112) must NOT be present in encounter deck or side schemes
      const bombScareCodes = ['01109', '01110', '01111', '01112'];
      expect(state.encounterDeck.some((c) => bombScareCodes.includes(c.card.code))).toBe(false);
      expect(state.sideSchemes.some((s) => bombScareCodes.includes(s.card.code))).toBe(false);

      // Masters of Evil contains 7 cards (1x 01128, 1x 01129, 1x 01130, 1x 01131, 1x 01132, 2x 01133):
      const moeDeckCards = state.encounterDeck.filter(
        (c) =>
          c.card.setCode === 'masters_of_evil' ||
          [
            THE_MASTERS_OF_EVIL,
            RADIOACTIVE_MAN,
            WHIRLWIND,
            TIGER_SHARK,
            MELTER,
            MASTERS_OF_MAYHEM,
          ].includes(c.card.code),
      );
      expect(moeDeckCards.length).toBe(7);
      expect(moeDeckCards.filter((c) => c.card.code === THE_MASTERS_OF_EVIL).length).toBe(1);
      expect(moeDeckCards.filter((c) => c.card.code === RADIOACTIVE_MAN).length).toBe(1);
      expect(moeDeckCards.filter((c) => c.card.code === WHIRLWIND).length).toBe(1);
      expect(moeDeckCards.filter((c) => c.card.code === TIGER_SHARK).length).toBe(1);
      expect(moeDeckCards.filter((c) => c.card.code === MELTER).length).toBe(1);
      expect(moeDeckCards.filter((c) => c.card.code === MASTERS_OF_MAYHEM).length).toBe(2);
    });
  });

  describe('2. The Masters of Evil (01128) Side Scheme', () => {
    it('discards encounter cards until a Masters of Evil minion is hit, engaging it with first player', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: cardCatalog.getCard('01010a') as HeroCard,
            alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01013')!),
          },
        ],
        skipMulligan: true,
      });

      for (const p of state.players) {
        p.currentForm = 'hero';
        p.activeFormCard = p.hero;
      }

      state.firstPlayerIndex = 0; // P1 is first player

      // Arrange encounter deck: top 2 are non-minion filler, then Melter, then filler
      const filler1 = createTreachery('01114'); // False Alarm
      const filler2 = createTreachery('01114');
      const melter = createMinion(MELTER);
      const filler3 = createTreachery('01114');

      state.encounterDeck = [filler1, filler2, melter, filler3];
      state.encounterDiscard = [];

      // Deal and reveal The Masters of Evil
      state.players[0].dealtEncounterCards.push(
        createCardInstance(cardCatalog.getCard(THE_MASTERS_OF_EVIL)!),
      );
      const afterReveal = step4_revealEncounterCards(state);

      // Side scheme enters play with starting threat 3 per player = 6 threat in 2-player game
      const scheme = afterReveal.sideSchemes.find((s) => s.card.code === THE_MASTERS_OF_EVIL);
      expect(scheme).toBeDefined();
      expect(scheme?.threat).toBe(6);

      // Filler cards were discarded
      expect(afterReveal.encounterDiscard.filter((c) => c.card.code === '01114').length).toBe(2);

      // Melter was put into play engaged with the first player (p1)
      const p1Engaged = afterReveal.players[0].engagedMinions.find((m) => m.card.code === MELTER);
      expect(p1Engaged).toBeDefined();
      expect(afterReveal.players[1].engagedMinions.some((m) => m.card.code === MELTER)).toBe(false);
    });

    it('engages with Player 2 when Player 2 is the first player', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: cardCatalog.getCard('01010a') as HeroCard,
            alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01013')!),
          },
        ],
        skipMulligan: true,
      });

      for (const p of state.players) {
        p.currentForm = 'hero';
        p.activeFormCard = p.hero;
      }

      state.firstPlayerIndex = 1; // P2 is first player

      const tigerShark = createMinion(TIGER_SHARK);
      state.encounterDeck = [tigerShark];
      state.encounterDiscard = [];

      state.players[0].dealtEncounterCards.push(
        createCardInstance(cardCatalog.getCard(THE_MASTERS_OF_EVIL)!),
      );
      const afterReveal = step4_revealEncounterCards(state);

      // Tiger Shark must engage with P2
      expect(afterReveal.players[0].engagedMinions.some((m) => m.card.code === TIGER_SHARK)).toBe(
        false,
      );
      expect(afterReveal.players[1].engagedMinions.some((m) => m.card.code === TIGER_SHARK)).toBe(
        true,
      );
    });
  });

  describe('3. Masters of Mayhem (01133) & Minion Activation Chains', () => {
    it('activates Melter forcing ally defense on P1, and Tiger Shark gaining Tough on P2', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: cardCatalog.getCard('01010a') as HeroCard,
            alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01013')!),
          },
        ],
        skipMulligan: true,
      });

      for (const p of state.players) {
        p.currentForm = 'hero';
        p.activeFormCard = p.hero;
      }

      const p1 = state.players[0];
      const p2 = state.players[1];

      // P1 controls ready Black Cat ally and is engaged with Melter
      const blackCat = createAlly('01011');
      blackCat.exhausted = false;
      p1.allies.push(blackCat);

      const melter = createMinion(MELTER);
      p1.engagedMinions.push(melter);

      // P2 is engaged with Tiger Shark
      const tigerShark = createMinion(TIGER_SHARK);
      p2.engagedMinions.push(tigerShark);

      state.phase = GamePhase.PLAYER_PHASE;
      state.encounterDeck = [];

      // Melter attacks P1: Melter's constant restriction requires ally defense
      initiateEnemyAttack(state, { type: 'MINION', card: melter }, p1.id);
      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();
      expect(prompt?.promptId).toMatch(/^prompt_defend_/);
      // Melter restriction excludes hero and undefended
      const optionIds = prompt!.options.map((o) => o.id);
      expect(optionIds).toEqual([`defend_ally_${blackCat.instanceId}`]);
      expect(
        canDeclareDefender(
          state,
          p1.id,
          { type: 'HERO', playerId: p1.id },
          state.activeAttackContext,
        ).allowed,
      ).toBe(false);

      // Tiger Shark attacks P2 synchronously -> gains Tough status card
      expect(tigerShark.statusCards ?? []).not.toContain(StatusCard.TOUGH);
      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: tigerShark },
        p2.id,
        'TAKE_UNDEFENDED',
      );
      expect(tigerShark.statusCards).toContain(StatusCard.TOUGH);
    });

    it('resolves Radioactive Man random hand discard and Whirlwind multi-hero attack', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: cardCatalog.getCard('01010a') as HeroCard,
            alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01013')!),
          },
        ],
        skipMulligan: true,
      });

      for (const p of state.players) {
        p.currentForm = 'hero';
        p.activeFormCard = p.hero;
      }

      const p1 = state.players[0];
      const p2 = state.players[1];

      // Give P1 cards in hand
      p1.hand = [
        createCardInstance(cardCatalog.getCard('01005')!),
        createCardInstance(cardCatalog.getCard('01006')!),
      ];

      // Radioactive Man attacks P1 -> P1 discards 1 random card
      const radioactiveMan = createMinion(RADIOACTIVE_MAN);
      p1.engagedMinions.push(radioactiveMan);
      state.encounterDeck = [];

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: radioactiveMan },
        p1.id,
        'TAKE_UNDEFENDED',
      );
      expect(p1.hand.length).toBe(1);
      expect(p1.discard.length).toBe(1);

      // Whirlwind attacks P1 -> Forced Interrupt deals damage to P1 and also initiates attack on P2
      const whirlwind = createMinion(WHIRLWIND);
      p1.engagedMinions.push(whirlwind);

      const p1HpBefore = p1.health;
      const p2HpBefore = p2.health;

      initiateEnemyAttack(state, { type: 'MINION', card: whirlwind }, p1.id, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
      });

      // Whirlwind ATK: 2 -> both heroes take 2 damage
      expect(p1.health).toBe(p1HpBefore - 2);
      expect(p2.health).toBe(p2HpBefore - 2);
    });

    it('triggers Masters of Mayhem fallback search when no minions are engaged', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
        skipMulligan: true,
      });

      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = p1.hero;
      p1.engagedMinions = [];

      // Minion is in encounter deck
      const melter = createMinion(MELTER);
      state.encounterDeck = [melter];
      state.encounterDiscard = [];

      const mayhemInst = createTreachery(MASTERS_OF_MAYHEM);
      const ability = mayhemInst.card.enrichment!.abilities![0];
      const res = executeEffect(state, ability, {
        playerId: p1.id,
        sourceCardInstance: mayhemInst,
      });

      expect(res.success).toBe(true);
      // Melter was found and engaged with P1
      expect(p1.engagedMinions.some((m) => m.card.code === MELTER)).toBe(true);
    });
  });

  describe('4. Masters of Evil Minion Boost Effects Interplay', () => {
    it('Melter Boost: exhausts each ally controlled by defending player', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
        skipMulligan: true,
      });
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = p1.hero;

      const ally = createAlly('01011');
      ally.exhausted = false;
      p1.allies.push(ally);

      state.encounterDeck = [createMinion(MELTER)];

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, p1.id, 'TAKE_UNDEFENDED');
      expect(ally.exhausted).toBe(true);
    });

    it('Tiger Shark Boost: gives the villain a tough status card', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
        ],
        skipMulligan: true,
      });
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = p1.hero;

      const villain = getActiveVillain(state)!;
      expect(villain.statusCards ?? []).not.toContain(StatusCard.TOUGH);

      state.encounterDeck = [createMinion(TIGER_SHARK)];
      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, p1.id, 'TAKE_UNDEFENDED');
      expect(villain.statusCards).toContain(StatusCard.TOUGH);
    });

    it('Radioactive Man Boost: discards 1 card at random from defending player hand', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Captain Marvel',
            hero: cardCatalog.getCard('01010a') as HeroCard,
            alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01013')!),
          },
        ],
        skipMulligan: true,
      });
      const p1 = state.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = p1.hero;
      p1.hand = [
        createCardInstance(cardCatalog.getCard('01013')!),
        createCardInstance(cardCatalog.getCard('01014')!),
      ];

      state.encounterDeck = [createMinion(RADIOACTIVE_MAN)];

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, p1.id, 'TAKE_UNDEFENDED');
      expect(p1.hand.length).toBe(1);
      expect(p1.discard.length).toBe(1);
    });

    it('Whirlwind Boost: deals 1 damage to each hero', () => {
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
          },
          {
            id: 'p2',
            name: 'Captain Marvel',
            hero: cardCatalog.getCard('01010a') as HeroCard,
            alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
            deckCards: Array(10).fill(cardCatalog.getCard('01013')!),
          },
        ],
        skipMulligan: true,
      });
      for (const p of state.players) {
        p.currentForm = 'hero';
        p.activeFormCard = p.hero;
      }
      const p1 = state.players[0];
      const p2 = state.players[1];
      const villain = getActiveVillain(state)!;

      const p1HpBefore = p1.health;
      const p2HpBefore = p2.health;

      state.encounterDeck = [createMinion(WHIRLWIND)];
      // Whirlwind has 0 boost icons (boostStar only)
      // Rhino ATK (I: 2) -> 2 attack damage to p1, plus 1 to each hero from boost star
      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, p1.id, 'TAKE_UNDEFENDED');
      expect(p2.health).toBe(p2HpBefore - 1);
      expect(p1.health).toBe(p1HpBefore - (villain.card.attack + 1));
    });
  });

  describe('5. Headless Match Simulation with Rhino + Masters of Evil', () => {
    it('plays a multi-round match to completion without deadlocks, errors, or unhandled prompts', () => {
      const starter = getStarterDeck('spider_man_justice');
      expect(starter).toBeDefined();
      const loaded = starter!.loadDeck(cardCatalog);

      const seed = 'test_rhino_masters_of_evil_match';
      const state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        difficulty: 'STANDARD',
        modularSetCodes: ['masters_of_evil'],
        seed,
        players: [
          {
            id: 'p1',
            name: loaded.hero.name,
            hero: loaded.hero,
            alterEgo: loaded.alterEgo,
            deckCards: loaded.deckCards,
            obligation: loaded.obligation,
            nemesisCards: loaded.nemesisCards,
          },
        ],
      });

      const result = runMatch(state, {
        maxRounds: 10,
        maxActionsPerTurn: 10,
        seed,
      });

      expect(['HEROES', 'VILLAIN', 'TIMEOUT']).toContain(result.winner);
      expect(result.roundsPlayed).toBeGreaterThanOrEqual(1);
      expect(result.heroNames).toEqual(['Spider-Man']);
    });
  });
});
