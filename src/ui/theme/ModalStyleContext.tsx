import React from 'react';
import { ModalStyleContext } from './useModalStyle';
import type { ModalStyle, VerbColor } from './modal-styles';

export interface ModalStyleProviderProps {
  style: ModalStyle;
  overlayInset?: string;
  overlayTop?: number;
  cardAccents?: boolean;
  verbOverride?: VerbColor;
  children: React.ReactNode;
}

/** Supplies the active modal style, as the game will once a single style is settled. */
export const ModalStyleProvider: React.FC<ModalStyleProviderProps> = ({
  style,
  overlayInset = 'p-4',
  overlayTop,
  cardAccents = false,
  verbOverride,
  children,
}) => {
  const value = React.useMemo(
    () => ({ style, overlayInset, overlayTop, cardAccents, verbOverride }),
    [style, overlayInset, overlayTop, cardAccents, verbOverride],
  );
  return <ModalStyleContext.Provider value={value}>{children}</ModalStyleContext.Provider>;
};
