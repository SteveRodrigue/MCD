import { describe, it, expect } from 'vitest';
import { executeEffect } from '../../src/engine/effects';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { createCardInstance } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, Keyword, NormalizedCard } from '../../src/engine/models';
import { newRhinoGame } from '../support/game-fixtures';

describe('DecisionPromptOption.cardCode single source (Issue #573)', () => {
  it('SEARCH_AND_SELECT sets cardCode and cardName directly on each candidate option', () => {
    const state = newRhinoGame();
    const player = state.players[0];

    const backflip = cardCatalog.getCard('01003')!;
    const kick = cardCatalog.getCard('01004')!;

    // Put two distinct events into discard
    player.discard = [createCardInstance(backflip), createCardInstance(kick)];

    // Execute SEARCH for 1 event from discard
    const result = executeEffect(
      state,
      {
        id: 'search_test',
        effect: 'SEARCH',
        effectParams: {
          source: 'DISCARD',
          target: 'EVENT',
          takeCount: 1,
          minimumTake: 1,
          destination: 'HAND',
        },
      },
      { playerId: player.id },
    );

    const prompt = peekDecisionPrompt(result.state);
    expect(prompt).toBeDefined();
    expect(prompt?.options.length).toBeGreaterThan(0);
    for (const opt of prompt!.options) {
      expect(opt.cardCode).toBeDefined();
      expect(typeof opt.cardCode).toBe('string');
      expect(opt.cardName).toBeDefined();
    }
  });

  it('PLAY_FROM_ZONE sets cardCode and cardName on each playable card option', () => {
    const state = newRhinoGame();
    const player = state.players[0];

    const blackCat: NormalizedCard = { ...cardCatalog.getCard('01002')!, cost: 0 };

    // Put a cost-0 ally into discard so it is immediately playable
    player.discard = [createCardInstance(blackCat)];

    const result = executeEffect(
      state,
      {
        id: 'make_the_call_test',
        effect: 'PLAY_FROM_ZONE',
        effectParams: {
          source: 'ANY_PLAYER_DISCARD',
          filter: { types: ['ally'] },
          costMode: 'PRINTED_COST',
          destination: 'TABLEAU',
          control: 'SELF',
        },
      },
      { playerId: player.id },
    );

    const prompt = peekDecisionPrompt(result.state);
    expect(prompt).toBeDefined();
    const playOption = prompt!.options.find((o) => o.effect === 'PLAY_CARD_FROM_ZONE_RESOLUTION');
    expect(playOption).toBeDefined();
    expect(playOption?.cardCode).toBe('01002');
    expect(playOption?.cardName).toBe('Black Cat');
  });

  it('optional FLIP_FORM sets cardCode and cardName for the alternate form', () => {
    const state = newRhinoGame();
    const player = state.players[0];

    const result = executeEffect(
      state,
      {
        id: 'flip_test',
        effect: 'FLIP_FORM',
        effectParams: {
          optional: true,
        },
      },
      { playerId: player.id },
    );

    const prompt = peekDecisionPrompt(result.state);
    expect(prompt).toBeDefined();
    const flipOption = prompt!.options.find((o) => o.effect === 'CHANGE_FORM');
    expect(flipOption).toBeDefined();
    expect(flipOption?.cardCode).toBe(
      player.availableForms.find((f) => f.code !== player.activeFormCard.code)?.code,
    );
    expect(flipOption?.cardName).toBeDefined();
  });

  it('DISCARD_RESTRICTED_REPLACEMENT sets cardCode and cardName on restricted candidates', () => {
    const state = newRhinoGame();
    const player = state.players[0];
    player.currentForm = 'hero';

    const restrictedCard: NormalizedCard = {
      ...cardCatalog.getCard('01005')!,
      code: 'plasma_gun_01',
      name: 'Plasma Gun',
      type: CardType.UPGRADE,
      keywords: [Keyword.RESTRICTED],
      cost: 0,
    };

    // Put 2 restricted cards in tableau (max 2 by default)
    const existingR1 = createCardInstance(restrictedCard);
    const existingR2 = createCardInstance(restrictedCard);
    player.tableau.push(existingR1, existingR2);

    // Card in hand is another restricted card (cost 0 for instant playing)
    const incomingR3 = createCardInstance(restrictedCard);
    player.hand = [incomingR3];

    const actionRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: player.id,
      cardInstanceId: incomingR3.instanceId,
      paymentCardInstanceIds: [],
    });

    const prompt = peekDecisionPrompt(actionRes.state);
    expect(prompt).toBeDefined();
    const restrictedOptions = prompt!.options.filter(
      (o) => o.effect === 'DISCARD_RESTRICTED_REPLACEMENT',
    );
    expect(restrictedOptions.length).toBe(2);
    for (const opt of restrictedOptions) {
      expect(opt.cardCode).toBe('plasma_gun_01');
      expect(opt.cardName).toBe('Plasma Gun');
    }
  });
});
