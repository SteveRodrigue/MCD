import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { executeEffect } from '../../src/engine/effects';
import { executeEnemyAttackSynchronously } from '../../src/engine/pipeline/combat-pipeline';
import { GamePhase, GameState, PlayerState, SideSchemeState } from '../../src/engine/models';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Yon-Rogg (01177) Scheme Targeting and ADD_THREAT Primitive (Issue #106)', () => {
  let catalog: CardCatalog;
  let state: GameState;
  let player: PlayerState;

  beforeEach(() => {
    catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
    player = {
      id: 'p1',
      name: 'Hero',
      identity: 'Captain Marvel',
      health: 10,
      maxHealth: 10,
      hand: [],
      deck: [],
      discard: [],
      tableau: [],
      allies: [],
      upgrades: [],
      supports: [],
      engagedMinions: [],
      resources: { physical: 0, energy: 0, mental: 0, wild: 0 },
      statusCards: [],
      exhausted: false,
      activeForm: 'HERO',
      activeFormCard: createCardInstance(catalog.getCard('01010a')!),
      ready: true,
    } as unknown as PlayerState;

    state = {
      roundNumber: 1,
      phase: GamePhase.VILLAIN_PHASE,
      firstPlayerIndex: 0,
      activePlayerIndex: 0,
      players: [player],
      villain: {
        id: 'villain',
        instanceId: 'villain_inst',
        card: catalog.getCard('01094')!,
        health: 14,
        maxHealth: 14,
        stage: 1,
        attachments: [],
        statusCards: [],
      } as any,
      mainScheme: {
        id: 'main_scheme',
        instanceId: 'main_scheme_inst',
        card: catalog.getCard('01097')!,
        stage: 1,
        threat: 2,
        targetThreat: 7,
        accelerationTokens: 0,
      } as any,
      sideSchemes: [],
      encounterDeck: [],
      encounterDiscard: [],
      removedFromGame: [],
      log: [],
    } as unknown as GameState;
  });

  it('places 1 threat on The Psyche-Magnitron (01176) when Yon-Rogg (01177) attacks and the scheme is in play', () => {
    const psycheMagnitronCard = catalog.getCard('01176')!;
    expect(psycheMagnitronCard).toBeDefined();
    const psycheScheme: SideSchemeState = {
      instanceId: 'side_scheme_psyche',
      card: psycheMagnitronCard as any,
      threat: 2,
    };
    state.sideSchemes.push(psycheScheme);

    const yonRoggCard = catalog.getCard('01177')!;
    expect(yonRoggCard).toBeDefined();
    const yonRoggInstance = createCardInstance(yonRoggCard);
    player.engagedMinions.push(yonRoggInstance);

    const initialMainThreat = state.mainScheme.threat;

    // Yon-Rogg attacks the player
    const resultState = executeEnemyAttackSynchronously(
      state,
      { type: 'MINION', card: yonRoggInstance },
      player.id,
      'TAKE_UNDEFENDED',
    );

    // Threat on The Psyche-Magnitron must increase by 1 (2 -> 3)
    const updatedPsyche = resultState.sideSchemes.find((s) => s.card.code === '01176');
    expect(updatedPsyche).toBeDefined();
    expect(updatedPsyche!.threat).toBe(3);

    // Main scheme threat must be untouched
    expect(resultState.mainScheme.threat).toBe(initialMainThreat);
  });

  it('fizzles threat placement when Yon-Rogg attacks but The Psyche-Magnitron is NOT in play (RR v1.8 p. 29)', () => {
    // The Psyche-Magnitron is NOT in state.sideSchemes
    state.sideSchemes = [];

    const yonRoggCard = catalog.getCard('01177')!;
    const yonRoggInstance = createCardInstance(yonRoggCard);
    player.engagedMinions.push(yonRoggInstance);

    const initialMainThreat = state.mainScheme.threat;

    // Yon-Rogg attacks the player
    const resultState = executeEnemyAttackSynchronously(
      state,
      { type: 'MINION', card: yonRoggInstance },
      player.id,
      'TAKE_UNDEFENDED',
    );

    // Main scheme threat must NOT be modified
    expect(resultState.mainScheme.threat).toBe(initialMainThreat);
  });

  it('does NOT trigger threat placement when another minion attacks while Yon-Rogg is in play', () => {
    const psycheMagnitronCard = catalog.getCard('01176')!;
    const psycheScheme: SideSchemeState = {
      instanceId: 'side_scheme_psyche',
      card: psycheMagnitronCard as any,
      threat: 2,
    };
    state.sideSchemes.push(psycheScheme);

    // Both Yon-Rogg and another minion (Hydra Mercenary 01111) are engaged with player
    const yonRoggCard = catalog.getCard('01177')!;
    const yonRoggInstance = createCardInstance(yonRoggCard);
    player.engagedMinions.push(yonRoggInstance);

    const otherMinionCard = catalog.getCard('01111') || catalog.getCard('01110')!;
    const otherMinionInstance = createCardInstance(otherMinionCard);
    player.engagedMinions.push(otherMinionInstance);

    // The other minion attacks the player (NOT Yon-Rogg)
    const resultState = executeEnemyAttackSynchronously(
      state,
      { type: 'MINION', card: otherMinionInstance },
      player.id,
      'TAKE_UNDEFENDED',
    );

    // Threat on The Psyche-Magnitron must NOT change (remains 2)
    const updatedPsyche = resultState.sideSchemes.find((s) => s.card.code === '01176');
    expect(updatedPsyche).toBeDefined();
    expect(updatedPsyche!.threat).toBe(2);
  });

  it('supports direct ADD_THREAT primitive targeting a side scheme by cardCode', () => {
    const psycheMagnitronCard = catalog.getCard('01176')!;
    const psycheScheme: SideSchemeState = {
      instanceId: 'side_scheme_psyche',
      card: psycheMagnitronCard as any,
      threat: 1,
    };
    state.sideSchemes.push(psycheScheme);

    const ability = {
      id: 'test_add_threat',
      timing: 'ACTION' as const,
      steps: [
        {
          effect: 'ADD_THREAT' as const,
          effectParams: {
            amount: 3,
            cardCode: '01176',
          },
        },
      ],
    };

    const res = executeEffect(state, ability, { playerId: player.id });
    expect(res.success).toBe(true);
    expect(res.mutatedState).toBe(true);

    const updatedPsyche = res.state.sideSchemes.find((s) => s.card.code === '01176');
    expect(updatedPsyche!.threat).toBe(4);
    expect(res.state.mainScheme.threat).toBe(2);
  });

  it('supports direct ADD_THREAT primitive targeting a side scheme by targetInstanceId', () => {
    const psycheMagnitronCard = catalog.getCard('01176')!;
    const psycheScheme: SideSchemeState = {
      instanceId: 'side_scheme_psyche_123',
      card: psycheMagnitronCard as any,
      threat: 1,
    };
    state.sideSchemes.push(psycheScheme);

    const ability = {
      id: 'test_add_threat_instance',
      timing: 'ACTION' as const,
      steps: [
        {
          effect: 'ADD_THREAT' as const,
          effectParams: {
            amount: 2,
            targetInstanceId: psycheScheme.instanceId,
          },
        },
      ],
    };

    const res = executeEffect(state, ability, { playerId: player.id });
    expect(res.success).toBe(true);
    expect(res.mutatedState).toBe(true);

    const updatedPsyche = res.state.sideSchemes.find(
      (s) => s.instanceId === psycheScheme.instanceId,
    );
    expect(updatedPsyche!.threat).toBe(3);
    expect(res.state.mainScheme.threat).toBe(2);
  });

  it('supports direct ADD_THREAT primitive with perPlayer: true targeting a side scheme by cardCode', () => {
    const psycheMagnitronCard = catalog.getCard('01176')!;
    const psycheScheme: SideSchemeState = {
      instanceId: 'side_scheme_psyche',
      card: psycheMagnitronCard as any,
      threat: 0,
    };
    state.sideSchemes.push(psycheScheme);

    const ability = {
      id: 'test_add_threat_per_player',
      timing: 'WHEN_REVEALED' as const,
      steps: [
        {
          effect: 'ADD_THREAT' as const,
          effectParams: {
            amount: 2,
            perPlayer: true,
            cardCode: '01176',
          },
        },
      ],
    };

    // 1 player in state -> totalToAdd = 2 * 1 = 2
    const res = executeEffect(state, ability, { playerId: player.id });
    expect(res.success).toBe(true);

    const updatedPsyche = res.state.sideSchemes.find((s) => s.card.code === '01176');
    expect(updatedPsyche!.threat).toBe(2);
    expect(res.state.mainScheme.threat).toBe(2);
  });
});
