import React, { useMemo } from 'react';
import { DecisionPromptModal } from '../board/DecisionPromptModal';
import { CardRef } from '../../theme/CardRef';
import { Narration, SpeechBubble } from '../../theme/ComicSpeech';
import { ModalFlavorContext } from '../../theme/useModalFlavor';
import { useActionBurst } from '../../theme/useActionBurst';
import { ATTACKER, SANDMAN, decisionPrompt } from './template-data';

export interface DecisionTemplateProps {
  /** Forced interrupts cannot be passed; the header turns red. */
  forced?: boolean;
  onAction?: (message: string) => void;
}

/**
 * Archetype 1: Decision / action prompt. The lab renders the real `DecisionPromptModal` with a
 * sample defense prompt and lays comic flavour (narration, a villain's speech bubble, a sound
 * effect on choice) over it through the modal flavor context.
 */
export const DecisionTemplate: React.FC<DecisionTemplateProps> = ({ forced = false, onAction }) => {
  const { burst, fire } = useActionBurst();
  const prompt = useMemo(() => decisionPrompt(forced), [forced]);

  const flavor = useMemo(
    () => ({
      burst,
      intro: (
        <>
          <Narration>
            {forced ? (
              'Meanwhile... there is no time to think!'
            ) : (
              <>
                Meanwhile, at the docks... <CardRef {...SANDMAN} /> lurks nearby.
              </>
            )}
          </Narration>
          <SpeechBubble speaker={ATTACKER}>
            {forced ? 'No dodging this one, hero! RAAAGH!' : 'Out of my way, little hero! RAAAGH!'}
          </SpeechBubble>
        </>
      ),
    }),
    [burst, forced],
  );

  return (
    <ModalFlavorContext.Provider value={flavor}>
      <DecisionPromptModal
        prompt={prompt}
        onSelectOption={(optionId) => {
          fire();
          onAction?.(`Chose: ${optionId}`);
        }}
      />
    </ModalFlavorContext.Provider>
  );
};
