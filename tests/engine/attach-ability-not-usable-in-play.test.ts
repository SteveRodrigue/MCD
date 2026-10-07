import { describe, it, expect } from 'vitest';
import { GamePhase, HeroCard, AlterEgoCard } from '@engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { findInPlayCardInstance } from '@engine/state/state-validator';
import { evaluateTableauCardLegality } from '../../src/ui/components/board/tableau-card-legality';

/**
 * An upgrade with "Attach to X" attaches when it is played (RR v1.8 Attachment). The `timing` of its
 * attach ability only declares the identity form needed to play it: once attached, the card offers
 * no action of its own (#259).
 */
function buildGame() {
  const hero = cardCatalog.getCard('01001a') as HeroCard;
  const state = setupGame({
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      },
    ],
    villain: cardCatalog.getCard('01094') as any,
    mainScheme: cardCatalog.getCard('01097b') as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  state.phase = GamePhase.PLAYER_PHASE;
  state.activePlayerIndex = 0;
  state.players[0].currentForm = 'hero';
  state.players[0].activeFormCard = hero;
  return state;
}

describe('Attach abilities are not usable once attached (#259)', () => {
  it.each([
    ['01007', 'spider_tracer_attach'],
    ['01009', 'webbed_up_attach'],
  ])('%s attached to a minion exposes no action', (code, abilityId) => {
    const state = buildGame();
    const p1 = state.players[0];
    const minion = createCardInstance(cardCatalog.getCard('01110')!);
    p1.engagedMinions.push(minion);
    const upgrade = createCardInstance(cardCatalog.getCard(code)!);
    const energy = createCardInstance({
      ...cardCatalog.getCard('01014')!,
      resources: { physical: 0, energy: 5, mental: 0, wild: 0, total: 5 },
    });
    p1.hand = [upgrade, energy];

    const played = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: upgrade.instanceId,
      targetInstanceId: minion.instanceId,
      paymentCardInstanceIds: [energy.instanceId],
    });
    expect(played.result.success).toBe(true);
    const attached = findInPlayCardInstance(played.state, upgrade.instanceId);
    expect(attached).toBeDefined();

    const reuse = dispatchAction(played.state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: upgrade.instanceId,
      abilityId,
    } as any);
    expect(reuse.result.success).toBe(false);

    const legality = evaluateTableauCardLegality(attached!, 'hero', {
      gameState: played.state,
      playerId: 'p1',
    });
    expect(legality.isUsable).toBe(false);
  });
});
