import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, VillainCard, MainSchemeCard, GamePhase } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { endPlayerPhase } from '@engine/pipeline/player-phase';
import fs from 'fs';
import path from 'path';

describe('State Lifecycle Duration & Zone Cleanup', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
  const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
  const rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
  const mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      skipMulligan: true,
    });
    gameState.phase = GamePhase.PLAYER_PHASE;
    gameState.activePlayerIndex = 0;
  });

  it('Contract: All supplemental card files strictly use canonical durations (PHASE | ROUND | TURN)', () => {
    const packsDir = path.resolve(process.cwd(), 'src/data/supplemental/pack');
    const packFiles = fs.readdirSync(packsDir).filter((f) => f.endsWith('.json'));

    const invalidDurations: { file: string; cardCode: string; duration: string }[] = [];

    for (const file of packFiles) {
      const content = JSON.parse(fs.readFileSync(path.join(packsDir, file), 'utf-8'));
      const cards = content.cards || content;
      for (const [cardCode, cardDef] of Object.entries<any>(cards)) {
        const abilities = cardDef?.abilities || cardDef?.enrichment?.abilities || [];
        for (const ability of abilities) {
          for (const step of ability.steps || []) {
            const d = step.effectParams?.duration;
            if (d !== undefined && !['PHASE', 'ROUND', 'TURN'].includes(d)) {
              invalidDurations.push({ file, cardCode, duration: d });
            }
          }
        }
      }
    }

    expect(invalidDurations).toEqual([]);
  });

  it('TURN duration modifiers expire when the player ends their turn', () => {
    const p1 = gameState.players[0];

    // Add TURN-scoped cost reduction and stat modifier to P1
    p1.activeCostReductions = [
      {
        id: 'turn_reduction',
        sourceCardName: 'Test Turn Ability',
        amount: 1,
        duration: 'TURN',
        appliesTo: 'NEXT_CARD',
      },
    ];
    p1.costReductions = 1;

    p1.activeStatModifiers = [
      {
        stat: 'ATK',
        amount: 2,
        duration: 'TURN',
        sourceCardName: 'Test Turn Attack',
      },
    ];

    // P1 ends turn
    const endTurnRes = dispatchAction(gameState, {
      type: 'END_PLAYER_TURN',
      playerId: p1.id,
    });
    expect(endTurnRes.result.success).toBe(true);

    // TURN duration modifiers must be cleared for P1
    const p1After = endTurnRes.state.players[0];
    expect(p1After.activeCostReductions?.some((r) => r.duration === 'TURN')).toBe(false);
    expect(p1After.costReductions || 0).toBe(0);
    expect(p1After.activeStatModifiers?.some((m) => m.duration === 'TURN')).toBe(false);
  });

  it('PHASE duration modifiers on tableau cards expire at end of phase', () => {
    const p1 = gameState.players[0];
    const upgradeInst = createCardInstance(cardCatalog.getCard('01092')!);
    upgradeInst.activeStatModifiers = [
      {
        stat: 'ATK',
        amount: 1,
        duration: 'PHASE',
        sourceCardName: 'Phase Buff',
      },
    ];
    p1.tableau.push(upgradeInst);

    const endedState = endPlayerPhase(gameState);
    const p1Ended = endedState.players[0];
    expect(p1Ended.tableau[0].activeStatModifiers?.length || 0).toBe(0);
  });
});
