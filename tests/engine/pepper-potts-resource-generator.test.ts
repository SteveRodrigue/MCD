import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { canPlayCard, evaluateCardPlayability } from '@engine/pipeline/legality-checker';

describe('Pepper Potts (01033) Dynamic Resource Generator — RR v1.8 & Issue #13', () => {
  let state: GameState;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = ironManHero;
  });

  it('1. Pepper Potts generates 2 Energy resources when Energy (01088) is on top of discard', () => {
    const player = state.players[0];
    const energyCard = createCardInstance(cardCatalog.getCard('01088')!); // 2 Energy
    player.discard = [energyCard];

    const pepperCard = cardCatalog.getCard('01033')!;
    const ability = pepperCard.enrichment!.abilities![0];

    const result = executeEffect(state, ability, {
      playerId: 'p1',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe(2);
    expect(result.onomatopoeia).toContain('RESOURCES!');
  });

  it('2. Pepper Potts generates 2 Mental resources when Genius (01089) is on top of discard', () => {
    const player = state.players[0];
    const geniusCard = createCardInstance(cardCatalog.getCard('01089')!); // 2 Mental
    player.discard = [geniusCard];

    const pepperCard = cardCatalog.getCard('01033')!;
    const ability = pepperCard.enrichment!.abilities![0];

    const result = executeEffect(state, ability, {
      playerId: 'p1',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe(2);
  });

  it('3. Pepper Potts generates 1 Wild resource when The Power of Leadership (01072) is on top of discard', () => {
    const player = state.players[0];
    const powerOfCard = createCardInstance(cardCatalog.getCard('01072')!); // 1 printed Wild
    player.discard = [powerOfCard];

    const pepperCard = cardCatalog.getCard('01033')!;
    const ability = pepperCard.enrichment!.abilities![0];

    const result = executeEffect(state, ability, {
      playerId: 'p1',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe(1);
    expect(result.onomatopoeia).toContain('[wild]');
  });

  it('4. Pepper Potts generates 2 Physical resources when Strength (01090) is on top of discard', () => {
    const player = state.players[0];
    const strengthCard = createCardInstance(cardCatalog.getCard('01090')!); // 2 Physical
    player.discard = [strengthCard];

    const pepperCard = cardCatalog.getCard('01033')!;
    const ability = pepperCard.enrichment!.abilities![0];

    const result = executeEffect(state, ability, {
      playerId: 'p1',
    });

    expect(result.success).toBe(true);
    expect(result.value).toBe(2);
    expect(result.onomatopoeia).toContain('[physical]');
  });

  it('5. Pepper Potts cannot be initiated when player discard pile is empty (RR v1.8 p. 16, 25)', () => {
    const player = state.players[0];
    player.discard = [];

    const pepperCard = cardCatalog.getCard('01033')!;
    const pepperInst = createCardInstance(pepperCard);
    player.tableau.push(pepperInst);

    // Try paying for a 2-cost card using Pepper Potts
    const cardToPlay = createCardInstance(cardCatalog.getCard('01035')!); // Arc Reactor (cost 2)
    player.hand = [cardToPlay];

    const legalResult = canPlayCard(state, 'p1', cardToPlay, [], [pepperInst.instanceId]);
    expect(legalResult.allowed).toBe(false);
    expect(legalResult.reason).toContain('cannot generate resources');

    // Also evaluateCardPlayability reports Pepper Potts as providing 0 potential resources
    const playability = evaluateCardPlayability(state, 'p1', cardToPlay);
    expect(playability.maxPotentialResources).toBe(0);
    expect(playability.isPlayable).toBe(false);
  });

  it('6. Pepper Potts exhaust cost applies properly when selected as generator during card play', () => {
    const player = state.players[0];
    const energyCard = createCardInstance(cardCatalog.getCard('01088')!); // 2 Energy
    player.discard = [energyCard];

    const pepperCard = cardCatalog.getCard('01033')!;
    const pepperInst = createCardInstance(pepperCard);
    player.tableau.push(pepperInst);

    const arcReactor = createCardInstance(cardCatalog.getCard('01035')!); // Arc Reactor (cost 2)
    player.hand = [arcReactor];

    // Card play is legal because Pepper provides 2 resources
    const legalResult = canPlayCard(state, 'p1', arcReactor, [], [pepperInst.instanceId]);
    expect(legalResult.allowed).toBe(true);

    const actionResult = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: arcReactor.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: [pepperInst.instanceId],
    });

    expect(actionResult.result.success).toBe(true);
    // Pepper Potts must be exhausted
    const updatedPepper = actionResult.state.players[0].tableau.find(
      (c) => c.instanceId === pepperInst.instanceId,
    );
    expect(updatedPepper?.exhausted).toBe(true);
    // Arc reactor entered play
    expect(
      actionResult.state.players[0].tableau.some((c) => c.instanceId === arcReactor.instanceId),
    ).toBe(true);
  });

  it('7. Action dispatcher pushes exact printed resources of top discard card to resourcesSpent', () => {
    const player = state.players[0];
    const energyCard = createCardInstance(cardCatalog.getCard('01088')!); // 2 Energy
    player.discard = [energyCard];

    const pepperCard = cardCatalog.getCard('01033')!;
    const pepperInst = createCardInstance(pepperCard);
    player.tableau.push(pepperInst);

    // Play Arc Reactor
    const cardToPlay = createCardInstance(cardCatalog.getCard('01035')!);
    player.hand = [cardToPlay];

    const actionResult = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: cardToPlay.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: [pepperInst.instanceId],
    });

    expect(actionResult.result.success).toBe(true);
    // Pepper Potts was used and exhausted
    const updatedPepper = actionResult.state.players[0].tableau.find(
      (c) => c.instanceId === pepperInst.instanceId,
    );
    expect(updatedPepper?.exhausted).toBe(true);
  });
});
