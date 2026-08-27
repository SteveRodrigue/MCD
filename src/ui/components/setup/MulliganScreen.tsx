import React, { useState } from 'react';
import { CheckCircle2, Play, Users, Check } from 'lucide-react';
import { GameState, CardInstance } from '../../../engine';
import { CardView } from '../cards/CardView';

interface MulliganScreenProps {
  gameState: GameState;
  onResolveHeroMulligan: (playerId: string, discardIds: string[]) => void;
  onStartScenario: () => void;
}

export const MulliganScreen: React.FC<MulliganScreenProps> = ({
  gameState,
  onResolveHeroMulligan,
  onStartScenario,
}) => {
  const [activeSeatIndex, setActiveSeatIndex] = useState<number>(0);
  const [discardsByPlayer, setDiscardsByPlayer] = useState<Record<string, string[]>>({});

  const totalSeats = gameState.players.length;
  const activePlayer = gameState.players[activeSeatIndex] || gameState.players[0];

  const mulliganCompletedMap = gameState.setupState?.mulliganCompleted || {};
  const isCurrentHeroCompleted = Boolean(mulliganCompletedMap[activePlayer.id]);
  const completedCount = gameState.players.filter((p) => mulliganCompletedMap[p.id]).length;
  const allCompleted = completedCount === totalSeats;

  const currentSelectedDiscards = discardsByPlayer[activePlayer.id] || [];

  const toggleDiscard = (instanceId: string) => {
    if (isCurrentHeroCompleted) return; // Hand locked after confirmation

    setDiscardsByPlayer((prev) => {
      const currentList = prev[activePlayer.id] || [];
      const updated = currentList.includes(instanceId)
        ? currentList.filter((id) => id !== instanceId)
        : [...currentList, instanceId];
      return { ...prev, [activePlayer.id]: updated };
    });
  };

  const handleConfirmCurrentHero = () => {
    onResolveHeroMulligan(activePlayer.id, currentSelectedDiscards);

    // If more seats exist and next seat is unconfirmed, auto-advance tab for convenience
    const nextUnconfirmedIdx = gameState.players.findIndex(
      (p, idx) => idx > activeSeatIndex && !mulliganCompletedMap[p.id],
    );
    if (nextUnconfirmedIdx !== -1) {
      setActiveSeatIndex(nextUnconfirmedIdx);
    }
  };

  return (
    <div className="relative max-w-6xl w-full mx-auto my-6 p-4 md:p-6">
      {/* Top Banner */}
      <div className="text-center mb-6 relative">
        <div className="inline-block bg-comic-yellow border-comic border-comic-black px-6 py-2 font-comic text-2xl tracking-wider text-comic-red shadow-comic transform -rotate-1 mb-2">
          SETUP STEP 8 • MULTI-HERO MULLIGAN PHASE
        </div>
        <h1 className="font-comic text-4xl md:text-5xl text-comic-red tracking-wide drop-shadow-md">
          REVIEW & PREVIEW ALL HERO HANDS
        </h1>
        <p className="font-comic text-lg text-comic-blue tracking-wider uppercase">
          Switch tabs freely between heroes to strategize before confirming discards
        </p>
      </div>

      {/* Multi-Hero Seat Tabs Bar */}
      {totalSeats > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          {gameState.players.map((p, idx) => {
            const isDone = Boolean(mulliganCompletedMap[p.id]);
            const isSelected = activeSeatIndex === idx;

            return (
              <button
                key={p.id}
                onClick={() => setActiveSeatIndex(idx)}
                className={`px-4 py-2.5 rounded-lg font-comic text-sm border-2 transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'bg-comic-blue text-white border-comic-black shadow-comic font-bold transform -translate-y-0.5'
                    : isDone
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-600 hover:bg-emerald-200'
                      : 'bg-white text-slate-800 border-slate-400 hover:border-comic-black hover:bg-amber-50'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-comic-red text-white text-[10px] flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                )}
                <span>
                  Seat {idx + 1}: {p.activeFormCard.name}
                </span>
                <span className="text-[10px] opacity-75 uppercase">({p.hero.name})</span>
                {isDone && (
                  <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                    READY
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Hero Status Card Panel */}
      <div className="comic-panel p-6 bg-white mb-6 relative">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-comic-black pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-comic-red text-white font-comic text-sm flex items-center justify-center font-bold border border-comic-black">
                {activeSeatIndex + 1}
              </span>
              <h2 className="font-comic text-3xl text-comic-black tracking-wide">
                {activePlayer.alterEgo.name}{' '}
                <span className="text-xl text-comic-blue font-normal">
                  ({activePlayer.hero.name})
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Alter-Ego Form • Starting Hand Size: {activePlayer.alterEgo.handSize} Cards • Hit
              Points: {activePlayer.health} HP
            </p>
          </div>

          {/* Individual Seat Status Badge */}
          {isCurrentHeroCompleted ? (
            <div className="bg-emerald-500 text-white font-comic text-sm px-4 py-1.5 rounded-full border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5 font-bold animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>MULLIGAN CONFIRMED (HAND READY)</span>
            </div>
          ) : (
            <div className="bg-amber-100 text-amber-900 font-comic text-xs px-3 py-1 rounded border border-comic-black font-bold uppercase">
              SELECT CARDS TO DISCARD & REDRAW
            </div>
          )}
        </div>

        {/* Informational Guidance */}
        {!isCurrentHeroCompleted && (
          <div className="comic-bubble p-3 mb-5 bg-amber-50 text-center max-w-2xl mx-auto text-xs text-slate-800">
            <p>
              Click any cards below to <span className="font-bold text-comic-red uppercase">discard and redraw</span>. Discarded cards will be shuffled back into your deck after drawing replacements.
            </p>
          </div>
        )}

        {/* Hand Cards Grid */}
        <div className="flex flex-wrap justify-center gap-4 mb-4 min-h-[260px] items-center">
          {activePlayer.hand.map((cardInst: CardInstance) => {
            const isDiscarded = currentSelectedDiscards.includes(cardInst.instanceId);

            return (
              <div key={cardInst.instanceId} className="relative">
                <CardView
                  card={cardInst.card}
                  instance={cardInst}
                  size="md"
                  isMulliganSelected={!isCurrentHeroCompleted && isDiscarded}
                  isKeepSelected={!isCurrentHeroCompleted && !isDiscarded}
                  onClick={() => toggleDiscard(cardInst.instanceId)}
                />
                {!isCurrentHeroCompleted && isDiscarded && (
                  <div className="absolute top-2 right-2 bg-rose-600 text-white font-comic text-[10px] px-2 py-0.5 rounded border border-comic-black shadow-comic-sm pointer-events-none uppercase font-bold z-10">
                    DISCARD
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Individual Hero Confirm Button (if not completed) */}
        {!isCurrentHeroCompleted && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 bg-amber-50/60 p-4 rounded-lg">
            <div className="text-xs text-slate-700">
              <span className="font-bold font-comic text-sm text-comic-black">
                {currentSelectedDiscards.length === 0
                  ? 'Keep All 6 Cards'
                  : `Discarding ${currentSelectedDiscards.length} card(s)`}
              </span>
              <p className="text-[11px] text-slate-500">
                {currentSelectedDiscards.length === 0
                  ? 'Confirming will keep your current opening hand.'
                  : 'Replacements will be drawn and discards shuffled back into your deck.'}
              </p>
            </div>

            <button
              onClick={handleConfirmCurrentHero}
              className="py-2.5 px-6 bg-comic-blue text-white border-2 border-comic-black font-comic text-base tracking-wider shadow-comic-sm hover:bg-sky-600 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer rounded"
            >
              <Check className="w-5 h-5 text-white" />
              <span>
                CONFIRM MULLIGAN FOR {activePlayer.alterEgo.name.toUpperCase()}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Global Scenario Launch Action Bar */}
      <div className="comic-panel p-6 bg-amber-100 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="font-comic text-xl text-comic-black flex items-center gap-2">
            <Users className="w-5 h-5 text-comic-blue" />
            <span>
              Mulligan Readiness: {completedCount} of {totalSeats} Heroes Ready
            </span>
          </div>
          <p className="text-xs text-slate-600">
            {allCompleted
              ? 'All hero opening hands are finalized and ready for action!'
              : 'You can confirm each hero individually or launch directly to keep current hands.'}
          </p>
        </div>

        {/* Main "Start Scenario" Action Button */}
        <button
          onClick={onStartScenario}
          className={`py-4 px-8 border-comic border-comic-black font-comic text-2xl tracking-wider shadow-comic transition-all flex items-center justify-center gap-3 group cursor-pointer ${
            allCompleted
              ? 'bg-comic-yellow text-comic-red hover:bg-amber-300 animate-pulse active:translate-x-1 active:translate-y-1'
              : 'bg-emerald-500 text-white hover:bg-emerald-400 active:translate-x-1 active:translate-y-1'
          }`}
        >
          <Play
            className={`w-7 h-7 ${
              allCompleted ? 'text-comic-red fill-comic-red' : 'text-white fill-white'
            } group-hover:scale-110 transition-transform`}
          />
          <span>
            {allCompleted
              ? 'START THE SCENARIO & BEGIN ROUND 1! ➔'
              : 'CONFIRM ALL & START SCENARIO ➔'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default MulliganScreen;
