import React, { useState } from 'react';
import { Skull, AlertTriangle, Eye } from 'lucide-react';
import { CardInstance } from '../../../engine/models';
import { useOptionalGameSettings } from '../../context/useGameSettings';
import { PileCardTile, PileGrid, PileViewerModal } from '../board/PileViewerModal';
import { getCardBackFallbackColor } from '../../services/card-cache-service';
import { cardBackUrl } from '../../../data/content/card-art';

export interface FacedownEncounterCardProps {
  cards: CardInstance[];
  heroName?: string;
  devMode?: boolean;
}

export const FacedownEncounterCard: React.FC<FacedownEncounterCardProps> = ({
  cards,
  heroName,
  devMode: devModeProp,
}) => {
  const [isPeekOpen, setIsPeekOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const settings = useOptionalGameSettings();
  const isDevMode = devModeProp ?? settings?.devMode ?? false;

  if (!cards || cards.length === 0) {
    return null;
  }

  const tooltipText =
    'Dealt facedown. Will be revealed and resolved during Step 4 of the Villain Phase.';

  const handleCardClick = () => {
    if (isDevMode) {
      setIsPeekOpen(true);
    }
  };

  return (
    <>
      <div
        className="relative group select-none shrink-0"
        data-testid="facedown-encounter-card"
        title={tooltipText}
      >
        {/* Stack shadow layers if multiple cards */}
        {cards.length > 1 && (
          <div className="absolute inset-0 translate-x-1 translate-y-1 bg-slate-800 rounded-lg border-2 border-comic-black -z-10" />
        )}
        {cards.length > 2 && (
          <div className="absolute inset-0 translate-x-2 translate-y-2 bg-rose-900 rounded-lg border-2 border-comic-black -z-20" />
        )}

        <div
          onClick={handleCardClick}
          style={{
            backgroundColor: getCardBackFallbackColor('encounter'),
          }}
          className={`w-28 h-40 rounded-lg border-2 border-comic-black shadow-comic-sm text-white flex flex-col justify-between p-2 relative overflow-hidden transition-transform ${
            isDevMode
              ? 'cursor-pointer hover:scale-[1.02] hover:border-amber-400 active:scale-[0.98]'
              : 'cursor-default'
          }`}
          role={isDevMode ? 'button' : 'region'}
          aria-label={`Facedown Encounter Cards (${cards.length})${isDevMode ? ' - Click to inspect' : ''}`}
          tabIndex={isDevMode ? 0 : undefined}
          onKeyDown={(e) => {
            if (isDevMode && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsPeekOpen(true);
            }
          }}
        >
          {/* Card Back Image or Fallback Background */}
          {!imageError ? (
            <img
              src={cardBackUrl('encounter')}
              alt="Encounter Card Back"
              onError={() => setImageError(true)}
              className="absolute inset-0 w-full h-full object-cover"
              data-testid="facedown-card-back-image"
            />
          ) : (
            <div
              className="absolute inset-0 w-full h-full"
              style={{ backgroundColor: getCardBackFallbackColor('encounter') }}
              data-testid="facedown-card-back-fallback"
            />
          )}

          {/* Top: Header & Icons */}
          <div className="flex items-center justify-between z-content bg-slate-950/80 px-1.5 py-0.5 rounded-sm border border-comic-black shadow-comic-xs backdrop-blur-xs">
            <div className="flex items-center gap-1">
              <Skull className="w-3.5 h-3.5 text-comic-red" />
              <span className="text-micro tracking-wider text-rose-300 font-bold uppercase">
                ENCOUNTER
              </span>
            </div>
            {isDevMode ? (
              <span
                className="bg-amber-400 text-slate-950 text-nano px-1 py-0.2 rounded-sm border border-comic-black font-bold flex items-center gap-0.5"
                title="Dev Mode Peek Available"
              >
                <Eye className="w-2.5 h-2.5" />
                PEEK
              </span>
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>

          {/* Center: Comic Emblem */}
          <div className="flex flex-col items-center justify-center my-auto z-content">
            <div className="w-10 h-10 rounded-full border-2 border-comic-black bg-rose-700/90 flex items-center justify-center shadow-comic-xs">
              <Skull className="w-6 h-6 text-amber-300 drop-shadow-md" />
            </div>
            <span className="text-nano font-sans font-bold text-rose-100 mt-1 tracking-tight uppercase bg-slate-950/80 px-1.5 py-0.5 rounded-sm border border-comic-black">
              {heroName ? `For ${heroName}` : 'Dealt'}
            </span>
          </div>

          {/* Bottom: Count Badge */}
          <div className="flex justify-center z-content">
            <span
              data-testid="facedown-count-badge"
              className="bg-amber-400 text-slate-950 text-micro px-2 py-0.5 rounded-sm border border-comic-black font-bold shadow-comic-xs uppercase tracking-wide"
            >
              FACEDOWN ({cards.length})
            </span>
          </div>
        </div>
      </div>

      {/* Dev Mode Inspector / Peek Modal */}
      {isDevMode && isPeekOpen && (
        <PileViewerModal
          title={`[DEV] Dealt Encounter Cards Peek (${cards.length})`}
          description={`${heroName ? `Cards dealt to ${heroName}. ` : ''}Will be revealed and resolved during Step 4 of the Villain Phase.`}
          icon={<Eye className="w-5 h-5" />}
          verb="yellow"
          devBadge
          closeLabel="Close Peek"
          onClose={() => setIsPeekOpen(false)}
          closeOnBackdrop
          maxWidthClass="max-w-2xl"
          testId="facedown-peek-modal"
        >
          <PileGrid>
            {cards.map((cardInst, idx) => (
              <PileCardTile
                key={cardInst.instanceId || idx}
                instance={cardInst}
                rank={idx + 1}
                label={cardInst.card.name}
              >
                <span className="text-micro uppercase font-semibold opacity-70">
                  {cardInst.card.type}
                </span>
              </PileCardTile>
            ))}
          </PileGrid>
        </PileViewerModal>
      )}
    </>
  );
};
