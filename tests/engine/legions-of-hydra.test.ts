import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { createCardInstance, resetInstanceCounter } from '@engine/state/card-instance';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';
import { isImmuneToDamage } from '@engine/pipeline/damage-immunity';
import { isVillainAttackBlockedByGuard } from '@engine/pipeline/target-restrictions';
import { executeEnemyAttackSynchronously } from '@engine/pipeline/combat-pipeline';
import { removeThreatFromScheme } from '@engine/pipeline/threat-pipeline';

const LEGIONS_OF_HYDRA = '01180';
const MADAME_HYDRA = '01181';
const HYDRA_SOLDIER = '01182';

describe('Legions of Hydra (01180) When Revealed', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
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
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
  });

  const p1 = () => state.players[0];

  const revealLegionsOfHydra = () => {
    p1().dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(LEGIONS_OF_HYDRA)!));
    state = step4_revealEncounterCards(state);
  };

  it('searches Madame Hydra from encounter deck, engages her with player, and places threat for 1 Hydra enemy', () => {
    const madame = createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!);
    state.encounterDeck = [madame];
    state.encounterDiscard = [];

    revealLegionsOfHydra();

    // Madame Hydra should be engaged with player, NOT in player.tableau
    const engaged = p1().engagedMinions.find((m) => m.card.code === MADAME_HYDRA);
    expect(engaged).toBeDefined();
    expect(p1().tableau.some((c) => c.card.code === MADAME_HYDRA)).toBe(false);

    // Legions of Hydra side scheme should be in play with base 3 + (1 * 2) = 5 threat
    const scheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(scheme).toBeDefined();
    expect(scheme?.threat).toBe(5);
  });

  it('searches Madame Hydra from encounter discard when 1 Hydra Soldier is already engaged (2 Hydra enemies = 7 threat)', () => {
    // 1 Hydra Soldier already engaged
    const soldier = createCardInstance(cardCatalog.getCard(HYDRA_SOLDIER)!);
    p1().engagedMinions.push(soldier as any);

    const madame = createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!);
    state.encounterDeck = [];
    state.encounterDiscard = [madame];

    revealLegionsOfHydra();

    // Madame Hydra should now also be engaged
    expect(p1().engagedMinions.some((m) => m.card.code === MADAME_HYDRA)).toBe(true);
    expect(state.encounterDiscard.some((c) => c.card.code === MADAME_HYDRA)).toBe(false);

    // 2 Hydra enemies in play (Madame Hydra + Hydra Soldier) -> 3 base + (2 * 2) = 7 threat
    const scheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(scheme).toBeDefined();
    expect(scheme?.threat).toBe(7);
  });

  it('skips search when Madame Hydra is already in play, placing threat for existing Hydra enemies', () => {
    // Madame Hydra is already engaged with player
    const madame = createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!);
    p1().engagedMinions.push(madame as any);

    // Another copy of Madame Hydra in deck should NOT be pulled
    const duplicateInDeck = createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!);
    state.encounterDeck = [duplicateInDeck];

    revealLegionsOfHydra();

    // Only 1 Madame Hydra engaged
    expect(p1().engagedMinions.filter((m) => m.card.code === MADAME_HYDRA).length).toBe(1);
    // The one in deck remained in deck
    expect(state.encounterDeck.filter((c) => c.card.code === MADAME_HYDRA).length).toBe(1);

    // 1 Hydra enemy in play -> 3 base + (1 * 2) = 5 threat
    const scheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(scheme).toBeDefined();
    expect(scheme?.threat).toBe(5);
  });

  it('handles 0 Hydra enemies when Madame Hydra is not in deck or discard', () => {
    state.encounterDeck = [];
    state.encounterDiscard = [];

    revealLegionsOfHydra();

    // 0 Hydra enemies in play -> 3 base + (0 * 2) = 3 threat
    const scheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(scheme).toBeDefined();
    expect(scheme?.threat).toBe(3);
  });
});

describe('Legions of Hydra Modular Encounter Set Integration with Rhino', () => {
  it('initializes Rhino scenario with Legions of Hydra modular set', () => {
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      modularSetCodes: ['legions_of_hydra'],
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });

    // Bomb Scare cards should NOT be present
    expect(state.encounterDeck.some((c) => c.card.code === '01109')).toBe(false);
    expect(state.sideSchemes.some((s) => s.card.code === '01109')).toBe(false);

    // Legions of Hydra modular cards should be present with full expanded quantities:
    // 2x 01180, 1x 01181, 3x 01182 = 6 cards
    const hydraDeckCards = state.encounterDeck.filter(
      (c) =>
        c.card.setCode === 'legions_of_hydra' || ['01180', '01181', '01182'].includes(c.card.code),
    );
    expect(hydraDeckCards.length).toBe(6);
    expect(hydraDeckCards.filter((c) => c.card.code === LEGIONS_OF_HYDRA).length).toBe(2);
    expect(hydraDeckCards.filter((c) => c.card.code === MADAME_HYDRA).length).toBe(1);
    expect(hydraDeckCards.filter((c) => c.card.code === HYDRA_SOLDIER).length).toBe(3);
  });

  it('orchestrates full cross-card interaction arc between 01180, 01181, and 01182 in a live Rhino game', () => {
    resetInstanceCounter();
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      modularSetCodes: ['legions_of_hydra'],
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = player.hero;

    // 1. A Hydra Soldier (01182) enters play engaged with player
    const soldierCard = cardCatalog.getCard(HYDRA_SOLDIER)!;
    const soldierInstance = createCardInstance(soldierCard);
    player.engagedMinions.push(soldierInstance);

    // Guard prevents attacking Rhino
    expect(isVillainAttackBlockedByGuard(player)).toBe(true);

    // Ensure Madame Hydra (01181) is in the encounter deck, ready to be searched
    if (!state.encounterDeck.some((c) => c.card.code === MADAME_HYDRA)) {
      state.encounterDeck.push(createCardInstance(cardCatalog.getCard(MADAME_HYDRA)!));
    }

    // 2. Legions of Hydra (01180) is revealed during encounter reveal step
    player.dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(LEGIONS_OF_HYDRA)!));
    step4_revealEncounterCards(state);

    // Madame Hydra was searched and is now engaged
    const madameInstance = player.engagedMinions.find((m) => m.card.code === MADAME_HYDRA);
    expect(madameInstance).toBeDefined();

    // Side scheme is in play; base 3 + (2 Hydra enemies: Madame Hydra + Hydra Soldier) * 2 = 7 threat
    const legionsScheme = state.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(legionsScheme).toBeDefined();
    expect(legionsScheme?.threat).toBe(7);

    // 3. Madame Hydra is immune to damage while Legions of Hydra is in play
    const minionRef = {
      type: 'minion' as const,
      entity: madameInstance!,
      instanceId: madameInstance!.instanceId,
      name: madameInstance!.card.name,
      targetPlayerId: player.id,
    };
    expect(isImmuneToDamage(state, minionRef as any)).toBe(true);

    const attackRes = applyDamageToTarget(state, {
      target: minionRef as any,
      amount: 4,
      isAttack: true,
      sourcePlayerId: player.id,
      sourceType: 'HERO',
    });
    expect(attackRes.result.damageTaken ?? 0).toBe(0);
    expect(madameInstance!.tokens?.damage ?? 0).toBe(0);

    // 4. Defeat Hydra Soldier (01182)
    const soldierRef = {
      type: 'minion' as const,
      entity: soldierInstance,
      name: soldierInstance.card.name,
      targetPlayerId: player.id,
    };
    const soldierDefeatRes = applyDamageToTarget(state, {
      target: soldierRef,
      amount: 4,
      isAttack: true,
      sourcePlayerId: player.id,
    });
    expect(soldierDefeatRes.result.targetDefeated).toBe(true);
    expect(player.engagedMinions.some((m) => m.instanceId === soldierInstance.instanceId)).toBe(
      false,
    );
    // When Defeated triggered: player received 1 facedown encounter card
    expect(player.dealtEncounterCards.length).toBe(1);
    // Rhino is no longer blocked by Guard
    expect(isVillainAttackBlockedByGuard(player)).toBe(false);

    // 5. Madame Hydra attacks player -> Forced Response places 2 threat on Legions of Hydra
    executeEnemyAttackSynchronously(
      state,
      { type: 'MINION', card: madameInstance! },
      player.id,
      'TAKE_UNDEFENDED',
    );
    expect(legionsScheme!.threat).toBe(9);

    // 6. Defeat Legions of Hydra by thwarting / removing all 9 threat
    removeThreatFromScheme(state, {
      playerId: player.id,
      targetType: 'side_scheme',
      targetInstanceId: legionsScheme!.instanceId,
      amount: 9,
      isPlayerSource: true,
      sourceName: 'Spider-Man',
    });
    expect(state.sideSchemes.some((s) => s.card.code === LEGIONS_OF_HYDRA)).toBe(false);
    expect(state.encounterDiscard.some((c) => c.card.code === LEGIONS_OF_HYDRA)).toBe(true);

    // 7. Madame Hydra's damage immunity drops once Legions of Hydra is defeated
    expect(isImmuneToDamage(state, minionRef as any)).toBe(false);

    // Player attacks and defeats Madame Hydra (HP: 6)
    const fatalAttackRes = applyDamageToTarget(state, {
      target: minionRef as any,
      amount: 6,
      isAttack: true,
      sourcePlayerId: player.id,
      sourceType: 'HERO',
    });
    expect(fatalAttackRes.result.targetDefeated).toBe(true);
    expect(player.engagedMinions.some((m) => m.instanceId === madameInstance!.instanceId)).toBe(
      false,
    );
    expect(state.encounterDiscard.some((c) => c.instanceId === madameInstance!.instanceId)).toBe(
      true,
    );
  });
});
