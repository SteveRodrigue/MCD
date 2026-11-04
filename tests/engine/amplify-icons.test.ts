import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { AlterEgoCard, GameState, HeroCard } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { resolveBoostCards } from '@engine/pipeline/boost-resolution';
import { countAmplifyIconsInPlay } from '@engine/pipeline/icons';

const CHARGE = '01107'; // no star
const PRINTED = (cardCatalog.getCard(CHARGE) as any).boostIcons ?? 0;

describe('Amplify icons add boost icons to boost cards (RR v1.8 Amplify Icon, #293)', () => {
  let state: GameState;

  const withAmplify = (code: string, amplify: number) => ({
    ...(cardCatalog.getCard(code) as any),
    scheme_amplify: amplify,
  });

  const reveal = (): number => {
    const boostCard = createCardInstance(cardCatalog.getCard(CHARGE)!, 'encounter');
    const villain = state.villains?.[0] ?? (state as any).villain;
    return resolveBoostCards(state, {
      queue: [boostCard],
      activatorInstanceId: villain?.instanceId ?? 'v',
      playerId: 'p1',
      category: 'combat',
      actor: { type: 'villain', name: 'Rhino' } as any,
    });
  };

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'p1',
          hero: cardCatalog.getCard('01010a') as HeroCard,
          alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: Array(10).fill(cardCatalog.getCard(CHARGE)!),
      skipMulligan: true,
    });
  });

  it('adds nothing with no amplify icon in play', () => {
    expect(countAmplifyIconsInPlay(state)).toBe(0);
    expect(reveal()).toBe(PRINTED);
  });

  it('adds one icon per amplify icon on a side scheme, summed across cards', () => {
    state.sideSchemes.push(createCardInstance(withAmplify('01107', 1), 'encounter') as any);
    state.sideSchemes.push(createCardInstance(withAmplify('01107', 2), 'encounter') as any);
    expect(countAmplifyIconsInPlay(state)).toBe(3);
    expect(reveal()).toBe(PRINTED + 3);
  });

  it('counts an amplify icon on an environment', () => {
    state.environments.push(createCardInstance(withAmplify('01107', 1), 'encounter') as any);
    expect(reveal()).toBe(PRINTED + 1);
  });

  it('counts an amplify icon on an engaged minion attachment', () => {
    const minion = createCardInstance(cardCatalog.getCard('01108')!, 'encounter') as any;
    minion.attachments = [createCardInstance(withAmplify('01107', 1), 'encounter')];
    state.players[0].engagedMinions.push(minion);
    expect(reveal()).toBe(PRINTED + 1);
  });

  it('stops counting when the card leaves play', () => {
    state.sideSchemes.push(createCardInstance(withAmplify('01107', 1), 'encounter') as any);
    expect(reveal()).toBe(PRINTED + 1);
    state.sideSchemes.pop();
    expect(reveal()).toBe(PRINTED);
  });

  it('logs the amplified total', () => {
    state.sideSchemes.push(createCardInstance(withAmplify('01107', 2), 'encounter') as any);
    reveal();
    const entry = [...state.log].reverse().find((e) => e.key === 'villain.boost.revealed');
    expect(entry?.params).toMatchObject({
      boostIcons: PRINTED + 2,
      printedIcons: PRINTED,
      amplify: 2,
    });
  });
});
