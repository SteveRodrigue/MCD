import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import { attachCardToHost } from '@engine/state/state-validator';

describe('Spider-Tracer (01007) Attached Host Defeat Trigger (Issue #176)', () => {
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

  it('When Spider-Tracer is attached to Minion A and Minion A is defeated, Spider-Tracer removes 3 threat and is discarded to player discard pile', () => {
    const minionCardA = cardCatalog.getCard('01101')!; // Hydra Mercenary (3 HP)
    const minionA = createCardInstance(minionCardA);
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerA = createCardInstance(tracerCard);

    state.players[0].engagedMinions = [minionA];
    attachCardToHost(state, tracerA, 'CHOSEN_MINION', minionA.instanceId);
    (tracerA as any).ownerId = 'p1';

    state.mainScheme.threat = 6;
    minionA.tokens = { damage: 2 }; // 2 damage already; Spider-Man basic attack 2 ATK deals lethal damage

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionA.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Minion A is defeated and removed
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Spider-Tracer triggers and removes 3 threat from main scheme (6 - 3 = 3)
    expect(res.state.mainScheme.threat).toBe(3);
    // Spider-Tracer placed in player discard
    expect(res.state.players[0].discard.some((c) => c.instanceId === tracerA.instanceId)).toBe(
      true,
    );
  });

  it('When Spider-Tracer is attached to Minion A and unrelated Minion B is defeated, Spider-Tracer does NOT trigger and remains attached to Minion A', () => {
    const minionCardA = cardCatalog.getCard('01101')!; // Hydra Mercenary (3 HP)
    const minionA = createCardInstance(minionCardA);
    const minionCardB = cardCatalog.getCard('01110')!; // Hydra Bomber (1 HP)
    const minionB = createCardInstance(minionCardB);
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerA = createCardInstance(tracerCard);

    state.players[0].engagedMinions = [minionA, minionB];
    attachCardToHost(state, tracerA, 'CHOSEN_MINION', minionA.instanceId);
    (tracerA as any).ownerId = 'p1';

    state.mainScheme.threat = 6;

    // Defeat Minion B with basic attack (deals 2 damage to 1 HP minion)
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionB.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Minion B defeated and removed
    expect(
      res.state.players[0].engagedMinions.some((m) => m.instanceId === minionB.instanceId),
    ).toBe(false);
    // Minion A still engaged
    const survivingMinionA = res.state.players[0].engagedMinions.find(
      (m) => m.instanceId === minionA.instanceId,
    );
    expect(survivingMinionA).toBeDefined();
    // Spider-Tracer remains attached to Minion A
    expect(survivingMinionA?.attachments?.some((c) => c.instanceId === tracerA.instanceId)).toBe(
      true,
    );
    // Spider-Tracer did NOT discard
    expect(res.state.players[0].discard.some((c) => c.instanceId === tracerA.instanceId)).toBe(
      false,
    );
    // Threat was NOT removed (remains 6)
    expect(res.state.mainScheme.threat).toBe(6);
  });

  it('When Spider-Tracer 1 is attached to Minion A and Spider-Tracer 2 is attached to Minion B: defeating Minion A triggers only Spider-Tracer 1 (removing 3 threat); Spider-Tracer 2 remains attached to Minion B', () => {
    const minionCardA = cardCatalog.getCard('01101')!; // Hydra Mercenary (3 HP)
    const minionA = createCardInstance(minionCardA);
    const minionCardB = cardCatalog.getCard('01110')!; // Hydra Bomber (1 HP)
    const minionB = createCardInstance(minionCardB);

    const tracerCard = cardCatalog.getCard('01007')!;
    const tracer1 = createCardInstance(tracerCard);
    const tracer2 = createCardInstance(tracerCard);

    state.players[0].engagedMinions = [minionA, minionB];
    attachCardToHost(state, tracer1, 'CHOSEN_MINION', minionA.instanceId);
    attachCardToHost(state, tracer2, 'CHOSEN_MINION', minionB.instanceId);
    (tracer1 as any).ownerId = 'p1';
    (tracer2 as any).ownerId = 'p1';

    state.mainScheme.threat = 6;
    minionA.tokens = { damage: 2 }; // 2 damage already; basic attack 2 ATK defeats Minion A

    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minionA.instanceId,
    });

    expect(res.result.success).toBe(true);
    // Minion A defeated and removed
    expect(
      res.state.players[0].engagedMinions.some((m) => m.instanceId === minionA.instanceId),
    ).toBe(false);
    // Minion B still engaged
    const survivingMinionB = res.state.players[0].engagedMinions.find(
      (m) => m.instanceId === minionB.instanceId,
    );
    expect(survivingMinionB).toBeDefined();

    // Exactly 3 threat removed (6 - 3 = 3), not 6
    expect(res.state.mainScheme.threat).toBe(3);

    // Tracer 1 in discard
    expect(res.state.players[0].discard.some((c) => c.instanceId === tracer1.instanceId)).toBe(
      true,
    );

    // Tracer 2 remains attached to Minion B
    expect(survivingMinionB?.attachments?.some((c) => c.instanceId === tracer2.instanceId)).toBe(
      true,
    );
    expect(res.state.players[0].discard.some((c) => c.instanceId === tracer2.instanceId)).toBe(
      false,
    );
  });
});
