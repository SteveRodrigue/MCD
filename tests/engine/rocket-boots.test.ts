import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  endPlayerPhase,
  getEffectiveMaxHealth,
  getEffectivePlayerTraits,
} from '@engine/index';

/**
 * Rocket Boots (01039), Iron Man upgrade. Printed: "You get +1 hit point. Hero Action: Exhaust
 * Rocket Boots and spend a [mental] resource -> gain the [[Aerial]] trait until the end of the
 * phase." (#131, review item A3). Before the fix the action paid its cost and granted nothing.
 */
describe('Rocket Boots (01039) (Issue #131)', () => {
  let state: GameState;
  const player = () => state.players[0];

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    player().currentForm = 'hero';
    player().activeFormCard = player().hero;
  });

  const equip = () => {
    const boots = createCardInstance(cardCatalog.getCard('01039')!);
    player().tableau.push(boots);
    return boots;
  };

  const useAction = (boots: ReturnType<typeof equip>, payWith: string[]) =>
    dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: boots.instanceId,
      abilityId: 'rocket_boots_aerial',
      paymentCardInstanceIds: payWith,
    });

  it('+1 hit point while in play', () => {
    const before = getEffectiveMaxHealth(player(), state);
    equip();
    expect(getEffectiveMaxHealth(player(), state)).toBe(before + 1);
  });

  it('the Hero Action exhausts Rocket Boots, spends a mental resource and grants Aerial', () => {
    const boots = equip();
    const payment = createCardInstance(cardCatalog.getCard('01039')!); // prints 1 mental resource
    player().hand = [payment];
    expect(getEffectivePlayerTraits(player(), state)).not.toContain('Aerial');

    const { state: next, result } = useAction(boots, [payment.instanceId]);

    expect(result.success).toBe(true);
    const p = next.players[0];
    expect(p.tableau.find((c) => c.instanceId === boots.instanceId)!.exhausted).toBe(true);
    expect(p.hand.some((c) => c.instanceId === payment.instanceId)).toBe(false);
    expect(getEffectivePlayerTraits(p, next)).toContain('Aerial');
  });

  it('Aerial lasts until the end of the phase, then is gone', () => {
    const boots = equip();
    const payment = createCardInstance(cardCatalog.getCard('01039')!);
    player().hand = [payment];
    const { state: next } = useAction(boots, [payment.instanceId]);
    expect(getEffectivePlayerTraits(next.players[0], next)).toContain('Aerial');

    const after = endPlayerPhase(next);
    expect(getEffectivePlayerTraits(after.players[0], after)).not.toContain('Aerial');
  });

  it('using the action twice does not stack duplicate traits', () => {
    const boots = equip();
    const payment = createCardInstance(cardCatalog.getCard('01039')!);
    player().hand = [payment];
    const { state: next } = useAction(boots, [payment.instanceId]);
    const traits = getEffectivePlayerTraits(next.players[0], next).filter((t) => t === 'Aerial');
    expect(traits).toHaveLength(1);
  });

  it('cannot be used without a mental resource payment', () => {
    const boots = equip();
    player().hand = [];
    const { result } = useAction(boots, []);
    expect(result.success).toBe(false);
  });
});
