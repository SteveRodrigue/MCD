import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import type { AlterEgoCard, CardInstance, GameState, HeroCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { resolveChosenHostAttachment } from '../../src/engine/pipeline/actions/play';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';

/**
 * Chosen-host attachment flow (R6b, Task A): explicit target, zero / one /
 * many candidates, and `maxPerHost`, for minion, ally and enemy hosts.
 */

const ATTACHMENT_CODE = '01088';
const MINION_CODE = '01100';
const ALLY_CODE = '01067';

function buildState(): GameState {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    players: [
      ['p1', '01001'],
      ['p2', '01010'],
    ].map(([id, heroCode]) => ({
      id,
      name: `Player ${id}`,
      hero: cardCatalog.getCard(`${heroCode}a`) as HeroCard,
      alterEgo: cardCatalog.getCard(`${heroCode}b`) as AlterEgoCard,
      deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
    })),
    villain: cardCatalog.getCard('01094') as any,
    mainScheme: cardCatalog.getCard('01097b') as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  return state;
}

const minion = (id: string): CardInstance => ({
  ...createCardInstance(cardCatalog.getCard(MINION_CODE)!, 'p1'),
  instanceId: id,
});
const ally = (id: string): CardInstance => ({
  ...createCardInstance(cardCatalog.getCard(ALLY_CODE)!, 'p1'),
  instanceId: id,
});

describe('resolveChosenHostAttachment (R6b)', () => {
  let state: GameState;
  let played: CardInstance;

  const attachLog = (s: GameState) => s.log.filter((l) => l.key === 'card.attached.to_host');
  const run = (targetHost: string, targetInstanceId?: string, maxPerHost?: number) =>
    resolveChosenHostAttachment(
      state,
      state.players[0],
      {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: played.instanceId,
        paymentCardInstanceIds: [],
        targetInstanceId,
      },
      played,
      targetHost,
      maxPerHost === undefined
        ? undefined
        : { effect: 'ATTACH_TO_HOST', effectParams: { target: targetHost, maxPerHost } },
    );

  beforeEach(() => {
    state = buildState();
    played = createCardInstance(cardCatalog.getCard(ATTACHMENT_CODE)!, 'p1');
    state.players[0].engagedMinions = [];
    state.players[0].allies = [];
    state.players[1].engagedMinions = [];
    state.players[1].allies = [];
  });

  describe('minion host', () => {
    it('attaches to the explicit target and logs it with its controller', () => {
      const m = minion('m1');
      state.players[1].engagedMinions = [m];

      expect(run('CHOSEN_MINION', 'm1')).toBeUndefined();
      expect(m.attachments?.map((a) => a.instanceId)).toEqual([played.instanceId]);
      const log = attachLog(state);
      expect(log).toHaveLength(1);
      expect(log[0].params).toMatchObject({ host: `${m.card.name} (Player p2)` });
    });

    it('attaches directly when exactly one minion is engaged', () => {
      const m = minion('m1');
      state.players[0].engagedMinions = [m];

      expect(run('CHOSEN_MINION')).toBeUndefined();
      expect(m.attachments).toHaveLength(1);
      expect(attachLog(state)[0].params).toMatchObject({ host: `${m.card.name} (Player p1)` });
    });

    it('prompts when several minions are engaged, across players', () => {
      state.players[0].engagedMinions = [minion('m1')];
      state.players[1].engagedMinions = [minion('m2')];

      const out = run('CHOSEN_MINION');
      expect(out?.result).toEqual({ success: true, onomatopoeia: 'CHOOSE MINION!' });
      const prompt = peekDecisionPrompt(out!.state)!;
      expect(prompt.title).toBe('Choose Minion Host');
      expect(prompt.promptId).toMatch(/^prompt_attach_minion_/);
      expect(prompt.options.map((o) => o.id)).toEqual(['m1', 'm2']);
      expect(prompt.options.every((o) => o.params?.isAttachmentMinionChoice)).toBe(true);
      expect(prompt.options[0].label).toBe(
        `${state.players[0].engagedMinions[0].card.name} (Player p1)`,
      );
    });

    it('skips minions that already hold maxPerHost copies of the played card', () => {
      const m1 = minion('m1');
      const m2 = minion('m2');
      m1.attachments = [{ ...played, instanceId: 'already_on_m1' }];
      state.players[0].engagedMinions = [m1, m2];

      expect(run('CHOSEN_MINION', undefined, 1)).toBeUndefined();
      expect(m2.attachments).toHaveLength(1);
      expect(m1.attachments).toHaveLength(1);
    });
  });

  describe('ally host', () => {
    it('attaches to the explicit target and logs it with its controller', () => {
      const a = ally('a1');
      state.players[1].allies = [a];

      expect(run('CHOSEN_ALLY', 'a1')).toBeUndefined();
      expect(a.attachments).toHaveLength(1);
      expect(attachLog(state)[0].params).toMatchObject({ host: `${a.card.name} (Player p2)` });
    });

    it('attaches directly when exactly one ally is in play', () => {
      const a = ally('a1');
      state.players[0].allies = [a];

      expect(run('CHOSEN_ALLY')).toBeUndefined();
      expect(a.attachments).toHaveLength(1);
    });

    it('prompts when several allies are in play', () => {
      state.players[0].allies = [ally('a1'), ally('a2')];

      const out = run('CHOSEN_ALLY');
      expect(out?.result).toEqual({ success: true, onomatopoeia: 'CHOOSE ALLY!' });
      const prompt = peekDecisionPrompt(out!.state)!;
      expect(prompt.title).toBe('Choose Ally Host');
      expect(prompt.promptId).toMatch(/^prompt_attach_ally_/);
      expect(prompt.options.every((o) => o.params?.isAttachmentAllyChoice)).toBe(true);
    });

    it('skips allies that already hold maxPerHost copies of the played card', () => {
      const a1 = ally('a1');
      a1.attachments = [{ ...played, instanceId: 'already_on_a1' }];
      state.players[0].allies = [a1, ally('a2')];

      expect(run('CHOSEN_ALLY', undefined, 1)).toBeUndefined();
      expect(state.players[0].allies[1].attachments).toHaveLength(1);
    });
  });

  describe('enemy host', () => {
    it('attaches to an explicit minion and logs it with its controller', () => {
      const m = minion('m1');
      state.players[1].engagedMinions = [m];

      expect(run('CHOSEN_ENEMY', 'm1')).toBeUndefined();
      expect(m.attachments).toHaveLength(1);
      expect(attachLog(state)[0].params).toMatchObject({ host: `${m.card.name} (Player p2)` });
    });

    it('attaches directly to the villain when it is the only enemy', () => {
      expect(run('CHOSEN_ENEMY')).toBeUndefined();
      expect(state.villain.attachments).toHaveLength(1);
      expect(attachLog(state)[0].params).toMatchObject({ host: state.villain.card.name });
    });

    it('prompts with the villain and the minions when several enemies exist', () => {
      state.players[0].engagedMinions = [minion('m1')];

      const out = run('CHOSEN_ENEMY');
      expect(out?.result).toEqual({ success: true, onomatopoeia: 'CHOOSE ENEMY!' });
      const prompt = peekDecisionPrompt(out!.state)!;
      expect(prompt.title).toBe('Choose Enemy Host');
      expect(prompt.promptId).toMatch(/^prompt_attach_enemy_/);
      expect(prompt.options).toHaveLength(2);
      expect(prompt.options.every((o) => o.params?.isAttachmentEnemyChoice)).toBe(true);
    });

    it('skips the villain and minions that already hold maxPerHost copies', () => {
      state.villain.attachments = [{ ...played, instanceId: 'already_on_villain' }];
      const m = minion('m1');
      state.players[0].engagedMinions = [m];

      expect(run('CHOSEN_ENEMY', undefined, 1)).toBeUndefined();
      expect(m.attachments).toHaveLength(1);
    });
  });

  it('attaches to the active villain for the generic fallback host', () => {
    expect(run('VILLAIN')).toBeUndefined();
    expect(state.villain.attachments).toHaveLength(1);
    expect(attachLog(state)[0].params).toMatchObject({ host: state.villain.card.name });
  });
});
