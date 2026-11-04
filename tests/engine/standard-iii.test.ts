import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyContent } from '@data/content/apply';
import { NodeFsDriver } from '@data/content/drivers/node-fs';
import { loadContent } from '@data/content/loader';
import { cardCatalog } from '@data/importer/card-loader';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  getActiveMainScheme,
} from '@engine/models';
import { kernel } from '@engine/kernel';
import { listEncounterSets } from '@engine/scenarios';
import { resolveDefenderDeclaration } from '@engine/pipeline/combat-pipeline';
import { canInitiateAbility } from '@engine/pipeline/legality-checker';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { startPlayerPhase } from '@engine/pipeline/player-phase';
import { createCardInstance } from '@engine/state/card-instance';
import { setupGame } from '@engine/state/game-setup';

const player = (id: string, hero: string, alterEgo: string) => ({
  id,
  name: id,
  hero: cardCatalog.getCard(hero) as HeroCard,
  alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
  deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
});

const game = (players = [player('p1', '01001a', '01001b')]): GameState => {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    skipMulligan: true,
    players,
    standardSetCode: 'standard_iii',
  });
  for (const p of state.players) {
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.exhausted = false;
    p.dealtEncounterCards = [];
  }
  return state;
};

const pursued = (state: GameState): CardInstance =>
  state.environments.find((e) => e.card.name === 'Pursued by the Past')!;
const counters = (state: GameState) => pursued(state).counters?.pursuit ?? 0;
const setCounters = (state: GameState, amount: number) => {
  pursued(state).counters = { pursuit: amount };
};
const fill = (state: GameState, count = 6) => {
  state.encounterDeck = Array.from({ length: count }, () =>
    createCardInstance(cardCatalog.getCard('01186')!),
  );
};
const reveal = (state: GameState, code: string, playerIndex = 0): GameState => {
  state.players[playerIndex].dealtEncounterCards.push(
    createCardInstance(cardCatalog.getCard(code)!),
  );
  return step4_revealEncounterCards(state);
};
const nemesisMinionOf = (state: GameState, index = 0) =>
  state.players[index].setAsideCards.find((c) => c.card.type === 'minion')!;

describe('Standard III', () => {
  beforeAll(async () => {
    const root = path.resolve(import.meta.dirname, '../../content');
    applyContent(await loadContent(new NodeFsDriver(root), { packs: ['core', 'aoa'] }));
  });

  it('lists the set, and Pursued by the Past starts in play on its front', () => {
    expect(listEncounterSets(cardCatalog, 'standard').map((s) => s.code)).toContain('standard_iii');
    const state = game();
    expect(pursued(state).card.code).toBe('45075a');
    expect(state.encounterDeck.some((c) => c.card.name === 'Pursued by the Past')).toBe(false);
  });

  describe('Pursued by the Past', () => {
    it('fourth counter solo flips and brings the nemesis set in, then flips back', () => {
      const state = game();
      fill(state);
      setCounters(state, 3);
      const minion = nemesisMinionOf(state);
      // Vulture has Quickstrike: its attack holds the rest until a defender is declared.
      const during = reveal(state, '45076');
      expect(during.activeAttackContext?.attackerCard?.instanceId).toBe(minion.instanceId);
      expect(pursued(during).card.code).toBe('45075b');
      const after = kernel.resumePendingSequence(
        resolveDefenderDeclaration(during, { type: 'UNDEFENDED', playerId: 'p1' }),
      );

      expect(counters(after)).toBe(0);
      expect(pursued(after).card.code).toBe('45075a');
      expect(after.players[0].engagedMinions.map((m) => m.instanceId)).toContain(minion.instanceId);
      expect(after.sideSchemes.some((s) => s.card.setCode?.endsWith('_nemesis'))).toBe(true);
      expect(after.players[0].setAsideCards).toHaveLength(0);
    });

    it('dark designs does not scheme after the counters reset', () => {
      const state = game();
      fill(state);
      setCounters(state, 3);
      const before = getActiveMainScheme(state).threat;
      const after = reveal(state, '45076');
      expect(getActiveMainScheme(after).threat).toBe(before);
    });

    it('dark designs schemes while counters remain', () => {
      const state = game();
      fill(state);
      const before = getActiveMainScheme(state).threat;
      const after = reveal(state, '45076');
      expect(counters(after)).toBe(1);
      expect(getActiveMainScheme(after).threat).toBeGreaterThan(before);
    });

    it('threshold counts players', () => {
      const state = game([player('p1', '01001a', '01001b'), player('p2', '01029a', '01029b')]);
      fill(state);
      setCounters(state, 3);
      const fourth = reveal(state, '45076');
      expect(counters(fourth)).toBe(4);

      setCounters(fourth, 4);
      const fifth = reveal(fourth, '45076');
      expect(counters(fifth)).toBe(0);
    });

    it('nemesis in play activates instead of flipping', () => {
      const state = game();
      fill(state);
      setCounters(state, 3);
      const p = state.players[0];
      const minion = nemesisMinionOf(state);
      p.setAsideCards = p.setAsideCards.filter((c) => c !== minion);
      p.engagedMinions = [minion as never];
      const setAside = p.setAsideCards.length;
      const after = reveal(state, '45076');

      expect(counters(after)).toBe(0);
      expect(pursued(after).card.code).toBe('45075a');
      expect(after.players[0].setAsideCards).toHaveLength(setAside);
      expect(after.activeAttackContext?.attackerCard?.instanceId).toBe(minion.instanceId);
    });

    it('defeated nemesis minion is found in the discard', () => {
      const state = game();
      fill(state);
      setCounters(state, 3);
      const p = state.players[0];
      const minion = nemesisMinionOf(state);
      p.setAsideCards = p.setAsideCards.filter((c) => c !== minion);
      state.encounterDiscard.push(minion);
      const after = reveal(state, '45076');
      expect(after.players[0].engagedMinions.map((m) => m.instanceId)).toContain(minion.instanceId);
    });
  });

  it('sinister strike: surge in alter-ego, attack in hero, each only with counters left', () => {
    const hero = game();
    fill(hero);
    expect(reveal(hero, '45077').activeAttackContext).toBeDefined();

    const noCounters = game();
    fill(noCounters);
    setCounters(noCounters, 3);
    const flipped = reveal(noCounters, '45077');
    expect(flipped.log.some((l) => l.key === 'combat.attack.initiated')).toBe(false);

    const alterEgo = game();
    fill(alterEgo);
    alterEgo.players[0].currentForm = 'alter_ego';
    alterEgo.players[0].activeFormCard = alterEgo.players[0].alterEgo;
    const size = alterEgo.encounterDeck.length;
    const after = reveal(alterEgo, '45077');
    expect(after.activeAttackContext).toBeUndefined();
    expect(after.encounterDeck.length).toBeLessThan(size);
  });

  describe('Evil Alliance', () => {
    it('places 3 counters when no minion activated', () => {
      const state = game();
      fill(state);
      expect(counters(reveal(state, '45078'))).toBe(3);
    });

    it('each nemesis minion in play activates against you, whoever it is engaged with', () => {
      const state = game([player('p1', '01001a', '01001b'), player('p2', '01029a', '01029b')]);
      fill(state);
      const first = nemesisMinionOf(state, 1);
      state.players[1].engagedMinions = [first as never];
      const after = reveal(state, '45078');
      expect(after.activeAttackContext?.attackerCard?.instanceId).toBe(first.instanceId);
      expect(after.activeAttackContext?.targetPlayerId).toBe('p1');
      expect(counters(after)).toBe(0);
    });
  });

  describe('Evil Alliance with two nemesis minions', () => {
    const withTwo = () => {
      const state = game([player('p1', '01001a', '01001b'), player('p2', '01029a', '01029b')]);
      fill(state);
      const mine = nemesisMinionOf(state, 0);
      const theirs = nemesisMinionOf(state, 1);
      state.players[0].engagedMinions = [mine as never];
      state.players[1].engagedMinions = [theirs as never];
      return { state, mine, theirs };
    };

    it('both attack a hero, one after the other, then the counters stay untouched', () => {
      const { state, mine, theirs } = withTwo();
      const first = reveal(state, '45078');
      expect(first.activeAttackContext?.attackerCard?.instanceId).toBe(mine.instanceId);
      const second = resolveDefenderDeclaration(first, { type: 'UNDEFENDED', playerId: 'p1' });
      expect(second.activeAttackContext?.attackerCard?.instanceId).toBe(theirs.instanceId);
      expect(second.activeAttackContext?.targetPlayerId).toBe('p1');
      const done = kernel.resumePendingSequence(
        resolveDefenderDeclaration(second, { type: 'UNDEFENDED', playerId: 'p1' }),
      );
      expect(done.activeAttackContext).toBeUndefined();
      expect(counters(done)).toBe(0);
    });

    it('both scheme against an alter-ego', () => {
      const { state, mine, theirs } = withTwo();
      const p = state.players[0];
      p.currentForm = 'alter_ego';
      p.activeFormCard = p.alterEgo;
      const before = getActiveMainScheme(state).threat;
      const after = reveal(state, '45078');
      const scheme = (m: CardInstance) => (m.card as { scheme?: number }).scheme ?? 0;
      expect(getActiveMainScheme(after).threat).toBe(before + scheme(mine) + scheme(theirs));
      expect(after.pendingActivations ?? []).toHaveLength(0);
    });
  });

  it('nowhere is safe discards an upgrade or support while counters remain', () => {
    const state = game();
    fill(state);
    state.players[0].tableau = [createCardInstance(cardCatalog.getCard('01006')!)];
    const after = reveal(state, '45079');
    expect(counters(after)).toBe(1);
    expect(after.players[0].tableau).toHaveLength(0);
  });

  describe('boost', () => {
    it('places a counter only after the scheme activation resolves', () => {
      const state = game();
      state.encounterDeck = [createCardInstance(cardCatalog.getCard('45079')!)];
      const threat = getActiveMainScheme(state).threat;
      const after = reveal(state, '01186');
      expect(getActiveMainScheme(after).threat).toBeGreaterThan(threat);
      expect(counters(after)).toBe(1);
    });

    it('waits for the attack to end', () => {
      const state = game();
      state.encounterDeck = [createCardInstance(cardCatalog.getCard('45079')!)];
      const during = reveal(state, '01187');
      expect(counters(during)).toBe(0);
      const after = resolveDefenderDeclaration(during, { type: 'UNDEFENDED', playerId: 'p1' });
      expect(counters(after)).toBe(1);
    });
  });

  describe('Drawing Near', () => {
    const withObligation = (state: GameState) => {
      const card = createCardInstance(cardCatalog.getCard('45080')!);
      state.players[0].obligations = [card];
      return card;
    };

    it('drawing near adds counters per printed resource icon', () => {
      const state = game();
      withObligation(state);
      const top = cardCatalog.getCard('01005')!;
      state.players[0].deck = [createCardInstance(top), createCardInstance(top)];
      const icons = top.resources?.total ?? 0;
      expect(icons).toBeGreaterThan(0);
      const after = startPlayerPhase(state);
      expect(after.players[0].deck).toHaveLength(1);
      expect(counters(after)).toBe(icons);
    });

    it('its alter-ego action needs an identity-specific card and discards it', () => {
      const state = game();
      const obligation = withObligation(state);
      const p = state.players[0];
      p.currentForm = 'alter_ego';
      p.activeFormCard = p.alterEgo;
      const ability = obligation.card.enrichment!.abilities![1];
      p.hand = [createCardInstance(cardCatalog.getCard('01091')!)];
      expect(canInitiateAbility(state, 'p1', ability, obligation).allowed).toBe(false);

      const specific = p.deck.find((c) => c.card.setCode === p.hero.setCode)?.card;
      const heroCard = specific ?? cardCatalog.getCardsBySet(p.hero.setCode!)[2];
      p.hand = [createCardInstance(heroCard)];
      expect(canInitiateAbility(state, 'p1', ability, obligation).allowed).toBe(true);

      kernel.executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: obligation });
      expect(p.obligations).toHaveLength(0);
    });
  });

  it('a peril reveal keeps its hold after the card it revealed resolves', () => {
    const state = game();
    const outer = createCardInstance(cardCatalog.getCard('01186')!);
    state.activeEncounterContext = {
      encounterInstanceId: outer.instanceId,
      encounterCard: outer,
      targetPlayerId: 'p1',
    };
    kernel.resolveActiveEncounterCardAfterInterrupt(
      state,
      createCardInstance(cardCatalog.getCard('01187')!),
      state.players[0],
      true,
    );
    expect(state.activeEncounterContext?.encounterInstanceId).toBe(outer.instanceId);
  });

  it('standard III declares no scripted ability', () => {
    for (const code of ['45075a', '45075b', '45076', '45077', '45078', '45079', '45080']) {
      const effects = (cardCatalog.getCard(code)!.enrichment!.abilities ?? []).flatMap((a) =>
        (a.steps ?? []).map((s) => s.effect),
      );
      expect(effects).not.toContain('EXECUTE_SPECIAL');
    }
  });
});
