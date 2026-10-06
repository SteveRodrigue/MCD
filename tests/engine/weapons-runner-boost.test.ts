import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  GamePhase,
  VillainPhaseStep,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  MinionCard,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import {
  advanceVillainPhaseStep,
  executeEnemyAttackSynchronously,
  executeVillainSchemeAgainstPlayer,
  peekDecisionPrompt,
  resolveDecisionPrompt,
  step2_villainAndMinionActivations,
} from '@engine/pipeline';

// Weapons Runner (01121): "Surge. [star] Boost: Put Weapons Runner into play engaged with you."
// Villain phase step 2 (RR v1.8): each minion engaged with the player activates, including one
// that was engaged during the villain's activation against that player.
describe('Weapons Runner (01121): boost puts it into play engaged with the attacked player', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const setup = (playerCount: 1 | 2 = 1, firstHero: [string, string] = ['01001a', '01001b']) => {
    resetInstanceCounter();
    const players = [player('p1', firstHero[0], firstHero[1])];
    if (playerCount === 2) players.push(player('p2', '01010a', '01010b'));
    state = setupGame({
      scenarioId: 'rhino',
      players,
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
  };

  const weaponsRunner = () => createCardInstance(cardCatalog.getCard('01121')!);

  /** A boost card with no ability and no star: only its icons count. */
  const filler = (name: string, boostIcons = 0): CardInstance =>
    createCardInstance({
      code: `filler-${name}`,
      name,
      type: 'treachery',
      boostIcons,
    } as any);

  const stack = (...cards: CardInstance[]) => {
    state.encounterDeck = [...cards, ...state.encounterDeck];
  };

  const toAlterEgo = () => {
    for (const p of state.players) {
      p.currentForm = 'alter_ego';
      p.activeFormCard = p.alterEgo;
    }
  };

  const startVillainActivations = () => {
    state.phase = GamePhase.VILLAIN_PHASE;
    state.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;
  };

  beforeEach(() => setup());

  describe('boost resolution', () => {
    it('villain attack: Weapons Runner ends engaged with the attacked player, ready and undamaged, and adds no ATK', () => {
      const wr = weaponsRunner();
      stack(wr);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      const engaged = state.players[0].engagedMinions.find((m) => m.instanceId === wr.instanceId);
      expect(engaged).toBeDefined();
      expect(engaged!.exhausted).toBeFalsy();
      expect(engaged!.tokens?.damage ?? 0).toBe(0);
      expect(state.encounterDiscard.some((c) => c.instanceId === wr.instanceId)).toBe(false);
      // Rhino ATK 2 plus 0 boost icons.
      expect(state.lastCombatOutcome?.finalDamage).toBe(2);
    });

    it('villain scheme: Weapons Runner ends engaged with the player schemed against, threat equals the base SCH', () => {
      toAlterEgo();
      const wr = weaponsRunner();
      stack(wr);
      const startThreat = state.mainScheme.threat;

      executeVillainSchemeAgainstPlayer(state, state.players[0]);

      expect(state.players[0].engagedMinions.map((m) => m.instanceId)).toEqual([wr.instanceId]);
      expect(state.encounterDiscard.some((c) => c.instanceId === wr.instanceId)).toBe(false);
      // Rhino SCH 1 plus 0 boost icons.
      expect(state.mainScheme.threat).toBe(startThreat + 1);
    });

    it('two players: the boost engages the attacked player, not player 1', () => {
      setup(2);
      const wr = weaponsRunner();
      stack(wr);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p2', 'TAKE_UNDEFENDED');

      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(state.players[1].engagedMinions.map((m) => m.instanceId)).toEqual([wr.instanceId]);
    });

    it('a non-star boost card is still discarded and its icons count', () => {
      const plain = filler('plain', 1);
      stack(plain);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(state.encounterDiscard.some((c) => c.instanceId === plain.instanceId)).toBe(true);
      expect(state.players[0].engagedMinions).toHaveLength(0);
      expect(state.lastCombatOutcome?.finalDamage).toBe(3);
    });

    it('does not surge when put into play by its boost, and MINION_ENTERS_PLAY fires once', () => {
      const watcher = createCardInstance({
        code: 'watcher',
        name: 'Watcher',
        type: 'support',
        faction: 'justice',
        enrichment: {
          abilities: [
            {
              id: 'watch_minion_enters',
              timing: 'FORCED_RESPONSE',
              trigger: 'MINION_ENTERS_PLAY',
              steps: [{ effect: 'ADD_THREAT', effectParams: { amount: 1 } }],
            },
          ],
        },
      } as any);
      state.players[0].tableau.push(watcher);
      const wr = weaponsRunner();
      stack(wr);
      const startThreat = state.mainScheme.threat;
      const dealtBefore = state.players[0].dealtEncounterCards.length;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(state.players[0].engagedMinions.map((m) => m.instanceId)).toEqual([wr.instanceId]);
      expect(state.players[0].dealtEncounterCards).toHaveLength(dealtBefore);
      expect(state.mainScheme.threat).toBe(startThreat + 1);
    });
  });

  describe.each(['stepped', 'synchronous'] as const)('activation order (%s flow)', (flow) => {
    /** Runs villain phase step 2 and returns "source>player" for each attack, in order. */
    const runAttacks = (): string[] => {
      startVillainActivations();
      if (flow === 'synchronous') {
        state = step2_villainAndMinionActivations(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
        return state.log
          .filter((l) => l.key === 'combat.attack.undefended')
          .map((l) => `${l.params!.who_attacks}>${l.params!.player}`);
      }
      const events: string[] = [];
      for (let i = 0; i < 20; i++) {
        state = advanceVillainPhaseStep(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
        const ev = state.villainPhaseStepEvent!;
        if (ev.type === 'DEAL_ENCOUNTER_CARD') break;
        events.push(`${ev.sourceName}>${ev.targetPlayerId}`);
      }
      return events;
    };

    it('hero form: Weapons Runner attacks the same player before encounter cards are dealt', () => {
      stack(weaponsRunner(), filler('f1'));

      expect(runAttacks()).toEqual(['Rhino>p1', 'Weapons Runner>p1']);
    });

    it('two players: Weapons Runner activates before the villain activates against player 2', () => {
      setup(2);
      stack(weaponsRunner(), filler('f1'), filler('f2'));

      expect(runAttacks()).toEqual(['Rhino>p1', 'Weapons Runner>p1', 'Rhino>p2']);
    });

    it('an already engaged minion activates first, then Weapons Runner, then the next player', () => {
      setup(2);
      const hydra = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
      state.players[0].engagedMinions.push(hydra);
      stack(weaponsRunner(), filler('f1'), filler('f2'));

      expect(runAttacks()).toEqual([
        'Rhino>p1',
        `${hydra.card.name}>p1`,
        'Weapons Runner>p1',
        'Rhino>p2',
      ]);
    });

    it('a minion engaged during 2b joins the end of that minion list and activates before the next player', () => {
      setup(2);
      const villainous = createCardInstance({
        ...(cardCatalog.getCard('01101') as MinionCard),
        code: 'test-villainous-thug',
        name: 'Villainous Thug',
        keywords: ['Villainous'],
      } as any);
      state.players[0].engagedMinions.push(villainous);
      // Villain boost: f1. Villainous Thug's boost: Weapons Runner. Player 2's villain boost: f2.
      stack(filler('f1'), weaponsRunner(), filler('f2'));

      expect(runAttacks()).toEqual([
        'Rhino>p1',
        'Villainous Thug>p1',
        'Weapons Runner>p1',
        'Rhino>p2',
      ]);
    });
  });

  describe('stepped flow details', () => {
    it('alter-ego form: after the villain schemes, the next step event is the minion scheme with its printed SCH', () => {
      toAlterEgo();
      stack(weaponsRunner(), filler('f1'));
      startVillainActivations();
      const printedScheme = (cardCatalog.getCard('01121') as MinionCard).scheme;
      expect(printedScheme).toBeGreaterThan(0);

      state = advanceVillainPhaseStep(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
      expect(state.villainPhaseStepEvent?.type).toBe('VILLAIN_SCHEME');

      state = advanceVillainPhaseStep(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
      expect(state.villainPhaseStepEvent?.type).toBe('MINION_SCHEME');
      expect(state.villainPhaseStepEvent?.sourceName).toBe('Weapons Runner');
      expect(state.villainPhaseStepEvent?.targetPlayerId).toBe('p1');
      expect(state.villainPhaseStepEvent?.amount).toBe(printedScheme);
    });

    it('hero form: the next step event after the villain attack is the Weapons Runner attack', () => {
      stack(weaponsRunner(), filler('f1'));
      startVillainActivations();

      state = advanceVillainPhaseStep(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
      expect(state.villainPhaseStepEvent?.type).toBe('VILLAIN_ATTACK');

      state = advanceVillainPhaseStep(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
      expect(state.villainPhaseStepEvent?.type).toBe('MINION_ATTACK');
      expect(state.villainPhaseStepEvent?.sourceName).toBe('Weapons Runner');
      expect(state.villainPhaseStepEvent?.targetPlayerId).toBe('p1');

      state = advanceVillainPhaseStep(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
      expect(state.villainPhaseStepEvent?.type).toBe('DEAL_ENCOUNTER_CARD');
    });

    it('each minion activates once, also when the step resumes after a defender prompt', () => {
      // Not Spider-Man: his Spider-Sense opens a separate optional-trigger prompt first.
      setup(1, ['01010a', '01010b']);
      const hydra = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
      state.players[0].engagedMinions.push(hydra);
      stack(weaponsRunner(), filler('f1'));
      startVillainActivations();

      const events: string[] = [];
      for (let i = 0; i < 20; i++) {
        state = advanceVillainPhaseStep(state);
        const ev = state.villainPhaseStepEvent!;
        if (ev.type === 'DEAL_ENCOUNTER_CARD') break;
        events.push(`${ev.sourceName}>${ev.targetPlayerId}`);
        let prompt = peekDecisionPrompt(state);
        while (prompt) {
          state = resolveDecisionPrompt(state, 'p1', prompt.options[0].id).state;
          prompt = peekDecisionPrompt(state);
        }
      }

      expect(events).toEqual(['Rhino>p1', `${hydra.card.name}>p1`, 'Weapons Runner>p1']);
    });
  });
});
