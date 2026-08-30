import React from 'react';
import { Newspaper, Eye } from 'lucide-react';
import { LegalActionItem } from '../../../engine/pipeline/legal-actions-generator';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200">
      {/* Vintage 1960s Tabloid Press Flash */}
      <div className="relative w-full max-w-md bg-[#fbf7ee] text-slate-900 border-4 border-slate-950 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-sm overflow-hidden flex flex-col font-serif">
        {/* Masthead Flash */}
        <div className="bg-amber-300 border-b-2 border-slate-950 p-3 text-center select-none">
          <div className="flex justify-between items-center text-[9px] uppercase tracking-widest text-slate-800 font-bold border-b border-slate-900 pb-0.5 mb-1">
            <span>EXTRA! EXTRA!</span>
            <span className="font-comic text-comic-red font-black">★ THE DAILY BUGLE ★</span>
            <span>PRESS FLASH</span>
          </div>

          <h2 className="text-2xl font-black uppercase tracking-tight font-serif text-slate-950 leading-none">
            PRESS RUN COMPLETE!
          </h2>
          <p className="text-[11px] font-comic font-bold text-slate-800 uppercase mt-1">
            All Actions Resolved for {playerName}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 text-center space-y-3">
          <div className="p-3 bg-white/90 border border-slate-700 rounded shadow-xs">
            <p className="text-xs text-slate-800 font-serif leading-relaxed">
              You have exhausted your character and played all available cards from hand. No further legal moves remain.
            </p>
            <p className="text-[11px] font-comic font-bold text-comic-blue mt-1">
              Ready to conclude your turn?
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={onDismiss}
              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-comic text-xs py-2 px-3 rounded border-2 border-slate-900 shadow-sm active:translate-y-0.5 font-bold cursor-pointer flex items-center justify-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Review Board</span>
            </button>

            <button
              onClick={onConfirmEndTurn}
              className="flex-1 bg-comic-red hover:bg-red-700 text-white font-comic text-xs py-2 px-3 rounded border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 font-bold cursor-pointer flex items-center justify-center gap-1 uppercase"
            >
              <Newspaper className="w-3.5 h-3.5" />
              <span>{turnAction.headline}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EndTurnConfirmationModal;
