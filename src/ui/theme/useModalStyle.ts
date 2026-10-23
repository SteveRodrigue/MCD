import { createContext, useContext, useMemo } from 'react';
import { getCardAccent, type CardAccent } from './card-accents';
import { DEFAULT_MODAL_STYLE, type ModalStyle, type VerbColor } from './modal-styles';

export interface ModalStyleContextValue {
  style: ModalStyle;
  /** Padding classes of the full-screen overlay. The lab uses it to clear its own navigation bar. */
  overlayInset: string;
  /** Pixels of top clearance below fixed lab chrome (overrides the top padding of `overlayInset`). */
  overlayTop?: number;
  /** Draw the faction / hero / villain accent on card-bearing elements. */
  cardAccents: boolean;
  /** Forces every header colour (the lab's verb switch). The game never sets it. */
  verbOverride?: VerbColor;
}

export const ModalStyleContext = createContext<ModalStyleContextValue>({
  style: DEFAULT_MODAL_STYLE,
  overlayInset: 'p-4',
  cardAccents: false,
});

export const useModalStyle = (): ModalStyleContextValue => useContext(ModalStyleContext);

/** The accent for a card, or null when accents are off or the card is unknown. */
export const useCardAccent = (code: string): CardAccent | null => {
  const { cardAccents } = useModalStyle();
  return useMemo(() => (cardAccents ? getCardAccent(code) : null), [cardAccents, code]);
};
