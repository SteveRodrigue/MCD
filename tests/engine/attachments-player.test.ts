import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import { step2_villainActivations } from '@engine/pipeline/villain-phase';
import { getEffectiveAllyStats } from '@engine/pipeline/stat-calculator';

describe('Player Attachments & Upgrades Subsystem (Inspired, Webbed Up, Spider-Tracer)', () => {
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
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!), // 10 Swinging Web Kicks to prevent deck cycle in upkeep
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

  it('01074 Inspired: Grants +1 THW and +1 ATK to attached ally', () => {
    const daredevilCard = cardCatalog.getCard('01058')!; // 2 THW, 2 ATK
    const daredevilInstance = createCardInstance(daredevilCard);
    const inspiredCard = cardCatalog.getCard('01074')!;
    const inspiredInstance = createCardInstance(inspiredCard);

    // Attach Inspired to Daredevil
    daredevilInstance.attachments = [inspiredInstance];
    state.players[0].allies = [daredevilInstance];

    const stats = getEffectiveAllyStats(state, daredevilInstance);
    // Base 2 + 1 Inspired = 3 THW & 3 ATK
    expect(stats.thwart).toBe(3);
    expect(stats.attack).toBe(3);

    // Perform Ally Attack
    state.mainScheme.threat = 5;
    const initialVillainHp = state.villain.health;

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: daredevilInstance.instanceId,
      targetType: 'villain',
    });

    expect(res.result.success).toBe(true);
    // Daredevil attacks for 3
    expect(res.state.villain.health).toBe(initialVillainHp - 3);
  });

  it('01009 Webbed Up: Cancels villain attack, discards itself, and stuns the villain', () => {
    const webbedUpCard = cardCatalog.getCard('01009')!;
    const webbedUpInstance = createCardInstance(webbedUpCard);
    state.villain.attachments = [webbedUpInstance];
    state.villains[0].attachments = state.villain.attachments;

    const initialHeroHp = state.players[0].health;

    // Execute step 2 villain activations (Rhino would attack Spider-Man in hero form)
    const nextState = step2_villainActivations(state);

    // Attack must be cancelled
    expect(nextState.players[0].health).toBe(initialHeroHp);
    // Webbed Up must be discarded to player discard
    expect(nextState.villain.attachments.some((c) => c.card.code === '01009')).toBe(false);
    expect(nextState.players[0].discard.some((c) => c.card.code === '01009')).toBe(true);
    // Villain must now have STUNNED status
    expect(nextState.villain.statusCards).toContain(StatusCard.STUNNED);
  });

  it('01007 Spider-Tracer: Removes 3 threat from scheme when attached minion is defeated', () => {
    const minionCard = cardCatalog.getCard('01101')!; // Hydra Mercenary (3 HP)
    const minionInstance = createCardInstance(minionCard);
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerInstance = createCardInstance(tracerCard);

    minionInstance.attachments = [tracerInstance];
    state.players[0].engagedMinions = [minionInstance];
    state.mainScheme.threat = 6;

    // Player attacks minion with 3 damage (e.g. basic attack after form change or swinging kick)
    // Let's set minion health to 1 so basic attack (2 ATK) defeats it
    minionInstance.tokens = { damage: 2 };

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionInstance.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Spider-Tracer triggers and removes 3 threat from main scheme (6 - 3 = 3)
    expect(res.state.mainScheme.threat).toBe(3);
    // Spider-Tracer placed in player discard
    expect(res.state.players[0].discard.some((c) => c.card.code === '01007')).toBe(true);
  });
});
