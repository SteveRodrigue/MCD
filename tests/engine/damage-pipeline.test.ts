import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';

describe('Canonical 9-Step Damage Pipeline (damage-pipeline.ts)', () => {
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
          deckCards: [cardCatalog.getCard('01005')!],
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

  it('Step 1 vs Step 2: Step 1 Damage Dealt Shield (Armored Rhino Suit) intercepts before Tough is consumed', () => {
    const suitCard = cardCatalog.getCard('01098')!;
    const suitInstance = createCardInstance(suitCard);
    state.villain.attachments = [suitInstance];
    state.villain.statusCards = [StatusCard.TOUGH];

    const initialHp = state.villain.health;

    // Deal 2 damage to Villain
    const res = applyDamageToTarget(state, {
      target: {
        type: 'villain',
        entity: state.villain,
        name: state.villain.card.name,
        attachments: state.villain.attachments,
        statusCards: state.villain.statusCards,
      },
      amount: 2,
      isAttack: true,
    });

    expect(res.result.damageTaken).toBe(0);
    expect(res.state.villain.health).toBe(initialHp);
    // Armored Rhino Suit absorbed the damage
    expect(suitInstance.tokens?.damage).toBe(2);
    // TOUGH status card should STILL be intact (absorbed in Step 1 before Step 2 Tough)
    expect(res.state.villain.statusCards).toContain(StatusCard.TOUGH);
    expect(res.result.toughRemoved).toBe(false);
  });

  it('Step 2: Tough status card prevents damage when no shield is present', () => {
    state.villain.attachments = [];
    state.villain.statusCards = [StatusCard.TOUGH];
    const initialHp = state.villain.health;

    const res = applyDamageToTarget(state, {
      target: {
        type: 'villain',
        entity: state.villain,
        name: state.villain.card.name,
        attachments: state.villain.attachments,
        statusCards: state.villain.statusCards,
      },
      amount: 4,
      isAttack: true,
    });

    expect(res.result.damageTaken).toBe(0);
    expect(res.result.toughRemoved).toBe(true);
    expect(res.state.villain.statusCards.length).toBe(0);
    expect(res.state.villain.health).toBe(initialHp);
  });

  it('Step 2: Piercing keyword removes Tough and still deals full damage', () => {
    state.villain.attachments = [];
    state.villain.statusCards = [StatusCard.TOUGH];
    const initialHp = state.villain.health;

    const res = applyDamageToTarget(state, {
      target: {
        type: 'villain',
        entity: state.villain,
        name: state.villain.card.name,
        attachments: state.villain.attachments,
        statusCards: state.villain.statusCards,
      },
      amount: 4,
      isAttack: true,
      hasPiercing: true,
    });

    expect(res.result.toughRemoved).toBe(true);
    expect(res.state.villain.statusCards.length).toBe(0);
    expect(res.result.damageTaken).toBe(4);
    expect(res.state.villain.health).toBe(initialHp - 4);
  });

  it('Universal Host Shield: Applies to player identity attachments', () => {
    const player = state.players[0];
    const playerShield: CardInstance = {
      instanceId: 'player_shield_1',
      ownerId: player.id,
      card: {
        code: 'mock_player_shield',
        name: 'Telekinetic Barrier',
        type: 'upgrade',
        enrichment: {
          abilities: [
            {
              id: 'tk_barrier_shield',
              timing: 'FORCED_INTERRUPT',
              trigger: 'DAMAGE_WOULD_BE_TAKEN',
              steps: [
                {
                  effect: 'ATTACHMENT_DAMAGE_SHIELD',
                  effectParams: {
                    maxAbsorb: 5,
                    target: 'ATTACHED_IDENTITY',
                  },
                },
              ],
            },
          ],
        },
      } as any,
    };

    player.attachments = [playerShield];
    const initialPlayerHp = player.health;

    // Enemy attacks player for 3 damage
    const res1 = applyDamageToTarget(state, {
      target: {
        type: 'player',
        entity: player,
        name: player.name,
        attachments: player.attachments,
        statusCards: player.statusCards,
      },
      amount: 3,
      isAttack: true,
    });

    expect(res1.result.damageTaken).toBe(0);
    expect(player.health).toBe(initialPlayerHp);
    expect(playerShield.tokens?.damage).toBe(3);
    expect(player.attachments.length).toBe(1);

    // Enemy attacks player for 3 more damage (total 6 >= 5 threshold) -> Shield breaks and discards to player discard
    const res2 = applyDamageToTarget(res1.state, {
      target: {
        type: 'player',
        entity: player,
        name: player.name,
        attachments: player.attachments,
        statusCards: player.statusCards,
      },
      amount: 3,
      isAttack: true,
    });

    expect(res2.result.damageTaken).toBe(0);
    expect(player.health).toBe(initialPlayerHp);
    expect(player.attachments.length).toBe(0);
    expect(player.discard.some((c) => c.instanceId === 'player_shield_1')).toBe(true);
  });
});
