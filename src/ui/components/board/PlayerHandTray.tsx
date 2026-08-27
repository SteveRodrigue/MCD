import React from 'react';
import { CardInstance } from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { Sparkles } from 'lucide-react';

interface PlayerHandTrayProps {
  hand: CardInstance[];
  heroName: string;
  handSizeLimit: number;
  onCardClick?: (cardInst: CardInstance) => void;
}

export const PlayerHandTray: React.FC<PlayerHandTrayProps> = ({
  hand,
  heroName,
  handSizeLimit,
  onCardClick,
}) => {
  return (
    <footer className="w-full bg-amber-100/90 border-t-3 border-comic-black shadow-comic p-4 z-20">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Hand Header Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-comic-yellow text-comic-black border border-comic-black font-comic text-xs px-2.5 py-0.5 rounded shadow-comic-sm">
              PLAYER HAND ({hand.length} / {handSizeLimit})
            </span>
            <span className="font-comic text-sm text-comic-blue">
              {heroName}'s Current Hand
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-600">
            <Sparkles className="w-3.5 h-3.5 text-comic-yellow" />
            <span>Hover card to zoom (1.9×)</span>
          </div>
        </div>

        {/* Hand Cards Horizontal Scroll / Fan Row */}
        <div className="flex items-center justify-center gap-4 overflow-x-auto py-2 px-2 min-h-[290px]">
          {hand.map((cardInst) => (
            <CardView
              key={cardInst.instanceId}
              card={cardInst.card}
              instance={cardInst}
              size="md"
              enableHoverZoom={true}
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
    </footer>
  );
};

export default PlayerHandTray;
