import path from 'node:path';
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { applyContent } from '../../src/data/content/apply';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';
import { loadContent } from '../../src/data/content/loader';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  type GameState,
  type VillainCard,
  type PlayerState,
  getActiveVillain,
  getActiveMainScheme,
} from '../../src/engine/models';
import {
  executeEnemyAttackSynchronously,
  initiateEnemyAttack,
} from '../../src/engine/pipeline/combat-pipeline';
import { executeVillainSchemeAgainstPlayer } from '../../src/engine/pipeline/villain-phase';
import { dispatchAction } from '../../src/engine/pipeline';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';

describe('Conditional additional boost card Forced Interrupts (#292)', () => {
  let state: GameState;
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;

  const setForm = (player: PlayerState, form: 'hero' | 'alter_ego') => {
    player.currentForm = form;
    player.activeFormCard = form === 'hero' ? player.hero : player.alterEgo;
  };

  const stackBoosts = (...boostIcons: number[]) => {
    const cards = boostIcons.map((icons, idx) =>
      createCardInstance({
        code: `test-boost-${idx}-${Date.now()}`,
        name: `Boost Card ${idx + 1}`,
        type: 'treachery',
        boostIcons: icons,
      } as any),
    );
    state.encounterDeck = [...cards, ...state.encounterDeck];
    return cards;
  };

  beforeAll(async () => {
    const root = path.resolve(import.meta.dirname, '../../content');
    applyContent(
      await loadContent(new NodeFsDriver(root), { packs: ['core', 'gmw', 'aos', 'trors'] }),
    );
  });

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;

    const captainMarvelHero = cardCatalog.getCard('01010a')!;
    const carolDanversAlterEgo = cardCatalog.getCard('01010b')!;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.encounterDiscard = [];
  });

  describe('Scenario A: Klaw attacks vs schemes', () => {
    it('Klaw I deals 2 boost cards (1 base + 1 additional) on attack', () => {
      const p1 = state.players[0];
      setForm(p1, 'hero');
      const klawI = cardCatalog.getCard('01113') as VillainCard;
      expect(klawI).toBeDefined();

      const villain = getActiveVillain(state);
      villain.card = klawI;
      villain.health = klawI.health || 12;

      stackBoosts(1, 2);
      const initialHp = p1.health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Klaw I base ATK 0 + boost 1 + boost 2 = 3 damage
      expect(p1.health).toBe(initialHp - 3);
      expect(state.encounterDiscard).toHaveLength(2);
      expect(state.log.filter((l) => l.key === 'villain.boost.added').length).toBe(1);
    });

    it('Klaw I deals only 1 base boost card when scheming (0 additional)', () => {
      const p1 = state.players[0];
      setForm(p1, 'alter_ego');
      const klawI = cardCatalog.getCard('01113') as VillainCard;

      const villain = getActiveVillain(state);
      villain.card = klawI;
      villain.health = klawI.health || 12;

      stackBoosts(2, 3);
      const initialThreat = getActiveMainScheme(state).threat;

      executeVillainSchemeAgainstPlayer(state, p1);

      // Klaw I base SCH 2 + boost 2 = 4 threat placed (second boost was not drawn)
      expect(getActiveMainScheme(state).threat).toBe(initialThreat + 4);
      expect(state.encounterDiscard).toHaveLength(1);
      expect(state.log.filter((l) => l.key === 'villain.boost.added').length).toBe(0);
    });
  });

  describe('Scenario B: Ronan and Power Stone', () => {
    it('deals 1 additional boost card when targeted player controls the Power Stone', () => {
      const p1 = state.players[0];
      setForm(p1, 'hero');

      const ronan = cardCatalog.getCard('16103') as VillainCard;
      expect(ronan).toBeDefined();
      const villain = getActiveVillain(state);
      villain.card = ronan;

      // Player 1 controls the Power Stone attachment (16149)
      const powerStone = createCardInstance(
        cardCatalog.getCard('16149') ??
          ({
            code: '16149',
            name: 'Power Stone',
            type: 'attachment',
          } as any),
      );
      p1.attachments = [powerStone];

      stackBoosts(1, 2);
      const initialHp = p1.health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Ronan base ATK 2 + boost 1 + boost 2 = 5 damage
      expect(p1.health).toBe(initialHp - 5);
      expect(state.encounterDiscard).toHaveLength(2);
      expect(state.log.filter((l) => l.key === 'villain.boost.added').length).toBe(1);
    });

    it('deals 0 additional boost cards when targeted player does not control the Power Stone', () => {
      const p1 = state.players[0];
      const p2 = state.players[1];
      setForm(p1, 'hero');
      setForm(p2, 'hero');

      const ronan = cardCatalog.getCard('16103') as VillainCard;
      const villain = getActiveVillain(state);
      villain.card = ronan;

      // Player 2 controls the Power Stone, but Ronan activates against Player 1
      const powerStone = createCardInstance(
        cardCatalog.getCard('16149') ??
          ({
            code: '16149',
            name: 'Power Stone',
            type: 'attachment',
          } as any),
      );
      p2.attachments = [powerStone];
      p1.attachments = [];

      stackBoosts(1, 2);
      const initialHp = p1.health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Ronan base ATK 2 + boost 1 = 3 damage (second card remains in deck)
      expect(p1.health).toBe(initialHp - 3);
      expect(state.encounterDiscard).toHaveLength(1);
      expect(state.log.filter((l) => l.key === 'villain.boost.added').length).toBe(0);
    });
  });

  describe('Scenario C: Baron Zemo player choice', () => {
    it('prompts player and adds 1 additional boost card when boost option is chosen', () => {
      const p1 = state.players[0];
      setForm(p1, 'hero');

      const zemo = cardCatalog.getCard('50165b') as VillainCard;
      expect(zemo).toBeDefined();
      const villain = getActiveVillain(state);
      villain.card = zemo;

      // Board member environment in play
      const boardMember = createCardInstance({
        code: 'bm_01',
        name: 'Board Member Alpha',
        type: 'environment',
        traits: ['Board Member'],
        counters: { secret: 0 },
      } as any);
      state.environments = [boardMember];

      stackBoosts(1, 2);

      // Initiate attack; should pause on Baron Zemo choice prompt
      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', { acceptOptionalTriggers: true });

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();
      expect(prompt?.title).toBe('Baron Zemo');

      // Choose additional boost option
      const boostOpt = prompt?.options.find((o) => o.id === 'additional_boost');
      expect(boostOpt).toBeDefined();

      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: boostOpt!.id,
      });

      expect(res.state.log.filter((l) => l.key === 'villain.boost.added').length).toBe(1);
    });

    it('prompts player and places secret counter when counter option is chosen', () => {
      const p1 = state.players[0];
      setForm(p1, 'hero');

      const zemo = cardCatalog.getCard('50165b') as VillainCard;
      const villain = getActiveVillain(state);
      villain.card = zemo;

      const boardMember = createCardInstance({
        code: 'bm_01',
        name: 'Board Member Alpha',
        type: 'environment',
        traits: ['Board Member'],
        counters: { secret: 0 },
      } as any);
      state.environments = [boardMember];

      stackBoosts(1, 2);

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', { acceptOptionalTriggers: true });

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();

      const counterOpt = prompt?.options.find((o) => o.id === 'place_counters');
      expect(counterOpt).toBeDefined();

      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: counterOpt!.id,
      });

      expect(res.state.environments[0].counters?.secret).toBe(1);
      expect(res.state.log.filter((l) => l.key === 'villain.boost.added').length).toBe(0);
    });
  });

  describe('Scenario D: Master Strategist (count per side scheme)', () => {
    it('deals 1 additional boost card per side scheme in play and discards Master Strategist', () => {
      const p1 = state.players[0];
      setForm(p1, 'hero');

      const masterStrategistCard = cardCatalog.getCard('04134');
      expect(masterStrategistCard).toBeDefined();
      expect(masterStrategistCard?.enrichment?.abilities?.[0].limit).toBe('ONCE_PER_ACTIVATION');
      const masterStrategist = createCardInstance(masterStrategistCard!);

      const villain = getActiveVillain(state);
      villain.attachments = [masterStrategist];
      masterStrategist.hostInstanceId = villain.instanceId;

      // 2 side schemes in play
      state.sideSchemes = [
        {
          ...createCardInstance({
            code: 'ss1',
            name: 'Scheme 1',
            type: 'side_scheme',
            baseThreat: 0,
          } as any),
          threat: 0,
        } as never,
        {
          ...createCardInstance({
            code: 'ss2',
            name: 'Scheme 2',
            type: 'side_scheme',
            baseThreat: 0,
          } as any),
          threat: 0,
        } as never,
      ];

      // 1 base + 2 additional = 3 boost cards
      stackBoosts(1, 1, 1);
      const initialHp = p1.health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Villain ATK 2 + boost 3 = 5 damage
      expect(p1.health).toBe(initialHp - 5);
      expect(state.encounterDiscard).toHaveLength(4); // 3 boost cards + Master Strategist discarded
      expect(villain.attachments).not.toContain(masterStrategist);
      expect(state.log.filter((l) => l.key === 'villain.boost.added').length).toBe(2); // Two boost added logs
    });
  });

  describe('Scenario E: Spider-Man Spider-Sense on INITIATES_ATTACK', () => {
    it('draws 1 card when villain initiates an attack against Spider-Man', () => {
      const p1 = state.players[0];
      setForm(p1, 'hero');
      p1.hand = [];
      p1.deck = [
        createCardInstance(cardCatalog.getCard('01005')!),
        createCardInstance(cardCatalog.getCard('01006')!),
      ];

      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', { acceptOptionalTriggers: true });

      // Spider-Sense triggers on villain attack initiation and draws 1 card
      expect(p1.hand).toHaveLength(1);
    });
  });
});
