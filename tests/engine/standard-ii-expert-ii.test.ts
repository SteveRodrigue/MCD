import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyContent } from '@data/content/apply';
import { NodeFsDriver } from '@data/content/drivers/node-fs';
import { loadContent } from '@data/content/loader';
import { cardCatalog } from '@data/importer/card-loader';
import { AlterEgoCard, GameState, HeroCard, StatusCard, getActiveVillain } from '@engine/models';
import { canPlayCard } from '@engine/pipeline/legality-checker';
import {
  getEffectiveVillainStats,
  isEntityIncapacitatedByStatus,
} from '@engine/pipeline/stat-calculator';
import {
  getVillainPhaseThreatToAdd,
  step4_revealEncounterCards,
} from '@engine/pipeline/villain-phase';
import { kernel } from '@engine/kernel';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { listEncounterSets } from '@engine/scenarios';
import { createCardInstance } from '@engine/state/card-instance';
import { setupGame } from '@engine/state/game-setup';

const player = (id: string, hero: string, alterEgo: string) => ({
  id,
  name: id,
  hero: cardCatalog.getCard(hero) as HeroCard,
  alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
  deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
});

const game = (options: Partial<Parameters<typeof setupGame>[0]> = {}): GameState => {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    skipMulligan: true,
    players: [player('p1', '01001a', '01001b')],
    standardSetCode: 'standard_ii',
    ...options,
  });
  for (const p of state.players) {
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.exhausted = false;
    p.hand = [];
    p.dealtEncounterCards = [];
  }
  return state;
};

const reveal = (state: GameState, playerIndex: number, code: string): GameState => {
  state.players[playerIndex].dealtEncounterCards.push(
    createCardInstance(cardCatalog.getCard(code)!),
  );
  return step4_revealEncounterCards(state);
};

describe('Standard II and Expert II', () => {
  beforeAll(async () => {
    const root = path.resolve(import.meta.dirname, '../../content');
    applyContent(await loadContent(new NodeFsDriver(root), { packs: ['core', 'hood'] }));
  });

  it('lists both sets with deck counts that treat a double-sided card as one card', () => {
    const count = (kind: 'standard' | 'expert', code: string) =>
      listEncounterSets(cardCatalog, kind).find((set) => set.code === code)?.cardCount;
    expect(count('standard', 'standard_ii')).toBe(8);
    expect(count('expert', 'expert_ii')).toBe(4);
  });

  describe('Formidable Foe', () => {
    it('formidable foe starts in play on the side of the mode and is never in the deck', () => {
      expect(cardCatalog.getCard('24049a')?.enrichment?.modeOnly).toBe('STANDARD');
      expect(cardCatalog.getCard('24049b')?.enrichment?.modeOnly).toBe('EXPERT');
      const standard = game({ difficulty: 'STANDARD' });
      expect(standard.environments.map((e) => e.card.code)).toEqual(['24049a']);
      expect(standard.encounterDeck.some((c) => c.card.name === 'Formidable Foe')).toBe(false);

      const expert = game({ difficulty: 'EXPERT' });
      expect(expert.environments.map((e) => e.card.code)).toEqual(['24049b']);
      expect(expert.encounterDeck.some((c) => c.card.name === 'Formidable Foe')).toBe(false);
    });

    it('one stun does not stop a steady villain, two do', () => {
      const state = game({ difficulty: 'STANDARD' });
      const villain = getActiveVillain(state);
      villain.statusCards = [StatusCard.STUNNED];
      expect(isEntityIncapacitatedByStatus(villain, StatusCard.STUNNED, state)).toBe(false);
      villain.statusCards = [StatusCard.STUNNED, StatusCard.STUNNED];
      expect(isEntityIncapacitatedByStatus(villain, StatusCard.STUNNED, state)).toBe(true);
    });

    it('standard side leaves minions unsteady, expert side makes minions steady too', () => {
      const minionWithStun = () => ({
        ...createCardInstance(cardCatalog.getCard('01103')!),
        statusCards: [StatusCard.STUNNED],
      });
      const standard = game({ difficulty: 'STANDARD' });
      expect(isEntityIncapacitatedByStatus(minionWithStun(), StatusCard.STUNNED, standard)).toBe(
        true,
      );
      const expert = game({ difficulty: 'EXPERT' });
      expect(isEntityIncapacitatedByStatus(minionWithStun(), StatusCard.STUNNED, expert)).toBe(
        false,
      );
    });

    it('formidable foe adds 1 threat each villain phase on its expert side and none on its standard side', () => {
      const baseline = (difficulty: 'STANDARD' | 'EXPERT') =>
        getVillainPhaseThreatToAdd(game({ difficulty, standardSetCode: 'standard' }));
      expect(getVillainPhaseThreatToAdd(game({ difficulty: 'STANDARD' }))).toBe(
        baseline('STANDARD'),
      );
      expect(getVillainPhaseThreatToAdd(game({ difficulty: 'EXPERT' }))).toBe(
        baseline('EXPERT') + 1,
      );
    });
  });

  describe('Peril', () => {
    const twoPlayers = () =>
      game({
        difficulty: 'EXPERT',
        expertSetCode: 'expert_ii',
        players: [player('p1', '01001a', '01001b'), player('p2', '01029a', '01029b')],
      });

    it('seat 2 cannot play or trigger during a peril card, seat 1 can', () => {
      const state = twoPlayers();
      const event = createCardInstance(cardCatalog.getCard('01005')!);
      state.activeEncounterContext = {
        encounterInstanceId: 'x',
        encounterCard: createCardInstance(cardCatalog.getCard('24030')!),
        targetPlayerId: 'p1',
      };
      const ability = { id: 'a', timing: 'RESPONSE', steps: [] } as never;

      expect(canPlayCard(state, 'p2', event).reason).toMatch(/peril/);
      expect(kernel.checkAbilityTargets(state, state.players[1], ability)).toMatchObject({
        allowed: false,
        reason: expect.stringMatching(/peril/),
      });
      expect(kernel.checkAbilityTargets(state, state.players[0], ability).allowed).toBe(true);

      const forced = { id: 'f', timing: 'FORCED_RESPONSE', steps: [] } as never;
      expect(kernel.checkAbilityTargets(state, state.players[1], forced).allowed).toBe(true);

      state.activeEncounterContext.encounterCard = createCardInstance(
        cardCatalog.getCard('24032')!,
      );
      expect(kernel.checkAbilityTargets(state, state.players[1], ability)).toMatchObject({
        allowed: false,
        reason: expect.stringMatching(/peril/),
      });
      state.activeEncounterContext = undefined;
      expect(kernel.checkAbilityTargets(state, state.players[1], ability).allowed).toBe(true);
    });
  });

  describe('Overwhelming Force', () => {
    const inTableau = (code: string, cost: number, permanent = false) => {
      const card = {
        ...cardCatalog.getCard(code)!,
        cost,
        keywords: permanent ? ['Permanent'] : [],
      };
      return createCardInstance(card as never);
    };

    it('overwhelming force skips a permanent card', () => {
      const state = game();
      const permanent = inTableau('01006', 3, true);
      const upgrade = inTableau('01007', 1);
      state.players[0].tableau = [permanent, upgrade];
      const after = reveal(state, 0, '24052');
      expect(after.players[0].tableau.map((c) => c.instanceId)).toEqual([permanent.instanceId]);
    });

    it('overwhelming force discards the highest cost, and asks on a tie', () => {
      const state = game();
      const [low, high] = [inTableau('01006', 1), inTableau('01007', 4)];
      state.players[0].tableau = [low, high];
      const after = reveal(state, 0, '24052');
      expect(after.players[0].tableau.map((c) => c.instanceId)).toEqual([low.instanceId]);

      const tied = game();
      tied.players[0].tableau = [inTableau('01006', 2), inTableau('01007', 2)];
      const asked = reveal(tied, 0, '24052');
      expect(peekDecisionPrompt(asked)?.options).toHaveLength(2);
    });

    it('overwhelming force surges with nothing to discard', () => {
      const state = game();
      state.players[0].tableau = [];
      const deckBefore = state.encounterDeck.length;
      const after = reveal(state, 0, '24052');
      expect(after.encounterDeck.length).toBeLessThan(deckBefore);
    });
  });

  it('dark dealings schemes with +1 SCH', () => {
    const state = game();
    const before = state.mainSchemes[0].threat;
    const villainScheme = getEffectiveVillainStats(state, getActiveVillain(state)).scheme;
    state.encounterDeck = [createCardInstance(cardCatalog.getCard('01186')!)];
    const after = reveal(state, 0, '24050');
    const boostIcons = (cardCatalog.getCard('01186') as { boostIcons?: number }).boostIcons ?? 0;
    expect(after.mainSchemes[0].threat).toBe(before + villainScheme + 1 + boostIcons);
  });

  describe('Mob Mentality', () => {
    it('alter-ego discards the top 7 and engages the first minion only', () => {
      const state = game();
      const p = state.players[0];
      p.currentForm = 'alter_ego';
      p.activeFormCard = p.alterEgo;
      const treachery = () => createCardInstance(cardCatalog.getCard('01186')!);
      const [first, second] = ['01103', '01103'].map((code) =>
        createCardInstance(cardCatalog.getCard(code)!),
      );
      state.encounterDeck = [
        treachery(),
        first,
        treachery(),
        second,
        treachery(),
        treachery(),
        treachery(),
        treachery(),
      ];
      const after = reveal(state, 0, '24051');
      expect(after.players[0].engagedMinions.map((m) => m.instanceId)).toEqual([first.instanceId]);
      expect(after.encounterDiscard.some((c) => c.instanceId === second.instanceId)).toBe(true);
      expect(after.encounterDiscard.some((c) => c.instanceId === first.instanceId)).toBe(false);
      expect(after.encounterDeck).toHaveLength(1);
    });
  });

  it('total annihilation gives its attack overkill, in hero form only', () => {
    const state = game();
    const started = reveal(state, 0, '24054');
    expect(started.activeAttackContext?.hasOverkill).toBe(true);

    const alterEgo = game();
    alterEgo.players[0].currentForm = 'alter_ego';
    alterEgo.players[0].activeFormCard = alterEgo.players[0].alterEgo;
    expect(reveal(alterEgo, 0, '24054').activeAttackContext).toBeUndefined();
  });

  it('cruel intentions deals each player a card and gives the villain a facedown boost', () => {
    const state = game({
      difficulty: 'EXPERT',
      expertSetCode: 'expert_ii',
      players: [player('p1', '01001a', '01001b'), player('p2', '01029a', '01029b')],
    });
    const cards = ['01186', '01186', '01186', '01186', '01186', '01186'];
    state.encounterDeck = cards.map((code) => createCardInstance(cardCatalog.getCard(code)!));
    state.players[0].dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('24029')!));
    kernel.executeEffect(state, cardCatalog.getCard('24029')!.enrichment!.abilities![0], {
      playerId: 'p1',
    });
    expect(state.players[1].dealtEncounterCards).toHaveLength(1);
    expect(getActiveVillain(state).facedownBoostCards).toHaveLength(1);
  });

  it('ruination reveals the next side scheme and places 2 threat on each scheme', () => {
    const state = game({ difficulty: 'EXPERT', expertSetCode: 'expert_ii' });
    const sideScheme = createCardInstance(cardCatalog.getCard('01107')!);
    const treachery = createCardInstance(cardCatalog.getCard('01186')!);
    state.encounterDeck = [treachery, sideScheme];
    const threatBefore = state.mainSchemes[0].threat;
    const after = reveal(state, 0, '24030');
    expect(after.sideSchemes.some((s) => s.instanceId === sideScheme.instanceId)).toBe(true);
    // Incite 1 + 2 on each scheme
    expect(after.mainSchemes[0].threat).toBe(threatBefore + 3);
    const placed = after.sideSchemes.find((s) => s.instanceId === sideScheme.instanceId)!;
    const base = (cardCatalog.getCard('01107') as { baseThreat?: number }).baseThreat ?? 0;
    expect(placed.threat).toBeGreaterThanOrEqual(base + 2);
  });

  it('seek and destroy brings the nemesis minion in from the set-aside area', () => {
    const state = game({ difficulty: 'EXPERT', expertSetCode: 'expert_ii' });
    const p = state.players[0];
    const nemesis = p.setAsideCards.find((c) => c.card.type === 'minion')!;
    const threat = state.mainSchemes[0].threat;
    const after = reveal(state, 0, '24031');
    expect(after.players[0].engagedMinions.map((m) => m.instanceId)).toContain(nemesis.instanceId);
    expect(after.players[0].setAsideCards.some((c) => c.instanceId === nemesis.instanceId)).toBe(
      false,
    );
    expect(after.mainSchemes[0].threat).toBe(threat + 1);
  });

  it('slug it out exhausts the identity and deals 2 damage', () => {
    const state = game({ difficulty: 'EXPERT', expertSetCode: 'expert_ii' });
    const health = state.players[0].health;
    state.encounterDeck = ['01186', '01186'].map((code) =>
      createCardInstance(cardCatalog.getCard(code)!),
    );
    const after = reveal(state, 0, '24032');
    expect(after.players[0].exhausted).toBe(true);
    expect(after.players[0].health).toBe(health - 2);
  });

  it('shadow of the past II matches the Core card', () => {
    const steps = (code: string) =>
      cardCatalog.getCard(code)!.enrichment!.abilities![0].steps?.map((s) => s.effect);
    expect(steps('24053')).toEqual(steps('01190'));
  });

  it('standard II and expert II declare no scripted ability', () => {
    for (const code of [
      '24029',
      '24030',
      '24031',
      '24032',
      '24050',
      '24051',
      '24052',
      '24053',
      '24054',
      '24049a',
      '24049b',
    ]) {
      const effects = (cardCatalog.getCard(code)!.enrichment!.abilities ?? []).flatMap((a) =>
        (a.steps ?? []).map((s) => s.effect),
      );
      expect(effects).not.toContain('EXECUTE_SPECIAL');
    }
  });
});
