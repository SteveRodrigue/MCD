import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  StatusCard,
  CardAbility,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { dispatchAction, peekDecisionPrompt, step4_revealEncounterCards } from '@engine/pipeline';
import { executeEffect } from '@engine/effects';

// #295: an attack step reports the damage dealt and the damaged character to the steps after it
// (Stampede 01106: "If a character is damaged by this attack, that character is stunned."). The
// attack opens a defender prompt, so the later steps wait and run once the attack is over.
describe('attack outcome facts for later steps (#295)', () => {
  let state: GameState;

  const setup = (heroCode: [string, string] = ['01001a', '01001b']) => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'p1',
          hero: cardCatalog.getCard(heroCode[0]) as HeroCard,
          alterEgo: cardCatalog.getCard(heroCode[1]) as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    const p = state.players[0];
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.hand = [];
    // The boost card of the attack: no icons, no ability, so the attack is Rhino's base ATK.
    state.encounterDeck = [
      createCardInstance({ code: 'filler-boost', name: 'Filler', type: 'treachery' } as any),
      ...state.encounterDeck,
    ];
  };

  const attackThenStun = (): CardAbility =>
    ({
      id: 'test_attack_then_stun',
      timing: 'WHEN_REVEALED',
      trigger: 'WHEN_REVEALED',
      steps: [
        { id: 'attack', effect: 'VILLAIN_ATTACKS', effectParams: {} },
        {
          id: 'stun',
          gate: 'IF_RESULT',
          gateParams: { result: 'DAMAGE_DEALT' },
          effect: 'ADD_STATUS',
          effectParams: { status: 'STUNNED', target: 'DAMAGED_CHARACTER' },
        },
      ],
    }) as CardAbility;

  const stunned = (entity: { statusCards?: StatusCard[] }) =>
    (entity.statusCards ?? []).filter((s) => s === StatusCard.STUNNED).length;

  const answer = (selectedOptionId: string) => {
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId,
    });
    state = res.state;
    return res;
  };

  /** Declines Spider-Sense, if offered, so the defender prompt is the head prompt. */
  const declineSpiderSense = () => {
    if (peekDecisionPrompt(state)?.options.some((o) => o.id === 'trigger_spider_sense')) {
      answer('pass');
    }
  };

  const start = () => {
    executeEffect(state, attackThenStun(), { playerId: 'p1' });
    declineSpiderSense();
  };

  beforeEach(() => setup());

  it('undefended: the stun waits for the defender prompt, then lands on the damaged hero', () => {
    start();

    expect(peekDecisionPrompt(state)?.options.map((o) => o.id)).toContain('undefended');
    expect(stunned(state.players[0])).toBe(0);

    answer('undefended');
    expect(state.lastCombatOutcome!.finalDamage).toBeGreaterThan(0);
    expect(stunned(state.players[0])).toBe(1);
  });

  it('the hero defends and takes no damage: nobody is stunned', () => {
    start();

    answer('defend_hero');

    expect(state.lastCombatOutcome!.finalDamage).toBe(0);
    expect(stunned(state.players[0])).toBe(0);
  });

  it('an ally defends and is damaged: the ally is stunned, the hero is not', () => {
    const ally = createCardInstance({ ...(cardCatalog.getCard('01002') as any), health: 9 });
    state.players[0].allies.push(ally);
    start();

    answer(`defend_ally_${ally.instanceId}`);

    expect(state.lastCombatOutcome!.finalDamage).toBeGreaterThan(0);
    expect(stunned(state.players[0].allies.find((a) => a.instanceId === ally.instanceId)!)).toBe(1);
    expect(stunned(state.players[0])).toBe(0);
  });

  it('a stunned villain does not attack: no prompt, no stun', () => {
    state.villain.statusCards = [StatusCard.STUNNED];

    start();

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(stunned(state.players[0])).toBe(0);
  });

  it('a damage prevention prompt keeps the stun waiting until it is answered', () => {
    setup(['01010a', '01010b']);
    // Cosmic Flight: prevent up to 3 damage; Rhino hits for 2, so all of it can be prevented.
    state.players[0].tableau = [createCardInstance(cardCatalog.getCard('01017')!)];
    start();
    answer('undefended');

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(stunned(state.players[0])).toBe(0);

    answer('pass');

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(stunned(state.players[0])).toBe(1);
  });

  describe('Stampede (01106)', () => {
    const reveal = () => {
      state.players[0].dealtEncounterCards.push(
        createCardInstance(cardCatalog.getCard('01106')!) as CardInstance,
      );
      state = step4_revealEncounterCards(state);
      declineSpiderSense();
    };

    it('hero form: Rhino attacks and the damaged hero is stunned', () => {
      reveal();
      expect(peekDecisionPrompt(state)).toBeDefined();
      answer('undefended');
      expect(stunned(state.players[0])).toBe(1);
    });

    it('hero form, fully defended: no stun', () => {
      reveal();
      answer('defend_hero');
      expect(stunned(state.players[0])).toBe(0);
    });

    it('alter-ego form: surge only, no attack and no stun', () => {
      state.players[0].currentForm = 'alter_ego';
      state.players[0].activeFormCard = state.players[0].alterEgo;
      reveal();
      expect(state.activeAttackContext).toBeUndefined();
      expect(stunned(state.players[0])).toBe(0);
      expect(state.log.some((l) => l.key === 'encounter.surge.triggered')).toBe(true);
    });
  });
});
