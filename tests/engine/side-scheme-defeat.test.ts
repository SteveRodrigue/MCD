import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, Keyword, GameState, SideSchemeCard } from '@engine/models';
import { executeEffect, defeatSideScheme } from '@engine/effects';
import { getSpecialHandler } from '@engine/specials/special-registry';
import '@engine/specials/wakanda-forever';

describe('Canonical Side Scheme Defeat & Zero-Threat Scheme Pipeline (Issue #149, RR v1.8 p. 9, 25, 30)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;
  let state: GameState;

  beforeEach(() => {
    spiderManHero = JSON.parse(JSON.stringify(cardCatalog.getCard('01001a')!));
    peterParkerAlterEgo = JSON.parse(JSON.stringify(cardCatalog.getCard('01001b')!));
    rhinoVillain = JSON.parse(JSON.stringify(cardCatalog.getCard('01094')!));
    mainScheme = JSON.parse(JSON.stringify(cardCatalog.getCard('01097b')!));

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [
            cardCatalog.getCard('01005')!,
            cardCatalog.getCard('01006')!,
            cardCatalog.getCard('01007')!,
            cardCatalog.getCard('01008')!,
            cardCatalog.getCard('01009')!,
            cardCatalog.getCard('01084')!,
            cardCatalog.getCard('01085')!,
            cardCatalog.getCard('01086')!,
            cardCatalog.getCard('01087')!,
            cardCatalog.getCard('01088')!,
            cardCatalog.getCard('01089')!,
            cardCatalog.getCard('01090')!,
          ],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  describe('a) Event card threat removal on The Psyche-Magnitron (01176)', () => {
    it('defeats, splices from sideSchemes, discards to encounterDiscard, and dispatches SCHEME_DEFEATED', () => {
      const player = state.players[0];
      const psycheCard = cardCatalog.getCard('01176')!;
      expect(psycheCard).toBeDefined();

      state.sideSchemes = [
        {
          instanceId: 'psyche_inst_1',
          card: JSON.parse(JSON.stringify(psycheCard)),
          threat: 2,
        },
      ];

      // Track SCHEME_DEFEATED trigger dispatch with once-per-round limit (e.g. Skilled Investigator pattern)
      player.activeFormCard.enrichment = {
        abilities: [
          {
            id: 'detect_scheme_defeated',
            timing: 'FORCED_RESPONSE',
            trigger: 'SCHEME_DEFEATED',
            limit: 'ONCE_PER_ROUND',
            steps: [
              {
                effect: 'DRAW',
                effectParams: { count: 1, target: 'SELF' },
              },
            ],
          },
        ],
      };

      const initialHandCount = player.hand.length;

      // Event threat removal: remove 2 threat from The Psyche-Magnitron
      const removeThreatAbility = {
        id: 'event_remove_threat',
        timing: 'HERO_ACTION' as const,
        steps: [
          {
            effect: 'REMOVE_THREAT' as const,
            effectParams: {
              amount: 2,
              target: 'SIDE_SCHEME',
              targetInstanceId: 'psyche_inst_1',
            },
          },
        ],
      };

      const result = executeEffect(state, removeThreatAbility as any, {
        playerId: player.id,
        targetInstanceId: 'psyche_inst_1',
      });

      expect(result.success).toBe(true);

      // The side scheme must be spliced from state.sideSchemes
      expect(state.sideSchemes).toHaveLength(0);
      expect(state.sideSchemes.some((s) => s.instanceId === 'psyche_inst_1')).toBe(false);

      // It must be placed in state.encounterDiscard
      expect(state.encounterDiscard.some((c) => c.instanceId === 'psyche_inst_1')).toBe(true);

      // SCHEME_DEFEATED trigger must have fired (drew 1 card via listener)
      expect(player.hand.length).toBe(initialHandCount + 1);

      // Comic log must contain scheme.defeated
      const defeatLog = state.log.find((l) => l.key === 'scheme.defeated');
      expect(defeatLog).toBeDefined();
      expect(defeatLog?.params?.scheme).toBe('The Psyche-Magnitron');
    });
  });

  describe('b) Wakanda Forever threat reduction to 0 defeats and discards side scheme', () => {
    it('defeats and discards side scheme via Tactical Genius in Wakanda Forever', () => {
      const blackPantherHero = JSON.parse(JSON.stringify(cardCatalog.getCard('01040a')!));
      const blackPantherAlterEgo = JSON.parse(JSON.stringify(cardCatalog.getCard('01040b')!));

      const bpState = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Black Panther',
            hero: blackPantherHero,
            alterEgo: blackPantherAlterEgo,
            deckCards: [cardCatalog.getCard('01043a')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });
      const bpPlayer = bpState.players[0];
      bpPlayer.currentForm = 'hero';
      bpPlayer.activeFormCard = blackPantherHero;

      // Add Tactical Genius (01048) to tableau
      const tacticalGenius = createCardInstance(cardCatalog.getCard('01048')!);
      bpPlayer.tableau = [tacticalGenius];

      // Side scheme starts with 1 threat (Tactical Genius removes 1 threat if not final, 2 if final)
      const sideSchemeCard = cardCatalog.getCard('01109')!; // Bomb Scare
      bpState.sideSchemes = [
        {
          instanceId: 'ss_tactical_target',
          card: JSON.parse(JSON.stringify(sideSchemeCard)),
          threat: 1,
        },
      ];

      const wfHandler = getSpecialHandler('WAKANDA_FOREVER');
      expect(wfHandler).toBeDefined();

      const wfResult = wfHandler!.execute(
        bpState,
        {
          playerId: bpPlayer.id,
          sourceCardInstance: createCardInstance(cardCatalog.getCard('01043a')!),
        },
        { targetSchemeId: 'ss_tactical_target' },
      );

      expect(wfResult.success).toBe(true);

      // Side scheme must be defeated and removed
      expect(bpState.sideSchemes).toHaveLength(0);
      expect(bpState.encounterDiscard.some((c) => c.instanceId === 'ss_tactical_target')).toBe(
        true,
      );
    });
  });

  describe('c) Main scheme reaching 0 threat dispatches SCHEME_THREAT_REDUCED_TO_ZERO and satisfies SCHEME_EMPTY, but remains in play', () => {
    it('dispatches SCHEME_THREAT_REDUCED_TO_ZERO, sets conditionMet, and keeps main scheme in play', () => {
      const player = state.players[0];
      state.mainScheme.threat = 2;

      player.activeFormCard.enrichment = {
        abilities: [
          {
            id: 'detect_zero_threat',
            timing: 'FORCED_RESPONSE',
            trigger: 'SCHEME_THREAT_REDUCED_TO_ZERO' as any,
            steps: [
              {
                effect: 'DRAW',
                effectParams: { count: 1, target: 'SELF' },
              },
            ],
          },
        ],
      };

      const initialHandCount = player.hand.length;

      // Card effect removing 2 threat from MAIN_SCHEME with condition SCHEME_EMPTY
      const removeThreatAbility = {
        id: 'clear_the_area_test',
        timing: 'HERO_ACTION' as const,
        steps: [
          {
            effect: 'REMOVE_THREAT' as const,
            condition: 'SCHEME_EMPTY' as const,
            effectParams: {
              amount: 2,
              target: 'MAIN_SCHEME',
            },
          },
        ],
      };

      const result = executeEffect(state, removeThreatAbility as any, { playerId: player.id });

      expect(result.success).toBe(true);
      expect(result.conditionMet).toBe(true);
      expect(state.mainScheme.threat).toBe(0);

      // Main scheme must remain in play (NOT defeated)
      expect(state.mainScheme).toBeDefined();
      expect(state.encounterDiscard.some((c) => c.card.type === CardType.MAIN_SCHEME)).toBe(false);

      // SCHEME_THREAT_REDUCED_TO_ZERO must have dispatched (+1 card drawn)
      expect(player.hand.length).toBe(initialHandCount + 1);

      // Log must not have scheme.defeated
      expect(state.log.some((l) => l.key === 'scheme.defeated')).toBe(false);
    });
  });

  describe('d) When Defeated abilities and Victory keyword on side schemes resolve properly', () => {
    it('executes When Defeated reward abilities declared on the side scheme', () => {
      const player = state.players[0];
      const whenDefeatedScheme: SideSchemeCard = {
        ...(cardCatalog.getCard('01109')! as SideSchemeCard),
        code: 'test_when_defeated_scheme',
        name: 'Reward Side Scheme',
        enrichment: {
          abilities: [
            {
              id: 'reward_draw_two',
              timing: 'FORCED_RESPONSE',
              trigger: 'DEFEATED',
              steps: [
                {
                  effect: 'DRAW',
                  effectParams: { count: 2, target: 'SELF' },
                },
              ],
            },
          ],
        },
      };

      state.sideSchemes = [
        {
          instanceId: 'ss_reward_inst',
          card: whenDefeatedScheme as any,
          threat: 1,
        },
      ];

      const initialHand = player.hand.length;

      defeatSideScheme(state, 'ss_reward_inst', player.id);

      expect(state.sideSchemes).toHaveLength(0);
      expect(state.encounterDiscard.some((c) => c.instanceId === 'ss_reward_inst')).toBe(true);
      // When Defeated drew 2 cards
      expect(player.hand.length).toBe(initialHand + 2);
    });

    it('routes side scheme with Victory keyword to state.victoryDisplay instead of discard', () => {
      const player = state.players[0];
      const victoryScheme: SideSchemeCard = {
        ...(cardCatalog.getCard('01109')! as SideSchemeCard),
        code: 'test_victory_scheme',
        name: 'Victory Side Scheme',
        keywords: [Keyword.VICTORY],
      };

      state.sideSchemes = [
        {
          instanceId: 'ss_victory_inst',
          card: victoryScheme as any,
          threat: 2,
        },
      ];

      const removeThreatAbility = {
        id: 'remove_threat_victory',
        timing: 'HERO_ACTION' as const,
        steps: [
          {
            effect: 'REMOVE_THREAT' as const,
            effectParams: {
              amount: 2,
              target: 'SIDE_SCHEME',
              targetInstanceId: 'ss_victory_inst',
            },
          },
        ],
      };

      const result = executeEffect(state, removeThreatAbility as any, { playerId: player.id });
      expect(result.success).toBe(true);

      // Scheme removed from play
      expect(state.sideSchemes).toHaveLength(0);
      // Present in victoryDisplay
      expect(state.victoryDisplay.some((c) => c.instanceId === 'ss_victory_inst')).toBe(true);
      // Not in encounterDiscard
      expect(state.encounterDiscard.some((c) => c.instanceId === 'ss_victory_inst')).toBe(false);
    });
  });
});
