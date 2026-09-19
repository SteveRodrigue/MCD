import { describe, it, expect } from 'vitest';
import {
  getEffectivePlayerTraits,
  getEffectivePlayerTraitsDetails,
  getEffectiveCardTraits,
  getEffectiveCardTraitsDetails,
  hasPlayerTrait,
} from '../../src/engine/pipeline/stat-calculator';
import { evaluatePlayRequirements } from '../../src/engine/pipeline/legality-checker';
import { CardType } from '../../src/engine/models/enums';
import type { GameState, PlayerState, CardInstance, NormalizedCard } from '../../src/engine/models';

function createMockPlayer(overrides?: Partial<PlayerState>): PlayerState {
  const heroCard: NormalizedCard = {
    code: '01010a',
    name: 'Captain Marvel',
    type: CardType.HERO,
    traits: ['Avenger', 'Captain Marvel'],
    faction: 'hero',
    cost: null,
    text: '',
    resources: { total: 0, physical: 0, energy: 0, mental: 0, wild: 0 },
  } as any;

  const alterEgoCard: NormalizedCard = {
    code: '01010b',
    name: 'Carol Danvers',
    type: CardType.ALTER_EGO,
    traits: ['S.H.I.E.L.D.', 'Soldier'],
    faction: 'hero',
    cost: null,
    text: '',
    resources: { total: 0, physical: 0, energy: 0, mental: 0, wild: 0 },
  } as any;

  return {
    id: 'player-1',
    name: 'Carol Danvers',
    hero: heroCard as any,
    alterEgo: alterEgoCard as any,
    currentForm: 'hero',
    health: 12,
    maxHealth: 12,
    deck: [],
    hand: [],
    discard: [],
    tableau: [],
    allies: [],
    engagedMinions: [],
    attachments: [],
    activeFormCard: heroCard,
    availableForms: [heroCard, alterEgoCard],
    exhausted: false,
    statusCards: [],
    basicChangeFormUsedThisRound: false,
    formChangedThisRound: false,
    recoveryUsedThisRound: false,
    ...overrides,
  } as any as PlayerState;
}

function createMockState(playerOverrides?: Partial<PlayerState>): GameState {
  const player = createMockPlayer(playerOverrides);
  return {
    scenarioId: 'rhino',
    scenario: { id: 'rhino', name: 'Rhino' } as any,
    villain: {
      id: 'rhino-1',
      card: {
        code: '01094',
        name: 'Rhino',
        type: CardType.VILLAIN,
        traits: ['Brute', 'Criminal'],
        hitPoints: 14,
      } as any,
      health: 14,
      maxHealth: 14,
      statusCards: [],
      attachments: [],
    } as any,
    mainScheme: {
      id: 'main-scheme',
      instanceId: 'main-scheme',
      card: { code: '01097b', name: 'The Break-In!' } as any,
      threat: 0,
      targetThreat: 7,
      accelerationTokens: 0,
    } as any,
    sideSchemes: [],
    players: [player],
    activePlayerIndex: 0,
    firstPlayerIndex: 0,
    phase: 'PLAYER_PHASE' as any,
    roundNumber: 1,
    turnStep: 'ACTIONS',
    boostDeck: [],
    boostDiscard: [],
    encounterDeck: [],
    encounterDiscard: [],
  } as any as GameState;
}

describe('Effective Traits Engine Pipeline', () => {
  describe('getEffectivePlayerTraits and getEffectivePlayerTraitsDetails', () => {
    it('returns printed traits when no dynamic upgrades or attachments exist', () => {
      const player = createMockPlayer();
      const details = getEffectivePlayerTraitsDetails(player);

      expect(details.printedTraits).toContain('Avenger');
      expect(details.printedTraits).toContain('Captain Marvel');
      expect(details.printedTraits).toContain('S.H.I.E.L.D.');
      expect(details.printedTraits).toContain('Soldier');
      expect(details.dynamicTraits).toEqual([]);
      expect(details.traits).toEqual(details.printedTraits);

      const traitsList = getEffectivePlayerTraits(player);
      expect(traitsList).toEqual(details.traits);
    });

    it('dynamically adds traits from tableau upgrades with CONSTANT ADD_TRAIT (Cosmic Flight 01017)', () => {
      const player = createMockPlayer();
      const cosmicFlight: CardInstance = {
        instanceId: 'cf-1',
        card: {
          code: '01017',
          name: 'Cosmic Flight',
          type: CardType.UPGRADE,
          traits: ['Item', 'Superpower'],
          enrichment: {
            abilities: [
              {
                id: 'cosmic_flight_aerial',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Aerial' },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.tableau.push(cosmicFlight);

      const details = getEffectivePlayerTraitsDetails(player);
      expect(details.dynamicTraits).toEqual(['Aerial']);
      expect(details.traits).toContain('Aerial');
      expect(details.traits).toContain('Avenger');
      expect(getEffectivePlayerTraits(player)).toContain('Aerial');
    });

    it('dynamically adds traits from player identity attachments with CONSTANT ADD_TRAIT', () => {
      const player = createMockPlayer();
      const symAttachment: CardInstance = {
        instanceId: 'sym-1',
        card: {
          code: 'sym-card',
          name: 'Symbiote Infestation',
          type: CardType.ATTACHMENT,
          traits: ['Symbiote'],
          enrichment: {
            abilities: [
              {
                id: 'sym_trait',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Symbiote' },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.attachments = [symAttachment];

      const details = getEffectivePlayerTraitsDetails(player);
      expect(details.dynamicTraits).toContain('Symbiote');
      expect(details.traits).toContain('Symbiote');
      expect(getEffectivePlayerTraits(player)).toContain('Symbiote');
    });

    it('deduplicates traits cleanly when printed and dynamic overlap', () => {
      const player = createMockPlayer();
      const duplicateAvengerUpgrade: CardInstance = {
        instanceId: 'up-1',
        card: {
          code: 'up-code',
          name: 'Avenger Honor',
          type: CardType.UPGRADE,
          traits: ['Title'],
          enrichment: {
            abilities: [
              {
                id: 'add_avenger',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Avenger' },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.tableau.push(duplicateAvengerUpgrade);

      const details = getEffectivePlayerTraitsDetails(player);
      expect(details.dynamicTraits).toEqual(['Avenger']);
      // Should not contain duplicate 'Avenger' in traits
      const avengerOccurrences = details.traits.filter((t) => t.toLowerCase() === 'avenger').length;
      expect(avengerOccurrences).toBe(1);
    });

    it('respects form changes between Hero and Alter-Ego form', () => {
      const player = createMockPlayer();
      expect(player.currentForm).toBe('hero');
      let details = getEffectivePlayerTraitsDetails(player);
      // In hero form, activeFormCard traits are Avenger and Captain Marvel
      expect(details.traits).toContain('Avenger');

      // Flip form to alter-ego
      player.currentForm = 'alter_ego';
      player.activeFormCard = player.alterEgo;
      details = getEffectivePlayerTraitsDetails(player);
      expect(details.traits).toContain('Soldier');
      expect(details.traits).toContain('S.H.I.E.L.D.');
    });
  });

  describe('getEffectiveCardTraits and getEffectiveCardTraitsDetails', () => {
    it('returns card printed traits when no instance attachments exist', () => {
      const allyCard: NormalizedCard = {
        code: 'ally-1',
        name: 'Mockingbird',
        type: CardType.ALLY,
        traits: ['Avenger', 'Spy'],
        faction: 'basic',
        cost: 3,
        text: '',
        resources: { total: 0, physical: 0, energy: 0, mental: 0, wild: 0 },
      } as any;

      const details = getEffectiveCardTraitsDetails(allyCard);
      expect(details.printedTraits).toEqual(['Avenger', 'Spy']);
      expect(details.dynamicTraits).toEqual([]);
      expect(details.traits).toEqual(['Avenger', 'Spy']);
      expect(getEffectiveCardTraits(allyCard)).toEqual(['Avenger', 'Spy']);
    });

    it('dynamically adds traits from ally attachments with CONSTANT ADD_TRAIT', () => {
      const allyCard: NormalizedCard = {
        code: 'ally-1',
        name: 'Mockingbird',
        type: CardType.ALLY,
        traits: ['Avenger', 'Spy'],
        faction: 'basic',
        cost: 3,
        text: '',
        resources: { total: 0, physical: 0, energy: 0, mental: 0, wild: 0 },
      } as any;

      const bootCampAttachment: CardInstance = {
        instanceId: 'att-1',
        card: {
          code: 'att-code',
          name: 'Special Forces Training',
          type: CardType.ATTACHMENT,
          traits: ['Skill'],
          enrichment: {
            abilities: [
              {
                id: 'sf_trait',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Soldier' },
                  },
                ],
              },
            ],
          },
        } as any,
      };

      const allyInstance: CardInstance = {
        instanceId: 'inst-ally',
        card: allyCard,
        attachments: [bootCampAttachment],
      };

      const details = getEffectiveCardTraitsDetails(allyCard, allyInstance);
      expect(details.printedTraits).toEqual(['Avenger', 'Spy']);
      expect(details.dynamicTraits).toEqual(['Soldier']);
      expect(details.traits).toEqual(['Avenger', 'Spy', 'Soldier']);
      expect(getEffectiveCardTraits(allyCard, allyInstance)).toContain('Soldier');
    });

    it('delegates to player traits when context player matches identity card', () => {
      const player = createMockPlayer();
      const cosmicFlight: CardInstance = {
        instanceId: 'cf-1',
        card: {
          code: '01017',
          name: 'Cosmic Flight',
          type: CardType.UPGRADE,
          traits: ['Item'],
          enrichment: {
            abilities: [
              {
                id: 'cf_aerial',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Aerial' },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.tableau.push(cosmicFlight);

      const details = getEffectiveCardTraitsDetails(player.activeFormCard, undefined, { player });
      expect(details.dynamicTraits).toContain('Aerial');
      expect(details.traits).toContain('Aerial');
    });

    it('evaluates villain attachments when villain context is passed', () => {
      const state = createMockState();
      const attachment: CardInstance = {
        instanceId: 'att-v',
        card: {
          code: 'att-v-code',
          name: 'Gamma Mutagen',
          type: CardType.ATTACHMENT,
          traits: ['Condition'],
          enrichment: {
            abilities: [
              {
                id: 'add_gamma',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Gamma' },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      state.villain.attachments.push(attachment);

      const details = getEffectiveCardTraitsDetails(state.villain.card, undefined, {
        villain: state.villain,
      });
      expect(details.dynamicTraits).toContain('Gamma');
      expect(details.traits).toContain('Gamma');
      expect(details.traits).toContain('Brute');
    });
  });

  describe('hasPlayerTrait', () => {
    it('returns true for printed traits with case-insensitivity', () => {
      const player = createMockPlayer();
      expect(hasPlayerTrait(player, 'Avenger')).toBe(true);
      expect(hasPlayerTrait(player, 'avenger')).toBe(true);
      expect(hasPlayerTrait(player, 'AVENGER')).toBe(true);
      expect(hasPlayerTrait(player, 'Soldier')).toBe(true);
      expect(hasPlayerTrait(player, 'soldier')).toBe(true);
      expect(hasPlayerTrait(player, 'Mystic')).toBe(false);
    });

    it('returns true for dynamically granted traits via Cosmic Flight', () => {
      const player = createMockPlayer();
      expect(hasPlayerTrait(player, 'Aerial')).toBe(false);

      const cosmicFlight: CardInstance = {
        instanceId: 'cf-1',
        card: {
          code: '01017',
          name: 'Cosmic Flight',
          type: CardType.UPGRADE,
          traits: ['Item'],
          enrichment: {
            abilities: [
              {
                id: 'cf_aerial',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Aerial' },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.tableau.push(cosmicFlight);

      expect(hasPlayerTrait(player, 'Aerial')).toBe(true);
      expect(hasPlayerTrait(player, 'aerial')).toBe(true);
      expect(hasPlayerTrait(player, 'AERIAL')).toBe(true);
    });

    it('returns true for traits granted via identity attachments', () => {
      const player = createMockPlayer();
      player.attachments = [
        {
          instanceId: 'att-1',
          card: {
            code: 'att-1',
            name: 'Web-Shield',
            traits: [],
            enrichment: {
              abilities: [
                {
                  id: 'web_shield',
                  timing: 'CONSTANT',
                  steps: [
                    {
                      effect: 'ADD_TRAIT',
                      effectParams: { trait: 'Shield' },
                    },
                  ],
                },
              ],
            },
          } as any,
        },
      ];

      expect(hasPlayerTrait(player, 'Shield')).toBe(true);
    });
  });

  describe('legality-checker identityTraits integration with dynamic traits', () => {
    it('blocks playing a card requiring identityTraits when player lacks trait', () => {
      const state = createMockState();
      const player = state.players[0];

      // Card requiring Aerial trait
      const aerialEventCard: NormalizedCard = {
        code: 'aerial-event-1',
        name: 'Pitch Black',
        type: CardType.EVENT,
        traits: ['Tactic'],
        faction: 'hero',
        cost: 1,
        text: 'Play only if your identity has the Aerial trait.',
        resources: { total: 1, physical: 1, energy: 0, mental: 0, wild: 0 },
        enrichment: {
          playRequirements: {
            identityTraits: ['Aerial'],
          },
        },
      } as any;

      const result = evaluatePlayRequirements(state, player, aerialEventCard);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Requires identity with trait: Aerial');
    });

    it('allows playing a card requiring identityTraits when player gains trait via Cosmic Flight', () => {
      const state = createMockState();
      const player = state.players[0];

      const cosmicFlight: CardInstance = {
        instanceId: 'cf-1',
        card: {
          code: '01017',
          name: 'Cosmic Flight',
          type: CardType.UPGRADE,
          traits: ['Item'],
          enrichment: {
            abilities: [
              {
                id: 'cf_aerial',
                timing: 'CONSTANT',
                steps: [
                  {
                    effect: 'ADD_TRAIT',
                    effectParams: { trait: 'Aerial' },
                  },
                ],
              },
            ],
          },
        } as any,
      };
      player.tableau.push(cosmicFlight);

      const aerialEventCard: NormalizedCard = {
        code: 'aerial-event-1',
        name: 'Pitch Black',
        type: CardType.EVENT,
        traits: ['Tactic'],
        faction: 'hero',
        cost: 1,
        text: 'Play only if your identity has the Aerial trait.',
        resources: { total: 1, physical: 1, energy: 0, mental: 0, wild: 0 },
        enrichment: {
          playRequirements: {
            identityTraits: ['Aerial'],
          },
        },
      } as any;

      const result = evaluatePlayRequirements(state, player, aerialEventCard);
      expect(result.allowed).toBe(true);
    });
  });
});
