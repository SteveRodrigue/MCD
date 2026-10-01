import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import { getEffectiveVillainStats } from '@engine/pipeline/stat-calculator';

describe('Encounter Attachments Subsystem (Armored Rhino Suit, Charge, Enhanced Ivory Horn)', () => {
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
          deckCards: [cardCatalog.getCard('01005')!], // Swinging Web Kick
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

  it('01098 Armored Rhino Suit: Accumulates damage counters across attacks and discards upon reaching at least 5 damage', () => {
    const suitCard = cardCatalog.getCard('01098')!;
    const suitInstance: CardInstance = createCardInstance(suitCard);
    state.villain.attachments = [suitInstance];

    const initialHp = state.villain.health;

    // 1. Player basic attacks Rhino for 2 ATK
    const res1 = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
    });

    expect(res1.result.success).toBe(true);
    // Villain HP should NOT decrease (absorbed by Armored Rhino Suit)
    expect(res1.state.villain.health).toBe(initialHp);
    // Armored Rhino Suit should remain attached with 2 damage tokens
    expect(res1.state.villain.attachments.length).toBe(1);
    expect(res1.state.villain.attachments[0].tokens?.damage).toBe(2);
    expect(res1.state.encounterDiscard.some((c) => c.card.code === '01098')).toBe(false);

    // Ready hero for second attack
    res1.state.players[0].exhausted = false;

    // 2. Player attacks Rhino again (2 ATK) -> total damage reaches 4 (still < 5)
    const res2 = dispatchAction(res1.state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
    });

    expect(res2.result.success).toBe(true);
    expect(res2.state.villain.health).toBe(initialHp);
    expect(res2.state.villain.attachments.length).toBe(1);
    expect(res2.state.villain.attachments[0].tokens?.damage).toBe(4);
    expect(res2.state.encounterDiscard.some((c) => c.card.code === '01098')).toBe(false);

    // Ready hero for third attack
    res2.state.players[0].exhausted = false;

    // 3. Player attacks Rhino a third time (2 ATK) -> total damage reaches 6 (>= 5) -> Discards suit!
    const res3 = dispatchAction(res2.state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
    });

    expect(res3.result.success).toBe(true);
    expect(res3.state.villain.health).toBe(initialHp);
    // Armored Rhino Suit should now be discarded to encounter discard
    expect(res3.state.villain.attachments.length).toBe(0);
    expect(res3.state.encounterDiscard.some((c) => c.card.code === '01098')).toBe(true);

    // Ready hero for fourth attack
    res3.state.players[0].exhausted = false;

    // 4. Now that suit is discarded, subsequent attack damages Rhino directly
    const res4 = dispatchAction(res3.state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
    });

    expect(res4.result.success).toBe(true);
    expect(res4.state.villain.health).toBe(initialHp - 2);
  });

  it('01098 Armored Rhino Suit: Absorbs massive single attack (8 damage) and discards immediately', () => {
    const suitCard = cardCatalog.getCard('01098')!;
    const suitInstance: CardInstance = createCardInstance(suitCard);
    state.villain.attachments = [suitInstance];

    const initialHp = state.villain.health;

    // Play Swinging Web Kick (8 damage, cost 3)
    const webKickCard = cardCatalog.getCard('01005')!;
    const webKickInstance = createCardInstance(webKickCard);
    const res1 = createCardInstance(cardCatalog.getCard('01003')!);
    const res2 = createCardInstance(cardCatalog.getCard('01003')!);
    const res3 = createCardInstance(cardCatalog.getCard('01003')!);
    state.players[0].hand = [webKickInstance, res1, res2, res3];

    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: webKickInstance.instanceId,
      paymentCardInstanceIds: [res1.instanceId, res2.instanceId, res3.instanceId],
    });

    expect(res.result.success).toBe(true);
    // Suit absorbs all 8 damage and discards; Rhino takes 0 damage
    expect(res.state.villain.health).toBe(initialHp);
    expect(res.state.villain.attachments.length).toBe(0);
    expect(res.state.encounterDiscard.some((c) => c.card.code === '01098')).toBe(true);
  });

  it('01099 Charge: Dynamically grants +3 ATK and OVERKILL keyword', () => {
    const chargeCard = cardCatalog.getCard('01099')!;
    const chargeInstance: CardInstance = createCardInstance(chargeCard);
    state.villain.attachments = [chargeInstance];

    const stats = getEffectiveVillainStats(state, state.villain);
    // Base 2 ATK + 3 Charge = 5 ATK
    expect(stats.attack).toBe(5);
    expect(stats.keywords).toContain('OVERKILL');
  });

  it('01100 Enhanced Ivory Horn: Grants +1 ATK and can be discarded via player action', () => {
    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    state.villain.attachments = [hornInstance];

    const stats = getEffectiveVillainStats(state, state.villain);
    // Base 2 ATK + 1 Horn = 3 ATK
    expect(stats.attack).toBe(3);

    // Player spends 3 physical resources to discard attachment via USE_CARD_ABILITY (ADR-0055)
    state.players[0].currentForm = 'hero';
    const phys1 = createCardInstance(cardCatalog.getCard('01003')!);
    const phys2 = createCardInstance(cardCatalog.getCard('01003')!);
    const phys3 = createCardInstance(cardCatalog.getCard('01003')!);
    state.players[0].hand = [phys1, phys2, phys3];

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: hornInstance.instanceId,
      abilityId: 'ivory_horn_discard_action',
      paymentCardInstanceIds: [phys1.instanceId, phys2.instanceId, phys3.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.attachments.length).toBe(0);
    expect(res.state.encounterDiscard.some((c) => c.card.code === '01100')).toBe(true);
    expect(res.state.players[0].hand.length).toBe(0);
    expect(res.state.players[0].discard.length).toBe(3);

    const updatedStats = getEffectiveVillainStats(res.state, res.state.villain);
    expect(updatedStats.attack).toBe(2);
  });
});
