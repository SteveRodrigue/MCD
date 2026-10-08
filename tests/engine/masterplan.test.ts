import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  SideSchemeCard,
  CardInstance,
  AbilityStep,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  step4_revealEncounterCards,
  executeEffect,
} from '@engine/index';
import { evaluateStepGate, isStepGateClosedByState } from '@engine/pipeline/step-gate-evaluator';

const MASTERPLAN = '01192';
const CROWD_CONTROL = '01108'; // side scheme
const BREAKIN_AND_TAKIN = '01107'; // side scheme, When Revealed: +1 threat per player
const HYDRA_MERCENARY = '01101'; // minion
const HARD_TO_KEEP_DOWN = '01104'; // treachery
const IM_TOUGH = '01105'; // treachery

/**
 * Issue #245: Masterplan (01192): "When Revealed: Place 4 threat on each side scheme. If there are
 * no side schemes in play, discard cards from the top of the encounter deck until a side scheme is
 * discarded. Reveal that side scheme." Empty deck rule: RR v1.8 glossary "Encounter Deck".
 */
describe('Masterplan 01192 (Issue #245)', () => {
  let state: GameState;

  const inst = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);
  const sideSchemeBase = (code: string): number => {
    const card = cardCatalog.getCard(code) as SideSchemeCard;
    return card.baseThreat * (card.baseThreatFixed ? 1 : state.players.length);
  };
  const addSideScheme = (code: string, threat: number): CardInstance => {
    const card = cardCatalog.getCard(code) as SideSchemeCard;
    const instance = createCardInstance(card);
    state.sideSchemes.push({ instanceId: instance.instanceId, card, threat });
    return instance;
  };
  const revealMasterplan = () => {
    state.players[0].dealtEncounterCards.push(inst(MASTERPLAN));
    state = step4_revealEncounterCards(state);
  };

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
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
      p.dealtEncounterCards = [];
    }
    state.sideSchemes = [];
    state.encounterDiscard = [];
    state.accelerationTokens = 0;
  });

  it('1. places 4 threat on the single side scheme and touches neither deck nor discard', () => {
    const crowd = addSideScheme(CROWD_CONTROL, 2);
    const deck = [inst(HARD_TO_KEEP_DOWN), inst(HYDRA_MERCENARY)];
    state.encounterDeck = [...deck];

    revealMasterplan();

    expect(state.sideSchemes.find((s) => s.instanceId === crowd.instanceId)!.threat).toBe(6);
    expect(state.sideSchemes).toHaveLength(1);
    expect(state.encounterDeck.map((c) => c.instanceId)).toEqual(deck.map((c) => c.instanceId));
    // Masterplan itself is the only card in the discard pile (treachery resolution).
    expect(state.encounterDiscard.map((c) => c.card.code)).toEqual([MASTERPLAN]);
    expect(state.accelerationTokens).toBe(0);
  });

  it('2. places 4 threat on each of two side schemes', () => {
    const a = addSideScheme(CROWD_CONTROL, 2);
    const b = addSideScheme(BREAKIN_AND_TAKIN, 3);
    state.encounterDeck = [inst(HARD_TO_KEEP_DOWN)];

    revealMasterplan();

    expect(state.sideSchemes.find((s) => s.instanceId === a.instanceId)!.threat).toBe(6);
    expect(state.sideSchemes.find((s) => s.instanceId === b.instanceId)!.threat).toBe(7);
    expect(state.encounterDeck).toHaveLength(1);
  });

  it('3. with no side scheme, discards until one, reveals it through the real reveal path, leaves the rest', () => {
    const treachery = inst(HARD_TO_KEEP_DOWN);
    const minion = inst(HYDRA_MERCENARY);
    const breakin = inst(BREAKIN_AND_TAKIN);
    const x = inst(IM_TOUGH);
    state.encounterDeck = [treachery, minion, breakin, x];

    revealMasterplan();

    expect(state.encounterDiscard.map((c) => c.instanceId)).toEqual(
      expect.arrayContaining([treachery.instanceId, minion.instanceId]),
    );
    expect(state.encounterDiscard.some((c) => c.instanceId === breakin.instanceId)).toBe(false);
    // The minion was discarded, never put in play.
    expect(state.players.some((p) => p.engagedMinions.length > 0)).toBe(false);

    expect(state.sideSchemes).toHaveLength(1);
    expect(state.sideSchemes[0].instanceId).toBe(breakin.instanceId);
    // Starting threat plus its When Revealed ("an additional 1 per hero").
    expect(state.sideSchemes[0].threat).toBe(
      sideSchemeBase(BREAKIN_AND_TAKIN) + state.players.length,
    );

    expect(state.encounterDeck.map((c) => c.instanceId)).toEqual([x.instanceId]);
    expect(state.accelerationTokens).toBe(0);

    const discardLog = state.log.find(
      (l) =>
        l.key === 'card.discarded.fromDeck' &&
        String(l.params?.cards).includes(cardCatalog.getCard(HYDRA_MERCENARY)!.name),
    );
    expect(discardLog).toBeDefined();
    expect(state.log.some((l) => l.key === 'encounter.reveal.sideScheme')).toBe(true);
  });

  it('4. with no side scheme in the deck, discards everything, resets the deck, places one acceleration token and does not continue', () => {
    const treachery = inst(HARD_TO_KEEP_DOWN);
    const minion = inst(HYDRA_MERCENARY);
    state.encounterDeck = [treachery, minion];

    revealMasterplan();

    expect(state.sideSchemes).toHaveLength(0);
    expect(state.accelerationTokens).toBe(1);
    // The discarded cards are the new (shuffled) deck; the effect did not continue into it.
    expect(state.encounterDeck.map((c) => c.instanceId).sort()).toEqual(
      [treachery.instanceId, minion.instanceId].sort(),
    );
    expect(state.encounterDiscard.map((c) => c.card.code)).toEqual([MASTERPLAN]);
    expect(state.log.some((l) => l.key === 'encounter.deck.empty')).toBe(true);
  });

  it('5. with no side scheme and a side scheme on top, discards nothing else and reveals it', () => {
    const crowd = inst(CROWD_CONTROL);
    const x = inst(HARD_TO_KEEP_DOWN);
    state.encounterDeck = [crowd, x];

    revealMasterplan();

    expect(state.sideSchemes.map((s) => s.instanceId)).toEqual([crowd.instanceId]);
    expect(state.encounterDeck.map((c) => c.instanceId)).toEqual([x.instanceId]);
    expect(state.encounterDiscard.map((c) => c.card.code)).toEqual([MASTERPLAN]);
    expect(state.log.some((l) => l.key === 'encounter.reveal.sideScheme')).toBe(true);
  });

  it('6. ADD_THREAT on ALL_SIDE_SCHEMES with no side scheme places nothing and touches no deck', () => {
    const deck = [inst(CROWD_CONTROL), inst(HARD_TO_KEEP_DOWN)];
    state.encounterDeck = [...deck];

    const res = executeEffect(
      state,
      { effect: 'ADD_THREAT', effectParams: { amount: 4, target: 'ALL_SIDE_SCHEMES' } },
      { playerId: 'p1' },
    );

    expect(res.mutatedState).toBe(false);
    expect(state.sideSchemes).toHaveLength(0);
    expect(state.encounterDeck.map((c) => c.instanceId)).toEqual(deck.map((c) => c.instanceId));
    expect(state.encounterDiscard).toHaveLength(0);
  });

  describe('7. IF_ZONE_EMPTY gate', () => {
    const gateStep = (zone: any): AbilityStep => ({
      effect: 'DRAW',
      gate: 'IF_ZONE_EMPTY',
      gateParams: { zone },
    });
    const isOpen = (zone: any) =>
      evaluateStepGate(gateStep(zone), undefined, state, { playerId: 'p1' });

    it('SIDE_SCHEMES', () => {
      expect(isOpen('SIDE_SCHEMES')).toBe(true);
      addSideScheme(CROWD_CONTROL, 2);
      expect(isOpen('SIDE_SCHEMES')).toBe(false);
    });

    it('ENCOUNTER_DECK', () => {
      state.encounterDeck = [];
      expect(isOpen('ENCOUNTER_DECK')).toBe(true);
      state.encounterDeck = [inst(HARD_TO_KEEP_DOWN)];
      expect(isOpen('ENCOUNTER_DECK')).toBe(false);
    });

    it('ENCOUNTER_DISCARD', () => {
      state.encounterDiscard = [];
      expect(isOpen('ENCOUNTER_DISCARD')).toBe(true);
      state.encounterDiscard = [inst(HARD_TO_KEEP_DOWN)];
      expect(isOpen('ENCOUNTER_DISCARD')).toBe(false);
    });

    it.each(['HAND', 'DECK', 'DISCARD'] as const)(
      'player zone %s uses the player resolving the ability',
      (zone) => {
        const key = zone.toLowerCase() as 'hand' | 'deck' | 'discard';
        state.players[0][key] = [];
        state.players[1][key] = [inst(HARD_TO_KEEP_DOWN)];
        expect(isOpen(zone)).toBe(true);
        state.players[0][key] = [inst(HARD_TO_KEEP_DOWN)];
        expect(isOpen(zone)).toBe(false);
        state.players[0][key] = [];
        expect(
          evaluateStepGate(gateStep(zone), undefined, state, {
            playerId: 'p2',
          }),
        ).toBe(false);
      },
    );

    it('is state-only, so the gate is reported closed by state', () => {
      addSideScheme(CROWD_CONTROL, 2);
      expect(isStepGateClosedByState(gateStep('SIDE_SCHEMES'), state, { playerId: 'p1' })).toBe(
        true,
      );
      state.sideSchemes = [];
      expect(isStepGateClosedByState(gateStep('SIDE_SCHEMES'), state, { playerId: 'p1' })).toBe(
        false,
      );
    });
  });
});
