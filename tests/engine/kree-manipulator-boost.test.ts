import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, AllyCard, MinionCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEnemyAttackSynchronously, type DefensePolicy } from '@engine/pipeline';

describe('Kree Manipulator (01178): boost places 1 threat only if the villain is making an undefended attack', () => {
  let state: GameState;
  let startThreat: number;

  const stackBoost = () => {
    state.encounterDeck = [
      createCardInstance(cardCatalog.getCard('01178')!),
      ...state.encounterDeck,
    ];
  };
  const villainAttack = (policy: DefensePolicy) => {
    stackBoost();
    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', policy);
  };

  beforeEach(() => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const peter = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderMan,
          alterEgo: peter,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    startThreat = state.mainScheme.threat;
  });

  it('adds 1 threat when the villain attack is undefended', () => {
    villainAttack('TAKE_UNDEFENDED');
    expect(state.mainScheme.threat).toBe(startThreat + 1);
  });

  it('adds no threat when the hero defends', () => {
    villainAttack('HERO_IF_READY');
    expect(state.mainScheme.threat).toBe(startThreat);
  });

  it('adds no threat when an ally defends', () => {
    state.players[0].allies.push(createCardInstance(cardCatalog.getCard('01002') as AllyCard));
    villainAttack('ALLY_CHUMP_BLOCK');
    expect(state.mainScheme.threat).toBe(startThreat);
  });

  it('adds no threat when a minion (not the villain) makes the undefended attack', () => {
    const minion = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
    state.players[0].engagedMinions.push(minion);
    stackBoost();
    executeEnemyAttackSynchronously(
      state,
      { type: 'MINION', card: minion },
      'p1',
      'TAKE_UNDEFENDED',
    );
    expect(state.mainScheme.threat).toBe(startThreat);
  });
});
