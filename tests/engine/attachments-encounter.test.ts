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

  it('01098 Armored Rhino Suit: Absorbs damage to villain and discards itself', () => {
    const suitCard = cardCatalog.getCard('01098')!;
    const suitInstance: CardInstance = createCardInstance(suitCard);
    state.villain.attachments = [suitInstance];

    const initialHp = state.villain.health;

    // Player basic attacks Rhino (2 ATK)
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
    });

    expect(res.result.success).toBe(true);
    // Villain HP should NOT decrease (absorbed by Armored Rhino Suit)
    expect(res.state.villain.health).toBe(initialHp);
    // Armored Rhino Suit should be discarded
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

    // Player spends resources to discard attachment
    const res = dispatchAction(state, {
      type: 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT',
      playerId: 'p1',
      attachmentInstanceId: hornInstance.instanceId,
    });

    expect(res.result.success).toBe(true);
    expect(res.state.villain.attachments.length).toBe(0);
    expect(res.state.encounterDiscard.some((c) => c.card.code === '01100')).toBe(true);

    const updatedStats = getEffectiveVillainStats(res.state, res.state.villain);
    expect(updatedStats.attack).toBe(2);
  });
});
