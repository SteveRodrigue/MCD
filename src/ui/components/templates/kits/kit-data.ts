import type { CardReference } from '../../../theme/CardRef';

/** Real core-set cards the kits draw, so thumbnails and accents are the ones the game shows. */
export const KIT_HERO: CardReference = { code: '01001a', name: 'Spider-Man' };
export const KIT_VILLAIN: CardReference = { code: '01094', name: 'Rhino' };
export const KIT_MINION: CardReference = { code: '01102', name: 'Sandman' };
export const KIT_ALLY: CardReference = { code: '01050', name: 'Hulk' };
export const KIT_EVENT: CardReference = { code: '01003', name: 'Backflip' };
export const KIT_UPGRADE: CardReference = { code: '01007', name: 'Spider-Tracer' };
export const KIT_TEAM_ALLY: CardReference = { code: '01075', name: 'Black Widow' };
export const KIT_TEAM_ALLY_2: CardReference = { code: '01059', name: 'Jessica Jones' };
export const KIT_HAND: readonly CardReference[] = [
  KIT_EVENT,
  { code: '01075', name: 'Black Widow' },
  { code: '01059', name: 'Jessica Jones' },
  { code: '01066', name: 'Hawkeye' },
  { code: '01083', name: 'Mockingbird' },
];

/** Spider-Man's hero blue; the hero palette is an accent on whichever theme is active. */
export const KIT_HERO_COLOR = '#1D4ED8';

export const KIT_TICKER: readonly string[] = [
  'Rhino smashes through the docks',
  'Sandman spotted near the harbour',
  'Spider-Man: menace or hero?',
  'Hulk seen leaving a bar',
];
