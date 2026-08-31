import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { executeEffect } from '../../src/engine/effects/index';
import { canPlayCard } from '../../src/engine/pipeline/legality-checker';

describe('Promoted Core Player Cards', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
    jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;

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
        {
          id: 'p2',
          name: 'Player 2',
          hero: sheHulkHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  it('Ground Stomp (01022): Deals 1 damage to villain and all engaged minions', () => {
    const p1 = state.players[0];
    // Add 1 minion with 2 health
    p1.engagedMinions.push({
      instanceId: 'minion_1',
      card: { id: '01110', code: '01110', name: 'Hydra Bomber', type: 'minion', health: 2 } as any,
      tokens: { damage: 0 },
      exhausted: false,
    });
    const initialVillainHealth = state.villain.health;

    const ability = {
      id: 'ground_stomp_action',
      timing: 'HERO_ACTION' as const,
      steps: [
        {
          effect: 'DEAL_DAMAGE',
          params: {
            amount: 1,
            target: 'ALL_ENEMIES',
          },
        },
      ],
    };

    const res = executeEffect(state, ability, { playerId: p1.id });
    expect(res.success).toBe(true);
    expect(res.state.villain.health).toBe(initialVillainHealth - 1);
    expect(res.state.players[0].engagedMinions[0].tokens?.damage).toBe(1);
  });

  it('Maria Hill (01067): All players draw 1 card when triggered', () => {
    const p1 = state.players[0];
    const p2 = state.players[1];
    p1.deck = [{ instanceId: 'c1', card: { name: 'Card 1' } as any, exhausted: false }];
    p2.deck = [{ instanceId: 'c2', card: { name: 'Card 2' } as any, exhausted: false }];
    p1.hand = [];
    p2.hand = [];

    const ability = {
      id: 'maria_hill_enters_play',
      timing: 'RESPONSE' as const,
      trigger: 'CARD_PLAYED' as const,
      steps: [
        {
          effect: 'DRAW_CARDS',
          params: {
            count: 1,
            target: 'ALL_PLAYERS',
          },
        },
      ],
    };

    const res = executeEffect(state, ability, { playerId: p1.id });
    expect(res.success).toBe(true);
    expect(res.state.players[0].hand.length).toBe(1);
    expect(res.state.players[1].hand.length).toBe(1);
  });

  it('The Triskelion (01073): Increases ally limit from 3 to 4', () => {
    const p1 = state.players[0];
    p1.allies = [];

    const allyCard = {
      id: 'test_ally',
      code: 'test_ally',
      name: 'Test Ally',
      type: 'ally',
      cost: 0,
      enrichment: { abilities: [] },
    } as any;

    // Put 3 allies in play
    for (let i = 0; i < 3; i++) {
      p1.allies.push({
        instanceId: `ally_${i}`,
        card: { ...allyCard, instanceId: `ally_${i}` },
        exhausted: false,
      });
    }

    p1.hand = [{ instanceId: 'hand_ally', card: allyCard, exhausted: false }];

    // 4th ally cannot be played without Triskelion
    const check1 = canPlayCard(state, p1.id, 'hand_ally', []);
    expect(check1.allowed).toBe(false);
    expect(check1.reason).toContain('Ally limit');

    // Add Triskelion to tableau
    p1.tableau.push({
      instanceId: 'triskelion_inst',
      card: {
        id: '01073',
        code: '01073',
        name: 'The Triskelion',
        type: 'support',
        cost: 0,
        enrichment: {
          abilities: [
            {
              id: 'triskelion_ally_limit',
              timing: 'CONSTANT',
              steps: [
                {
                  effect: 'ALLY_LIMIT_BONUS',
                  params: { amount: 1 },
                },
              ],
            },
          ],
        },
      } as any,
      exhausted: false,
    });

    // Now 4th ally is allowed
    const check2 = canPlayCard(state, p1.id, 'hand_ally', []);
    expect(check2.allowed).toBe(true);
  });
});
