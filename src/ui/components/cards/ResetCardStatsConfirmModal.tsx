import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { NormalizedCard } from '../../../engine/models';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';

interface ResetCardStatsConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  card?: NormalizedCard;
  isAll?: boolean;
  onConfirm: () => void | Promise<void>;
}

export const ResetCardStatsConfirmModal: React.FC<ResetCardStatsConfirmModalProps> = ({
  isOpen,
  onClose,
  card,
  isAll = false,
  onConfirm,
}) => {
  const { style } = useModalStyle();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isAll ? 'Reset all stats' : 'Reset card stats';

  return (
    <ModalScaffold
      title={title}
      kicker="Confirm"
      verb="red"
      trigger={card ? { name: card.name, code: card.code } : null}
      icon={<AlertTriangle className="w-5 h-5 animate-bounce" />}
      onClose={isSubmitting ? undefined : onClose}
      maxWidthClass="max-w-md"
      testId="reset-card-stats-confirm-modal"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`ml-auto px-4 py-2 text-xs font-bold cursor-pointer ${style.btnMove}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold uppercase rounded-lg border-2 border-comic-black bg-comic-red hover:bg-rose-600 text-white shadow-comic-sm cursor-pointer transition-transform active:scale-95 flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Resetting...' : 'Reset'}</span>
          </button>
        </>
      }
    >
      <div className={`p-3 text-xs leading-relaxed ${style.inset}`}>
        {isAll ? (
          <p>
            Are you sure you want to reset{' '}
            <span className="font-bold text-comic-red">all-time play stats for all cards</span>?
            This will delete all historical play counts, ability usages, and basic action logs.
            <br />
            <span className="font-black text-rose-600 uppercase">
              This action cannot be undone.
            </span>
          </p>
        ) : (
          <p>
            This clears all recorded plays, ability triggers and basic action usages of this card.
            <br />
            <span className="font-black text-rose-600 uppercase">
              This action cannot be undone.
            </span>
          </p>
        )}
      </div>
    </ModalScaffold>
  );
};
