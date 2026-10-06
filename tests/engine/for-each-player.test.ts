import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  CardAbility,
  CardInstance,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  executeEffect,
  dispatchAction,
  peekDecisionPrompt,
  step4_revealEncounterCards,
  getActiveVillain,
} from '@engine/index';
import { CardAbilitySchema, AbilityStepSchema } from '@data/supplemental/schema';

const ELECTROMAGNETIC_BACKLASH = '01174';
const ENERGY_3 = '01014'; // Energy Absorption, printed 3 energy
const ENERGY_1 = '01006'; // Aunt May, printed 1 energy
const PHYSICAL_1 = '01008'; // Web-Shooter, printed 1 physical, no energy
const HYDRA_BOMBER = '01110';

const card = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);
const deckOf = (...codes: string[]) => codes.map(card);

describe('Per-player iteration, ability-level forEachPlayer (#220)', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
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
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
      shuffleFn: (arr) => arr,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
  });

  // By id: a player who takes lethal damage leaves state.players (#246).
  const byId = (id: string) =>
    [...state.players, ...(state.eliminatedPlayers ?? [])].find((p) => p.id === id)!;
  const p1 = () => byId('p1');
  const p2 = () => byId('p2');
  const reveal = (revealingId = 'p1') => {
    state.players
      .find((p) => p.id === revealingId)!
      .dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(ELECTROMAGNETIC_BACKLASH)!));
    state = step4_revealEncounterCards(state);
  };

  describe('Electromagnetic Backlash (01174) When Revealed', () => {
    it('each player discards 5 and takes damage for their own printed energy icons', () => {
      // p1 top 5: 3 + 1 + 1 energy = 5; p2 top 5: no energy
      p1().deck = deckOf(ENERGY_3, ENERGY_1, ENERGY_1, PHYSICAL_1, PHYSICAL_1, PHYSICAL_1);
      p2().deck = deckOf(PHYSICAL_1, PHYSICAL_1, PHYSICAL_1, PHYSICAL_1, PHYSICAL_1, ENERGY_3);
      const hp1 = p1().health;
      const hp2 = p2().health;

      reveal();

      expect(p1().discard.filter((c) => c.card.code === ENERGY_3)).toHaveLength(1);
      expect(p1().deck).toHaveLength(1);
      expect(p2().deck).toHaveLength(1);
      expect(p2().deck[0].card.code).toBe(ENERGY_3);
      expect(p1().health).toBe(hp1 - 5);
      expect(p2().health).toBe(hp2);
    });

    it("does not count one player's discards for the other (scoped per iteration)", () => {
      p1().deck = deckOf(...Array(5).fill(ENERGY_3));
      p2().deck = deckOf(...Array(5).fill(PHYSICAL_1));
      const hp2 = p2().health;
      reveal();
      expect(p2().health).toBe(hp2);
    });

    it('resolves in player order, first player first', () => {
      state.firstPlayerIndex = 1;
      p1().deck = deckOf(...Array(5).fill(PHYSICAL_1));
      p2().deck = deckOf(...Array(5).fill(PHYSICAL_1));
      reveal();
      const order = state.log
        .filter((l) => l.key === 'card.discarded.fromDeck')
        .map((l) => l.params?.player);
      expect(order).toEqual(['Iron Man', 'Spider-Man']);
    });

    it('a short deck discards what is left and takes damage for those cards only, no discard from the new deck (RR Player Deck)', () => {
      p1().deck = deckOf(ENERGY_1, ENERGY_1);
      p1().discard = [];
      p2().deck = deckOf(PHYSICAL_1);
      p2().discard = deckOf(ENERGY_3, ENERGY_3);
      p1().dealtEncounterCards = [];
      p2().dealtEncounterCards = [];
      const hp1 = p1().health;
      const hp2 = p2().health;
      // The real ability, without the reveal: the deck reset deals a random encounter card
      const ability = cardCatalog.getCard(ELECTROMAGNETIC_BACKLASH)!.enrichment!
        .abilities![0] as unknown as CardAbility;
      state = executeEffect(state, ability, { playerId: 'p1' }).state;
      // p1 discarded exactly 2 cards; the reset deck is not discarded from again
      expect(p1().health).toBe(hp1 - 2);
      expect(p1().deck.map((c) => c.card.code)).toEqual([ENERGY_1, ENERGY_1]);
      expect(p1().discard).toHaveLength(0);
      // p2 discarded 1 physical card (no energy); the reshuffled energy cards were not discarded
      expect(p2().health).toBe(hp2);
      expect(
        p2()
          .deck.map((c) => c.card.code)
          .sort(),
      ).toEqual([PHYSICAL_1, ENERGY_3, ENERGY_3].sort());
      expect(p2().dealtEncounterCards).toHaveLength(1);
    });

    it('damages the identity in either form', () => {
      p2().currentForm = 'alter_ego';
      p2().activeFormCard = p2().alterEgo;
      p1().deck = deckOf(...Array(5).fill(PHYSICAL_1));
      p2().deck = deckOf(ENERGY_1, ENERGY_1, PHYSICAL_1, PHYSICAL_1, PHYSICAL_1);
      const alterEgoHp = p2().health;
      reveal();
      expect(p2().health).toBe(alterEgoHp - 2);
    });
  });

  describe('engine behaviour with an ad-hoc ability', () => {
    const discardThenDamage = (extra: Partial<CardAbility> = {}): CardAbility => ({
      id: 'test_for_each_player',
      timing: 'WHEN_REVEALED',
      trigger: 'WHEN_REVEALED',
      forEachPlayer: true,
      steps: [
        { effect: 'DISCARD', effectParams: { source: 'DECK', mode: 'TOP', count: 1 } },
        {
          effect: 'DEAL_DAMAGE',
          effectParams: {
            target: 'SELF_IDENTITY',
            amount: { from: 'DISCARDED_CARDS', discardAttribute: 'RESOURCE_ICONS' },
          },
        },
      ],
      ...extra,
    });

    it('an ability without forEachPlayer runs once for the resolving player only', () => {
      p1().deck = deckOf(ENERGY_1, ENERGY_1);
      p2().deck = deckOf(ENERGY_1, ENERGY_1);
      const ability = discardThenDamage({ forEachPlayer: undefined });
      executeEffect(state, ability, { playerId: 'p1' });
      expect(p1().deck).toHaveLength(1);
      expect(p2().deck).toHaveLength(2);
    });

    it('pauses at a prompt: the rest of that player and the remaining players resume in order', () => {
      // Each player has two enemies engaged, so "an enemy" opens a prompt per player.
      p1().engagedMinions.push(createCardInstance(cardCatalog.getCard(HYDRA_BOMBER) as MinionCard));
      p2().engagedMinions.push(createCardInstance(cardCatalog.getCard(HYDRA_BOMBER) as MinionCard));
      p1().deck = deckOf(PHYSICAL_1, PHYSICAL_1);
      p2().deck = deckOf(PHYSICAL_1, PHYSICAL_1);
      const ability: CardAbility = {
        id: 'test_for_each_player_prompt',
        timing: 'WHEN_REVEALED',
        trigger: 'WHEN_REVEALED',
        forEachPlayer: true,
        steps: [
          { effect: 'DEAL_DAMAGE', effectParams: { amount: 1, target: 'CHOSEN_ENEMY' } },
          { effect: 'DISCARD', effectParams: { source: 'DECK', mode: 'TOP', count: 1 } },
        ],
      };

      state = executeEffect(state, ability, { playerId: 'p1' }).state;

      // p1 is asked first; nothing after the prompt has run for anybody
      const first = peekDecisionPrompt(state);
      expect(first?.title).toContain('Choose an Enemy');
      expect(first?.playerId).toBe('p1');
      expect(p1().deck).toHaveLength(2);
      expect(p2().deck).toHaveLength(2);

      const villainId = getActiveVillain(state).instanceId!;
      state = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: villainId,
      }).state;

      // p1 finished their block, p2 is now asked
      expect(p1().deck).toHaveLength(1);
      expect(p2().deck).toHaveLength(2);
      const second = peekDecisionPrompt(state);
      expect(second?.title).toContain('Choose an Enemy');
      expect(second?.playerId).toBe('p2');

      state = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p2',
        selectedOptionId: villainId,
      }).state;

      expect(p2().deck).toHaveLength(1);
      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(state.pendingSequences?.length ?? 0).toBe(0);
    });
  });

  describe('schema', () => {
    const base = {
      id: 'a',
      timing: 'WHEN_REVEALED',
      trigger: 'WHEN_REVEALED',
      steps: [{ effect: 'DRAW', effectParams: { amount: 1 } }],
    };

    it('accepts a boolean forEachPlayer on an ability', () => {
      expect(CardAbilitySchema.safeParse({ ...base, forEachPlayer: true }).success).toBe(true);
      expect(CardAbilitySchema.safeParse({ ...base, forEachPlayer: false }).success).toBe(true);
      expect(CardAbilitySchema.safeParse(base).success).toBe(true);
    });

    it('rejects a non-boolean forEachPlayer', () => {
      expect(CardAbilitySchema.safeParse({ ...base, forEachPlayer: 'each_player' }).success).toBe(
        false,
      );
    });

    it('rejects forEachPlayer on a step (ability level only)', () => {
      expect(AbilityStepSchema.safeParse({ effect: 'DRAW', forEachPlayer: true }).success).toBe(
        false,
      );
    });
  });
});
