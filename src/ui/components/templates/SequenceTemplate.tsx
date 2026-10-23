import React, { useMemo } from 'react';
import { WakandaForeverModal } from '../board/WakandaForeverModal';
import { Narration } from '../../theme/ComicSpeech';
import { ModalFlavorContext } from '../../theme/useModalFlavor';
import { useActionBurst } from '../../theme/useActionBurst';
import { WAKANDA_PROMPT, WAKANDA_UPGRADES } from './template-data';

export interface SequenceTemplateProps {
  onExecute?: (orderedIds: string[]) => void;
  onAction?: (message: string) => void;
}

/**
 * Archetype 2: Interactive sequence / pipeline (Wakanda Forever, Issue #358). The lab renders the
 * real `WakandaForeverModal` with a sample prompt, plus narration and a sound effect on execute.
 */
export const SequenceTemplate: React.FC<SequenceTemplateProps> = ({ onExecute, onAction }) => {
  const { burst, fire } = useActionBurst();

  const flavor = useMemo(
    () => ({
      burst,
      intro: <Narration>Wakanda stands as one... and the final strike lands hardest!</Narration>,
    }),
    [burst],
  );

  return (
    <ModalFlavorContext.Provider value={flavor}>
      <WakandaForeverModal
        prompt={WAKANDA_PROMPT}
        onExecuteSequence={(order) => {
          fire();
          onExecute?.(order);
          const names = order.map((id) => WAKANDA_UPGRADES.find((u) => u.id === id)?.name);
          onAction?.(`Executed: ${names.join(' → ')}`);
        }}
      />
    </ModalFlavorContext.Provider>
  );
};
