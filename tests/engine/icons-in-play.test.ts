import { beforeEach, describe, expect, it } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  NormalizedCard,
  getActiveVillain,
} from '@engine/models';
import {
  countAccelerationIconsInPlay,
  countAmplifyIconsInPlay,
  countCrisisIconsInPlay,
  countHazardIconsInPlay,
} from '@engine/pipeline/icons';
import { getVillainPhaseThreatToAdd } from '@engine/pipeline/villain-phase';
import { createCardInstance } from '@engine/state/card-instance';
import { setupGame } from '@engine/state/game-setup';

const withIcon = (icons: Partial<NormalizedCard> = { scheme_acceleration: 1 }): CardInstance =>
  createCardInstance({ ...cardCatalog.getCard('01005')!, ...icons } as NormalizedCard);

describe('icons in play', () => {
  let state: GameState;

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      skipMulligan: true,
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
    });
    state.sideSchemes = [];
    state.environments = [];
  });

  const p1 = () => state.players[0];

  it.each<[string, (icon: CardInstance) => void]>([
    ['a side scheme', (i) => state.sideSchemes.push({ ...i, threat: 1 } as never)],
    [
      'an attachment on a side scheme',
      (i) => state.sideSchemes.push({ ...withIcon({}), threat: 1, attachments: [i] } as never),
    ],
    ['an environment', (i) => state.environments.push(i)],
    [
      'an attachment on an environment',
      (i) => state.environments.push({ ...withIcon({}), attachments: [i] }),
    ],
    ['an attachment on the villain', (i) => getActiveVillain(state).attachments.push(i)],
    ['a tableau card', (i) => p1().tableau.push(i)],
    ['an ally', (i) => p1().allies.push(i)],
    ['an attachment on an ally', (i) => p1().allies.push({ ...withIcon({}), attachments: [i] })],
    ['an engaged minion', (i) => p1().engagedMinions.push(i as never)],
    [
      'an attachment on an engaged minion',
      (i) => p1().engagedMinions.push({ ...withIcon({}), attachments: [i] } as never),
    ],
    ['an obligation in a play area', (i) => p1().obligations.push(i)],
  ])('acceleration counts an icon on %s', (_zone, place) => {
    const before = getVillainPhaseThreatToAdd(state);
    place(withIcon());
    expect(countAccelerationIconsInPlay(state)).toBe(1);
    expect(getVillainPhaseThreatToAdd(state)).toBe(before + 1);
  });

  it('acceleration counts each icon on a card', () => {
    p1().tableau.push(withIcon({ scheme_acceleration: 3 }));
    expect(countAccelerationIconsInPlay(state)).toBe(3);
  });

  it('an obligation in a play area adds its hazard, amplify and acceleration icons', () => {
    p1().obligations.push(
      withIcon({ scheme_acceleration: 1, scheme_hazard: 1, scheme_amplify: 1, scheme_crisis: 1 }),
    );
    expect(countAccelerationIconsInPlay(state)).toBe(1);
    expect(countHazardIconsInPlay(state)).toBe(1);
    expect(countAmplifyIconsInPlay(state)).toBe(1);
    expect(countCrisisIconsInPlay(state)).toBe(1);
  });

  it('an attachment on an environment adds its other icons too', () => {
    state.environments.push({ ...withIcon({}), attachments: [withIcon({ scheme_hazard: 1 })] });
    expect(countHazardIconsInPlay(state)).toBe(1);
  });

  it('an identity icon counts only on its faceup side', () => {
    const hero = { ...p1().hero, scheme_acceleration: 1 };
    p1().hero = hero;
    p1().activeFormCard = p1().alterEgo;
    expect(countAccelerationIconsInPlay(state)).toBe(0);
    p1().activeFormCard = hero;
    expect(countAccelerationIconsInPlay(state)).toBe(1);
  });

  it('facedown dealt, boost and tucked cards add no icons', () => {
    p1().dealtEncounterCards.push(withIcon());
    getActiveVillain(state).facedownBoostCards = [withIcon()];
    p1().tableau.push({ ...withIcon({}), tuckedCards: [withIcon()] } as never);
    expect(countAccelerationIconsInPlay(state)).toBe(0);
  });

  it('an icon leaves the count when its card leaves play', () => {
    const icon = withIcon();
    p1().tableau.push(icon);
    expect(countAccelerationIconsInPlay(state)).toBe(1);
    p1().tableau = [];
    expect(countAccelerationIconsInPlay(state)).toBe(0);
  });

  it('acceleration tokens and icons add up separately', () => {
    const before = getVillainPhaseThreatToAdd(state);
    state.accelerationTokens += 2;
    p1().tableau.push(withIcon({ scheme_acceleration: 3 }));
    expect(countAccelerationIconsInPlay(state)).toBe(3);
    expect(getVillainPhaseThreatToAdd(state)).toBe(before + 5);
  });
});
