import React, { useState } from 'react';
import { ModalLayer } from '../layout/ModalLayer';
import { Archive, X } from 'lucide-react';
import { CardInstance, NormalizedCard } from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { getEncounterSetName } from './villain-zone-utils';

export interface RemovedFromGameBoxProps {
  cards: CardInstance[];
}

function getCardSetOrTypeLabel(card: NormalizedCard): string {
  const encSet = getEncounterSetName(card);
  if (encSet && encSet !== 'Encounter Set') return encSet;
  if (card.faction) {
    return card.faction.charAt(0).toUpperCase() + card.faction.slice(1);
  }
  if (card.type) {
    return card.type.charAt(0).toUpperCase() + card.type.slice(1);
  }
  return encSet;
}

export const RemovedFromGameBox: React.FC<RemovedFromGameBoxProps> = ({ cards = [] }) => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const topCard = cards.length > 0 ? cards[cards.length - 1] : undefined;

  return (
    <>
      <section
        data-testid="removed-from-game-box"
        className="comic-panel p-4 bg-white/95 relative hover:z-raised focus-within:z-raised shadow-comic shrink-0"
      >
        {/* Zone Title Ribbon */}
        <div className="absolute -top-3 left-4 bg-slate-900 text-white border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1">
          <Archive className="w-3.5 h-3.5" />
          <span>OUT OF PLAY</span>
        </div>

        <div className="flex items-center justify-center pt-2">
          {topCard ? (
            <div
              data-testid="removed-from-game-pile"
              onClick={() => setShowModal(true)}
              className="relative cursor-pointer group"
              title={`Inspect Removed from Game Pile (${cards.length} Cards)`}
            >
              <CardView card={topCard.card} size="sm" showTokens={false} enableHoverZoom={true} />
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-comic-red text-white font-comic text-[9px] px-1 py-0.2 rounded border border-comic-black shadow-comic-xs uppercase font-bold pointer-events-none">
                REMOVED
              </span>
              <span className="absolute -bottom-2 -right-2 bg-slate-900 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                {cards.length}
              </span>
            </div>
          ) : (
            <div
              data-testid="removed-from-game-pile-empty"
              onClick={() => setShowModal(true)}
              className="w-28 h-40 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-1 cursor-pointer hover:border-slate-400"
              title="Removed from Game (Empty)"
            >
              <span className="font-comic text-xs text-slate-400">REMOVED</span>
              <span className="text-[10px] text-slate-400 font-bold">EMPTY</span>
            </div>
          )}
        </div>
      </section>

      {/* Removed from Game Modal */}
      {showModal && (
        <ModalLayer
          data-testid="removed-from-game-modal"
          className="inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-5xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
              <div className="flex items-center gap-2">
                <Archive className="w-6 h-6 text-comic-red" />
                <div>
                  <h3 className="font-comic text-xl text-comic-black uppercase">
                    Removed from Game ({cards.length} Cards)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Cards removed from the game are out of play and cannot reenter the game.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cards Grid */}
            {cards.length === 0 ? (
              <div className="py-8 text-center text-slate-500 font-comic">
                No cards have been removed from the game.
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-4 py-4">
                {cards.map((cardInst, idx) => (
                  <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                    <div className="relative">
                      <CardView
                        card={cardInst.card}
                        instance={cardInst}
                        size="sm"
                        enableHoverZoom={true}
                      />
                      <span className="absolute -top-2 -right-2 bg-slate-900 text-white font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black">
                        #{idx + 1}
                      </span>
                    </div>
                    <span className="bg-white/95 text-slate-900 border border-comic-black font-sans text-xs font-semibold px-2 py-0.5 rounded shadow-comic-sm truncate max-w-[120px] text-center">
                      {getCardSetOrTypeLabel(cardInst.card)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Close Button Footer */}
            <div className="text-center pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowModal(false)}
                className="comic-button-primary px-6 py-2 text-sm font-comic cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </ModalLayer>
      )}
    </>
  );
};

export default RemovedFromGameBox;
