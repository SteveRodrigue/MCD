import { describe, it, expect } from 'vitest';
import { defaultScenarioId } from '@engine/scenarios';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { buildAbilityInventory, hashCardData } from '@engine/simulation/ability-coverage';
import { playRecipe, runGauntlet } from '@engine/simulation/gauntlet';
import {
  exerciseTriggerWindow,
  sweepTriggerWindows,
  windowOrder,
} from '@engine/simulation/ability-stage-setter';
import type { AbilityTarget } from '@engine/simulation/ability-coverage';

const allCards = cardCatalog.getAllCards();
const inventory = buildAbilityInventory(allCards);
const options = { catalog: cardCatalog, allCards, scenarioId: defaultScenarioId() };
const play = (matches: number, ledger = {}) =>
  runGauntlet({
    catalog: cardCatalog,
    allCards,
    scenarioId: defaultScenarioId(),
    seed: 'ci',
    ledger,
    matches,
    cardDataHash: hashCardData(inventory),
  });

describe('Gauntlet: full matches by the coverage-seeking bot (#431)', () => {
  const matches = play(4);

  it('plays solo and two-player matches without a crash, step error or broken invariant', () => {
    expect(matches.map((m) => m.error)).toEqual([undefined, undefined, undefined, undefined]);
    expect(new Set(matches.map((m) => m.recipe.playerCount))).toEqual(new Set([1, 2]));
  });

  it('records a recipe that replays to the same match', () => {
    for (const match of matches) {
      const again = playRecipe(match.recipe, cardCatalog);
      expect(again.fingerprint, match.recipe.id).toBe(match.fingerprint);
    }
  });

  it('records byte-identical recipes and fingerprints from the same seed and baseline', () => {
    const record = (list: typeof matches) =>
      JSON.stringify(list.map((m) => [m.recipe, m.fingerprint, m.error]));
    expect(record(play(4))).toBe(record(matches));
  });

  it('depends on the baseline ledger it is given, and only on that', () => {
    const worn = { 'card:01005': 99, 'ability:01005#swinging_web_kick': 99 };
    const withBaseline = play(4, worn);
    const record = (list: typeof matches) => JSON.stringify(list.map((m) => m.recipe));
    expect(record(withBaseline)).toBe(record(play(4, worn)));
    expect(record(withBaseline)).not.toBe(record(matches));
  });

  it('drafts the same decks from the same seed', () => {
    const codes = (list: typeof matches) => list.map((m) => m.recipe.players[0].deckCardCodes);
    expect(codes(play(4))).toEqual(codes(matches));
  });

  it('steers later matches with what earlier ones tested', () => {
    const [first, second] = matches;
    expect(Object.keys(first.recipe.ledgerSnapshot)).toHaveLength(0);
    expect(Object.keys(second.recipe.ledgerSnapshot).length).toBeGreaterThan(0);
  });

  it('keeps the ledger a recipe started from frozen, so a replay starts from the same place', () => {
    const [, second] = matches;
    const frozen = JSON.stringify(second.recipe.ledgerSnapshot);
    playRecipe(second.recipe, cardCatalog);
    expect(JSON.stringify(second.recipe.ledgerSnapshot)).toBe(frozen);
  });

  it('reports a recipe that cannot be played as a finding, not a throw', () => {
    const broken = {
      ...matches[0].recipe,
      players: [{ heroSetCode: 'nobody', deckCardCodes: [] }],
    };
    const result = playRecipe(broken, cardCatalog);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('nobody');
  });
});

describe('trigger windows: abilities that react to the same trigger (#431)', () => {
  const windows = sweepTriggerWindows(inventory, options);

  it('stages every shared trigger window and resolves each one cleanly', () => {
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.filter((w) => !w.ok).map((w) => `${w.trigger}: ${w.reason}`)).toEqual([]);
  });

  it('puts two different cards in each window', () => {
    for (const window of windows) {
      expect(new Set(window.abilities.map((a) => a.split('#')[0])).size, window.trigger).toBe(2);
    }
  });

  it('reports honestly that no real Core Set window mixes a forced and an optional ability', () => {
    // Every Core window is optional-only or forced-only, so the order rule has nothing to judge there
    expect(windows.every((w) => w.order === 'unobserved')).toBe(true);
  });
});

describe('forced before optional in one trigger window (#431)', () => {
  const target = (timing: 'FORCED_RESPONSE' | 'RESPONSE', id: string): AbilityTarget => ({
    cardCode: id,
    abilityId: id,
    card: {} as never,
    observable: 'USED',
    ability: { id, timing, trigger: 'CHARACTER_DEFEATED', steps: [] },
  });
  const forced = target('FORCED_RESPONSE', 'forced_one');
  const optional = target('RESPONSE', 'optional_one');

  it('accepts the forced ability resolving first', () => {
    expect(
      windowOrder(
        ['ability.forced_one.triggered', 'ability.optional_one.triggered'],
        [forced, optional],
      ),
    ).toEqual({ checked: true });
  });

  it('rejects an optional ability resolving first', () => {
    const result = windowOrder(
      ['ability.optional_one.triggered', 'ability.forced_one.triggered'],
      [forced, optional],
    );
    expect(result.checked).toBe(true);
    expect(result.violation).toContain('optional ability resolved before a forced one');
  });

  it('judges nothing when only one side resolved', () => {
    expect(windowOrder(['ability.forced_one.triggered'], [forced, optional])).toEqual({
      checked: false,
    });
    expect(windowOrder([], [forced, optional])).toEqual({ checked: false });
  });

  it('holds in the real engine: a forced copy of a response resolves before the optional one', () => {
    // Interrogation Room (optional) and a forced twin of it share CHARACTER_DEFEATED
    const optionalReal = inventory.find((t) => t.abilityId === 'interrogation_room_response')!;
    const twinCard = {
      ...optionalReal.card,
      code: 'sim_forced_twin',
      enrichment: {
        ...optionalReal.card.enrichment!,
        abilities: [
          { ...optionalReal.ability, id: 'sim_forced_twin', timing: 'FORCED_RESPONSE' as const },
        ],
      },
    };
    const twin: AbilityTarget = {
      ...optionalReal,
      cardCode: twinCard.code,
      abilityId: 'sim_forced_twin',
      card: twinCard as never,
      ability: twinCard.enrichment.abilities[0],
    };
    const result = exerciseTriggerWindow([optionalReal, twin], options);
    expect(result.reason).toBeUndefined();
    expect(result.order).toBe('checked');
  });
});
