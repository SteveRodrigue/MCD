import React, { useState } from 'react';
import { CardInstance } from '../../../engine/models';
import { CardView } from './CardView';
import { getFanZIndex } from './fan-z';

export interface CardAttachmentFanProps {
  attachments?: CardInstance[];
  cardsUnderneath?: CardInstance[];
  onSelectAttachment?: (attachment: CardInstance) => void;
  className?: string;
  children: React.ReactNode;
}

// Small offsets (percent of the host card) so facedown cards read as a stack, not as visible cards.
const FACEDOWN_PEEK_TOP_PERCENT = 6;
const FACEDOWN_PEEK_LEFT_PERCENT = 3;

const FacedownUnderneathCard: React.FC<{ card: CardInstance }> = ({ card }) => (
  <div
    title={card.ownerId ? `Facedown card (${card.ownerId})` : 'Facedown card'}
    data-testid="underneath-facedown-card"
  >
    {/* Facedown: only the card back is rendered, never the front (hidden information) */}
    <CardView card={card.card} instance={card} size="sm" isFacedown />
  </div>
);

export const CardAttachmentFan: React.FC<CardAttachmentFanProps> = ({
  attachments = [],
  cardsUnderneath = [],
  onSelectAttachment,
  className = '',
  children,
}) => {
  const [hoveredAttachmentId, setHoveredAttachmentId] = useState<string | null>(null);
  const n = attachments.length;
  const m = cardsUnderneath.length;

  // Local order (isolated): underneath 1..m < attachments m+1..m+n < host m+n+1 < hovered attachment m+n+2.
  return (
    <div
      className={`relative isolate flex flex-col items-center hover:z-zoom focus-within:z-zoom ${className}`}
    >
      <div className="relative flex flex-col items-center" style={{ zIndex: m + n + 1 }}>
        {children}
      </div>
      <div className="pointer-events-none">
        {/* Staircase Fan-Down Mode (Issue #83 & #84) */}
        {n > 0 && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {attachments.map((att, idx) => {
              const hasAction = att.card.enrichment?.abilities?.some(
                (a) =>
                  a.timing === 'HERO_ACTION' ||
                  a.timing === 'ALTER_EGO_ACTION' ||
                  a.timing === 'ACTION',
              );

              const key = att.instanceId || `att_${idx}`;
              const topOffset = `${(idx + 1) * 42}%`;
              const leftOffset = `${(idx + 1) * -11}%`;

              return (
                <div
                  key={key}
                  className="absolute transition-all duration-200 pointer-events-auto group/att"
                  style={{
                    top: topOffset,
                    left: leftOffset,
                    zIndex: hoveredAttachmentId === key ? m + n + 2 : m + getFanZIndex(n, idx),
                  }}
                  onMouseEnter={() => setHoveredAttachmentId(key)}
                  onMouseLeave={() => setHoveredAttachmentId(null)}
                >
                  {/* CardView with Dynamic Hover Zoom (unrotated even if host exhausted) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAttachment?.(att);
                    }}
                    className="cursor-pointer relative"
                  >
                    <CardView
                      card={att.card}
                      instance={att}
                      isExhausted={att.exhausted ?? false}
                      size="sm"
                      enableHoverZoom={true}
                      zoomOrigin="bottom-left"
                    />

                    {/* Interactive Action Available Badge */}
                    {hasAction && (
                      <div className="absolute bottom-1 right-1 z-raised pointer-events-none">
                        <span className="bg-amber-400 text-slate-950 font-comic text-[8px] font-black px-1.5 py-0.5 rounded border border-comic-black shadow-comic-sm animate-bounce">
                          ⚡ ACTION
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Facedown cards underneath are only a reminder: they peek out a few pixels behind the host */}
        {m > 0 && (
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {cardsUnderneath.map((tucked, i) => (
              <div
                key={tucked.instanceId || `under_${i}`}
                className="absolute pointer-events-none"
                style={{
                  top: `${(i + 1) * FACEDOWN_PEEK_TOP_PERCENT}%`,
                  left: `${(i + 1) * -FACEDOWN_PEEK_LEFT_PERCENT}%`,
                  zIndex: getFanZIndex(m, i),
                }}
              >
                <FacedownUnderneathCard card={tucked} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
