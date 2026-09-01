import React, { useState } from 'react';
import { CardInstance } from '../../../engine/models';

export interface CardAttachmentFanProps {
  attachments?: CardInstance[];
  cardsUnderneath?: CardInstance[];
  onSelectAttachment?: (attachment: CardInstance) => void;
  className?: string;
}

export const CardAttachmentFan: React.FC<CardAttachmentFanProps> = ({
  attachments = [],
  cardsUnderneath = [],
  onSelectAttachment,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasAttachments = attachments.length > 0;
  const hasCardsUnderneath = cardsUnderneath.length > 0;

  if (!hasAttachments && !hasCardsUnderneath) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center w-full mt-1.5 space-y-1 ${className}`}>
      {/* 1. Tucked Face-Down Cards Underneath Badge (RR v1.8 p. 6) */}
      {hasCardsUnderneath && (
        <div
          className="flex items-center gap-1 px-2 py-0.5 bg-slate-900/90 text-amber-300 border-2 border-amber-400/80 rounded-md text-[10px] font-black uppercase tracking-wider shadow-md shadow-black/60"
          title="Face-down cards placed under this card (Out of play)"
        >
          <span>📦</span>
          <span>{cardsUnderneath.length} Underneath</span>
        </div>
      )}

      {/* 2. Face-Up Fan-Down Attachments (RR v1.8 p. 5) */}
      {hasAttachments && (
        <div className="w-full flex flex-col items-center">
          {/* Header pill / expand toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded border-2 border-slate-950 shadow-sm transition-all"
          >
            <span>📎 {attachments.length} Attached</span>
            <span>{isExpanded ? '▲ Less' : '▼ Details'}</span>
          </button>

          {/* Staggered Vertical Fan-Down Stack */}
          <div className="w-full mt-1 flex flex-col space-y-1">
            {attachments.map((att, idx) => {
              const modifier = att.card.enrichment?.abilities?.find((a) =>
                a.steps?.some((s) => s.effect === 'MODIFY_STAT'),
              );
              const statParam = modifier?.steps?.find((s) => s.effect === 'MODIFY_STAT')?.params;
              const hasAction = att.card.enrichment?.abilities?.some(
                (a) =>
                  a.timing === 'HERO_ACTION' ||
                  a.timing === 'ALTER_EGO_ACTION' ||
                  a.timing === 'ACTION' ||
                  a.steps?.some((s) => s.effect === 'DISCARD_ATTACHMENT'),
              );

              return (
                <div
                  key={att.instanceId || `att_${idx}`}
                  onClick={() => onSelectAttachment?.(att)}
                  className="flex flex-col bg-slate-900/95 border-2 border-slate-950 rounded p-1.5 shadow-md shadow-black/50 text-left transition-all hover:border-amber-400 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-[11px] text-amber-200 truncate">
                      {att.card.name}
                    </span>
                    {statParam && (
                      <span className="text-[10px] font-black px-1 py-0.2 bg-red-600 text-white rounded border border-slate-950">
                        +{String(statParam.amount)} {String(statParam.stat || '').substring(0, 3)}
                      </span>
                    )}
                  </div>

                  {/* Attachment ability summary if expanded */}
                  {isExpanded && (
                    <div className="mt-1 text-[9px] text-slate-300 line-clamp-2 italic font-mono bg-slate-950/60 p-1 rounded">
                      {att.card.text || 'Attached modifier card.'}
                    </div>
                  )}

                  {hasAction && (
                    <div className="mt-1 flex items-center justify-end">
                      <span className="text-[9px] font-black text-amber-400 bg-amber-950/80 px-1 py-0.5 rounded border border-amber-500/40">
                        ⚡ Action Available
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
