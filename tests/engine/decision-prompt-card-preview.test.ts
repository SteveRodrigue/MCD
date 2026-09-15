import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardType } from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { step5_revealEncounterCards } from '../../src/engine/pipeline/villain-phase';
import { executeEffect } from '../../src/engine/effects';

describe('Decision Prompt Card Preview Invariant (Issue #104)', () => {
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
  });

  it('Enhanced Spider-Sense (01004) prompt attaches triggering encounter card (False Alarm 01112)', () => {
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    state.players[0].hand.push(spiderSense);

    const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
    state.players[0].dealtEncounterCards.push(falseAlarm);

    const nextState = step5_revealEncounterCards(state);

    expect(nextState.pendingDecisionPrompt).toBeDefined();
    const prompt = nextState.pendingDecisionPrompt!;

    expect(prompt.triggerSourceCard).toBeDefined();
    expect(prompt.triggerSourceCard?.code).toBe('01112');
    expect(prompt.triggerSourceCard?.name).toBe('False Alarm');
    expect(prompt.triggerSourceCard?.type).toBe(CardType.TREACHERY);
    expect(prompt.triggerSourceCode).toBe('01112');
    expect(prompt.sourceCardCode).toBe('01004');
  });

  it('Hydra Bomber (01110) PLAYER_CHOICE attaches source card code and triggerSourceCard', () => {
    const bomberCard = cardCatalog.getCard('01110')!;
    const bomberInstance = createCardInstance(bomberCard);
    const ability = bomberCard.enrichment!.abilities![0];

    executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: bomberInstance,
    });

    expect(state.pendingDecisionPrompt).toBeDefined();
    const prompt = state.pendingDecisionPrompt!;

    expect(prompt.sourceCardCode).toBe('01110');
    expect(prompt.triggerSourceCard).toBeDefined();
    expect(prompt.triggerSourceCard?.code).toBe('01110');
  });
});
