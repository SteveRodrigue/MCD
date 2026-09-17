import { describe, it, expect } from 'vitest';
import { executeSequence } from '../../src/engine/effects';
import { getEffectiveHeroStats, hasPlayerTrait } from '../../src/engine/pipeline/stat-calculator';
import { StatusCard } from '../../src/engine/models/enums';
import type { GameState, PlayerState, CardInstance } from '../../src/engine/models';

function createMockPlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    id: 'player-1',
    name: 'Captain Marvel',
    hero: {
      code: '01010a',
      name: 'Captain Marvel',
      type: 'hero',
      traits: ['Avenger', 'Captain Marvel'],
      attack: 2,
      thwart: 2,
      defense: 1,
      health: 12,
      hitPoints: 12,
    } as any,
    alterEgo: {
      code: '01010b',
      name: 'Carol Danvers',
      type: 'alter_ego',
      traits: ['S.H.I.E.L.D.', 'Soldier'],
      health: 12,
      hitPoints: 12,
      recover: 4,
    } as any,
    currentForm: 'hero',
    health: 12,
    maxHealth: 12,
    deck: [
      { instanceId: 'deck-1', card: { code: 'c1', name: 'Card 1' } } as any,
      { instanceId: 'deck-2', card: { code: 'c2', name: 'Card 2' } } as any,
      { instanceId: 'deck-3', card: { code: 'c3', name: 'Card 3' } } as any,
    ],
    hand: [],
    discard: [],
    tableau: [],
    allies: [],
    engagedMinions: [],
    activeFormCard: {
      code: '01010a',
      name: 'Captain Marvel',
      type: 'hero',
      traits: ['Avenger', 'Captain Marvel'],
    } as any,
    availableForms: [],
    exhausted: false,
    statusCards: [],
    basicChangeFormUsedThisRound: false,
    formChangedThisRound: false,
    recoveryUsedThisRound: false,
    ...overrides,
  } as any as PlayerState;
}

function createMockState(playerOverrides?: Partial<PlayerState>): GameState {
  const player = createMockPlayer(playerOverrides);
  return {
    scenarioId: 'rhino',
    scenario: { id: 'rhino', name: 'Rhino' } as any,
    villain: {
      id: 'rhino-1',
      card: { code: '01094', name: 'Rhino', hitPoints: 14 } as any,
      health: 14,
      maxHealth: 14,
      statusCards: [],
      attachments: [],
    } as any,
    mainScheme: {
      id: 'main-scheme',
      instanceId: 'main-scheme',
      card: { code: '01097', name: 'The Break-In!' } as any,
      threat: 5,
      targetThreat: 7,
    } as any,
    sideSchemes: [
      {
        instanceId: 'side-1',
        card: { code: '01098', name: 'Crowd Control' } as any,
        threat: 3,
      } as any,
    ],
    players: [player],
    activePlayerId: player.id,
    phase: 'PLAYER_PHASE' as any,
    roundNumber: 1,
    firstPlayerIndex: 0,
    log: [],
  } as any as GameState;
}

describe('Condition-Based Modifiers & Ad-Hoc Param Elimination (Bug #67)', () => {
  describe('T1, T2, T2b: Alpha Flight Station (01015) — HAS_IDENTITY on DRAW', () => {
    it('T1: Carol Danvers in alter-ego form (01010b) resolves Alpha Flight Station action in play -> draws 2 cards via single DRAW with dynamicBonus', () => {
      const state = createMockState({
        currentForm: 'alter_ego',
        activeFormCard: {
          code: '01010b',
          name: 'Carol Danvers',
          type: 'alter_ego',
          traits: ['S.H.I.E.L.D.', 'Soldier'],
        } as any,
      });
      const player = state.players[0];

      const steps = [
        {
          effect: 'DRAW' as const,
          effectParams: {
            count: 1,
            dynamicBonus: {
              from: 'HAS_IDENTITY' as const,
              filter: { codes: ['01010b'] },
              multiplier: 1,
            },
          },
        },
      ];

      const result = executeSequence(state, steps, { playerId: player.id });
      expect(result.success).toBe(true);
      expect(player.hand).toHaveLength(2);
      expect(result.state.log.some((l) => l.onomatopoeia === 'DRAW +2!')).toBe(true);
    });

    it('T2: Spider-Man in alter-ego form (01001b) resolves Alpha Flight Station action in play -> draws only 1 card (HAS_IDENTITY condition fails)', () => {
      const state = createMockState({
        alterEgo: {
          code: '01001b',
          name: 'Peter Parker',
          type: 'alter_ego',
          traits: ['Civilian'],
        } as any,
        currentForm: 'alter_ego',
        activeFormCard: {
          code: '01001b',
          name: 'Peter Parker',
          type: 'alter_ego',
          traits: ['Civilian'],
        } as any,
      });
      const player = state.players[0];

      const steps = [
        {
          effect: 'DRAW' as const,
          effectParams: {
            count: 1,
            dynamicBonus: {
              from: 'HAS_IDENTITY' as const,
              filter: { codes: ['01010b'] },
              multiplier: 1,
            },
          },
        },
      ];

      const result = executeSequence(state, steps, { playerId: player.id });
      expect(result.success).toBe(true);
      expect(player.hand).toHaveLength(1);
      expect(result.state.log.some((l) => l.onomatopoeia === 'DRAW +1!')).toBe(true);
    });

    it('T2b: Captain Marvel in hero form (01010a) resolves Alpha Flight Station action in play -> draws only 1 card (active form is Captain Marvel, NOT Carol Danvers)', () => {
      const state = createMockState({
        currentForm: 'hero',
        activeFormCard: {
          code: '01010a',
          name: 'Captain Marvel',
          type: 'hero',
          traits: ['Avenger', 'Captain Marvel'],
        } as any,
      });
      const player = state.players[0];

      const steps = [
        {
          effect: 'DRAW' as const,
          effectParams: {
            count: 1,
            dynamicBonus: {
              from: 'HAS_IDENTITY' as const,
              filter: { codes: ['01010b'] },
              multiplier: 1,
            },
          },
        },
      ];

      const result = executeSequence(state, steps, { playerId: player.id });
      expect(result.success).toBe(true);
      expect(player.hand).toHaveLength(1);
      expect(result.state.log.some((l) => l.onomatopoeia === 'DRAW +1!')).toBe(true);
    });
  });

  describe('T3, T4, T5: Supersonic Punch (01032) & Powered Gauntlets (01038) — HAS_TRAIT on DEAL_DAMAGE', () => {
    it('T3: Captain Marvel with Aerial trait resolves Supersonic Punch event -> deals 8 damage in a single hit (Tough absorbs full 8)', () => {
      const state = createMockState({
        activeFormCard: {
          code: '01010a',
          name: 'Captain Marvel',
          traits: ['Avenger', 'Aerial'],
        } as any,
      });
      state.villain.statusCards = [StatusCard.TOUGH];
      const player = state.players[0];

      const steps = [
        {
          effect: 'DEAL_DAMAGE' as const,
          effectParams: {
            amount: 4,
            dynamicBonus: {
              from: 'HAS_TRAIT' as const,
              filter: { traits: ['Aerial'] },
              multiplier: 4,
            },
            target: 'VILLAIN',
          },
        },
      ];

      const result = executeSequence(state, steps, { playerId: player.id });
      expect(result.success).toBe(true);
      // Single hit consumed Tough; villain took 0 damage because Tough blocked the single 8-damage hit
      expect(result.state.villain.statusCards).not.toContain(StatusCard.TOUGH);
      expect(result.state.villain.health).toBe(14);
    });

    it('T4: Captain Marvel without Aerial trait resolves Supersonic Punch event -> deals 4 damage', () => {
      const state = createMockState(); // No Aerial trait
      const player = state.players[0];

      const steps = [
        {
          effect: 'DEAL_DAMAGE' as const,
          effectParams: {
            amount: 4,
            dynamicBonus: {
              from: 'HAS_TRAIT' as const,
              filter: { traits: ['Aerial'] },
              multiplier: 4,
            },
            target: 'VILLAIN',
          },
        },
      ];

      const result = executeSequence(state, steps, { playerId: player.id });
      expect(result.success).toBe(true);
      expect(result.state.villain.health).toBe(10); // 14 - 4
    });

    it('T5: Hero resolves Powered Gauntlets action in play -> grants +1 damage if Aerial is granted via in-play tableau upgrade', () => {
      const state = createMockState();
      const player = state.players[0];

      // Cosmic Flight (01017) in tableau granting Aerial trait via CONSTANT ADD_TRAIT
      const cosmicFlight: CardInstance = {
        instanceId: 'cf-1',
        card: {
          code: '01017',
          name: 'Cosmic Flight',
          traits: ['Item'],
          enrichment: {
            abilities: [
              {
                id: 'cf_aerial',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Aerial' },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.tableau.push(cosmicFlight);

      expect(hasPlayerTrait(player, 'Aerial')).toBe(true);

      const steps = [
        {
          effect: 'DEAL_DAMAGE' as const,
          effectParams: {
            amount: 1,
            dynamicBonus: {
              from: 'HAS_TRAIT' as const,
              filter: { traits: ['Aerial'] },
              multiplier: 1,
            },
            target: 'VILLAIN',
          },
        },
      ];

      const result = executeSequence(state, steps, { playerId: player.id });
      expect(result.success).toBe(true);
      expect(result.state.villain.health).toBe(12); // 14 - (1 + 1)
    });
  });

  describe('T6 & T7: Captain Marvel Helmet (01016) — 2 CONSTANT steps with TARGET_TRAIT_MATCH gate', () => {
    it("T6: Captain Marvel's Helmet in play: Aerial player gets +2 DEF (+1 unconditional + 1 conditional)", () => {
      const state = createMockState({
        hero: {
          code: '01010a',
          name: 'Captain Marvel',
          type: 'hero',
          traits: ['Avenger', 'Aerial'],
          defense: 1,
        } as any,
        activeFormCard: {
          code: '01010a',
          name: 'Captain Marvel',
          traits: ['Avenger', 'Aerial'],
        } as any,
      });
      const player = state.players[0];

      const helmet: CardInstance = {
        instanceId: 'helmet-1',
        card: {
          code: '01016',
          name: "Captain Marvel's Helmet",
          enrichment: {
            abilities: [
              {
                id: 'helmet_def',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'MODIFY_STAT',
                    effectParams: { stat: 'DEFENSE', amount: 1 },
                  },
                  {
                    effect: 'MODIFY_STAT',
                    gate: 'IF_CONDITION_MET',
                    condition: 'TARGET_TRAIT_MATCH',
                    gateParams: { trait: 'Aerial' },
                    effectParams: { stat: 'DEFENSE', amount: 1 },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.tableau.push(helmet);

      const stats = getEffectiveHeroStats(state, player);
      // Printed 1 DEF + 1 base + 1 Aerial = 3 DEF
      expect(stats.defense).toBe(3);
    });

    it("T7: Captain Marvel's Helmet in play: Non-Aerial player gets +1 DEF (second CONSTANT step gated and skipped)", () => {
      const state = createMockState({
        hero: {
          code: '01010a',
          name: 'Captain Marvel',
          type: 'hero',
          traits: ['Avenger'],
          defense: 1,
        } as any,
        activeFormCard: {
          code: '01010a',
          name: 'Captain Marvel',
          traits: ['Avenger'],
        } as any,
      });
      const player = state.players[0];

      const helmet: CardInstance = {
        instanceId: 'helmet-1',
        card: {
          code: '01016',
          name: "Captain Marvel's Helmet",
          enrichment: {
            abilities: [
              {
                id: 'helmet_def',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'MODIFY_STAT',
                    effectParams: { stat: 'DEFENSE', amount: 1 },
                  },
                  {
                    effect: 'MODIFY_STAT',
                    gate: 'IF_CONDITION_MET',
                    condition: 'TARGET_TRAIT_MATCH',
                    gateParams: { trait: 'Aerial' },
                    effectParams: { stat: 'DEFENSE', amount: 1 },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.tableau.push(helmet);

      const stats = getEffectiveHeroStats(state, player);
      // Printed 1 DEF + 1 base = 2 DEF
      expect(stats.defense).toBe(2);
    });
  });

  describe('T8 & T9: Crisis Interdiction (01012) — 2 steps with TARGET_TRAIT_MATCH gate', () => {
    it('T8: Aerial player resolves Crisis Interdiction event -> executes both steps (removes 2 threat, then 2 from second scheme)', () => {
      const state = createMockState({
        activeFormCard: {
          code: '01010a',
          name: 'Captain Marvel',
          traits: ['Avenger', 'Aerial'],
        } as any,
      });
      const player = state.players[0];

      const steps = [
        {
          effect: 'REMOVE_THREAT' as const,
          effectParams: { amount: 2, target: 'MAIN_SCHEME' },
        },
        {
          effect: 'REMOVE_THREAT' as const,
          gate: 'IF_CONDITION_MET' as const,
          condition: 'TARGET_TRAIT_MATCH' as const,
          gateParams: { trait: 'Aerial' },
          effectParams: { amount: 2, target: 'SIDE_SCHEME', targetInstanceId: 'side-1' },
        },
      ];

      const result = executeSequence(state, steps, { playerId: player.id });
      expect(result.success).toBe(true);
      expect(result.state.mainScheme.threat).toBe(3); // 5 - 2
      expect(result.state.sideSchemes[0].threat).toBe(1); // 3 - 2
    });

    it('T9: Non-Aerial player resolves Crisis Interdiction event -> executes step 1 only (step 2 skipped)', () => {
      const state = createMockState(); // No Aerial trait
      const player = state.players[0];

      const steps = [
        {
          effect: 'REMOVE_THREAT' as const,
          effectParams: { amount: 2, target: 'MAIN_SCHEME' },
        },
        {
          effect: 'REMOVE_THREAT' as const,
          gate: 'IF_CONDITION_MET' as const,
          condition: 'TARGET_TRAIT_MATCH' as const,
          gateParams: { trait: 'Aerial' },
          effectParams: { amount: 2, target: 'SIDE_SCHEME', targetInstanceId: 'side-1' },
        },
      ];

      const result = executeSequence(state, steps, { playerId: player.id });
      expect(result.success).toBe(true);
      expect(result.state.mainScheme.threat).toBe(3); // 5 - 2
      expect(result.state.sideSchemes[0].threat).toBe(3); // untouched
    });
  });

  describe('T10, T11, T12: Zero-tolerance elimination of ad-hoc params', () => {
    it('T10: carolBonus is absent from supplemental data and engine effects', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const coreJsonPath = path.resolve(__dirname, '../../src/data/supplemental/pack/core.json');
      const coreContent = fs.readFileSync(coreJsonPath, 'utf-8');
      expect(coreContent).not.toContain('"carolBonus"');
    });

    it('T11: aerialBonus is absent from all supplemental pack JSONs', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const packDir = path.resolve(__dirname, '../../src/data/supplemental/pack');
      const files = fs.readdirSync(packDir).filter((f: string) => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(packDir, file), 'utf-8');
        expect(content).not.toContain('"aerialBonus"');
      }
    });

    it('T12: bonusEnergyThwart is absent from all supplemental pack JSONs and engine', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const packDir = path.resolve(__dirname, '../../src/data/supplemental/pack');
      const files = fs.readdirSync(packDir).filter((f: string) => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(packDir, file), 'utf-8');
        expect(content).not.toContain('"bonusEnergyThwart"');
      }
    });
  });
});
