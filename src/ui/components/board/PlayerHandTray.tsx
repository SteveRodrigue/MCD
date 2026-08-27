import React, { useState } from 'react';
import { Layers, Sparkles, Skull, X, Eye } from 'lucide-react';
import { CardInstance } from '../../../engine/models';
import { CardView } from '../cards/CardView';

interface PlayerHandTrayProps {
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  setAsideCards?: CardInstance[];
  heroName: string;
  handSizeLimit: number;
  onCardClick?: (cardInst: CardInstance) => void;
}

export const PlayerHandTray: React.FC<PlayerHandTrayProps> = ({
  hand,
  deck,
  discard,
  setAsideCards = [],
  heroName,
  handSizeLimit,
  onCardClick,
}) => {
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showNemesisModal, setShowNemesisModal] = useState(false);

  const topDiscard = discard[discard.length - 1];
  const nemesisMinion =
    setAsideCards.find((c) => c.card.type === 'minion' || (c.card as any).type_code === 'minion') ||
    setAsideCards[0];

  return (
    <>
      <footer className="w-full bg-amber-100/95 border-t-3 border-comic-black shadow-comic p-4 z-20 sticky bottom-0 overflow-visible">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-6 overflow-visible">
          {/* 1. Player Deck & Discard Piles (Left of Hand) */}
          <div className="flex items-center gap-3 bg-white/90 p-2.5 rounded-xl border-2 border-comic-black shadow-comic-sm shrink-0">
            {/* Draw Pile (Face-Down Default • Click to Inspect in Dev Mode) */}
            <div
              onClick={() => setShowDeckModal(true)}
              className="flex flex-col items-center group cursor-pointer"
              title="Inspect Player Deck (Dev Mode - Search/Scry)"
            >
              <div className="w-18 h-26 sm:w-20 sm:h-28 bg-comic-blue border-2 border-comic-black rounded-lg shadow-comic-sm flex flex-col items-center justify-center p-2 text-center relative overflow-hidden bg-bendy-dots group-hover:border-comic-yellow transition-all">
                <Layers className="w-5 h-5 text-white mb-1 group-hover:scale-110 transition-transform" />
                <span className="font-comic text-lg text-white leading-none">{deck.length}</span>
                <span className="text-[9px] font-bold text-sky-200 uppercase">DECK</span>
              </div>
            </div>

            {/* Discard Pile (Open Information • Click to Inspect) */}
            <div className="flex flex-col items-center">
              {topDiscard ? (
                <div
                  onClick={() => setShowDiscardModal(true)}
                  className="relative cursor-pointer group"
                  title="Inspect Player Discard Pile"
                >
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

          {/* 2. Hand Cards Area (Center) */}
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

          {/* 3. Out of Play / Nemesis Set Area (Right of Hand - Displays Nemesis Minion!) */}
          <div className="flex flex-col items-center gap-1 bg-white/90 p-2.5 rounded-xl border-2 border-comic-black shadow-comic-sm shrink-0">
            <span className="text-[10px] font-bold text-slate-600 uppercase font-comic">
              OUT OF PLAY
            </span>

            {nemesisMinion ? (
              <div
                onClick={() => setShowNemesisModal(true)}
                className="relative cursor-pointer group flex flex-col items-center"
                title="Click to view all Set-Aside Nemesis cards (Out of Play)"
              >
                <CardView
                  card={nemesisMinion.card}
                  size="sm"
                  showTokens={false}
                  enableHoverZoom={true}
                  zoomOrigin="bottom"
                />
                <span className="absolute -bottom-2 -right-2 bg-rose-700 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                  {setAsideCards.length}
                </span>
              </div>
            ) : (
              <div className="w-18 h-26 sm:w-20 sm:h-28 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-1">
                <span className="font-comic text-xs text-slate-400">EMPTY</span>
                <span className="text-[9px] text-slate-400 font-bold">OUT OF PLAY</span>
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* Player Deck Inspector Modal (Dev Mode) */}
      {showDeckModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-6 h-6 text-comic-blue" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-comic text-xl text-comic-black uppercase">
                      Player Deck Inspector ({deck.length} Cards)
                    </h3>
                    <span className="bg-comic-blue text-white border border-comic-black font-comic text-[10px] px-2 py-0.5 rounded font-bold">
                      DEV MODE
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Cards are listed in exact draw order from Top of Deck (first) to Bottom of Deck (last).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeckModal(false)}
                className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 py-4">
              {deck.map((cardInst, idx) => (
                <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <CardView card={cardInst.card} instance={cardInst} size="sm" enableHoverZoom={true} />
                    <span className="absolute -top-2 -left-2 bg-slate-900 text-sky-300 font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black">
                      #{idx + 1}
                    </span>
                  </div>
                  <span className="font-comic text-[11px] text-slate-700 truncate max-w-[110px] text-center">
                    {cardInst.card.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-center pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowDeckModal(false)}
                className="comic-button-primary px-6 py-2 text-sm font-comic cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Discard Pile Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-6 h-6 text-comic-blue" />
                <div>
                  <h3 className="font-comic text-xl text-comic-black uppercase">
                    Player Discard Pile ({discard.length} Cards)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Discard piles are open information. Listed in discard order.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDiscardModal(false)}
                className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 py-4">
              {discard.map((cardInst, idx) => (
                <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <CardView card={cardInst.card} instance={cardInst} size="sm" enableHoverZoom={true} />
                    <span className="absolute -top-2 -left-2 bg-slate-900 text-white font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black">
                      #{idx + 1}
                    </span>
                  </div>
                  <span className="font-comic text-[11px] text-slate-700 truncate max-w-[110px] text-center">
                    {cardInst.card.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-center pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowDiscardModal(false)}
                className="comic-button-primary px-6 py-2 text-sm font-comic cursor-pointer"
              >
                Close Discard Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nemesis Set / Out of Play Modal */}
      {showNemesisModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
              <div className="flex items-center gap-2">
                <Skull className="w-6 h-6 text-comic-red" />
                <div>
                  <h3 className="font-comic text-xl text-comic-black uppercase">
                    Nemesis Set • Set Aside (Out of Play)
                  </h3>
                  <p className="text-xs text-slate-600">
                    These 5 cards are set aside at game start and enter play if "Shadow of the Past" is revealed.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNemesisModal(false)}
                className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-5 py-4">
              {setAsideCards.map((cardInst) => (
                <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                  <CardView card={cardInst.card} instance={cardInst} size="md" enableHoverZoom={true} />
                  <span className="font-comic text-xs text-slate-600 uppercase">
                    {cardInst.card.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-center pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowNemesisModal(false)}
                className="comic-button-primary px-6 py-2 text-sm font-comic cursor-pointer"
              >
                Close Out of Play Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PlayerHandTray;
