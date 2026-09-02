import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { assertCardConservation } from '../../src/engine/state/state-validator';
import { HeroCard, AlterEgoCard, StatusCard } from '../../src/engine/models';

describe('Cost Arrow Mandatory Resolution & Trigger Pipeline (RR v1.8 p. 8, 15, Issues #8 & #11)', () => {
  const shHero = cardCatalog.getCard('01019a') as HeroCard; // She-Hulk (Base ATK 3)
  const jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;

  it('1. Superhuman Strength (01028): gives +2 ATK, automatically pays discardSelf cost on attack, and stuns target', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: shHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    // Change to Hero form
    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    // Put Superhuman Strength (01028) into play in tableau
    const superhumanStrength = createCardInstance(cardCatalog.getCard('01028')!);
    player.tableau.push(superhumanStrength);

    const initialVillainHp = heroState.villain.health;

    // Perform BASIC_ATTACK against Rhino
    const res = dispatchAction(heroState, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
    });

    expect(res.result.success).toBe(true);

    // 1. She-Hulk base ATK (3) + Superhuman Strength (2) = 5 damage dealt to Rhino
    expect(res.state.villain.health).toBe(initialVillainHp - 5);

    // 2. Superhuman Strength automatically discarded (cost paid!)
    expect(res.state.players[0].tableau.some((c) => c.card.code === '01028')).toBe(false);
    expect(res.state.players[0].discard.some((c) => c.card.code === '01028')).toBe(true);

    // 3. Rhino receives STUNNED status card
    expect(res.state.villain.statusCards).toContain(StatusCard.STUNNED);

    // 4. Card conservation passes
    expect(() => assertCardConservation(res.state)).not.toThrow();
  });

  it('2. War Machine (01030): exhausts and deals 2 damage to self to deal 1 damage to all enemies (Issue #11)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: shHero,
          alterEgo: jenniferWaltersAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    // Spawn an engaged minion (Hydra Mercenary 01110, 3 HP)
    const minion = createCardInstance(cardCatalog.getCard('01110')!);
    player.engagedMinions.push(minion);

    // Put War Machine (01030, 4 HP) into play in player allies
    const warMachine = createCardInstance(cardCatalog.getCard('01030')!);
    player.allies.push(warMachine);

    const initialVillainHp = heroState.villain.health;

    // Trigger War Machine action: Exhaust and deal 2 damage to him -> deal 1 damage to each enemy
    const res = dispatchAction(heroState, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: warMachine.instanceId,
      abilityId: 'war_machine_action',
    });

    expect(res.result.success).toBe(true);

    // War Machine should have taken 2 damage and be exhausted
    const wmInstance = res.state.players[0].allies.find((a) => a.instanceId === warMachine.instanceId)!;
    expect(wmInstance.exhausted).toBe(true);
    expect(wmInstance.tokens?.damage).toBe(2);

    // 1 damage dealt to Rhino and 1 damage dealt to minion
    expect(res.state.villain.health).toBe(initialVillainHp - 1);
    const minionInstance = res.state.players[0].engagedMinions.find((m) => m.instanceId === minion.instanceId)!;
    expect(minionInstance.tokens?.damage).toBe(1);

    // Ready War Machine and trigger again -> takes 2 more damage (4 total = 4 HP max) -> defeated & discarded
    wmInstance.exhausted = false;
    const res2 = dispatchAction(res.state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: warMachine.instanceId,
      abilityId: 'war_machine_action',
    });

    expect(res2.result.success).toBe(true);
    // War Machine defeated & discarded
    expect(res2.state.players[0].allies.some((a) => a.instanceId === warMachine.instanceId)).toBe(false);
    expect(res2.state.players[0].discard.some((c) => c.instanceId === warMachine.instanceId)).toBe(true);

    // Card conservation passes
    expect(() => assertCardConservation(res2.state)).not.toThrow();
  });
});
