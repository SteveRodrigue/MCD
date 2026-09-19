import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, HeroCard, AlterEgoCard, StatusCard, GamePhase } from '@engine/models';
import { cardCatalog } from '../../../src/data/importer/card-loader';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';

function makeResources(type: 'physical' | 'energy' | 'mental' | 'wild', count: number) {
  return {
    physical: type === 'physical' ? count : 0,
    energy: type === 'energy' ? count : 0,
    mental: type === 'mental' ? count : 0,
    wild: type === 'wild' ? count : 0,
    total: count,
  };
}

describe('Issue #137 - Relentless Assault (01053) Overkill Invariants', () => {
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

    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0;
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].hand = [];
  });

  it('Player pays with Physical resource: attack gains Overkill and routes excess damage to Villain, NOT scheme threat', () => {
    const p1 = state.players[0];
    const initialVillainHp = state.villain.health;
    const initialSchemeThreat = state.mainScheme.threat;

    // Minion with 2 HP (Hydra Bomber 01110)
    const minionCard = cardCatalog.getCard('01110')!;
    const minionInst = createCardInstance(minionCard);
    p1.engagedMinions.push(minionInst);

    // Relentless Assault (01053) - costs 2
    const relentlessCard = cardCatalog.getCard('01053')!;
    const assaultInst = createCardInstance(relentlessCard);

    // Payment cards: 1 physical resource card + 1 energy resource card
    const payPhysical = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });
    const payEnergy = createCardInstance({
      ...cardCatalog.getCard('01014')!,
      resources: makeResources('energy', 1),
    });

    p1.hand = [assaultInst, payPhysical, payEnergy];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assaultInst.instanceId,
      targetInstanceId: minionInst.instanceId,
      paymentCardInstanceIds: [payPhysical.instanceId, payEnergy.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Overkill excess damage: 5 damage - 2 HP = 3 excess damage dealt to Villain
    expect(res.state.villain.health).toBe(initialVillainHp - 3);
    // Main scheme threat MUST remain completely unchanged by Overkill!
    expect(res.state.mainScheme.threat).toBe(initialSchemeThreat);
  });

  it('Player pays with non-Physical resources (Energy/Mental): attack does NOT gain Overkill', () => {
    const p1 = state.players[0];
    const initialVillainHp = state.villain.health;

    // Minion with 2 HP (Hydra Bomber 01110)
    const minionCard = cardCatalog.getCard('01110')!;
    const minionInst = createCardInstance(minionCard);
    p1.engagedMinions.push(minionInst);

    // Relentless Assault (01053) - costs 2
    const relentlessCard = cardCatalog.getCard('01053')!;
    const assaultInst = createCardInstance(relentlessCard);

    // Payment cards: 2 energy resource cards (NO physical resource)
    const payEnergy1 = createCardInstance({
      ...cardCatalog.getCard('01014')!,
      resources: makeResources('energy', 1),
    });
    const payEnergy2 = createCardInstance({
      ...cardCatalog.getCard('01014')!,
      resources: makeResources('energy', 1),
    });

    p1.hand = [assaultInst, payEnergy1, payEnergy2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assaultInst.instanceId,
      targetInstanceId: minionInst.instanceId,
      paymentCardInstanceIds: [payEnergy1.instanceId, payEnergy2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // WITHOUT physical resource kicker, NO overkill: Villain takes 0 damage!
    expect(res.state.villain.health).toBe(initialVillainHp);
  });

  it('Overkill damage to Villain is absorbed by Tough status card per RR v1.8 p. 22', () => {
    const p1 = state.players[0];
    state.villain.statusCards = [StatusCard.TOUGH];
    const initialVillainHp = state.villain.health;

    const minionCard = cardCatalog.getCard('01110')!;
    const minionInst = createCardInstance(minionCard);
    p1.engagedMinions.push(minionInst);

    const relentlessCard = cardCatalog.getCard('01053')!;
    const assaultInst = createCardInstance(relentlessCard);

    const payPhysical1 = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });
    const payPhysical2 = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });

    p1.hand = [assaultInst, payPhysical1, payPhysical2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assaultInst.instanceId,
      targetInstanceId: minionInst.instanceId,
      paymentCardInstanceIds: [payPhysical1.instanceId, payPhysical2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Minion defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Tough card absorbed the 3 excess overkill damage!
    expect(res.state.villain.statusCards.includes(StatusCard.TOUGH)).toBe(false);
    expect(res.state.villain.health).toBe(initialVillainHp);
  });

  it('Minion with Spider-Tracer defeated by Relentless Assault: Overkill damages Villain AND Spider-Tracer removes threat with proper prompt provenance', () => {
    const p1 = state.players[0];
    const initialVillainHp = state.villain.health;

    // Minion with 2 HP (Hydra Bomber 01110)
    const minionCard = cardCatalog.getCard('01110')!;
    const minionInst = createCardInstance(minionCard);

    // Attach Spider-Tracer (01007) to the minion
    const tracerCard = cardCatalog.getCard('01007')!;
    const tracerInst = createCardInstance(tracerCard);
    (tracerInst as any).ownerId = p1.id;
    minionInst.attachments = [tracerInst];

    p1.engagedMinions.push(minionInst);

    // Add a side scheme so Spider-Tracer prompts for scheme choice
    const sideSchemeCard = cardCatalog.getCard('01104')!; // Bomb Scare
    const sideSchemeInst = createCardInstance(sideSchemeCard);
    (sideSchemeInst as any).threat = 3;
    state.sideSchemes.push(sideSchemeInst as any);

    const relentlessCard = cardCatalog.getCard('01053')!;
    const assaultInst = createCardInstance(relentlessCard);

    const payPhysical1 = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });
    const payPhysical2 = createCardInstance({
      ...cardCatalog.getCard('01005')!,
      resources: makeResources('physical', 1),
    });

    p1.hand = [assaultInst, payPhysical1, payPhysical2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: assaultInst.instanceId,
      targetInstanceId: minionInst.instanceId,
      paymentCardInstanceIds: [payPhysical1.instanceId, payPhysical2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Minion is defeated
    expect(res.state.players[0].engagedMinions.length).toBe(0);
    // Overkill excess damage (5 - 2 = 3) was dealt to Villain
    expect(res.state.villain.health).toBe(initialVillainHp - 3);

    // Spider-Tracer prompted for scheme choice with complete provenance metadata
    const activePrompt = res.state.pendingDecisionQueue?.[0] || res.state.pendingDecisionPrompt;
    expect(activePrompt).toBeDefined();
    expect(activePrompt?.sourceCardName).toBe('Spider-Tracer');
    expect(activePrompt?.sourceCardCode).toBe('01007');
    expect(activePrompt?.options[0]?.cardCode).toBe('01097b');
    expect(activePrompt?.options[1]?.cardCode).toBe('01104');
  });
});
