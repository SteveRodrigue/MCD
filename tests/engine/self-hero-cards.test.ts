import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  StatusCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  peekDecisionPrompt,
  step4_revealEncounterCards,
  getActiveMainScheme,
} from '@engine/index';

const SWEEPING_SWOOP = '01168';
const ELECTRIC_WHIP = '01173';
const VULTURE = '01167';
const RITUAL_COMBAT = '01159';
const CHARGE = '01099'; // 2 boost icons, so X = 3
const ARMORED_VEST = '01081'; // upgrade

describe('Cards that say "your hero" (#222)', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
  });

  const p1 = () => state.players[0];
  const p2 = () => state.players[1];
  const toAlterEgo = (index: number) => {
    state.players[index].currentForm = 'alter_ego';
    state.players[index].activeFormCard = state.players[index].alterEgo;
  };
  const revealFor = (playerId: string, code: string) => {
    state.players
      .find((p) => p.id === playerId)!
      .dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(code)!));
    state = step4_revealEncounterCards(state);
  };
  const surged = () => state.log.some((l) => l.key === 'encounter.surge.triggered');

  describe('Sweeping Swoop (01168) When Revealed: stun your hero, surge if Vulture is in play', () => {
    it('stuns the revealing player hero and nobody else', () => {
      revealFor('p2', SWEEPING_SWOOP);
      expect(p2().statusCards).toContain(StatusCard.STUNNED);
      expect(p1().statusCards).not.toContain(StatusCard.STUNNED);
    });

    it('does not stun the alter-ego', () => {
      toAlterEgo(1);
      revealFor('p2', SWEEPING_SWOOP);
      expect(p2().statusCards).not.toContain(StatusCard.STUNNED);
    });

    it('gains surge only when Vulture is in play', () => {
      revealFor('p2', SWEEPING_SWOOP);
      expect(surged()).toBe(false);

      p1().engagedMinions.push(createCardInstance(cardCatalog.getCard(VULTURE) as MinionCard));
      revealFor('p2', SWEEPING_SWOOP);
      expect(surged()).toBe(true);
    });
  });

  describe('Electric Whip Attack (01173) When Revealed: damage per upgrade, or discard an upgrade', () => {
    const upgradesIn = (index: number) =>
      state.players[index].tableau.filter((t) => t.card.type === 'upgrade');
    const giveUpgrades = (index: number, n: number) => {
      for (let i = 0; i < n; i++) {
        state.players[index].tableau.push(createCardInstance(cardCatalog.getCard(ARMORED_VEST)!));
      }
    };
    const choose = (playerId: string, optionId: string) => {
      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId,
        selectedOptionId: optionId,
      });
      state = res.state;
      return res;
    };

    it('offers the player a choice between the two options', () => {
      giveUpgrades(1, 2);
      revealFor('p2', ELECTRIC_WHIP);
      const prompt = peekDecisionPrompt(state)!;
      expect(prompt.playerId).toBe('p2');
      expect(prompt.options.map((o) => o.id)).toEqual(
        expect.arrayContaining(['deal_damage', 'discard_upgrade']),
      );
    });

    it('damage option: 1 damage to your hero for each upgrade you control, nobody else', () => {
      giveUpgrades(1, 2);
      const p2Before = p2().health;
      const p1Before = p1().health;
      revealFor('p2', ELECTRIC_WHIP);
      choose('p2', 'deal_damage');
      expect(p2().health).toBe(p2Before - 2);
      expect(p1().health).toBe(p1Before);
    });

    it('damage option in alter-ego form: your hero takes nothing', () => {
      toAlterEgo(1);
      giveUpgrades(1, 2);
      const before = p2().health;
      revealFor('p2', ELECTRIC_WHIP);
      choose('p2', 'deal_damage');
      expect(p2().health).toBe(before);
    });

    it('discard option: the chosen upgrade is discarded', () => {
      giveUpgrades(1, 2);
      revealFor('p2', ELECTRIC_WHIP);
      choose('p2', 'discard_upgrade');

      // With two upgrades the player picks which one (a second prompt), with one it is automatic.
      const next = peekDecisionPrompt(state);
      if (next) {
        choose('p2', next.options[0].id);
      }
      expect(upgradesIn(1)).toHaveLength(1);
    });
  });
  describe('Ritual Combat (01159) When Revealed: discard the top card, then X damage to your hero or X threat', () => {
    const stackTop = () => {
      state.encounterDeck = [
        createCardInstance(cardCatalog.getCard(CHARGE)!),
        ...state.encounterDeck,
      ];
    };
    const choose = (playerId: string, optionId: string) => {
      state = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId,
        selectedOptionId: optionId,
      }).state;
    };

    it('discards the top card of the encounter deck and offers both options', () => {
      stackTop();
      const discardBefore = state.encounterDiscard.length;
      revealFor('p2', RITUAL_COMBAT);
      expect(state.encounterDiscard.length).toBeGreaterThan(discardBefore);
      const prompt = peekDecisionPrompt(state)!;
      expect(prompt.playerId).toBe('p2');
      expect(prompt.options.map((o) => o.id)).toEqual(
        expect.arrayContaining(['deal_damage', 'place_threat']),
      );
    });

    it('X = 1 + boost icons of the discarded card: damage to your hero', () => {
      stackTop();
      const before = [p1().health, p2().health];
      revealFor('p2', RITUAL_COMBAT);
      choose('p2', 'deal_damage');
      expect(p2().health).toBe(before[1] - 3);
      expect(p1().health).toBe(before[0]);
    });

    it('X = 1 + boost icons of the discarded card: threat on the main scheme', () => {
      stackTop();
      const before = getActiveMainScheme(state).threat;
      revealFor('p2', RITUAL_COMBAT);
      choose('p2', 'place_threat');
      expect(getActiveMainScheme(state).threat).toBe(before + 3);
    });

    it('damage option in alter-ego form: your hero takes nothing', () => {
      toAlterEgo(1);
      stackTop();
      const before = p2().health;
      revealFor('p2', RITUAL_COMBAT);
      choose('p2', 'deal_damage');
      expect(p2().health).toBe(before);
    });
  });
});
