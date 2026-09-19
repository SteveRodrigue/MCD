import React, { useState } from 'react';
import { Skull, AlertTriangle, Eye, X } from 'lucide-react';
import { CardInstance } from '../../../engine/models';
import { useGameSettings } from '../../context/useGameSettings';
import { CardView } from './CardView';

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

  let isDevMode = devModeProp ?? false;
  try {
    const settings = useGameSettings();
    if (devModeProp === undefined && settings) {
      isDevMode = settings.devMode;
    }
  } catch {
    // Rendered outside GameSettingsProvider
  }

  if (!cards || cards.length === 0) {
    return null;
  }

  const tooltipText =
    'Dealt facedown. Will be revealed and resolved during Step 5 of the Villain Phase.';

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
          className={`w-28 h-40 rounded-lg border-2 border-comic-black shadow-comic-sm bg-gradient-to-b from-rose-950 via-slate-900 to-rose-950 text-white flex flex-col justify-between p-2 relative overflow-hidden transition-transform ${
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
          {/* Halftone / texture comic dots effect overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ED1D24_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

          {/* Top: Header & Icons */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1">
              <Skull className="w-3.5 h-3.5 text-comic-red" />
              <span className="font-comic text-[10px] tracking-wider text-rose-300 font-bold uppercase">
                ENCOUNTER
              </span>
            </div>
            {isDevMode ? (
              <span
                className="bg-amber-400 text-slate-950 font-comic text-[9px] px-1 py-0.2 rounded border border-comic-black font-bold flex items-center gap-0.5"
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
          <div className="flex flex-col items-center justify-center my-auto z-10">
            <div className="w-12 h-12 rounded-full border-2 border-comic-black bg-rose-700/80 flex items-center justify-center shadow-comic-xs">
              <Skull className="w-7 h-7 text-amber-300 drop-shadow-md" />
            </div>
            <span className="text-[9px] font-sans font-bold text-rose-200 mt-1 tracking-tight uppercase">
              {heroName ? `For ${heroName}` : 'Dealt'}
            </span>
          </div>

          {/* Bottom: Count Badge */}
          <div className="flex justify-center z-10">
            <span
              data-testid="facedown-count-badge"
              className="bg-amber-400 text-slate-950 font-comic text-[10px] px-2 py-0.5 rounded border border-comic-black font-bold shadow-comic-xs uppercase tracking-wide"
            >
              FACEDOWN ({cards.length})
            </span>
          </div>
        </div>
      </div>

      {/* Dev Mode Inspector / Peek Modal */}
      {isDevMode && isPeekOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsPeekOpen(false)}
          data-testid="facedown-peek-modal"
        >
          <div
            className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-2xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-500" />
                <div>
                  <h3 className="font-comic text-lg text-comic-black uppercase">
                    [DEV] Dealt Encounter Cards Peek ({cards.length})
                  </h3>
                  <p className="text-xs text-slate-600">
                    {heroName ? `Cards dealt to ${heroName}. ` : ''}
                    Will be revealed and resolved during Step 5 of the Villain Phase.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPeekOpen(false)}
                className="p-1 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
                aria-label="Close peek modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Card list */}
            <div className="flex flex-wrap items-center justify-center gap-4 py-2">
              {cards.map((cardInst, idx) => (
                <div key={cardInst.instanceId || idx} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <CardView
                      card={cardInst.card}
                      instance={cardInst}
                      size="sm"
                      enableHoverZoom={true}
                    />
                    <span className="absolute -top-2 -left-2 bg-slate-900 text-white font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black">
                      #{idx + 1}
                    </span>
                  </div>
                  <span className="font-bold text-xs text-slate-800 max-w-[120px] truncate text-center">
                    {cardInst.card.name}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">
                    {cardInst.card.type}
                  </span>
                </div>
              ))}
            </div>

            {/* Close button */}
            <div className="text-center pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsPeekOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-comic px-5 py-1.5 rounded-lg border-2 border-comic-black shadow-comic-sm text-sm cursor-pointer"
              >
                Close Peek
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
