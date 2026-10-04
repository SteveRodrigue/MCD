import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  SideSchemeCard,
  CardInstance,
  Keyword,
  getActiveMainScheme,
} from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';

const CRISIS_SIDE_SCHEME = '01108'; // Bomb Scare, prints a Crisis icon
const PLAIN_SIDE_SCHEME = '01107';

describe('Mark V Helmet (01037): remove 1 threat from a scheme, from each scheme instead with Aerial', () => {
  let state: GameState;
  let helmet: CardInstance;

  const sideScheme = (id: string, code: string, threat: number) => ({
    instanceId: id,
    card: cardCatalog.getCard(code) as SideSchemeCard,
    threat,
  });
  const mainThreat = () => getActiveMainScheme(state).threat;
  const sideThreat = (id: string) => state.sideSchemes.find((s) => s.instanceId === id)!.threat;
  const useHelmet = () =>
    dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: helmet.instanceId,
      abilityId: 'mark_v_helmet',
    });
  const grantAerial = () => {
    state.players[0].activeTraitModifiers = [{ trait: 'Aerial', duration: 'PHASE' }];
  };

  beforeEach(() => {
    const ironMan = cardCatalog.getCard('01029a') as HeroCard;
    const tony = cardCatalog.getCard('01029b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: ironMan,
          alterEgo: tony,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = ironMan;
    getActiveMainScheme(state).threat = 4;
    state.sideSchemes = [
      sideScheme('side_a', PLAIN_SIDE_SCHEME, 3),
      sideScheme('side_b', PLAIN_SIDE_SCHEME, 2),
    ];

    helmet = createCardInstance(cardCatalog.getCard('01037')!);
    state.players[0].tableau.push(helmet);
  });

  it('without Aerial, removes 1 threat from one chosen scheme only', () => {
    const res = useHelmet();
    expect(res.result.success).toBe(true);
    state = res.state;

    const prompt = peekDecisionPrompt(state)!;
    expect(prompt).toBeDefined();
    const pick = prompt.options.find((o) => o.id === 'side_a')!;
    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: pick.id,
    }).state;

    expect(sideThreat('side_a')).toBe(2);
    expect(sideThreat('side_b')).toBe(2);
    expect(mainThreat()).toBe(4);
  });

  it('with Aerial, removes 1 threat from each scheme, once, with no prompt', () => {
    grantAerial();

    const res = useHelmet();
    expect(res.result.success).toBe(true);
    state = res.state;

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(mainThreat()).toBe(3);
    expect(sideThreat('side_a')).toBe(2);
    expect(sideThreat('side_b')).toBe(1);
    expect(
      state.players[0].tableau.find((c) => c.instanceId === helmet.instanceId)!.exhausted,
    ).toBe(true);
  });

  it('with Aerial and a Crisis side scheme, skips the main scheme and thwarts every side scheme', () => {
    grantAerial();
    state.sideSchemes.push(sideScheme('side_crisis', CRISIS_SIDE_SCHEME, 2));

    state = useHelmet().state;

    expect(mainThreat()).toBe(4);
    expect(sideThreat('side_a')).toBe(2);
    expect(sideThreat('side_b')).toBe(1);
    expect(sideThreat('side_crisis')).toBe(1);
  });

  it('with Aerial and a Patrol minion engaged, skips the main scheme (Patrol: cannot thwart the main scheme)', () => {
    grantAerial();
    const baseMinion = cardCatalog.getCard('01101') as MinionCard;
    state.players[0].engagedMinions = [
      createCardInstance({ ...baseMinion, keywords: [Keyword.PATROL] } as MinionCard),
    ];

    state = useHelmet().state;

    expect(mainThreat()).toBe(4);
    expect(sideThreat('side_a')).toBe(2);
    expect(sideThreat('side_b')).toBe(1);
  });

  it('without Aerial and a Patrol minion engaged, the main scheme is not offered', () => {
    const baseMinion = cardCatalog.getCard('01101') as MinionCard;
    state.players[0].engagedMinions = [
      createCardInstance({ ...baseMinion, keywords: [Keyword.PATROL] } as MinionCard),
    ];

    state = useHelmet().state;

    const prompt = peekDecisionPrompt(state)!;
    expect(prompt.options.map((o) => o.id).sort()).toEqual(['side_a', 'side_b']);
  });

  it('with Aerial and no scheme holding threat, the action cannot be started and nothing is spent', () => {
    grantAerial();
    state.sideSchemes = [];
    getActiveMainScheme(state).threat = 0;

    const res = useHelmet();

    expect(res.result.success).toBe(false);
    expect(mainThreat()).toBe(0);
    expect(helmet.exhausted).toBeFalsy();
  });
});
