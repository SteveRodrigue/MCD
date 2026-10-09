import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  CardType,
  CardInstance,
  CardAbility,
  HeroCard,
  AlterEgoCard,
  Keyword,
  MinionCard,
  StatusCard,
  VillainCard,
  VillainState,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { defeatMinionsBeyondHitPoints } from '@engine/pipeline/damage-pipeline';
import {
  executeEnemyAttackSynchronously,
  executeVillainSchemeAgainstPlayer,
  executeMinionSchemeAgainstPlayer,
  executeMinionAttackAgainstPlayer,
} from '@engine/pipeline';

// Issue #263: one boost resolution helper for the villain attack, the villain scheme, the minion
// attack and the minion scheme. Same dealing, same resolving loop, same log shape.

type PathKind = 'villainAttack' | 'villainScheme' | 'minionAttack' | 'minionScheme';

interface Path {
  kind: PathKind;
  /** ATK or SCH of the activating enemy before any boost icon. */
  base: number;
  entity: CardInstance | VillainState;
  /** Runs the activation and returns its outcome: damage dealt to the hero or threat placed. */
  run: () => number;
}

describe('Boost resolution: one shared helper for every activation (#263)', () => {
  let state: GameState;

  const WEAPONS_RUNNER = '01121';
  const TITANIAS_FURY = '01164';
  const FOLLOW_UP = '01103'; // 2 boost icons, no star ability

  const setup = () => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'p1',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as VillainCard, // Rhino I: ATK 2, SCH 1
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.encounterDiscard = [];
    state.mainScheme.threat = 1;
  };

  /** A boost card with no ability and no star: only its icons count. */
  const filler = (name: string, boostIcons = 0): CardInstance =>
    createCardInstance({ code: `filler-${name}`, name, type: 'treachery', boostIcons } as never);

  /** Puts the cards on top of the encounter deck, in order. */
  const stack = (...cards: CardInstance[]) => {
    state.encounterDeck = [...cards, ...state.encounterDeck];
  };

  const minionInstance = (over: Record<string, unknown> = {}): CardInstance =>
    createCardInstance({
      code: 't-minion',
      name: 'Test Minion',
      type: CardType.MINION,
      scheme: 1,
      attack: 3,
      health: 4,
      keywords: [Keyword.VILLAINOUS],
      ...over,
    } as unknown as MinionCard);

  const setForm = (form: 'hero' | 'alter_ego') => {
    const p = state.players[0];
    p.currentForm = form;
    p.activeFormCard = form === 'hero' ? p.hero : p.alterEgo;
  };

  /**
   * Builds one activation path against player p1. `minionOver` overrides the minion card for the
   * minion paths (for example no Villainous keyword, or additionalBoostCards).
   */
  const makePath = (kind: PathKind, minionOver: Record<string, unknown> = {}): Path => {
    const p = state.players[0];
    if (kind === 'villainAttack') {
      setForm('hero');
      return {
        kind,
        base: 2,
        entity: state.villain,
        run: () => {
          const hp = p.health;
          executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');
          return hp - p.health;
        },
      };
    }
    if (kind === 'villainScheme') {
      setForm('alter_ego');
      return {
        kind,
        base: 1,
        entity: state.villain,
        run: () => {
          const threat = state.mainScheme.threat;
          executeVillainSchemeAgainstPlayer(state, p);
          return state.mainScheme.threat - threat;
        },
      };
    }
    const minion = minionInstance(minionOver);
    p.engagedMinions = [minion];
    if (kind === 'minionAttack') {
      setForm('hero');
      return {
        kind,
        base: 3,
        entity: minion,
        run: () => {
          const hp = p.health;
          executeMinionAttackAgainstPlayer(state, minion, p, {
            synchronousPolicy: 'TAKE_UNDEFENDED',
          });
          return hp - p.health;
        },
      };
    }
    setForm('alter_ego');
    return {
      kind,
      base: 1,
      entity: minion,
      run: () => {
        const threat = state.mainScheme.threat;
        executeMinionSchemeAgainstPlayer(state, minion, p);
        return state.mainScheme.threat - threat;
      },
    };
  };

  /** Gives the enemy of the path `n` additional boost cards, as the importer does for Klaw. */
  const setAdditional = (path: Path, n: number) => {
    if (path.kind.startsWith('minion')) {
      (path.entity as CardInstance).card = {
        ...path.entity.card,
        additionalBoostCards: n,
      } as never;
    } else {
      state.villain.card = { ...state.villain.card, additionalBoostCards: n };
    }
  };

  const revealedNames = () =>
    state.log.filter((l) => l.key === 'villain.boost.revealed').map((l) => l.params?.card);
  const logCount = (key: string) => state.log.filter((l) => l.key === key).length;
  const held = (path: Path) => path.entity.facedownBoostCards ?? [];

  /** Forced identity ability counting every WHEN_BOOST_CARD_REVEALED dispatch in the log. */
  const installRevealObserver = () => {
    const p = state.players[0];
    const observer: CardAbility = {
      id: 'obs-reveal',
      timing: 'FORCED_INTERRUPT',
      trigger: 'WHEN_BOOST_CARD_REVEALED',
      steps: [
        { effect: 'ADD_STATUS', effectParams: { status: StatusCard.CONFUSED, target: 'PLAYER' } },
      ],
    } as never;
    p.hero = { ...p.hero, enrichment: { ...p.hero.enrichment, abilities: [observer] } };
    p.alterEgo = { ...p.alterEgo, enrichment: { ...p.alterEgo.enrichment, abilities: [observer] } };
    p.activeFormCard = p.currentForm === 'hero' ? p.hero : p.alterEgo;
  };

  const starCard = (): CardInstance =>
    createCardInstance({
      code: 't-star',
      name: 'Star Boost',
      type: 'treachery',
      boostIcons: 2,
      boostStar: true,
      enrichment: {
        abilities: [
          {
            id: 't-star-stun',
            timing: 'BOOST',
            steps: [
              {
                effect: 'ADD_STATUS',
                effectParams: { status: StatusCard.STUNNED, target: 'PLAYER' },
              },
            ],
          },
        ],
      },
    } as never);

  const REAL = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

  beforeEach(() => setup());

  describe('1. the shared loop: reveal trigger, star ability, icons, discard', () => {
    const coreKinds: PathKind[] = ['villainAttack', 'villainScheme', 'minionScheme'];

    for (const kind of coreKinds) {
      it(`${kind}: each boost card dispatches the reveal trigger once, runs its star ability against the target player, adds its icons and is discarded`, () => {
        const path = makePath(kind);
        setAdditional(path, 1);
        installRevealObserver();
        const star = starCard();
        const plain = filler('Plain', 1);
        stack(star, plain);

        const outcome = path.run();

        expect(logCount('ability.obs-reveal.triggered')).toBe(2);
        expect(state.players[0].statusCards).toContain(StatusCard.STUNNED);
        expect(logCount('villain.boost.starResolved')).toBe(1);
        expect(outcome).toBe(path.base + 2 + 1);
        expect(revealedNames()).toEqual(['Star Boost', 'Plain']);
        expect(state.encounterDiscard.map((c) => c.instanceId)).toEqual([
          star.instanceId,
          plain.instanceId,
        ]);
        expect(state.activeBoostCard).toBeUndefined();
        expect(state.activeBoostResolution).toBeUndefined();
      });

      it(`${kind}: a boost card its own Boost put into play engaged with the target player is not discarded`, () => {
        const path = makePath(kind);
        const wr = REAL(WEAPONS_RUNNER);
        stack(wr);

        const outcome = path.run();

        expect(state.players[0].engagedMinions.some((m) => m.instanceId === wr.instanceId)).toBe(
          true,
        );
        expect(state.encounterDiscard.some((c) => c.instanceId === wr.instanceId)).toBe(false);
        expect(outcome).toBe(path.base);
      });
    }
  });

  describe('2. additional boost cards', () => {
    for (const kind of ['villainAttack', 'villainScheme'] as PathKind[]) {
      it(`${kind}: villain additionalBoostCards 1 plus an attachment with 1 deal 2 extra cards`, () => {
        const path = makePath(kind);
        setAdditional(path, 1);
        state.villain.attachments = [
          createCardInstance({
            code: 't-att',
            name: 'Boost Attachment',
            type: 'attachment',
            additionalBoostCards: 1,
          } as never),
        ];
        stack(filler('A', 1), filler('B', 1), filler('C', 1));

        const outcome = path.run();

        expect(outcome).toBe(path.base + 3);
        expect(logCount('villain.boost.extra')).toBe(2);
        expect(state.encounterDiscard).toHaveLength(3);
      });
    }

    for (const kind of ['minionAttack', 'minionScheme'] as PathKind[]) {
      it(`${kind}: a Villainous minion with additionalBoostCards 1 deals 1 extra card and logs it`, () => {
        const path = makePath(kind, { additionalBoostCards: 1 });
        stack(filler('A', 1), filler('B', 2));

        const outcome = path.run();

        expect(outcome).toBe(path.base + 3);
        expect(logCount('villain.boost.extra')).toBe(1);
        expect(state.encounterDiscard).toHaveLength(2);
      });
    }
  });

  describe('3. an empty encounter deck while dealing a boost card', () => {
    const kinds: PathKind[] = ['villainAttack', 'villainScheme', 'minionAttack', 'minionScheme'];

    for (const kind of kinds) {
      it(`${kind}: the deck is exhausted the normal way (acceleration token and reshuffle)`, () => {
        const path = makePath(kind);
        state.encounterDeck = [];
        state.encounterDiscard = [filler('Reshuffled', 1)];
        const tokens = state.accelerationTokens;

        const outcome = path.run();

        expect(state.accelerationTokens).toBe(tokens + 1);
        expect(logCount('encounter.deck.empty')).toBe(1);
        expect(outcome).toBe(path.base + 1);
      });

      it(`${kind}: deck and discard both empty still place the acceleration token`, () => {
        const path = makePath(kind);
        state.encounterDeck = [];
        state.encounterDiscard = [];
        const tokens = state.accelerationTokens;

        const outcome = path.run();

        expect(state.accelerationTokens).toBe(tokens + 1);
        expect(outcome).toBe(path.base);
      });
    }
  });

  describe('3a. an enemy that is not Villainous resolves only the boost cards it holds', () => {
    for (const kind of ['minionAttack', 'minionScheme'] as PathKind[]) {
      it(`${kind}: a held facedown boost card resolves and no base card is dealt`, () => {
        const path = makePath(kind, { keywords: [] });
        const heldCard = filler('Held', 2);
        (path.entity as CardInstance).facedownBoostCards = [heldCard];
        const trap = filler('Trap', 5);
        stack(trap);

        const outcome = path.run();

        expect(outcome).toBe(path.base + 2);
        expect(revealedNames()).toEqual(['Held']);
        expect(state.encounterDeck[0].instanceId).toBe(trap.instanceId);
        expect(state.encounterDiscard.map((c) => c.instanceId)).toEqual([heldCard.instanceId]);
        expect(held(path)).toEqual([]);
      });
    }

    it('a non-Villainous minion with no held card deals and resolves nothing', () => {
      const path = makePath('minionScheme', { keywords: [] });
      const top = filler('Top', 3);
      stack(top);

      const outcome = path.run();

      expect(outcome).toBe(path.base);
      expect(state.encounterDeck[0].instanceId).toBe(top.instanceId);
      expect(revealedNames()).toEqual([]);
    });
  });

  describe('3b. facedown boost cards held by an enemy', () => {
    const kinds: PathKind[] = ['villainAttack', 'villainScheme', 'minionAttack', 'minionScheme'];

    for (const kind of kinds) {
      it(`${kind}: held cards resolve first, in order, then the base card; a card a Boost adds comes last and is not held`, () => {
        const path = makePath(kind);
        const h1 = filler('Held 1', 1);
        const h2 = filler('Held 2', 2);
        path.entity.facedownBoostCards = [h1, h2];
        stack(REAL(TITANIAS_FURY), filler('Chained', 1));

        const outcome = path.run();

        expect(revealedNames()).toEqual([
          'Held 1',
          'Held 2',
          cardCatalog.getCard(TITANIAS_FURY)!.name,
          'Chained',
        ]);
        // Held 1 + Held 2 + Titania's Fury (1) + Chained (1)
        expect(outcome).toBe(path.base + 1 + 2 + 1 + 1);
        expect(held(path)).toEqual([]);
        expect(state.encounterDeck.some((c) => c.instanceId === h1.instanceId)).toBe(false);
      });
    }

    it('defeating the enemy discards the cards it holds', () => {
      const path = makePath('minionAttack');
      const heldCard = filler('Held', 1);
      const minion = path.entity as CardInstance;
      minion.facedownBoostCards = [heldCard];
      minion.tokens = { damage: 99 };

      defeatMinionsBeyondHitPoints(state);

      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(state.encounterDiscard.some((c) => c.instanceId === heldCard.instanceId)).toBe(true);
      expect(minion.facedownBoostCards ?? []).toEqual([]);
    });
  });

  describe('4. IF_ACTIVATION_DEALT_DAMAGE boosts still defer in an attack', () => {
    it('Sweeping Swoop (01168) stuns the hero after the attack dealt damage', () => {
      const path = makePath('villainAttack');
      stack(REAL('01168'));

      const outcome = path.run();

      expect(outcome).toBeGreaterThan(0);
      expect(state.players[0].statusCards.filter((s) => s === StatusCard.STUNNED)).toHaveLength(1);
    });
  });

  describe("5. GIVE_ADDITIONAL_BOOST_CARD works in every activation (Titania's Fury 01164)", () => {
    const kinds: PathKind[] = ['villainAttack', 'villainScheme', 'minionAttack', 'minionScheme'];

    for (const kind of kinds) {
      it(`${kind}: the added card joins the running queue, is resolved last and is logged`, () => {
        const path = makePath(kind);
        setAdditional(path, 1);
        const fury = REAL(TITANIAS_FURY);
        const second = filler('Second', 1);
        const chained = REAL(FOLLOW_UP);
        stack(fury, second, chained);

        const outcome = path.run();

        expect(revealedNames()).toEqual([
          cardCatalog.getCard(TITANIAS_FURY)!.name,
          'Second',
          cardCatalog.getCard(FOLLOW_UP)!.name,
        ]);
        expect(logCount('villain.boost.added')).toBe(1);
        // Titania's Fury (1) + Second (1) + follow-up (2)
        expect(outcome).toBe(path.base + 1 + 1 + 2);
        expect(state.encounterDiscard.map((c) => c.instanceId)).toEqual([
          fury.instanceId,
          second.instanceId,
          chained.instanceId,
        ]);
        expect(state.activeBoostResolution).toBeUndefined();
      });
    }
  });

  describe("6. Titania's Fury end to end on a villain attack", () => {
    it('adds one boost card to the same attack', () => {
      const path = makePath('villainAttack');
      stack(REAL(TITANIAS_FURY), REAL(FOLLOW_UP));

      const outcome = path.run();

      // Rhino ATK 2 + Titania's Fury (1) + follow-up (2)
      expect(outcome).toBe(5);
    });
  });

  describe('7. no ability scan for GIVE_ADDITIONAL_BOOST_CARD', () => {
    for (const kind of ['villainAttack', 'villainScheme'] as PathKind[]) {
      it(`${kind}: a villain or attachment that lists the effect gets no extra card`, () => {
        const path = makePath(kind);
        const ability = {
          id: 't-heuristic',
          timing: 'FORCED_INTERRUPT',
          steps: [{ effect: 'GIVE_ADDITIONAL_BOOST_CARD' }],
        } as never;
        state.villain.card = {
          ...state.villain.card,
          enrichment: { abilities: [ability] },
        } as VillainCard;
        state.villain.attachments = [
          createCardInstance({
            code: 't-att2',
            name: 'Scan Attachment',
            type: 'attachment',
            enrichment: { abilities: [ability] },
          } as never),
        ];
        stack(filler('A', 1), filler('B', 1), filler('C', 1));
        const deckBefore = state.encounterDeck.length;

        const outcome = path.run();

        expect(deckBefore - state.encounterDeck.length).toBe(1);
        expect(outcome).toBe(path.base + 1);
        expect(logCount('villain.boost.extra')).toBe(0);
      });
    }
  });
});
