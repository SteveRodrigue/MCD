import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  SideSchemeCard,
  CardInstance,
  getActiveMainScheme,
} from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';

describe('Superhuman Law Division (01026): pay once, then choose the scheme (#298)', () => {
  let state: GameState;
  let division: CardInstance;
  let payment: CardInstance;

  beforeEach(() => {
    const ironMan = cardCatalog.getCard('01029a') as HeroCard;
    const tony = cardCatalog.getCard('01029b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: ironMan,
          alterEgo: tony,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = tony;
    getActiveMainScheme(state).threat = 5;
    state.sideSchemes = [
      {
        instanceId: 'side_a',
        card: cardCatalog.getCard('01107') as SideSchemeCard,
        threat: 3,
      },
    ];

    division = createCardInstance(cardCatalog.getCard('01026')!);
    state.players[0].tableau.push(division);
    payment = createCardInstance(
      cardCatalog.getAllCards().find((c) => c.resources.mental >= 1 && c.type !== 'hero')!,
    );
    state.players[0].hand = [payment];
  });

  it('charges the cost once when the ability is used and removes 2 threat from the chosen scheme', () => {
    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: division.instanceId,
      abilityId: 'superhuman_law_division',
      paymentCardInstanceIds: [payment.instanceId],
    });
    expect(res.result.success).toBe(true);
    state = res.state;

    // Cost is already paid: card exhausted, payment card gone from hand.
    const inPlay = state.players[0].tableau.find((c) => c.instanceId === division.instanceId)!;
    expect(inPlay.exhausted).toBe(true);
    expect(state.players[0].hand).toHaveLength(0);

    const prompt = peekDecisionPrompt(state)!;
    expect(prompt).toBeDefined();
    const pick = prompt.options.find((o) => o.id === 'side_a')!;

    const discardBefore = state.players[0].discard.length;
    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: pick.id,
    }).state;

    expect(state.sideSchemes.find((s) => s.instanceId === 'side_a')!.threat).toBe(1);
    expect(getActiveMainScheme(state).threat).toBe(5);
    expect(state.players[0].discard).toHaveLength(discardBefore);
  });
});
