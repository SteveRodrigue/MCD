import React, { useMemo } from 'react';
import { SelectCardsModal } from '../board/SelectCardsModal';
import { SpeechBubble } from '../../theme/ComicSpeech';
import { ModalFlavorContext } from '../../theme/useModalFlavor';
import { useActionBurst } from '../../theme/useActionBurst';
import { SELECT_POOL, SELECT_PROMPT, SPIDER_MAN } from './template-data';

export interface SelectTemplateProps {
  onAction?: (message: string) => void;
}

/**
 * Archetype 3: Card multi-selection. The lab renders the real `SelectCardsModal` with a sample
 * search prompt, plus a speech bubble and a sound effect on confirm.
 */
export const SelectTemplate: React.FC<SelectTemplateProps> = ({ onAction }) => {
  const { burst, fire } = useActionBurst();

  const flavor = useMemo(
    () => ({
      burst,
      intro: <SpeechBubble speaker={SPIDER_MAN}>Who should I call in as backup?</SpeechBubble>,
    }),
    [burst],
  );

  return (
    <ModalFlavorContext.Provider value={flavor}>
      <SelectCardsModal
        prompt={SELECT_PROMPT}
        onConfirm={(ids) => {
          fire();
          const names = ids.map((id) => SELECT_POOL.find((c) => c.id === id)?.name);
          onAction?.(`Confirmed: ${names.join(', ')}`);
        }}
      />
    </ModalFlavorContext.Provider>
  );
};
