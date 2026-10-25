import React from 'react';
import { ModalLayer } from '../layout/ModalLayer';
import { Newspaper, Eye } from 'lucide-react';
import { LegalActionItem } from '../../../engine/pipeline/legal-actions-generator';
import { NewsStory, NewspaperSheet } from '../../theme/kit/newspaper';
import { ThemedButton } from '../../theme/kit/controls';

interface EndTurnConfirmationModalProps {
  isOpen: boolean;
  playerName: string;
  turnAction?: LegalActionItem;
  onConfirmEndTurn: () => void;
  onDismiss: () => void;
}

export const EndTurnConfirmationModal: React.FC<EndTurnConfirmationModalProps> = ({
  isOpen,
  playerName,
  turnAction,
  onConfirmEndTurn,
  onDismiss,
}) => {
  if (!isOpen || !turnAction) return null;

  return (
    <ModalLayer className="inset-0 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200">
      <NewspaperSheet
        className="w-full max-w-md"
        edition="Press flash"
        issue="Final edition"
        flash="PRESS RUN COMPLETE!"
      >
        <NewsStory
          headline={`All actions resolved for ${playerName}`}
          standfirst="You have exhausted your character and played all available cards from hand. No further legal moves remain."
        >
          Ready to conclude your turn?
        </NewsStory>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <ThemedButton
            variant="secondary"
            onClick={onDismiss}
            className="flex-1"
            icon={<Eye className="w-3.5 h-3.5" />}
          >
            Review Board
          </ThemedButton>
          <ThemedButton
            variant="primary"
            onClick={onConfirmEndTurn}
            className="flex-1"
            icon={<Newspaper className="w-3.5 h-3.5" />}
          >
            {turnAction.headline}
          </ThemedButton>
        </div>
      </NewspaperSheet>
    </ModalLayer>
  );
};

export default EndTurnConfirmationModal;
