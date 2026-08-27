import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GameState, CardInstance } from '../../../engine';

interface MulliganScreenProps {
  gameState: GameState;
  onConfirmMulligan: (playerId: string, discardIds: string[]) => void;
}

export const MulliganScreen: React.FC<MulliganScreenProps> = ({
  gameState,
  onConfirmMulligan,
}) => {
  // Find the first player who hasn't completed mulligan
  const pendingPlayers = gameState.players.filter(
    (p) => !gameState.setupState?.mulliganCompleted[p.id]
  );

  const activePlayer = pendingPlayers[0] || gameState.players[0];
  const [selectedDiscards, setSelectedDiscards] = useState<string[]>([]);

  const toggleDiscard = (instanceId: string) => {
    setSelectedDiscards((prev) =>
      prev.includes(instanceId) ? prev.filter((id) => id !== instanceId) : [...prev, instanceId]
    );
  };

  const handleConfirm = () => {
    onConfirmMulligan(activePlayer.id, selectedDiscards);
    setSelectedDiscards([]); // Reset for next seat if multi-hero
  };

  const totalSeats = gameState.players.length;
  const completedCount = totalSeats - pendingPlayers.length;

  return (
    <div className="relative max-w-5xl w-full mx-auto my-6 p-6">
      {/* Top Banner */}
      <div className="text-center mb-6 relative">
        <div className="inline-block bg-comic-yellow border-comic border-comic-black px-6 py-2 font-comic text-2xl tracking-wider text-comic-red shadow-comic transform rotate-1 mb-2">
          SETUP STEP 8 • MULLIGAN PHASE
        </div>
        <h1 className="font-comic text-5xl text-comic-red tracking-wide drop-shadow-md">
          {activePlayer.name}
        </h1>
        <p className="font-comic text-lg text-comic-blue tracking-wider uppercase">
          Alter-Ego Form ({activePlayer.alterEgo.name}) • Hand Size: {activePlayer.hand.length}
        </p>

        {totalSeats > 1 && (
          <div className="inline-block bg-slate-100 border border-comic-black px-3 py-1 text-xs font-bold rounded mt-2">
            Hero Seat {completedCount + 1} of {totalSeats}
          </div>
        )}
      </div>

      {/* Mulligan Instructions Comic Bubble */}
      <div className="comic-bubble p-4 mb-6 bg-amber-50 text-center max-w-2xl mx-auto text-sm text-slate-800">
        <p className="font-medium">
          Select any number of cards from your opening hand to <span className="font-bold text-comic-red uppercase">discard and replace</span>. Discarded cards will be shuffled back into your deck after drawing replacements.
        </p>
      </div>

      {/* Hand Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-8">
        {activePlayer.hand.map((cardInst: CardInstance) => {
          const isDiscarded = selectedDiscards.includes(cardInst.instanceId);
          const card = cardInst.card;

          return (
            <button
              key={cardInst.instanceId}
              onClick={() => toggleDiscard(cardInst.instanceId)}
              className={`relative flex flex-col justify-between p-3 rounded-lg border-3 transition-all transform hover:-translate-y-1 text-left min-h-[220px] ${
                isDiscarded
                  ? 'border-comic-red bg-rose-50 shadow-comic scale-95 opacity-80'
                  : 'border-comic-black bg-white shadow-comic hover:shadow-comic-lg'
              }`}
            >
              {/* Status Ribbon */}
              <div
                className={`absolute -top-3 -right-2 px-2 py-0.5 font-comic text-xs font-bold tracking-wider rounded border border-comic-black shadow-comic-sm ${
                  isDiscarded
                    ? 'bg-comic-red text-white'
                    : 'bg-emerald-400 text-slate-950'
                }`}
              >
                {isDiscarded ? 'MULLIGAN' : 'KEEP'}
              </div>

              {/* Card Top: Cost & Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-comic-yellow font-comic text-sm flex items-center justify-center font-bold">
                    {card.cost ?? 0}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    {card.type}
                  </span>
                </div>
                <h3 className="font-comic text-base text-comic-black leading-tight">
                  {card.name}
                </h3>
              </div>

              {/* Card Body: Text */}
              <div className="my-2 text-[11px] text-slate-600 line-clamp-4 leading-snug">
                {card.text || 'No special text.'}
              </div>

              {/* Card Bottom: Resource Icon & Faction */}
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                <span className="capitalize">{card.faction}</span>
                <span className="text-slate-700 font-bold uppercase">
                  {card.resources.total > 0
                    ? `${card.resources.total} ${
                        card.resources.physical > 0
                          ? 'PHY'
                          : card.resources.energy > 0
                            ? 'NRG'
                            : card.resources.mental > 0
                              ? 'MNT'
                              : 'WLD'
                      }`
                    : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Footer Bar */}
      <div className="comic-panel p-6 bg-amber-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-comic-blue text-white flex items-center justify-center font-comic text-xl">
            {selectedDiscards.length}
          </div>
          <div>
            <div className="font-comic text-xl text-comic-black">
              {selectedDiscards.length === 0
                ? 'KEEP ALL 6 CARDS'
                : `DISCARD & REDRAW ${selectedDiscards.length} ${
                    selectedDiscards.length === 1 ? 'CARD' : 'CARDS'
                  }`}
            </div>
            <div className="text-xs text-slate-600">
              {selectedDiscards.length === 0
                ? 'No cards will be replaced.'
                : 'Replacement cards will be drawn immediately.'}
            </div>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          className="w-full sm:w-auto py-3 px-8 bg-comic-yellow border-comic border-comic-black font-comic text-2xl text-comic-red tracking-wider shadow-comic hover:bg-amber-300 active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-2 group"
        >
          <span>
            {pendingPlayers.length > 1
              ? 'CONFIRM & NEXT HERO'
              : 'CONFIRM & START BATTLE!'}
          </span>
          <ArrowRight className="w-6 h-6 text-comic-red group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default MulliganScreen;
