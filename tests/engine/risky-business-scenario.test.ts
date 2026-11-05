import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { bootContent } from '../../src/data/content/apply';
import { bootPacks, contentDriver } from '../helpers/content';
import { ScenarioRegistry } from '@engine/scenarios';
import { AlterEgoCard, HeroCard, getActiveVillain, getActiveMainScheme } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { kernel } from '@engine/kernel';
import {
  executeVillainAttackAgainstPlayer,
  executeVillainSchemeAgainstPlayer,
} from '@engine/pipeline/villain-phase';

describe('Risky Business Scenario Integration (MC02 / Issue #470)', () => {
  beforeAll(async () => {
    await bootPacks('core', 'gob');
  });

  afterAll(async () => {
    await bootContent(contentDriver);
  });

  const createScenarioGame = (
    options: { heroForm?: 'hero' | 'alter_ego'; difficulty?: 'STANDARD' | 'EXPERT' } = {},
  ) => {
    const heroCard = cardCatalog.getCard('01001a') as HeroCard;
    const alterEgoCard = cardCatalog.getCard('01001b') as AlterEgoCard;
    const state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'risky_business',
      difficulty: options.difficulty ?? 'STANDARD',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: heroCard,
          alterEgo: alterEgoCard,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    if (options.heroForm === 'hero') {
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = heroCard;
    }
    return state;
  };

  it('registers the risky_business scenario in ScenarioRegistry with correct definition', () => {
    const plugin = ScenarioRegistry.get('risky_business');
    expect(plugin).toBeDefined();
    expect(plugin?.definition.name).toBe('Risky Business');
    expect(plugin?.definition.villainSetup.villainName).toBe('Norman Osborn');
    expect(plugin?.definition.mainSchemeSetup.stages).toEqual([
      '02004a',
      '02004b',
      '02005a',
      '02005b',
    ]);
    expect(plugin?.definition.modularEncounterSets.mandatory).toContain('risky_business');
  });

  it('sets up game with Norman Osborn I and Criminal Enterprise with 2 infamy counters per hero', () => {
    const state = createScenarioGame({ heroForm: 'hero' });

    // Active villain is Norman Osborn (02001a)
    const villain = getActiveVillain(state);
    expect(villain.card.code).toBe('02001a');
    expect(villain.card.name).toBe('Norman Osborn');

    // Main scheme is Hostile Takeover 1B (02004b)
    const mainScheme = getActiveMainScheme(state);
    expect(mainScheme.card.code).toBe('02004b');
    expect(mainScheme.threat).toBe(2);
    expect(mainScheme.targetThreat).toBe(7);

    // Criminal Enterprise environment is in play with 2 infamy counters
    expect(state.environments.length).toBe(1);
    const env = state.environments[0];
    expect(env.card.code).toBe('02006a');
    expect(env.card.name).toBe('Criminal Enterprise');
    expect(env.counters?.infamy).toBe(2);
  });

  it('Norman Osborn replaces attacks with placing infamy counters on Criminal Enterprise', () => {
    const state = createScenarioGame({ heroForm: 'hero' });
    const initialHealth = state.players[0].health;
    const initialCounters = state.environments[0].counters?.infamy ?? 0;

    // Trigger villain attack against Spider-Man in hero form
    executeVillainAttackAgainstPlayer(state, state.players[0]);

    // Player took no damage
    expect(state.players[0].health).toBe(initialHealth);

    // Criminal Enterprise gained 1 infamy counter
    expect(state.environments[0].counters?.infamy).toBe(initialCounters + 1);
  });

  it('removing infamy counters flips Criminal Enterprise to State of Madness and Norman Osborn to Green Goblin', () => {
    const state = createScenarioGame({ heroForm: 'hero' });
    const initialPlayerHealth = state.players[0].health;

    // Use Criminal Enterprise Action to spend 2 infamy counters
    const ability = state.environments[0].card.enrichment?.abilities?.find(
      (a) => a.id === 'criminal_enterprise_action',
    );
    expect(ability).toBeDefined();

    kernel.executeEffect(state, ability!, {
      playerId: state.players[0].id,
      sourceCardInstance: state.environments[0],
    });

    // Environment should now be State of Madness (02006b)
    expect(state.environments[0].card.code).toBe('02006b');
    expect(state.environments[0].card.name).toBe('State of Madness');
    expect(state.environments[0].counters?.madness).toBe(2); // 2 per hero

    // Villain should now be Green Goblin (02001b)
    const villain = getActiveVillain(state);
    expect(villain.card.code).toBe('02001b');
    expect(villain.card.name).toBe('Green Goblin');

    // Green Goblin's When Revealed dealt 3 indirect damage to Spider-Man
    expect(state.players[0].health).toBe(initialPlayerHealth - 3);
  });

  it('Green Goblin replaces scheming with removing madness counters from State of Madness', () => {
    const state = createScenarioGame({ heroForm: 'alter_ego' });

    // Flip to Green Goblin / State of Madness first
    state.environments[0].card = cardCatalog.getCard('02006b')!;
    state.environments[0].counters = { madness: 2 };
    state.villains[0].card = cardCatalog.getCard('02001b') as any;
    state.villains[0].activeSide = 'b';

    const initialThreat = getActiveMainScheme(state).threat;

    // Villain schemes against player in alter-ego
    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    // Main scheme threat was not increased
    expect(getActiveMainScheme(state).threat).toBe(initialThreat);

    // State of Madness lost 1 madness counter
    expect(state.environments[0].counters?.madness).toBe(1);
  });

  it('removing the last madness counter flips Green Goblin and State of Madness back to Norman Osborn and Criminal Enterprise', () => {
    const state = createScenarioGame({ heroForm: 'alter_ego' });

    // Green Goblin / State of Madness with 1 madness counter
    state.environments[0].card = cardCatalog.getCard('02006b')!;
    state.environments[0].counters = { madness: 1 };
    state.villains[0].card = cardCatalog.getCard('02001b') as any;
    state.villains[0].activeSide = 'b';

    // Villain schemes -> removes last madness counter
    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    // Should have flipped back to Norman Osborn (02001a) and Criminal Enterprise (02006a)
    expect(getActiveVillain(state).card.code).toBe('02001a');
    expect(state.environments[0].card.code).toBe('02006a');
    expect(state.environments[0].counters?.infamy).toBe(2); // re-initialized to 2 per hero
  });

  it('Hostile Takeover 1B When Completed places infamy counters and discards cards from players decks', () => {
    const state = createScenarioGame({ heroForm: 'hero' });
    const initialDeckCount = state.players[0].deck.length;

    // Environment starts with 2 infamy counters
    expect(state.environments[0].counters?.infamy).toBe(2);

    // Complete main scheme 1B
    const plugin = ScenarioRegistry.get('risky_business')!;
    const result = plugin.onMainSchemeCompleted(state, getActiveMainScheme(state).instanceId!);

    expect(result.advancedStage).toBe(true);

    // Main scheme advanced to 2B (02005b)
    expect(getActiveMainScheme(state).card.code).toBe('02005b');

    // Criminal Enterprise gained 1 infamy counter (now 3)
    expect(state.environments[0].counters?.infamy).toBe(3);

    // 3 cards were discarded from player's deck
    expect(state.players[0].deck.length).toBe(initialDeckCount - 3);
  });
});
