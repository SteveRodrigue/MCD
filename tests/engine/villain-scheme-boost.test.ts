import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  CardType,
  StatusCard,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  Keyword,
  MinionCard,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import {
  executeVillainSchemeAgainstPlayer,
  executeMinionSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
  executeMinionActivationAgainstPlayer,
} from '@engine/pipeline/villain-phase';

describe('Villain Scheme Boost Resolution & Villainous Activations (Issue #188)', () => {
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
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any, // Rhino I (SCH 1, ATK 2)
      mainScheme: cardCatalog.getCard('01097b') as any, // The Break-In! (targetThreat 7)
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = peterParkerAlterEgo;
    state.mainScheme.threat = 1;
    state.encounterDiscard = [];
  });

  it('1. Advance (01186): Villain schemes on reveal, draws boost card, logs reveal, adds boost icons, and discards boost card', () => {
    const advanceCard = cardCatalog.getCard('01186')!;
    const advanceInst = createCardInstance(advanceCard);

    // Prepare top boost card in encounter deck with known 2 boost icons
    const mockBoostCard: CardInstance = {
      instanceId: 'boost_card_01',
      card: {
        id: 'mock_boost',
        code: 'mock_boost',
        name: 'Hydra Bomber',
        type: CardType.MINION,
        boostIcons: 2,
      } as any,
    };
    state.encounterDeck = [mockBoostCard];

    const initialThreat = state.mainScheme.threat;
    const initialDeckCount = state.encounterDeck.length;

    // Execute Advance Treachery
    const ability = advanceCard.enrichment!.abilities![0];
    const res = executeEffect(state, ability, {
      playerId: 'p1',
      sourceCardInstance: advanceInst,
    });

    expect(res.success).toBe(true);

    // 1. Boost card drawn from deck
    expect(res.state.encounterDeck.length).toBe(initialDeckCount - 1);

    // 2. Logged villain.boost.revealed
    const boostLog = res.state.log.find((l) => l.key === 'villain.boost.revealed');
    expect(boostLog).toBeDefined();
    expect(boostLog?.params?.card).toBe('Hydra Bomber');
    expect(boostLog?.params?.boostIcons).toBe(2);

    // 3. Main Scheme threat placed = Rhino SCH (1) + Boost Icons (2) = 3
    expect(res.state.mainScheme.threat).toBe(initialThreat + 1 + 2);

    // 4. Boost card discarded to encounter discard
    expect(res.state.encounterDiscard).toHaveLength(1);
    expect(res.state.encounterDiscard[0].instanceId).toBe('boost_card_01');
    expect(res.state.activeBoostCard).toBeUndefined();
  });

  it('2. Star Boost Ability: Star boost ability executes and resolves properly during villain scheme activation', () => {
    const starBoostCard: CardInstance = {
      instanceId: 'star_boost_01',
      card: {
        id: 'star_boost_treachery',
        code: 'star_boost_treachery',
        name: 'Sinister Schemes',
        type: CardType.TREACHERY,
        boostIcons: 1,
        boostStar: true,
        enrichment: {
          abilities: [
            {
              id: 'star_boost_confuse',
              timing: 'BOOST',
              steps: [
                {
                  effect: 'ADD_STATUS',
                  effectParams: {
                    status: StatusCard.CONFUSED,
                    target: 'PLAYER',
                  },
                },
              ],
            },
          ],
        },
      } as any,
    };
    state.encounterDeck = [starBoostCard];

    const initialThreat = state.mainScheme.threat;
    expect(state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);

    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    // Star boost effect applied
    expect(state.players[0].statusCards).toContain(StatusCard.CONFUSED);

    // Logs recorded
    const starLog = state.log.find((l) => l.key === 'villain.boost.starResolved');
    expect(starLog).toBeDefined();
    expect(starLog?.params?.card).toBe('Sinister Schemes');
    expect(starLog?.params?.abilityId).toBe('star_boost_confuse');

    const boostLog = state.log.find((l) => l.key === 'villain.boost.revealed');
    expect(boostLog).toBeDefined();
    expect(boostLog?.params?.boostIcons).toBe(1);

    // Main scheme threat: Rhino SCH (1) + Boost Icons (1) = 2
    expect(state.mainScheme.threat).toBe(initialThreat + 1 + 1);

    // Boost card discarded
    expect(state.encounterDiscard).toHaveLength(1);
    expect(state.encounterDiscard[0].instanceId).toBe('star_boost_01');
  });

  it('3. Multiple Boost Cards: Villain with additionalBoostCards deals and resolves multiple boost cards during scheme', () => {
    (state.villain.card as any).additionalBoostCards = 1;

    const boost1: CardInstance = {
      instanceId: 'boost_01',
      card: {
        id: 'b1',
        code: 'b1',
        name: 'Boost One',
        type: CardType.TREACHERY,
        boostIcons: 1,
      } as any,
    };
    const boost2: CardInstance = {
      instanceId: 'boost_02',
      card: {
        id: 'b2',
        code: 'b2',
        name: 'Boost Two',
        type: CardType.TREACHERY,
        boostIcons: 2,
      } as any,
    };
    // Top card is boost1, next is boost2
    state.encounterDeck = [boost1, boost2];

    const initialThreat = state.mainScheme.threat;

    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    expect(state.encounterDeck).toHaveLength(0);
    expect(state.encounterDiscard).toHaveLength(2);
    expect(state.encounterDiscard[0].instanceId).toBe('boost_01');
    expect(state.encounterDiscard[1].instanceId).toBe('boost_02');

    // Both revealed logs present
    const revealLogs = state.log.filter((l) => l.key === 'villain.boost.revealed');
    expect(revealLogs).toHaveLength(2);
    expect(revealLogs[0].params?.boostIcons).toBe(1);
    expect(revealLogs[1].params?.boostIcons).toBe(2);

    // Total threat: Rhino SCH (1) + boost1 (1) + boost2 (2) = 4
    expect(state.mainScheme.threat).toBe(initialThreat + 1 + 1 + 2);
  });

  it('4. Villainous Minion Scheme: Minion with Villainous keyword deals and resolves boost card when scheming', () => {
    const villainousMinion: CardInstance = {
      instanceId: 'minion_villainous_1',
      card: {
        id: 'armored_guard',
        code: 'armored_guard',
        name: 'Armored Guard',
        type: CardType.MINION,
        scheme: 1,
        attack: 2,
        health: 3,
        keywords: [Keyword.VILLAINOUS],
      } as unknown as MinionCard,
    };
    state.players[0].engagedMinions = [villainousMinion];

    const boostCard: CardInstance = {
      instanceId: 'boost_minion_sch',
      card: {
        id: 'boost_minion_sch_card',
        code: 'boost_minion_sch_card',
        name: 'Reinforcements',
        type: CardType.TREACHERY,
        boostIcons: 2,
      } as any,
    };
    state.encounterDeck = [boostCard];

    const initialThreat = state.mainScheme.threat;

    executeMinionSchemeAgainstPlayer(state, villainousMinion, state.players[0]);

    // Boost card drawn and discarded
    expect(state.encounterDeck).toHaveLength(0);
    expect(state.encounterDiscard).toHaveLength(1);
    expect(state.encounterDiscard[0].instanceId).toBe('boost_minion_sch');

    // Revealed log present
    const boostLog = state.log.find((l) => l.key === 'villain.boost.revealed');
    expect(boostLog).toBeDefined();
    expect(boostLog?.params?.card).toBe('Reinforcements');
    expect(boostLog?.params?.boostIcons).toBe(2);

    // Main scheme threat: base minion SCH (1) + Boost Icons (2) = 3
    expect(state.mainScheme.threat).toBe(initialThreat + 1 + 2);
  });

  it('5. Villainous Minion Attack: Minion with Villainous keyword deals and resolves boost card when attacking', () => {
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].health = 10;

    const villainousMinion: CardInstance = {
      instanceId: 'minion_villainous_2',
      card: {
        id: 'tombstone',
        code: 'tombstone',
        name: 'Tombstone',
        type: CardType.MINION,
        scheme: 1,
        attack: 3,
        health: 4,
        keywords: [Keyword.VILLAINOUS],
      } as unknown as MinionCard,
    };
    state.players[0].engagedMinions = [villainousMinion];

    const boostCard: CardInstance = {
      instanceId: 'boost_minion_atk',
      card: {
        id: 'boost_atk_card',
        code: 'boost_atk_card',
        name: 'Concussive Blast',
        type: CardType.TREACHERY,
        boostIcons: 2,
      } as any,
    };
    state.encounterDeck = [boostCard];

    executeMinionAttackAgainstPlayer(state, villainousMinion, state.players[0], {
      synchronousPolicy: 'TAKE_UNDEFENDED',
    });

    // Boost card drawn and discarded
    expect(state.encounterDeck).toHaveLength(0);
    expect(state.encounterDiscard).toHaveLength(1);
    expect(state.encounterDiscard[0].instanceId).toBe('boost_minion_atk');

    // Reveal log present
    const boostLog = state.log.find((l) => l.key === 'villain.boost.revealed');
    expect(boostLog).toBeDefined();
    expect(boostLog?.params?.card).toBe('Concussive Blast');
    expect(boostLog?.params?.boostIcons).toBe(2);

    // Undefended damage: Minion ATK (3) + Boost Icons (2) = 5 damage
    expect(state.players[0].health).toBe(10 - 5);
  });

  it('6. Regular Minion Invariant: Minion without Villainous keyword attacks and schemes without dealing boost cards', () => {
    const regularMinion: CardInstance = {
      instanceId: 'regular_minion_1',
      card: {
        id: 'hydra_soldier',
        code: 'hydra_soldier',
        name: 'Hydra Soldier',
        type: CardType.MINION,
        scheme: 1,
        attack: 1,
        health: 2,
        keywords: [],
      } as unknown as MinionCard,
    };
    state.players[0].engagedMinions = [regularMinion];

    const topEncounterCard: CardInstance = {
      instanceId: 'deck_card_untouched',
      card: {
        id: 'untouched',
        code: 'untouched',
        name: 'Untouched Card',
        type: CardType.TREACHERY,
        boostIcons: 3,
      } as any,
    };
    state.encounterDeck = [topEncounterCard];

    // 1. Minion Schemes in Alter-Ego
    state.players[0].currentForm = 'alter_ego';
    const initialThreat = state.mainScheme.threat;

    executeMinionActivationAgainstPlayer(state, regularMinion, state.players[0]);

    // No boost card dealt
    expect(state.encounterDeck).toHaveLength(1);
    expect(state.encounterDiscard).toHaveLength(0);
    expect(state.log.filter((l) => l.key === 'villain.boost.revealed')).toHaveLength(0);
    // Base threat only
    expect(state.mainScheme.threat).toBe(initialThreat + 1);

    // 2. Minion Attacks in Hero Form
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].health = 10;

    executeMinionActivationAgainstPlayer(state, regularMinion, state.players[0], {
      synchronousPolicy: 'TAKE_UNDEFENDED',
    });

    // Still no boost card dealt
    expect(state.encounterDeck).toHaveLength(1);
    expect(state.encounterDiscard).toHaveLength(0);
    expect(state.log.filter((l) => l.key === 'villain.boost.revealed')).toHaveLength(0);
    // Base damage only: 1 damage
    expect(state.players[0].health).toBe(9);
  });

  it('7. Confused Villain Invariant: Confused villain clears confusion and does not deal boost cards or place threat', () => {
    state.villain.statusCards = [StatusCard.CONFUSED];

    const boostCard: CardInstance = {
      instanceId: 'should_not_draw',
      card: {
        id: 'no_draw',
        code: 'no_draw',
        name: 'No Draw Card',
        type: CardType.TREACHERY,
        boostIcons: 3,
      } as any,
    };
    state.encounterDeck = [boostCard];

    const initialThreat = state.mainScheme.threat;

    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    // Confusion cleared
    expect(state.villain.statusCards).not.toContain(StatusCard.CONFUSED);

    // Confusion cancelled log emitted
    const confusedLog = state.log.find((l) => l.key === 'villain.confused.cancelled');
    expect(confusedLog).toBeDefined();

    // No boost cards drawn, no threat placed
    expect(state.encounterDeck).toHaveLength(1);
    expect(state.encounterDiscard).toHaveLength(0);
    expect(state.log.filter((l) => l.key === 'villain.boost.revealed')).toHaveLength(0);
    expect(state.mainScheme.threat).toBe(initialThreat);
  });
});
