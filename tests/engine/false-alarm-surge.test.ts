import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance, StatusCard } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { step4_revealEncounterCards } from '@engine/index';

// False Alarm (01112), #242:
// "When Revealed: You are confused. If you are already confused, this card gains surge."
describe('False Alarm (01112): surge when you are already confused (#242)', () => {
  let state: GameState;
  let fillers: CardInstance[];

  const filler = (name: string): CardInstance =>
    createCardInstance({
      code: `filler-${name}`,
      name: `Filler ${name}`,
      type: 'treachery',
      faction: 'encounter',
    } as any);

  const setForm = (form: 'hero' | 'alter_ego') => {
    const p = state.players[0];
    p.currentForm = form;
    p.activeFormCard = form === 'hero' ? p.hero : p.alterEgo;
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
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    setForm('hero');
    // Fillers on top: a surge reveals filler a, never a card of the shuffled Rhino deck.
    fillers = [filler('a'), filler('b')];
    state.encounterDeck = [...fillers, ...state.encounterDeck];
  });

  const revealFalseAlarm = () => {
    state.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01112')!));
    state = step4_revealEncounterCards(state);
  };
  const revealed = (card: CardInstance) =>
    state.encounterDiscard.some((c) => c.instanceId === card.instanceId);
  const confusedCount = () =>
    (state.players[0].statusCards ?? []).filter((s) => s === StatusCard.CONFUSED).length;

  it.each(['hero', 'alter_ego'] as const)(
    'not confused (%s form): becomes confused, no surge',
    (form) => {
      setForm(form);
      revealFalseAlarm();
      expect(confusedCount()).toBe(1);
      expect(revealed(fillers[0])).toBe(false);
    },
  );

  it.each(['hero', 'alter_ego'] as const)(
    'already confused (%s form): stays at one confused card and surges exactly once',
    (form) => {
      setForm(form);
      state.players[0].statusCards = [StatusCard.CONFUSED];
      revealFalseAlarm();
      expect(confusedCount()).toBe(1);
      expect(revealed(fillers[0])).toBe(true);
      expect(revealed(fillers[1])).toBe(false);
    },
  );
});
