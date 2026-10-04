import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  peekDecisionPrompt,
  step4_revealEncounterCards,
  getActiveMainScheme,
} from '@engine/index';

/**
 * Hydra Bomber (01110), Hydra minion: "When Revealed: Choose to either take 2 damage or place
 * 1 threat on the main scheme." The player revealing it is "you" (RR v1.8 Reveal): only that
 * player's identity takes the damage (#133).
 */
describe('Hydra Bomber (01110) When Revealed (Issue #133)', () => {
  let state: GameState;

  const heroOf = (code: string) => cardCatalog.getCard(code) as HeroCard;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: heroOf('01001a'),
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: heroOf('01029a'),
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const player of state.players) {
      player.currentForm = 'hero';
      player.activeFormCard = player.hero;
    }
  });

  const revealFor = (playerId: string) => {
    const bomber = createCardInstance(cardCatalog.getCard('01110')!);
    state.players.find((p) => p.id === playerId)!.dealtEncounterCards.push(bomber);
    return { bomber, prompted: step4_revealEncounterCards(state) };
  };

  it('prompts the revealing player, who now has the Bomber engaged', () => {
    const { bomber, prompted } = revealFor('p2');
    const prompt = peekDecisionPrompt(prompted);
    expect(prompt).toBeDefined();
    expect(prompt!.playerId).toBe('p2');
    expect(prompt!.options.map((o) => o.id)).toEqual(['take_damage', 'place_threat']);
    expect(prompted.players[1].engagedMinions.some((m) => m.instanceId === bomber.instanceId)).toBe(
      true,
    );
  });

  it('"take 2 damage" damages only the revealing player', () => {
    const p1Before = state.players[0].health;
    const p2Before = state.players[1].health;
    const { prompted } = revealFor('p2');
    const { state: next, result } = dispatchAction(prompted, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p2',
      selectedOptionId: 'take_damage',
    });
    expect(result.success).toBe(true);
    expect(next.players[1].health).toBe(p2Before - 2);
    expect(next.players[0].health).toBe(p1Before);
  });

  it('"place 1 threat" adds exactly 1 threat to the main scheme and damages no one', () => {
    const p1Before = state.players[0].health;
    const p2Before = state.players[1].health;
    const threatBefore = getActiveMainScheme(state).threat;
    const { prompted } = revealFor('p2');
    const { state: next } = dispatchAction(prompted, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p2',
      selectedOptionId: 'place_threat',
    });
    expect(getActiveMainScheme(next).threat).toBe(threatBefore + 1);
    expect(next.players[0].health).toBe(p1Before);
    expect(next.players[1].health).toBe(p2Before);
  });
  it('"take 2 damage" also applies when the revealing player is in alter-ego form', () => {
    state.players[1].currentForm = 'alter_ego';
    state.players[1].activeFormCard = state.players[1].alterEgo;
    const p2Before = state.players[1].health;
    const { prompted } = revealFor('p2');
    const { state: next } = dispatchAction(prompted, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p2',
      selectedOptionId: 'take_damage',
    });
    expect(next.players[1].health).toBe(p2Before - 2);
    expect(next.players[0].health).toBe(state.players[0].health);
  });
});
