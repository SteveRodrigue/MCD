import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GameState, CardInstance } from '../../../engine';
import { CardView } from '../cards/CardView';

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
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {activePlayer.hand.map((cardInst: CardInstance) => {
          const isDiscarded = selectedDiscards.includes(cardInst.instanceId);

          return (
            <CardView
              key={cardInst.instanceId}
              card={cardInst.card}
              instance={cardInst}
              size="md"
              isMulliganSelected={isDiscarded}
              isKeepSelected={!isDiscarded}
              onClick={() => toggleDiscard(cardInst.instanceId)}
            />
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
