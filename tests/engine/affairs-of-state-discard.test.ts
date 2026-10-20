import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';

const AFFAIRS_OF_STATE = '01155';
const PANTHER_CLAWS = '01047'; // Black Panther Upgrade
const VIBRANIUM_SUIT = '01049'; // Black Panther Upgrade
const ARMORED_VEST = '01081'; // Generic Upgrade (not Black Panther)
const AVENGERS_MANSION = '01091'; // Support

describe('Affairs of State (01155): two-stage choice and Black Panther upgrade discard prompt', () => {
  let state: GameState;
  let blackPantherHero: HeroCard;
  let tchallaAlterEgo: AlterEgoCard;

  beforeEach(() => {
    blackPantherHero = cardCatalog.getCard('01040a') as HeroCard;
    tchallaAlterEgo = cardCatalog.getCard('01040b') as AlterEgoCard;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: "T'Challa",
          hero: blackPantherHero,
          alterEgo: tchallaAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = tchallaAlterEgo;
  });

  it('selecting take_effect with 2+ Black Panther upgrades enqueues secondary Discard Black Panther Upgrade prompt ignoring non-BP upgrades', () => {
    const claws = createCardInstance(cardCatalog.getCard(PANTHER_CLAWS)!);
    const suit = createCardInstance(cardCatalog.getCard(VIBRANIUM_SUIT)!);
    const vest = createCardInstance(cardCatalog.getCard(ARMORED_VEST)!);
    const mansion = createCardInstance(cardCatalog.getCard(AVENGERS_MANSION)!);

    state.players[0].tableau.push(claws, suit, vest, mansion);

    state.players[0].dealtEncounterCards.push(
      createCardInstance(cardCatalog.getCard(AFFAIRS_OF_STATE)!),
    );
    state = step4_revealEncounterCards(state);

    const firstPrompt = peekDecisionPrompt(state);
    expect(firstPrompt).toBeDefined();
    expect(firstPrompt!.title).toBe('Affairs of State');
    expect(firstPrompt!.options.map((o) => o.id)).toContain('take_effect');

    // Player selects option to discard a Black Panther upgrade
    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'take_effect',
    }).state;

    // Secondary prompt enqueued with dynamic title and description
    const secondPrompt = peekDecisionPrompt(state);
    expect(secondPrompt).toBeDefined();
    expect(secondPrompt!.title).toBe('Discard Black Panther Upgrade');
    expect(secondPrompt!.description).toBe(
      'Choose a Black Panther upgrade you control to discard:',
    );
    expect(secondPrompt!.sourceCardName).toBe('Affairs of State');

    // Options only contain Black Panther upgrades
    const optionIds = secondPrompt!.options.map((o) => o.id);
    expect(optionIds).toContain(claws.instanceId);
    expect(optionIds).toContain(suit.instanceId);
    expect(optionIds).not.toContain(vest.instanceId);
    expect(optionIds).not.toContain(mansion.instanceId);

    // Resolve choice: player chooses Panther Claws
    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: claws.instanceId,
    }).state;

    // Claws discarded, others remain in tableau
    expect(state.players[0].tableau.some((c) => c.instanceId === claws.instanceId)).toBe(false);
    expect(state.players[0].tableau.some((c) => c.instanceId === suit.instanceId)).toBe(true);
    expect(state.players[0].tableau.some((c) => c.instanceId === vest.instanceId)).toBe(true);
    expect(state.players[0].tableau.some((c) => c.instanceId === mansion.instanceId)).toBe(true);
    expect(state.players[0].discard.some((c) => c.instanceId === claws.instanceId)).toBe(true);

    // Combat log entry names the discarded card
    const discardLog = state.log.find((l) => l.key === 'player.tableau.discarded');
    expect(discardLog).toBeDefined();
    expect(discardLog!.params?.player).toBe("T'Challa");
    expect(discardLog!.params?.card).toBe('Panther Claws');
  });

  it('selecting take_effect with exactly 1 Black Panther upgrade auto-discards without second prompt and logs card name', () => {
    const claws = createCardInstance(cardCatalog.getCard(PANTHER_CLAWS)!);
    const vest = createCardInstance(cardCatalog.getCard(ARMORED_VEST)!);
    const mansion = createCardInstance(cardCatalog.getCard(AVENGERS_MANSION)!);

    state.players[0].tableau.push(claws, vest, mansion);

    state.players[0].dealtEncounterCards.push(
      createCardInstance(cardCatalog.getCard(AFFAIRS_OF_STATE)!),
    );
    state = step4_revealEncounterCards(state);

    const firstPrompt = peekDecisionPrompt(state);
    expect(firstPrompt).toBeDefined();

    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'take_effect',
    }).state;

    // Auto-discarded claws without secondary prompt
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].tableau.some((c) => c.instanceId === claws.instanceId)).toBe(false);
    expect(state.players[0].tableau.some((c) => c.instanceId === vest.instanceId)).toBe(true);
    expect(state.players[0].tableau.some((c) => c.instanceId === mansion.instanceId)).toBe(true);
    expect(state.players[0].discard.some((c) => c.instanceId === claws.instanceId)).toBe(true);

    const discardLog = state.log.find((l) => l.key === 'player.tableau.discarded');
    expect(discardLog).toBeDefined();
    expect(discardLog!.params?.player).toBe("T'Challa");
    expect(discardLog!.params?.card).toBe('Panther Claws');
  });
});
