import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, SideSchemeCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { step4_dealEncounterCards } from '@engine/pipeline/villain-phase';

describe('Step 4 Deal Encounter Cards: Sequential Hazard Distribution & Heroic Mode (RR v1.8 p. 11, p. 22)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;
  });

  it('deals cards sequentially for hazard icons in a 3-player game starting from First Player (RR v1.8 p. 11)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        { id: 'p1', name: 'Spider-Man', hero: spiderManHero, alterEgo: peterParkerAlterEgo, deckCards: [] },
        { id: 'p2', name: 'Captain Marvel', hero: captainMarvelHero, alterEgo: carolDanversAlterEgo, deckCards: [] },
        { id: 'p3', name: 'Iron Man', hero: ironManHero, alterEgo: tonyStarkAlterEgo, deckCards: [] },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(30).fill(cardCatalog.getCard('01108')!), // 30 Hydra Mercenary cards
      skipMulligan: true,
    });

    // Add 2 Hazard side schemes (total 2 Hazard icons)
    const hazardCard = cardCatalog.getCard('01110') as SideSchemeCard; // Crowd Control with hazard
    state.sideSchemes = [
      { instanceId: 'hazard_1', card: { ...hazardCard, hasHazard: true }, threat: 2 },
      { instanceId: 'hazard_2', card: { ...hazardCard, hasHazard: true }, threat: 2 },
    ];

    state.firstPlayerIndex = 0; // P1 starts
    step4_dealEncounterCards(state);

    // Base pass: P1=1, P2=1, P3=1
    // Hazard pass: Hazard 1 -> P1, Hazard 2 -> P2
    // Final: P1 = 2, P2 = 2, P3 = 1
    expect(state.players[0].dealtEncounterCards.length).toBe(2);
    expect(state.players[1].dealtEncounterCards.length).toBe(2);
    expect(state.players[2].dealtEncounterCards.length).toBe(1);
  });

  it('wraps around and respects firstPlayerIndex rotation during sequential hazard dealing', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        { id: 'p1', name: 'Spider-Man', hero: spiderManHero, alterEgo: peterParkerAlterEgo, deckCards: [] },
        { id: 'p2', name: 'Captain Marvel', hero: captainMarvelHero, alterEgo: carolDanversAlterEgo, deckCards: [] },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(30).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
    });

    // Add 3 Hazard side schemes (total 3 Hazard icons)
    const hazardCard = cardCatalog.getCard('01110') as SideSchemeCard;
    state.sideSchemes = [
      { instanceId: 'hazard_1', card: { ...hazardCard, hasHazard: true }, threat: 2 },
      { instanceId: 'hazard_2', card: { ...hazardCard, hasHazard: true }, threat: 2 },
      { instanceId: 'hazard_3', card: { ...hazardCard, hasHazard: true }, threat: 2 },
    ];

    state.firstPlayerIndex = 1; // P2 (Captain Marvel) starts!
    step4_dealEncounterCards(state);

    // Base pass: P2=1, P1=1
    // Hazard pass: Hazard 1 -> P2, Hazard 2 -> P1, Hazard 3 -> P2
    // Final: P2 = 3 cards (1 + 2), P1 = 2 cards (1 + 1)
    expect(state.players[1].dealtEncounterCards.length).toBe(3);
    expect(state.players[0].dealtEncounterCards.length).toBe(2);
  });

  it('deals additional base cards for Heroic Mode (Heroic 1, Heroic 2)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      difficulty: 'EXPERT',
      heroicLevel: 1, // Heroic 1 -> +1 base card per player (2 cards each)
      players: [
        { id: 'p1', name: 'Spider-Man', hero: spiderManHero, alterEgo: peterParkerAlterEgo, deckCards: [] },
        { id: 'p2', name: 'Captain Marvel', hero: captainMarvelHero, alterEgo: carolDanversAlterEgo, deckCards: [] },
      ],
      villain: cardCatalog.getCard('01095') as any, // Rhino II
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(30).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
    });

    // No hazard icons
    step4_dealEncounterCards(state);

    // Each player gets 1 base + 1 heroic = 2 cards
    expect(state.players[0].dealtEncounterCards.length).toBe(2);
    expect(state.players[1].dealtEncounterCards.length).toBe(2);
  });

  it('combines Heroic Mode and Sequential Hazard Dealing', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      difficulty: 'EXPERT',
      heroicLevel: 2, // Heroic 2 -> +2 base cards per player (3 cards each)
      players: [
        { id: 'p1', name: 'Spider-Man', hero: spiderManHero, alterEgo: peterParkerAlterEgo, deckCards: [] },
        { id: 'p2', name: 'Captain Marvel', hero: captainMarvelHero, alterEgo: carolDanversAlterEgo, deckCards: [] },
      ],
      villain: cardCatalog.getCard('01095') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(30).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
    });

    // 1 Hazard icon
    const hazardCard = cardCatalog.getCard('01110') as SideSchemeCard;
    state.sideSchemes = [
      { instanceId: 'hazard_1', card: { ...hazardCard, hasHazard: true }, threat: 2 },
    ];

    state.firstPlayerIndex = 0; // P1 starts
    step4_dealEncounterCards(state);

    // Base pass: P1=3, P2=3 (Heroic 2)
    // Hazard pass: Hazard 1 -> P1 (+1)
    // Final: P1 = 4 cards, P2 = 3 cards
    expect(state.players[0].dealtEncounterCards.length).toBe(4);
    expect(state.players[1].dealtEncounterCards.length).toBe(3);
  });
});
