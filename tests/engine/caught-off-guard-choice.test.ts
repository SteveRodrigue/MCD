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
  executeEffect,
} from '@engine/index';

describe('Caught Off Guard (01188) Discard Choice and Surge Behavior (Issue #184)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    resetInstanceCounter();

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
  });

  it('Test 1: Revealing Caught Off Guard with 2+ upgrades/supports enqueues decision prompt with both options', () => {
    const mansion = createCardInstance(cardCatalog.getCard('01091')!); // Avengers Mansion (Support)
    const shooter = createCardInstance(cardCatalog.getCard('01008')!); // Web-Shooter (Upgrade)
    state.players[0].tableau.push(mansion, shooter);

    const caughtOffGuard = createCardInstance(cardCatalog.getCard('01188')!);
    state.players[0].dealtEncounterCards.push(caughtOffGuard);

    const nextState = step4_revealEncounterCards(state);

    const prompt = peekDecisionPrompt(nextState);
    expect(prompt).toBeDefined();
    expect(prompt!.title).toBe('Discard Upgrade or Support');
    expect(prompt!.isVoluntary).toBe(false);
    expect(prompt!.options.length).toBe(2);
    expect(prompt!.options.map((o) => o.id)).toEqual([mansion.instanceId, shooter.instanceId]);
    expect(prompt!.options.map((o) => o.label)).toEqual(['Avengers Mansion', 'Web-Shooter']);
    // Both cards remain in tableau until choice is resolved
    expect(nextState.players[0].tableau.length).toBe(2);
  });

  it('Test 2: Resolving decision prompt for one card discards that card and keeps the other in tableau without Surge', () => {
    const mansion = createCardInstance(cardCatalog.getCard('01091')!); // Avengers Mansion (Support)
    const shooter = createCardInstance(cardCatalog.getCard('01008')!); // Web-Shooter (Upgrade)
    state.players[0].tableau.push(mansion, shooter);

    const caughtOffGuard = createCardInstance(cardCatalog.getCard('01188')!);
    state.players[0].dealtEncounterCards.push(caughtOffGuard);

    const promptState = step4_revealEncounterCards(state);
    const prompt = peekDecisionPrompt(promptState);
    expect(prompt).toBeDefined();

    // Player chooses to discard Avengers Mansion
    const resolveAction = dispatchAction(promptState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: mansion.instanceId,
    });

    expect(resolveAction.result.success).toBe(true);

    // Avengers Mansion discarded to player discard pile
    expect(
      resolveAction.state.players[0].tableau.some((c) => c.instanceId === mansion.instanceId),
    ).toBe(false);
    expect(
      resolveAction.state.players[0].discard.some((c) => c.instanceId === mansion.instanceId),
    ).toBe(true);

    // Web-Shooter remains safely in tableau
    expect(
      resolveAction.state.players[0].tableau.some((c) => c.instanceId === shooter.instanceId),
    ).toBe(true);

    // No Surge: player dealtEncounterCards is empty
    expect(resolveAction.state.players[0].dealtEncounterCards.length).toBe(0);

    // Discard log entry includes player and discarded card name
    const discardLog = resolveAction.state.log.find((l) => l.key === 'player.tableau.discarded');
    expect(discardLog).toBeDefined();
    expect(discardLog!.params?.player).toBe('Spider-Man');
    expect(discardLog!.params?.card).toBe('Avengers Mansion');

    // Prompt is cleared from the queue
    expect(peekDecisionPrompt(resolveAction.state)).toBeUndefined();
  });

  it('Test 3: Revealing with exactly 1 upgrade/support auto-discards without prompt and without Surge', () => {
    const shooter = createCardInstance(cardCatalog.getCard('01008')!); // Web-Shooter (Upgrade)
    state.players[0].tableau.push(shooter);

    const caughtOffGuard = createCardInstance(cardCatalog.getCard('01188')!);
    state.players[0].dealtEncounterCards.push(caughtOffGuard);

    const nextState = step4_revealEncounterCards(state);

    // No prompt enqueued
    expect(peekDecisionPrompt(nextState)).toBeUndefined();

    // Web-Shooter auto-discarded
    expect(nextState.players[0].tableau.length).toBe(0);
    expect(nextState.players[0].discard.some((c) => c.instanceId === shooter.instanceId)).toBe(
      true,
    );

    // Auto-discard log entry includes player and discarded card name
    const discardLog = nextState.log.find((l) => l.key === 'player.tableau.discarded');
    expect(discardLog).toBeDefined();
    expect(discardLog!.params?.player).toBe('Spider-Man');
    expect(discardLog!.params?.card).toBe('Web-Shooter');

    // No Surge triggered
    expect(nextState.players[0].dealtEncounterCards.length).toBe(0);
  });

  it('Test 4: Revealing with 0 upgrades/supports discards nothing and deals a Surge encounter card', () => {
    state.players[0].tableau = [];
    const initialDealtCount = state.players[0].dealtEncounterCards.length;

    const caughtOffGuard = createCardInstance(cardCatalog.getCard('01188')!);
    const ability = caughtOffGuard.card.enrichment!.abilities![0];

    // Direct effect execution test: verifies SURGE fallback triggers and adds dealt encounter card
    const res = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: caughtOffGuard,
    });

    expect(res.success).toBe(true);
    expect(res.onomatopoeia).toBe('SURGE!');
    expect(state.players[0].tableau.length).toBe(0);
    expect(state.players[0].dealtEncounterCards.length).toBe(initialDealtCount + 1);
  });

  it('Test 5: 2-player multiplayer scenario routes prompt to dealt player and logs resolution under that player', () => {
    const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;

    const twoPlayerState = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    twoPlayerState.players[0].currentForm = 'hero';
    twoPlayerState.players[0].activeFormCard = spiderManHero;
    twoPlayerState.players[1].currentForm = 'hero';
    twoPlayerState.players[1].activeFormCard = captainMarvelHero;

    // Give p2 two cards in tableau (Support + Upgrade)
    const mansion = createCardInstance(cardCatalog.getCard('01091')!); // Avengers Mansion (Support)
    const cosmicFlight = createCardInstance(cardCatalog.getCard('01017')!); // Cosmic Flight (Upgrade)
    twoPlayerState.players[1].tableau.push(mansion, cosmicFlight);

    // p2 is dealt Caught Off Guard
    const caughtOffGuard = createCardInstance(cardCatalog.getCard('01188')!);
    twoPlayerState.players[1].dealtEncounterCards.push(caughtOffGuard);

    const promptState = step4_revealEncounterCards(twoPlayerState);
    const prompt = peekDecisionPrompt(promptState);

    expect(prompt).toBeDefined();
    expect(prompt!.playerId).toBe('p2');
    expect(prompt!.title).toBe('Discard Upgrade or Support');
    expect(prompt!.options.map((o) => o.id)).toEqual([mansion.instanceId, cosmicFlight.instanceId]);

    // Resolve choice: p2 chooses Cosmic Flight
    const resolveAction = dispatchAction(promptState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p2',
      selectedOptionId: cosmicFlight.instanceId,
    });

    expect(resolveAction.result.success).toBe(true);
    expect(
      resolveAction.state.players[1].tableau.some((c) => c.instanceId === cosmicFlight.instanceId),
    ).toBe(false);
    expect(
      resolveAction.state.players[1].tableau.some((c) => c.instanceId === mansion.instanceId),
    ).toBe(true);
    expect(
      resolveAction.state.players[1].discard.some((c) => c.instanceId === cosmicFlight.instanceId),
    ).toBe(true);

    const discardLog = resolveAction.state.log.find((l) => l.key === 'player.tableau.discarded');
    expect(discardLog).toBeDefined();
    expect(discardLog!.params?.player).toBe('Captain Marvel');
    expect(discardLog!.params?.card).toBe('Cosmic Flight');
  });
});
