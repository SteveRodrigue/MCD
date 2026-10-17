import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { ModalLayer } from '../layout/ModalLayer';
import { NormalizedCard } from '../../../engine/models';

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

  const title = isAll ? 'RESET ALL STATS' : `RESET STATS: ${card?.name || 'CARD'}`;

  return (
    <ModalLayer className="fixed inset-0 bg-comic-black/85 z-modal flex items-center justify-center p-4 backdrop-blur-xs font-comic">
      <div
        className="bg-comic-paper border-4 border-comic-black max-w-md w-full rounded-xl shadow-comic-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-comic-red px-5 py-3 border-b-4 border-comic-black flex items-center justify-between text-white select-none">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-comic-yellow shrink-0 animate-bounce" />
            <h3 className="font-bangers text-xl tracking-wide uppercase text-white truncate">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-comic-yellow p-1 transition-colors cursor-pointer"
            title="Cancel"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-comic-black">
          <div className="p-3 bg-amber-100/80 border-2 border-comic-black rounded-lg text-xs leading-relaxed text-slate-800">
            {isAll ? (
              <p>
                Are you sure you want to reset{' '}
                <span className="font-bold text-comic-red">all-time play stats for all cards</span>?
                This will delete all historical play counts, ability usages, and basic action logs.
                <br />
                <span className="font-black text-rose-700 uppercase">
                  This action cannot be undone.
                </span>
              </p>
            ) : (
              <p>
                Are you sure you want to reset all play stats for{' '}
                <span className="font-bold text-comic-black">
                  {card?.name} ({card?.code})
                </span>
                ? This will clear all recorded plays, ability triggers, and basic action usages for
                this card.
                <br />
                <span className="font-black text-rose-700 uppercase">
                  This action cannot be undone.
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-amber-50 border-t-2 border-comic-black flex items-center justify-end gap-3 select-none">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold font-comic rounded-lg border-2 border-comic-black bg-white hover:bg-slate-100 text-comic-black shadow-comic-sm cursor-pointer transition-transform active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold font-comic uppercase rounded-lg border-2 border-comic-black bg-comic-red hover:bg-rose-600 text-white shadow-comic-sm cursor-pointer transition-transform active:scale-95 flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {isSubmitting ? 'Resetting...' : isAll ? 'Reset All Stats' : 'Reset Card Stats'}
            </span>
          </button>
        </div>
      </div>
    </ModalLayer>
  );
};
