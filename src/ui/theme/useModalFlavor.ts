import { createContext, useContext } from 'react';
import type { BurstState } from './useActionBurst';

/**
 * Presentation extras a harness (the lab) can lay over a real modal without the modal knowing:
 * a narrator caption / speech bubble above the body and a sound-effect burst. The game provides none.
 */
export interface ModalFlavor {
  intro?: React.ReactNode;
  burst?: BurstState | null;
}

export const ModalFlavorContext = createContext<ModalFlavor>({});

export const useModalFlavor = (): ModalFlavor => useContext(ModalFlavorContext);
