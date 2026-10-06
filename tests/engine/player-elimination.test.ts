import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  StatusCard,
  getFirstPlayer,
  getPerPlayerCount,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { applyDamageToTarget } from '@engine/pipeline/damage-pipeline';
import { eliminatePlayer } from '@engine/pipeline/player-elimination';
import { step1_placeThreat, step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { getActiveMainScheme } from '@engine/models';

// Issue #246: a defeated hero eliminates that player only (RR v1.8 Player Elimination). The group
// loses when every player is eliminated. Scenarios S1 to S8 are in
// docs/backlog/plan_issue_246_player_elimination.md.
describe('Player elimination (#246)', () => {
  let state: GameState;

  const makePlayer = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const build = (count: 2 | 3) => {
    const players = [
      makePlayer('p1', '01001a', '01001b'),
      makePlayer('p2', '01010a', '01010b'),
      ...(count === 3 ? [makePlayer('p3', '01029a', '01029b')] : []),
    ];
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

  const hit = (playerId: string, amount: number) => {
    const player = state.players.find((p) => p.id === playerId)!;
    return applyDamageToTarget(state, {
      target: {
        type: 'player',
        entity: player,
        name: player.name,
        targetPlayerId: player.id,
        attachments: player.attachments,
        statusCards: player.statusCards,
      } as any,
      amount,
      sourceType: 'VILLAIN',
    } as any);
  };

  const encounterCard = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

  beforeEach(() => build(2));

  it('keeps the game going when one of two heroes reaches 0 HP', () => {
    hit('p1', 999);
    expect(state.winner).toBeNull();
    expect(state.players.map((p) => p.id)).toEqual(['p2']);
    expect(state.eliminatedPlayers?.map((p) => p.id)).toEqual(['p1']);
    expect(state.firstPlayerIndex).toBe(0);
    expect(state.activePlayerIndex).toBe(0);
  });

  it('loses the game when the last remaining hero is eliminated', () => {
    hit('p1', 999);
    hit('p2', 999);
    expect(state.winner).toBe('VILLAIN');
    expect(state.players).toHaveLength(0);
  });

  it('a solo hero defeated loses the game', () => {
    state.players.splice(1);
    hit('p1', 999);
    expect(state.winner).toBe('VILLAIN');
  });

  it('S8: the first player token passes to the next clockwise player', () => {
    build(3);
    state.firstPlayerIndex = 1;
    state.activePlayerIndex = 1;
    eliminatePlayer(state, 'p2');
    expect(state.players.map((p) => p.id)).toEqual(['p1', 'p3']);
    expect(getFirstPlayer(state).id).toBe('p3');
  });

  it('keeps the first player when another player is eliminated, re-basing the index', () => {
    build(3);
    state.firstPlayerIndex = 2;
    state.activePlayerIndex = 2;
    eliminatePlayer(state, 'p1');
    expect(state.players.map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(getFirstPlayer(state).id).toBe('p3');
    expect(state.players[state.activePlayerIndex].id).toBe('p3');
  });

  it('wraps the first player token past the end of the table', () => {
    build(3);
    state.firstPlayerIndex = 2;
    eliminatePlayer(state, 'p3');
    expect(getFirstPlayer(state).id).toBe('p1');
  });

  it('S4: engaged minions engage the next clockwise player keeping everything they carry', () => {
    build(3);
    const minion = encounterCard('01101');
    minion.tokens = { damage: 1 };
    minion.statusCards = [StatusCard.STUNNED];
    minion.attachments = [encounterCard('01098')];
    state.players[0].engagedMinions.push(minion);
    eliminatePlayer(state, 'p1');
    const moved = state.players.find((p) => p.id === 'p2')!.engagedMinions;
    expect(moved.map((m) => m.instanceId)).toEqual([minion.instanceId]);
    expect(moved[0].tokens?.damage).toBe(1);
    expect(moved[0].statusCards).toEqual([StatusCard.STUNNED]);
    expect(moved[0].attachments).toHaveLength(1);
  });

  it('S1: an encounter attachment on the eliminated identity goes to the encounter discard', () => {
    const attachment = encounterCard('01098');
    state.players[0].attachments = [attachment];
    const before = state.encounterDiscard.length;
    eliminatePlayer(state, 'p1');
    expect(state.encounterDiscard).toHaveLength(before + 1);
    expect(state.encounterDiscard.map((c) => c.instanceId)).toContain(attachment.instanceId);
  });

  it('S2: status cards of the eliminated player leave with the player', () => {
    state.players[0].statusCards = [StatusCard.CONFUSED, StatusCard.TOUGH];
    eliminatePlayer(state, 'p1');
    expect(state.winner).toBeNull();
    expect(state.players.flatMap((p) => p.statusCards)).toEqual([]);
  });

  it('S3: an ally the eliminated player controls but does not own goes to its owner discard', () => {
    const ally = createCardInstance(cardCatalog.getCard('01002')!, 'p2');
    ally.ownerId = 'p2';
    state.players[0].allies.push(ally);
    const before = state.players[1].discard.length;
    eliminatePlayer(state, 'p1');
    expect(state.players[0].id).toBe('p2');
    expect(state.players[0].discard).toHaveLength(before + 1);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(ally.instanceId);
  });

  it('S5: the eliminated player upgrade attached to another hero ally leaves with its owner', () => {
    const ally = createCardInstance(cardCatalog.getCard('01002')!, 'p2');
    const upgrade = createCardInstance(cardCatalog.getCard('01037')!, 'p1');
    upgrade.ownerId = 'p1';
    ally.attachments = [upgrade];
    state.players[1].allies.push(ally);
    eliminatePlayer(state, 'p1');
    const kept = state.players[0].allies.find((a) => a.instanceId === ally.instanceId)!;
    expect(kept.attachments ?? []).toHaveLength(0);
    expect(state.players[0].discard.map((c) => c.instanceId)).not.toContain(upgrade.instanceId);
    expect(state.eliminatedPlayers![0].discard.map((c) => c.instanceId)).toContain(
      upgrade.instanceId,
    );
  });

  it('the eliminated player cards are not left in play or in the encounter discard', () => {
    expect(state.players[0].hand.length).toBeGreaterThan(0);
    eliminatePlayer(state, 'p1');
    expect(state.encounterDiscard.some((c) => c.ownerId === 'p1')).toBe(false);
    expect(state.players.some((p) => p.id === 'p1')).toBe(false);
  });

  it('is idempotent for a player that is already gone', () => {
    eliminatePlayer(state, 'p1');
    expect(() => eliminatePlayer(state, 'p1')).not.toThrow();
    expect(state.players.map((p) => p.id)).toEqual(['p2']);
    expect(state.eliminatedPlayers).toHaveLength(1);
  });

  describe('S9: an elimination in the middle of a loop over the players', () => {
    // A treachery whose When Revealed deals 1 damage to every hero.
    const pingTreachery = () => {
      const base = cardCatalog.getCard('01111')!;
      const card = {
        ...base,
        type: 'treachery',
        enrichment: {
          abilities: [
            {
              id: 'ping_all',
              trigger: 'WHEN_REVEALED',
              timing: 'WHEN_REVEALED',
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1, target: 'ALL_HEROES' } }],
            },
          ],
        },
      } as any;
      return createCardInstance(card);
    };

    it('reveals each remaining hero card exactly once when the first hero is eliminated by the first reveal', () => {
      const [a, b] = state.players;
      a.health = 1;
      const bStart = b.health;
      a.dealtEncounterCards = [pingTreachery()];
      b.dealtEncounterCards = [pingTreachery()];

      step4_revealEncounterCards(state);

      expect(state.players.map((p) => p.id)).toEqual(['p2']);
      expect(b.dealtEncounterCards).toHaveLength(0);
      // hit by a's card and by its own, never twice by the same reveal
      expect(b.health).toBe(bStart - 2);
      expect(state.winner).toBeNull();
    });

    it('still reveals the later hero card when the earlier hero is the one eliminated (reverse order)', () => {
      const [a, b] = state.players;
      b.health = 1;
      const aStart = a.health;
      a.dealtEncounterCards = [pingTreachery()];
      b.dealtEncounterCards = [pingTreachery()];

      step4_revealEncounterCards(state);

      expect(state.players.map((p) => p.id)).toEqual(['p1']);
      // b is gone before its own card is revealed: that card leaves with it, unrevealed
      expect(a.health).toBe(aStart - 1);
    });

    it('ALL_CHARACTERS damage reaches every hero even when the first one is eliminated by it', () => {
      const [a, b] = state.players;
      a.health = 1;
      const bStart = b.health;
      a.dealtEncounterCards = [];
      b.dealtEncounterCards = [];
      const card = pingTreachery();
      (card.card as any).enrichment.abilities[0].steps[0].effectParams.target = 'ALL_CHARACTERS';
      a.dealtEncounterCards = [card];

      step4_revealEncounterCards(state);

      expect(b.health).toBe(bStart - 1);
    });
  });

  describe('per-player icon', () => {
    it('escalation threat is multiplied by the players who started the scenario', () => {
      build(3);
      eliminatePlayer(state, 'p3');
      const before = getActiveMainScheme(state).threat;
      const escalation = getActiveMainScheme(state).card.escalationThreat;
      step1_placeThreat(state);
      expect(getActiveMainScheme(state).threat - before).toBe(
        escalation * 3 + state.accelerationTokens,
      );
    });

    it('counts the players who started the scenario, whoever is eliminated', () => {
      build(3);
      expect(getPerPlayerCount(state)).toBe(3);
      eliminatePlayer(state, 'p2');
      expect(getPerPlayerCount(state)).toBe(3);
      expect(state.players).toHaveLength(2);
    });
  });
});
