import { getLoadedContent } from '../../../data/content/store';

const TYPE_LABEL: Record<string, string> = {
  hero: 'Hero',
  alter_ego: 'Alter-ego',
  minion: 'Minion',
  ally: 'Ally',
  villain: 'Villain',
  main_scheme: 'Main scheme',
  side_scheme: 'Side scheme',
};

export interface ArtPackCardDescription {
  /** The card's printed name, or the code when no installed pack owns it. */
  name: string;
  /** Hero, Alter-ego and so on; empty for an unknown code. */
  kind: string;
  known: boolean;
  /** The card belongs to an installed pack that is off, so the game does not use it now. */
  packOff: boolean;
}

/** What to call a code in the browser: a card of an installed pack, a scenario token, or the code. */
export function describeArtPackCard(code: string): ArtPackCardDescription {
  const label = getLoadedContent().artPackCardLabels[code];
  if (!label) return { name: code, kind: '', known: false, packOff: false };
  return {
    name: label.name,
    kind: label.source === 'token' ? 'Token' : (TYPE_LABEL[label.type ?? ''] ?? ''),
    known: true,
    packOff: label.source === 'off-pack',
  };
}
