import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  Keyword,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  peekDecisionPrompt,
  step4_revealEncounterCards,
} from '@engine/index';
import { resolveActiveEncounterCardAfterInterrupt } from '@engine/pipeline/villain-phase';

const PRINTED_SURGE = ['01121', '01158', '01178', '01185', '01191', '01193'];

describe('Surge keyword (#218): reveal 1 additional encounter card after the card resolves', () => {
  let state: GameState;

  const filler = (name: string): CardInstance =>
    createCardInstance({
      code: `filler-${name}`,
      name: `Filler ${name}`,
      type: 'treachery',
      faction: 'encounter',
    } as any);

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
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
  });

  const p1 = () => state.players[0];
  const deckWithFillers = (...names: string[]) => {
    const cards = names.map(filler);
    state.encounterDeck = [...cards, ...state.encounterDeck];
    return cards;
  };
  const revealCode = (code: string) => {
    const inst = createCardInstance(cardCatalog.getCard(code)!);
    p1().dealtEncounterCards.push(inst);
    state = step4_revealEncounterCards(state);
    return inst;
  };
  const revealed = (card: CardInstance) =>
    state.encounterDiscard.some((c) => c.instanceId === card.instanceId);
  const surgeLogs = () => state.log.filter((l) => l.key === 'encounter.surge.triggered').length;

  describe('the six cards that print Surge', () => {
    it.each(['01178', '01191'])('%s reveals exactly one extra card', (code) => {
      const [a, b] = deckWithFillers('a', 'b');
      revealCode(code);
      expect(revealed(a)).toBe(true);
      expect(revealed(b)).toBe(false);
      expect(state.encounterDeck).toContain(b);
    });

    it('the extra card is revealed only after the original card has fully resolved', () => {
      deckWithFillers('a');
      revealCode('01191'); // Exhaustion
      const order = state.log
        .filter((l) => l.key === 'encounter.reveal.treachery')
        .map((l) => String(l.params?.card));
      expect(order).toEqual(['Exhaustion', 'Filler a']);
    });

    it('Under Fire (01193) reveals the top card, then surges one more', () => {
      const [a, b, c] = deckWithFillers('a', 'b', 'c');
      revealCode('01193');
      expect(revealed(a)).toBe(true);
      expect(revealed(b)).toBe(true);
      expect(revealed(c)).toBe(false);
    });

    it('Biomechanical Upgrades (01185, attachment) and Weapons Runner (01121, minion) surge', () => {
      for (const code of ['01185', '01121']) {
        const [a, b] = deckWithFillers(`x${code}`, `y${code}`);
        revealCode(code);
        expect(revealed(a)).toBe(true);
        expect(revealed(b)).toBe(false);
      }
    });

    it('Heart-Shaped Herb (01158) surges', () => {
      const [a, b] = deckWithFillers('a', 'b');
      revealCode('01158');
      expect(revealed(a)).toBe(true);
      expect(revealed(b)).toBe(false);
    });
  });

  describe('cards that do not print Surge', () => {
    it('a card that only conditionally "gains surge" (Yon-Rogg 01179) does not surge when it discards an energy resource', () => {
      const [a] = deckWithFillers('a');
      p1().hand = [
        createCardInstance({ ...cardCatalog.getCard('01006')!, resources: { energy: 1 } } as any),
      ];
      revealCode('01179');
      expect(revealed(a)).toBe(false);
      expect(surgeLogs()).toBe(0);
    });

    it('a card that only "gains surge" (Stampede 01106, alter-ego only) does not surge in hero form', () => {
      const [a] = deckWithFillers('a');
      revealCode('01106');
      expect(revealed(a)).toBe(false);
      expect(surgeLogs()).toBe(0);
    });

    it('Stampede in alter-ego form gains surge exactly once (effect only, no keyword double)', () => {
      p1().currentForm = 'alter_ego';
      p1().activeFormCard = p1().alterEgo;
      const [a, b] = deckWithFillers('a', 'b');
      revealCode('01106');
      expect(revealed(a)).toBe(true);
      expect(revealed(b)).toBe(false);
      expect(surgeLogs()).toBe(1);
    });

    it('printed Surge plus the SURGE effect surges once', () => {
      const synthetic = {
        ...(cardCatalog.getCard('01191') as any),
        code: 'synthetic-surge-twice',
        enrichment: {
          abilities: [
            {
              id: 'twice',
              timing: 'WHEN_REVEALED',
              trigger: 'WHEN_REVEALED',
              steps: [{ effect: 'SURGE' }],
            },
          ],
        },
      };
      const [a, b] = deckWithFillers('a', 'b');
      p1().dealtEncounterCards.push(createCardInstance(synthetic));
      state = step4_revealEncounterCards(state);
      expect(revealed(a)).toBe(true);
      expect(revealed(b)).toBe(false);
    });
  });

  describe('timing and cancellation', () => {
    it('a Surge card that opens a prompt deals the extra card facedown, revealed only after the choice resolves', () => {
      const bomber = {
        ...(cardCatalog.getCard('01110') as any),
        keywords: [...((cardCatalog.getCard('01110') as any).keywords ?? []), Keyword.SURGE],
      };
      const [a] = deckWithFillers('a');
      p1().dealtEncounterCards.push(createCardInstance(bomber));
      state = step4_revealEncounterCards(state);

      expect(peekDecisionPrompt(state)).toBeDefined();
      expect(revealed(a)).toBe(false);
      expect(p1().dealtEncounterCards.map((c) => c.instanceId)).toContain(a.instanceId);

      state = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'place_threat',
      }).state;
      expect(revealed(a)).toBe(false);

      // The villain phase resumes its reveal step once the prompt queue is empty.
      state = step4_revealEncounterCards(state);
      expect(revealed(a)).toBe(true);
    });

    it('a cancelled When Revealed text does not cancel the Surge keyword', () => {
      const [a] = deckWithFillers('a');
      const inst = createCardInstance(cardCatalog.getCard('01191')!);
      state.activeEncounterContext = {
        encounterInstanceId: inst.instanceId,
        encounterCard: inst,
        targetPlayerId: 'p1',
      };
      resolveActiveEncounterCardAfterInterrupt(state, inst, p1(), true);
      // The extra card is dealt (revealed later by step 4)
      expect(p1().dealtEncounterCards).toContain(a);
    });

    it('a card cancelled and discarded does not surge', () => {
      const [a] = deckWithFillers('a');
      const inst = createCardInstance(cardCatalog.getCard('01191')!);
      state.activeEncounterContext = {
        encounterInstanceId: inst.instanceId,
        encounterCard: inst,
        targetPlayerId: 'p1',
        discardCard: true,
      };
      resolveActiveEncounterCardAfterInterrupt(state, inst, p1(), true);
      expect(p1().dealtEncounterCards).toHaveLength(0);
      expect(state.encounterDeck).toContain(a);
    });

    it('with an empty encounter deck the extra card comes from the reshuffled discard and acceleration increases', () => {
      const [a] = deckWithFillers('a');
      state.encounterDeck = [];
      state.encounterDiscard = [a];
      const acceleration = state.accelerationTokens;
      revealCode('01191');
      expect(state.accelerationTokens).toBe(acceleration + 1);
      expect(revealed(a)).toBe(true);
    });
  });

  it('the six printed Surge cards carry the Surge keyword in the catalog', () => {
    for (const code of PRINTED_SURGE) {
      expect(cardCatalog.getCard(code)!.keywords, code).toContain(Keyword.SURGE);
    }
  });
});
