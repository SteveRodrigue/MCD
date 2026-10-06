import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  CardInstance,
  StatusCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  step4_revealEncounterCards,
} from '@engine/index';

const TITANIAS_FURY = '01164';
const TITANIA = '01162';
const INERT_SIDE_SCHEME = '01107'; // Breakin' & Takin'

describe("ENEMY_ATTACKS: Titania's Fury (01164) and Titania's attack X (01162), #223", () => {
  let state: GameState;
  let titania: CardInstance;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
      shuffleFn: (cards) => cards,
    });
    // A surge reveals the top encounter card; keep it one that cannot start an attack.
    state.encounterDeck.unshift(createCardInstance(cardCatalog.getCard(INERT_SIDE_SCHEME)!));
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
    titania = createCardInstance(cardCatalog.getCard(TITANIA) as MinionCard);
  });

  const reveal = () => {
    state.players[0].dealtEncounterCards.push(
      createCardInstance(cardCatalog.getCard(TITANIAS_FURY)!),
    );
    state = step4_revealEncounterCards(state);
  };
  const engageTitania = () => state.players[0].engagedMinions.push(titania);
  const surged = () => state.log.some((l) => l.key === 'encounter.surge.triggered');

  it('Titania attacks the hero, with no heal and no surge', () => {
    engageTitania();
    titania.tokens = { ...titania.tokens, damage: 2 };
    reveal();
    expect(state.activeAttackContext?.attackerCard?.card.code).toBe(TITANIA);
    expect(state.activeAttackContext?.targetPlayerId).toBe('p1');
    expect(titania.tokens?.damage).toBe(2);
    expect(surged()).toBe(false);
  });

  it('her attack X is her remaining hit points (6 - 2 damage = 4)', () => {
    engageTitania();
    titania.tokens = { ...titania.tokens, damage: 2 };
    reveal();
    expect(state.activeAttackContext?.baseAttack).toBe(4);
  });

  it('did not attack when Titania is not in play: surge', () => {
    reveal();
    expect(state.activeAttackContext).toBeUndefined();
    expect(surged()).toBe(true);
  });

  it('did not attack when Titania is stunned: stun cleared, all damage healed, surge', () => {
    engageTitania();
    titania.tokens = { ...titania.tokens, damage: 3 };
    titania.statusCards = [StatusCard.STUNNED];
    reveal();
    expect(state.activeAttackContext).toBeUndefined();
    expect(titania.statusCards).not.toContain(StatusCard.STUNNED);
    expect(titania.tokens?.damage ?? 0).toBe(0);
    expect(surged()).toBe(true);
  });

  it('did not attack when the player is in alter-ego form: heal and surge', () => {
    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = state.players[0].alterEgo;
    engageTitania();
    titania.tokens = { ...titania.tokens, damage: 3 };
    reveal();
    expect(state.activeAttackContext).toBeUndefined();
    expect(titania.tokens?.damage ?? 0).toBe(0);
    expect(surged()).toBe(true);
  });
});
