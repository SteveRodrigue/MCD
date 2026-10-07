import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { AlterEgoCard, GameState, HeroCard } from '@engine/models';
import type { TriggerFilter } from '@engine/models';
import type { TriggerContext } from '@engine/triggers/trigger-dispatcher';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { matchesTriggerFilter } from '@engine/triggers/trigger-dispatcher';

/**
 * #276: trigger-filter members that no test exercised (scopes, forms, engagement, threat
 * source and the `attackerCardFilter` card criteria), proven through the real matcher.
 */
const ctx = (extra: Partial<TriggerContext>): TriggerContext => ({
  targetPlayerId: 'p1',
  ...extra,
});

describe('trigger filter members (#276)', () => {
  let state: GameState;

  beforeEach(() => {
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
      villain: cardCatalog.getCard('01094') as never,
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: Array(10).fill(cardCatalog.getCard('01108')!),
      skipMulligan: true,
      skipScenarioPlugin: true,
    });
  });

  const player = () => state.players[0];

  describe('targetPlayerScope', () => {
    it('OTHER matches only another player, ANY matches everyone', () => {
      const other: TriggerFilter = { targetPlayerScope: 'OTHER' };
      expect(matchesTriggerFilter(other, { targetPlayerId: 'p2' }, player())).toBe(true);
      expect(matchesTriggerFilter(other, { targetPlayerId: 'p1' }, player())).toBe(false);

      const any: TriggerFilter = { targetPlayerScope: 'ANY' };
      expect(matchesTriggerFilter(any, { targetPlayerId: 'p2' }, player())).toBe(true);
      expect(matchesTriggerFilter(any, { targetPlayerId: 'p1' }, player())).toBe(true);
    });
  });

  describe('targetScope', () => {
    it('OTHER excludes the card itself, ANY does not restrict', () => {
      const card = createCardInstance(cardCatalog.getCard('01016')!);
      const self = ctx({ targetInstanceId: card.instanceId });
      const elsewhere = ctx({ targetInstanceId: 'someone_else' });

      expect(matchesTriggerFilter({ targetScope: 'OTHER' }, elsewhere, player(), card)).toBe(true);
      expect(matchesTriggerFilter({ targetScope: 'OTHER' }, self, player(), card)).toBe(false);
      expect(matchesTriggerFilter({ targetScope: 'ANY' }, self, player(), card)).toBe(true);
      expect(matchesTriggerFilter({ targetScope: 'ANY' }, elsewhere, player(), card)).toBe(true);
    });
  });

  describe('targetForm', () => {
    it('matches the form of the event target (alter-ego and hero)', () => {
      expect(
        matchesTriggerFilter(
          { targetForm: 'ALTER_EGO' },
          ctx({ targetForm: 'ALTER_EGO' }),
          player(),
        ),
      ).toBe(true);
      expect(
        matchesTriggerFilter({ targetForm: 'ALTER_EGO' }, ctx({ targetForm: 'HERO' }), player()),
      ).toBe(false);
      expect(
        matchesTriggerFilter({ targetForm: 'HERO' }, ctx({ targetForm: 'HERO' }), player()),
      ).toBe(true);
    });
  });

  describe('isEngaged', () => {
    it('is true for an enemy target and false for a non-enemy target', () => {
      expect(
        matchesTriggerFilter({ isEngaged: true }, ctx({ targetType: 'MINION' }), player()),
      ).toBe(true);
      expect(
        matchesTriggerFilter({ isEngaged: true }, ctx({ targetType: 'SCHEME' }), player()),
      ).toBe(false);
      expect(
        matchesTriggerFilter({ isEngaged: false }, ctx({ targetType: 'SCHEME' }), player()),
      ).toBe(true);
    });
  });

  describe('threatSource', () => {
    it('HAZARD matches only threat placed by a hazard', () => {
      const filter: TriggerFilter = { threatSource: 'HAZARD' };
      expect(matchesTriggerFilter(filter, ctx({ threatSource: 'HAZARD' }), player())).toBe(true);
      expect(matchesTriggerFilter(filter, ctx({ threatSource: 'VILLAIN_SCHEME' }), player())).toBe(
        false,
      );
    });
  });

  describe('damageSource', () => {
    it('ATTACK matches only damage from an attack (#256)', () => {
      const filter: TriggerFilter = { damageSource: 'ATTACK' };
      expect(matchesTriggerFilter(filter, ctx({ damageSource: 'ATTACK' }), player())).toBe(true);
      expect(matchesTriggerFilter(filter, ctx({}), player())).toBe(false);
    });
  });

  describe('attackerCardFilter', () => {
    const attacker = (card: Record<string, unknown>) =>
      ({ attackerCard: { card }, targetPlayerId: 'p1' }) as never;

    it('types: environment matches only an environment attacker', () => {
      const filter: TriggerFilter = { attackerCardFilter: { types: ['environment'] } };
      expect(
        matchesTriggerFilter(filter, attacker({ code: 'x', type: 'environment' }), player()),
      ).toBe(true);
      expect(matchesTriggerFilter(filter, attacker({ code: 'x', type: 'minion' }), player())).toBe(
        false,
      );
    });

    it.each(['Overkill', 'Quickstrike', 'Ranged', 'Hazard', 'Acceleration'] as const)(
      'hasKeyword %s matches an attacker carrying that keyword',
      (keyword) => {
        const filter: TriggerFilter = { attackerCardFilter: { hasKeyword: keyword } };
        const withKeyword = attacker({ code: 'x', type: 'minion', keywords: [keyword] });
        const without = attacker({ code: 'x', type: 'minion', keywords: [] });
        expect(matchesTriggerFilter(filter, withKeyword, player())).toBe(true);
        expect(matchesTriggerFilter(filter, without, player())).toBe(false);
      },
    );

    it('isIdentitySpecific accepts only cards of the player hero set', () => {
      const filter: TriggerFilter = { attackerCardFilter: { isIdentitySpecific: true } };
      const heroCard = attacker({ code: '01005', type: 'event', raw: {} });
      const otherCard = attacker({ code: '09999', type: 'event', raw: {} });
      expect(matchesTriggerFilter(filter, heroCard, player())).toBe(true);
      expect(matchesTriggerFilter(filter, otherCard, player())).toBe(false);
    });
  });
});
