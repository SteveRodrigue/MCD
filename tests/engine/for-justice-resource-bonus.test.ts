import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardType,
  CardResources,
} from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { peekDecisionPrompt, resolveDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';
import { executeEffect } from '../../src/engine/effects';

function makeResources(type: 'physical' | 'energy' | 'mental' | 'wild', count = 1): CardResources {
  return {
    physical: type === 'physical' ? count : 0,
    energy: type === 'energy' ? count : 0,
    mental: type === 'mental' ? count : 0,
    wild: type === 'wild' ? count : 0,
    total: count,
  };
}

describe('For Justice! (01060) Resource Bonus Acceptance Test Suite (Issue #186)', () => {
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
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.mainScheme.threat = 5;
    state.sideSchemes = [];
  });

  it('Test 1: For Justice! played without mental resource removes 3 threat from scheme', () => {
    const p1 = state.players[0];
    const initialThreat = state.mainScheme.threat;

    const fjCard = cardCatalog.getCard('01060')!;
    const fjInstance = createCardInstance(fjCard);

    const physicalCard = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const pay2 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });

    p1.hand = [fjInstance, pay1, pay2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: fjInstance.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Base amount is 3, no mental bonus
    expect(res.state.mainScheme.threat).toBe(initialThreat - 3);
  });

  it('Test 2: For Justice! played with mental resource removes 4 threat from scheme', () => {
    const p1 = state.players[0];
    const initialThreat = state.mainScheme.threat;

    const fjCard = cardCatalog.getCard('01060')!;
    const fjInstance = createCardInstance(fjCard);

    const physicalCard = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const mentalCard = cardCatalog.getCard('01005')!;
    const pay2 = createCardInstance({ ...mentalCard, resources: makeResources('mental', 1) });

    p1.hand = [fjInstance, pay1, pay2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: fjInstance.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Base 3 + 1 mental bonus = 4 threat removed
    expect(res.state.mainScheme.threat).toBe(initialThreat - 4);
  });

  it('Test 3: For Justice! played with wild resource removes 4 threat from scheme', () => {
    const p1 = state.players[0];
    const initialThreat = state.mainScheme.threat;

    const fjCard = cardCatalog.getCard('01060')!;
    const fjInstance = createCardInstance(fjCard);

    const physicalCard = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const wildCard = cardCatalog.getCard('01005')!;
    const pay2 = createCardInstance({ ...wildCard, resources: makeResources('wild', 1) });

    p1.hand = [fjInstance, pay1, pay2];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: fjInstance.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Base 3 + 1 wild counts as mental bonus = 4 threat removed
    expect(res.state.mainScheme.threat).toBe(initialThreat - 4);
  });

  it('Test 4: For Justice! played with mental resource when multiple schemes exist prompts for target and removes 4 threat from chosen scheme', () => {
    const p1 = state.players[0];
    state.mainScheme.threat = 5;

    // Add a side scheme with 5 threat
    const sideSchemeInstanceId = 'side_scheme_bomb_threat';
    state.sideSchemes = [
      {
        instanceId: sideSchemeInstanceId,
        threat: 5,
        card: {
          id: '01100',
          code: '01100',
          name: 'Bomb Threat',
          type: CardType.SIDE_SCHEME,
          baseThreat: 5,
        } as any,
      },
    ];

    const fjCard = cardCatalog.getCard('01060')!;
    const fjInstance = createCardInstance(fjCard);

    const physicalCard = cardCatalog.getCard('01005')!;
    const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
    const mentalCard = cardCatalog.getCard('01005')!;
    const pay2 = createCardInstance({ ...mentalCard, resources: makeResources('mental', 1) });

    p1.hand = [fjInstance, pay1, pay2];

    // Play card without specifying targetInstanceId -> triggers prompt
    const playRes = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: fjInstance.instanceId,
      paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId],
    });

    expect(playRes.result.success).toBe(true);
    const prompt = peekDecisionPrompt(playRes.state);
    expect(prompt).toBeDefined();
    expect(prompt?.options.length).toBeGreaterThanOrEqual(2);

    // Verify side scheme option exists
    const sideSchemeOption = prompt?.options.find((opt) => opt.id === sideSchemeInstanceId);
    expect(sideSchemeOption).toBeDefined();

    // Resolve prompt by choosing the side scheme
    const resolveRes = dispatchAction(playRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p1.id,
      selectedOptionId: sideSchemeInstanceId,
    });

    expect(resolveRes.result.success).toBe(true);
    // 4 threat removed from side scheme (5 - 4 = 1)
    const updatedSideScheme = resolveRes.state.sideSchemes.find(
      (s) => s.instanceId === sideSchemeInstanceId,
    );
    expect(updatedSideScheme?.threat).toBe(1);
    // Main scheme remains untouched at 5 threat
    expect(resolveRes.state.mainScheme.threat).toBe(5);
  });

  it('Test 4b: Direct executeEffect with multiple schemes prompts for target and removes 4 threat when resolved', () => {
    const p1 = state.players[0];
    state.mainScheme.threat = 5;

    const sideSchemeInstanceId = 'side_scheme_direct';
    state.sideSchemes = [
      {
        instanceId: sideSchemeInstanceId,
        threat: 5,
        card: {
          id: '01100',
          code: '01100',
          name: 'Direct Side Scheme',
          type: CardType.SIDE_SCHEME,
          baseThreat: 5,
        } as any,
      },
    ];

    const fjCard = cardCatalog.getCard('01060')!;
    const fjAbility = fjCard.enrichment!.abilities![0];

    // Execute effect directly with mental resource spent
    const effectRes = executeEffect(state, fjAbility, {
      playerId: p1.id,
      resourcesSpent: ['mental'],
    });

    expect(effectRes.success).toBe(true);
    const prompt = peekDecisionPrompt(effectRes.state);
    expect(prompt).toBeDefined();

    // Resolve decision prompt choosing main scheme
    const resolved = resolveDecisionPrompt(
      effectRes.state,
      p1.id,
      effectRes.state.mainScheme.instanceId!,
    );
    expect(resolved.result.success).toBe(true);
    // Main scheme removes 4 threat (5 - 4 = 1)
    expect(resolved.state.mainScheme.threat).toBe(1);
  });
});
