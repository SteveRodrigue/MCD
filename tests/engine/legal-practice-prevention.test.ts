import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  AllyCard,
  MinionCard,
  Keyword,
  getActiveMainScheme,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { applyThwart } from '@engine/pipeline/threat-pipeline';
import { canAttack, canThwart, HERO_ACTOR } from '@engine/pipeline/legality-checker';

// #331: Legal Practice (01023) was offered the main scheme although an icon prevented it. Every way
// to remove threat from the main scheme must agree with the others on the same board, so the table
// below asks the hero thwart, the ally thwart, an event (Legal Practice), an ability (Surveillance
// Team 01064) and the thwart executor about the same four boards.
const SHE_HULK = ['01019a', '01019b'] as const;
const BLACK_PANTHER = ['01029a', '01029b'] as const;

const patrolMinion = () =>
  createCardInstance({
    ...(cardCatalog.getCard('01101') as MinionCard),
    keywords: [Keyword.PATROL],
    text: '',
    enrichment: undefined,
  } as MinionCard);

const crisisSideScheme = () => ({
  instanceId: 'crisis_side',
  card: cardCatalog.getCard('01108')!,
  threat: 0,
});

function board(mutate: (state: GameState) => void, form: 'hero' | 'alter_ego'): GameState {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    players: [SHE_HULK, BLACK_PANTHER].map(([hero, alterEgo], i) => ({
      id: `p${i + 1}`,
      name: i === 0 ? 'She-Hulk' : 'Black Panther',
      hero: cardCatalog.getCard(hero) as HeroCard,
      alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
      deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
    })),
    villain: cardCatalog.getCard('01094') as never,
    mainScheme: cardCatalog.getCard('01097b') as never,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  const p1 = state.players[0];
  p1.currentForm = form;
  p1.activeFormCard = form === 'hero' ? p1.hero : p1.alterEgo;
  state.sideSchemes = [];
  getActiveMainScheme(state).threat = 5;
  mutate(state);
  return state;
}

const BOARDS: { name: string; mutate: (s: GameState) => void; mainAllowed: boolean }[] = [
  { name: 'a clear board', mutate: () => {}, mainAllowed: true },
  {
    name: 'a Crisis icon in play',
    mutate: (s) => s.sideSchemes.push(crisisSideScheme() as never),
    mainAllowed: false,
  },
  {
    name: 'a Patrol minion engaged with the acting player',
    mutate: (s) => s.players[0].engagedMinions.push(patrolMinion()),
    mainAllowed: false,
  },
  {
    name: 'a Patrol minion engaged with the other player',
    mutate: (s) => s.players[1].engagedMinions.push(patrolMinion()),
    mainAllowed: true,
  },
];

describe('removing threat from the main scheme agrees everywhere (#331)', () => {
  describe.each(BOARDS)('$name', ({ mutate, mainAllowed }) => {
    it('hero thwart', () => {
      const state = board(mutate, 'hero');
      expect(canThwart(state, 'p1', HERO_ACTOR, 'main_scheme').allowed).toBe(mainAllowed);
    });

    it('ally thwart', () => {
      const state = board((s) => {
        mutate(s);
        s.players[0].allies = [createCardInstance(cardCatalog.getCard('01011') as AllyCard)];
      }, 'hero');
      const allyId = state.players[0].allies[0].instanceId;
      expect(
        canThwart(state, 'p1', { kind: 'ally', instanceId: allyId }, 'main_scheme').allowed,
      ).toBe(mainAllowed);
    });

    it('event: Legal Practice (CHOSEN_SCHEME), the main scheme is the only scheme with threat', () => {
      const state = board((s) => {
        mutate(s);
        s.players[0].hand = [
          { instanceId: 'lp', card: cardCatalog.getCard('01023')!, exhausted: false },
          { instanceId: 'h1', card: { name: 'A' } as never, exhausted: false },
          { instanceId: 'h2', card: { name: 'B' } as never, exhausted: false },
        ];
      }, 'alter_ego');
      const res = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: 'lp',
        discardCardInstanceIds: ['h1', 'h2'],
      } as never);

      expect(res.result.success).toBe(mainAllowed);
      expect(peekDecisionPrompt(res.state)).toBeUndefined();
      expect(getActiveMainScheme(res.state).threat).toBe(mainAllowed ? 3 : 5);
      // Nothing is paid when the play is refused.
      expect(res.state.players[0].hand).toHaveLength(mainAllowed ? 0 : 3);
    });

    it('ability: Surveillance Team (CHOSEN_SCHEME), the main scheme is the only scheme with threat', () => {
      const state = board(mutate, 'hero');
      const team = createCardInstance(cardCatalog.getCard('01064')!);
      team.tokens = { damage: 0, threat: 0, counters: 3 };
      state.players[0].tableau.push(team);

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: team.instanceId,
        abilityId: 'surveillance_team_action',
      });

      expect(res.result.success).toBe(mainAllowed);
      expect(getActiveMainScheme(res.state).threat).toBeLessThan(mainAllowed ? 5 : 6);
      expect(getActiveMainScheme(res.state).threat < 5).toBe(mainAllowed);
    });

    it('thwart executor', () => {
      const state = board(mutate, 'hero');
      const { result } = applyThwart(state, {
        thwarterType: 'HERO',
        thwarterEntity: state.players[0],
        playerId: 'p1',
        targetType: 'main_scheme',
        thwartValue: 2,
      });
      expect(result.threatRemoved > 0).toBe(mainAllowed);
    });
  });

  it('an encounter source is not limited by Crisis or Patrol (RR v1.8: player cards only)', () => {
    const state = board((s) => {
      s.sideSchemes.push(crisisSideScheme() as never);
      s.players[0].engagedMinions.push(patrolMinion());
    }, 'hero');
    const { result } = applyThwart(state, {
      thwarterType: 'CARD_EFFECT',
      playerId: 'p1',
      targetType: 'main_scheme',
      thwartValue: 2,
      isPlayerSource: false,
    });
    expect(result.threatRemoved).toBe(2);
  });
});

describe('Guard blocks the villain attack for hero and ally alike', () => {
  const guardMinion = () => createCardInstance(cardCatalog.getCard('01101') as MinionCard);

  it('rejects a villain attack, allows a minion attack, only for the engaged player', () => {
    const state = board((s) => {
      s.players[0].engagedMinions.push(guardMinion());
      s.players[0].allies = [createCardInstance(cardCatalog.getCard('01011') as AllyCard)];
    }, 'hero');
    const minionId = state.players[0].engagedMinions[0].instanceId;
    const ally = { kind: 'ally', instanceId: state.players[0].allies[0].instanceId } as const;

    expect(canAttack(state, 'p1', HERO_ACTOR, 'villain').allowed).toBe(false);
    expect(canAttack(state, 'p1', ally, 'villain').allowed).toBe(false);
    expect(canAttack(state, 'p1', HERO_ACTOR, 'minion', minionId).allowed).toBe(true);
    expect(canAttack(state, 'p1', ally, 'minion', minionId).allowed).toBe(true);

    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = state.players[1].hero;
    state.activePlayerIndex = 1;
    expect(canAttack(state, 'p2', HERO_ACTOR, 'villain').allowed).toBe(true);
  });
});
