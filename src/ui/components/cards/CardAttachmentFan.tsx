import React from 'react';
import { CardInstance } from '../../../engine/models';
import { CardView } from './CardView';

export interface CardAttachmentFanProps {
  attachments?: CardInstance[];
  cardsUnderneath?: CardInstance[];
  onSelectAttachment?: (attachment: CardInstance) => void;
  mode?: 'vertical' | 'staircase';
  className?: string;
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
  mode = 'vertical',
  className = '',
}) => {
  const hasAttachments = attachments.length > 0;
  const hasCardsUnderneath = cardsUnderneath.length > 0;

  if (!hasAttachments && !hasCardsUnderneath) {
    return null;
  }

  return (
    <div
      className={
        mode === 'staircase'
          ? `pointer-events-none ${className}`
          : `flex flex-col items-center w-full relative ${className}`
      }
    >
      {/* 2. Staircase Fan-Down Mode (Issue #83 & #84) */}
      {hasAttachments && mode === 'staircase' && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {attachments.map((att, idx) => {
            const hasAction = att.card.enrichment?.abilities?.some(
              (a) =>
                a.timing === 'HERO_ACTION' ||
                a.timing === 'ALTER_EGO_ACTION' ||
                a.timing === 'ACTION' ||
                a.steps?.some((s) => s.effect === 'DISCARD_ATTACHMENT'),
            );

            // Stacking behind host: Host is z-30.
            // Att 0 (idx=0) is z-20, Att 1 (idx=1) is z-10, etc.
            const zIndex = (attachments.length - idx) * 10;
            const topOffset = `${(idx + 1) * 42}%`;
            const leftOffset = `${(idx + 1) * -11}%`;

            return (
              <div
                key={att.instanceId || `att_${idx}`}
                className="absolute transition-all duration-200 pointer-events-auto group/att hover:z-40"
                style={{
                  top: topOffset,
                  left: leftOffset,
                  zIndex,
                }}
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
                    <div className="absolute bottom-1 right-1 z-30 pointer-events-none">
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

      {/* 2b. Facedown cards underneath are only a reminder: they peek out a few pixels behind the host */}
      {hasCardsUnderneath && mode === 'staircase' && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {cardsUnderneath.map((tucked, i) => (
            <div
              key={tucked.instanceId || `under_${i}`}
              className="absolute pointer-events-none"
              style={{
                top: `${(i + 1) * FACEDOWN_PEEK_TOP_PERCENT}%`,
                left: `${(i + 1) * -FACEDOWN_PEEK_LEFT_PERCENT}%`,
                zIndex: cardsUnderneath.length - i,
              }}
            >
              <FacedownUnderneathCard card={tucked} />
            </div>
          ))}
        </div>
      )}

      {/* 3. Vertical Stack Mode (Original fallback / VillainZone / Player Identity) */}
      {hasAttachments && mode === 'vertical' && (
        <div className="flex flex-col items-center w-full -mt-5 sm:-mt-6">
          <div className="flex flex-col items-center w-full">
            {attachments.map((att, idx) => {
              const modifier = att.card.enrichment?.abilities?.find((a) =>
                a.steps?.some((s) => s.effect === 'MODIFY_STAT'),
              );
              const statParam = modifier?.steps?.find(
                (s) => s.effect === 'MODIFY_STAT',
              )?.effectParams;
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
                  className={`relative flex flex-col items-center transition-all duration-200 ${
                    idx > 0 ? '-mt-24 sm:-mt-28 hover:z-40' : 'hover:z-40'
                  }`}
                  style={{ zIndex: 10 + idx }}
                >
                  {/* Top Badge: Name & Stat Modifier Pill */}
                  <div className="flex items-center gap-1 mb-0.5 bg-slate-950/90 text-white border border-comic-black rounded px-1.5 py-0.5 shadow-comic-sm z-20">
                    <span className="font-comic text-[9px] text-amber-300 font-bold truncate max-w-[90px]">
                      {att.card.name}
                    </span>
                    {statParam && (
                      <span className="bg-comic-red text-white font-comic text-[8px] px-1 rounded font-bold">
                        +{String(statParam.amount)} {String(statParam.stat || '').substring(0, 3)}
                      </span>
                    )}
                  </div>

                  {/* Authentic CardView with Dynamic Hover Zoom */}
                  <div
                    onClick={() => onSelectAttachment?.(att)}
                    className="cursor-pointer relative"
                  >
                    <CardView
                      card={att.card}
                      instance={att}
                      isExhausted={att.exhausted ?? false}
                      size="sm"
                      enableHoverZoom={true}
                      zoomOrigin="bottom"
                    />

                    {/* Interactive Action Available Badge */}
                    {hasAction && (
                      <div className="absolute bottom-1 right-1 z-30 pointer-events-none">
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
        </div>
      )}

      {/* 3b. Facedown cards underneath: only a thin strip of each card back shows (a reminder) */}
      {hasCardsUnderneath && mode === 'vertical' && (
        <div className="flex flex-col items-center w-full">
          {cardsUnderneath.map((tucked, i) => (
            <div key={tucked.instanceId || `under_${i}`} className="relative h-3 overflow-hidden">
              <FacedownUnderneathCard card={tucked} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
