import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { canInitiateAbility } from '../../src/engine/pipeline/legality-checker';
import { getAvailableResources } from '../../src/engine/pipeline/cost-engine';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';

/**
 * A resource ability is triggered only while paying a cost (RR v1.8 "Resource Ability"), never as
 * an action of its own (#387). The gate is `canInitiateAbility`.
 */
describe('Web-Shooter (01008): its Hero Resource ability cannot be started outside a payment', () => {
  let state: GameState;
  let webShooter: CardInstance;

  beforeEach(() => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const peter = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderMan,
          alterEgo: peter,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.tokens = { damage: 0, threat: 0, counters: 3 };
    state.players[0].tableau.push(webShooter);
  });

  const ability = () => webShooter.card.enrichment!.abilities![0];

  it('the gate refuses to start it and says why', () => {
    const check = canInitiateAbility(state, 'p1', ability(), webShooter, {});
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/paying a cost/i);
  });

  it('USE_CARD_ABILITY fails and leaves the card ready with its counters', () => {
    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: webShooter.instanceId,
      abilityId: ability().id,
    });
    expect(res.result.success).toBe(false);
    const after = res.state.players[0].tableau.find((c) => c.instanceId === webShooter.instanceId)!;
    expect(after.exhausted).toBe(false);
    expect(after.tokens?.counters).toBe(3);
  });

  it('is not offered as a legal turn action', () => {
    const offered = getLegalActionsForPlayer(state, 'p1');
    expect(JSON.stringify(offered)).not.toContain(webShooter.instanceId);
  });

  it('still counts as a resource generator when paying a cost', () => {
    state.players[0].hand = [];
    const res = getAvailableResources(state.players[0], state);
    expect(res.generators).toBe(1);
  });
});
