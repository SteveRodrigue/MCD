import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, SideSchemeCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { canBasicThwart } from '@engine/pipeline/legality-checker';
import { dispatchAction } from '@engine/pipeline';

describe('Keyword Icon: Crisis (Rules Reference v1.8 p. 11)', () => {
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
          name: 'Player 1',
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

  it('Crowd Control (01108) with Crisis icon prevents removing threat from main scheme', () => {
    const sideSchemeCard = cardCatalog.getCard('01108') as SideSchemeCard;
    const sideSchemeInstance = createCardInstance(sideSchemeCard);

    state.sideSchemes = [
      {
        instanceId: sideSchemeInstance.instanceId,
        card: sideSchemeCard,
        threat: 2,
      },
    ];

    state.mainScheme.threat = 5;

    // Cannot thwart main scheme while Crisis is active
    const check = canBasicThwart(state, 'p1', 'main_scheme');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Crisis');

    // Attempting to dispatch basic thwart on main scheme fails
    const res = dispatchAction(state, {
      type: 'BASIC_THWART',
      playerId: 'p1',
      targetType: 'main_scheme',
    });
    expect(res.result.success).toBe(false);

    // Can thwart the side scheme directly
    const sideCheck = canBasicThwart(state, 'p1', 'side_scheme', sideSchemeInstance.instanceId);
    expect(sideCheck.allowed).toBe(true);

    // Defeating Crisis side scheme unlocks thwarting main scheme
    state.sideSchemes = [];
    const unlockedCheck = canBasicThwart(state, 'p1', 'main_scheme');
    expect(unlockedCheck.allowed).toBe(true);
  });
});
