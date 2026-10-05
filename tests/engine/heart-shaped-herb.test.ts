import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  StatusCard,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { step4_revealEncounterCards } from '@engine/index';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';

// Heart-Shaped Herb (01158), #244:
// "When Revealed: Give the villain and each minion engaged with you a tough status card.
//  [star] Boost: Give the villain a tough status card."
describe('Heart-Shaped Herb (01158): tough status cards, no healing (#244)', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const setup = (twoPlayers = false) => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: twoPlayers
        ? [player('p1', '01001a', '01001b'), player('p2', '01010a', '01010b')]
        : [player('p1', '01001a', '01001b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
  };

  const engageMinion = (playerIndex: number) => {
    const minion = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
    state.players[playerIndex].engagedMinions.push(minion);
    return minion;
  };
  const toughCount = (entity: { statusCards?: StatusCard[] }) =>
    (entity.statusCards ?? []).filter((s) => s === StatusCard.TOUGH).length;
  // Surge reveals the next encounter card: put a vanilla filler on top so the shuffled
  // Rhino deck (e.g. Hard to Keep Down, which heals Rhino) cannot change the outcome.
  const surgeFiller = () =>
    createCardInstance({
      code: 'filler-surge',
      name: 'Filler surge',
      type: 'treachery',
      faction: 'encounter',
    } as any);
  const revealHerb = () => {
    state.encounterDeck = [surgeFiller(), ...state.encounterDeck];
    state.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01158')!));
    state = step4_revealEncounterCards(state);
  };

  beforeEach(() => setup());

  it('When Revealed gives the villain and the minion engaged with you a tough status card, and heals nothing', () => {
    const minion = engageMinion(0);
    getActiveVillain(state).health -= 3;
    const healthBefore = getActiveVillain(state).health;

    revealHerb();

    const villain = getActiveVillain(state);
    expect(toughCount(villain)).toBe(1);
    expect(
      toughCount(state.players[0].engagedMinions.find((m) => m.instanceId === minion.instanceId)!),
    ).toBe(1);
    expect(villain.health).toBe(healthBefore);
  });

  it('a minion engaged with another player gets no tough status card', () => {
    setup(true);
    const mine = engageMinion(0);
    const theirs = engageMinion(1);

    revealHerb();

    expect(
      toughCount(state.players[0].engagedMinions.find((m) => m.instanceId === mine.instanceId)!),
    ).toBe(1);
    expect(
      toughCount(state.players[1].engagedMinions.find((m) => m.instanceId === theirs.instanceId)!),
    ).toBe(0);
  });

  it('a villain that is already tough keeps exactly one tough status card', () => {
    getActiveVillain(state).statusCards = [StatusCard.TOUGH];

    revealHerb();

    expect(toughCount(getActiveVillain(state))).toBe(1);
  });

  it('Boost gives the villain a tough status card', () => {
    state.encounterDeck = [
      createCardInstance(cardCatalog.getCard('01158')!),
      ...state.encounterDeck,
    ];
    getActiveVillain(state).statusCards = [];

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    expect(toughCount(getActiveVillain(state))).toBe(1);
  });
});
