import React from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { CardInstance } from '../../../engine/models';
import { CardView } from '../cards/CardView';

interface PlayerHandTrayProps {
  hand: CardInstance[];
  deckCount: number;
  discard: CardInstance[];
  heroName: string;
  handSizeLimit: number;
  onCardClick?: (cardInst: CardInstance) => void;
}

export const PlayerHandTray: React.FC<PlayerHandTrayProps> = ({
  hand,
  deckCount,
  discard,
  heroName,
  handSizeLimit,
  onCardClick,
}) => {
  const topDiscard = discard[discard.length - 1];

  return (
    <footer className="w-full bg-amber-100/95 border-t-3 border-comic-black shadow-comic p-4 z-20 sticky bottom-0 overflow-visible">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-6 overflow-visible">
        {/* 1. Player Deck & Discard Piles (At the Left of Hand of Cards!) */}
        <div className="flex items-center gap-3 bg-white/90 p-2.5 rounded-xl border-2 border-comic-black shadow-comic-sm shrink-0">
          {/* Draw Pile */}
          <div className="flex flex-col items-center">
            <div className="w-18 h-26 sm:w-20 sm:h-28 bg-comic-blue border-2 border-comic-black rounded-lg shadow-comic-sm flex flex-col items-center justify-center p-2 text-center relative overflow-hidden bg-bendy-dots">
              <Layers className="w-5 h-5 text-white mb-1" />
              <span className="font-comic text-lg text-white leading-none">{deckCount}</span>
              <span className="text-[9px] font-bold text-sky-200 uppercase">DECK</span>
            </div>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center">
            {topDiscard ? (
              <div className="relative">
                <CardView card={topDiscard.card} size="sm" showTokens={false} enableHoverZoom={true} zoomOrigin="bottom" />
                <span className="absolute -bottom-2 -right-2 bg-slate-900 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                  {discard.length}
                </span>
              </div>
            ) : (
              <div className="w-18 h-26 sm:w-20 sm:h-28 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-1">
                <span className="font-comic text-xs text-slate-400">DISCARD</span>
                <span className="text-[10px] text-slate-400 font-bold">EMPTY</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Hand Cards Area (Unconstrained Z-Axis Elevation) */}
        <div className="flex-1 w-full space-y-2 overflow-visible">
          {/* Hand Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-comic-yellow text-comic-black border border-comic-black font-comic text-xs px-2.5 py-0.5 rounded shadow-comic-sm font-bold">
                HAND ({hand.length} / {handSizeLimit})
              </span>
              <span className="font-comic text-sm text-comic-blue">
                {heroName}'s Hand
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-600">
              <Sparkles className="w-3.5 h-3.5 text-comic-yellow" />
              <span>Hover card to zoom (1.9×)</span>
            </div>
          </div>

          {/* Horizontal Hand of Cards (Unconstrained Z-Axis Elevation) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center sm:justify-start gap-4 overflow-visible py-2 px-2 min-h-[290px]">
            {hand.map((cardInst) => (
              <CardView
                key={cardInst.instanceId}
                card={cardInst.card}
                instance={cardInst}
                size="md"
                enableHoverZoom={true}
                zoomOrigin="bottom"
                onClick={() => onCardClick && onCardClick(cardInst)}
              />
            ))}

            {hand.length === 0 && (
              <div className="w-full py-8 text-center border-2 border-dashed border-slate-300 rounded-xl bg-white/60">
                <span className="font-comic text-base text-slate-400">
                  Hand is empty. (Cards will be drawn at the end of the round during Upkeep).
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PlayerHandTray;
