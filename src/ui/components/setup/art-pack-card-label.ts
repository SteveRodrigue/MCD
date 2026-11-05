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

export interface ArtPackCardLabel {
  /** The card's printed name, or the code when no loaded card owns it. */
  name: string;
  /** Hero, Alter-ego and so on; empty for an unknown code. */
  kind: string;
  known: boolean;
}

/** What to call a code in the browser: a card of a loaded pack, a scenario token, or just the code. */
export function describeArtPackCard(code: string): ArtPackCardLabel {
  for (const pack of getLoadedContent().packs) {
    const card = pack.cards.find((candidate) => candidate.code === code);
    if (card) {
      return { name: card.name, kind: TYPE_LABEL[card.type_code ?? ''] ?? '', known: true };
    }
    for (const scenario of pack.scenarios) {
      const token = scenario.tokens?.find((candidate) => candidate.code === code);
      if (token) return { name: token.name, kind: 'Token', known: true };
    }
  }
  return { name: code, kind: '', known: false };
}
