import React, { useState } from 'react';
import { CheckCircle2, Play, Users, Check, Crown } from 'lucide-react';
import { GameState, CardInstance, peekDecisionPrompt } from '../../../engine';
import { CardView } from '../cards/CardView';
import { ToneButton } from '../../theme/kit/controls';
import { useModalStyle } from '../../theme/useModalStyle';
import { DecisionPromptModal } from '../board/DecisionPromptModal';

interface MulliganScreenProps {
  gameState: GameState;
  onResolveHeroMulligan: (playerId: string, discardIds: string[]) => void;
  onStartScenario: () => void;
  /** Answers a decision of a player Setup ability (RR v1.8 Appendix II step 16). */
  onResolvePrompt: (playerId: string, selectedOptionId: string) => void;
}

export const MulliganScreen: React.FC<MulliganScreenProps> = ({
  gameState,
  onResolveHeroMulligan,
  onStartScenario,
  onResolvePrompt,
}) => {
  const { style } = useModalStyle();
  const [activeSeatIndex, setActiveSeatIndex] = useState<number>(0);
  const [discardsByPlayer, setDiscardsByPlayer] = useState<Record<string, string[]>>({});

  const totalSeats = gameState.players.length;
  const activePlayer = gameState.players[activeSeatIndex] || gameState.players[0];

  const mulliganCompletedMap = gameState.setupState?.mulliganCompleted || {};
  const isCurrentHeroCompleted = Boolean(mulliganCompletedMap[activePlayer.id]);
  const completedCount = gameState.players.filter((p) => mulliganCompletedMap[p.id]).length;
  const allCompleted = completedCount === totalSeats;

  const setupPrompt = peekDecisionPrompt(gameState);
  const isResolvingSetup = gameState.setupState?.stage === 'PLAYER_SETUP';

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
        <div
          className={`inline-block px-6 py-2 font-comic text-2xl tracking-wider -rotate-1 mb-2 ${style.buttonShape} ${style.verbs.yellow.banner}`}
        >
          SETUP STEP 8 • MULTI-HERO MULLIGAN PHASE
        </div>
        <h1
          className={`font-comic text-4xl md:text-5xl tracking-wide drop-shadow-md ${style.emphasis}`}
        >
          REVIEW & PREVIEW ALL HERO HANDS
        </h1>
        <p className={`font-comic text-lg tracking-wider uppercase ${style.muted}`}>
          Switch tabs freely between heroes to strategize before confirming discards
        </p>
      </div>

      {/* Multi-Hero Seat Tabs Bar */}
      {totalSeats > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          {gameState.players.map((p, idx) => {
            const isDone = Boolean(mulliganCompletedMap[p.id]);
            const isSelected = activeSeatIndex === idx;
            const isStartingPlayer = idx === 0;

            return (
              <button
                key={p.id}
                onClick={() => setActiveSeatIndex(idx)}
                className={`px-4 py-2.5 text-sm transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? `${style.tileSelected} font-bold -translate-y-0.5`
                    : isDone
                      ? `${style.buttonShape} bg-emerald-100 text-emerald-950 hover:bg-emerald-200`
                      : style.tile
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-comic-red text-white text-micro flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                )}
                <span>
                  Seat {idx + 1}: {p.activeFormCard.name}
                </span>
                <span className="text-micro opacity-75 uppercase">({p.hero.name})</span>
                {isStartingPlayer && (
                  <span
                    className={`text-micro bg-amber-400 text-slate-950 px-1.5 py-0.2 font-bold flex items-center gap-0.5 ${style.badge}`}
                  >
                    👑 STARTING
                  </span>
                )}
                {isDone && (
                  <span
                    className={`text-micro bg-emerald-600 text-white px-1.5 py-0.2 font-bold ${style.badge}`}
                  >
                    READY
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Hero Status Card Panel */}
      <div className={`p-6 mb-6 relative ${style.panel} ${style.text}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-current/30 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`w-7 h-7 bg-comic-red text-white text-sm flex items-center justify-center font-bold ${style.badge} !rounded-full`}
              >
                {activeSeatIndex + 1}
              </span>
              <h2 className="font-comic text-3xl tracking-wide">
                {activePlayer.alterEgo.name}{' '}
                <span className="font-comic text-xl text-comic-blue font-normal">
                  ({activePlayer.hero.name})
                </span>
              </h2>
              {activeSeatIndex === 0 && (
                <span
                  className={`bg-comic-yellow text-comic-black text-xs px-2.5 py-0.5 font-bold uppercase flex items-center gap-1 ${style.badge}`}
                >
                  <Crown className="w-3.5 h-3.5 text-comic-red" />
                  <span>STARTING PLAYER (ROUND 1)</span>
                </span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${style.muted}`}>
              Alter-Ego Form • Starting Hand Size: {activePlayer.alterEgo.handSize} Cards • Hit
              Points: {activePlayer.health} HP
            </p>
          </div>

          {/* Individual Seat Status Badge */}
          {isCurrentHeroCompleted ? (
            <div
              className={`bg-emerald-500 text-white text-sm px-4 py-1.5 flex items-center gap-1.5 font-bold animate-fade-in ${style.buttonShape}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>MULLIGAN CONFIRMED (HAND READY)</span>
            </div>
          ) : (
            <div
              className={`bg-amber-100 text-amber-900 text-xs px-3 py-1 font-bold uppercase ${style.badge}`}
            >
              SELECT CARDS TO DISCARD & REDRAW
            </div>
          )}
        </div>

        {/* Informational Guidance */}
        {!isCurrentHeroCompleted && (
          <div className={`p-3 mb-5 text-center max-w-2xl mx-auto text-xs ${style.inset}`}>
            <p>
              Click any cards below to{' '}
              <span className={`font-bold uppercase ${style.emphasis}`}>discard and redraw</span>.
              Discarded cards will be shuffled back into your deck after drawing replacements.
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
                  <div
                    className={`absolute top-2 right-2 bg-rose-600 text-white text-micro px-2 py-0.5 pointer-events-none uppercase font-bold z-content ${style.badge}`}
                  >
                    DISCARD
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Individual Hero Confirm Button (if not completed) */}
        {!isCurrentHeroCompleted && (
          <div
            className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-4 ${style.inset}`}
          >
            <div className="text-xs">
              <span className="font-bold text-sm">
                {currentSelectedDiscards.length === 0
                  ? 'Keep All 6 Cards'
                  : `Discarding ${currentSelectedDiscards.length} card(s)`}
              </span>
              <p className={`text-mini ${style.muted}`}>
                {currentSelectedDiscards.length === 0
                  ? 'Confirming will keep your current opening hand.'
                  : 'Replacements will be drawn and discards shuffled back into your deck.'}
              </p>
            </div>

            <ToneButton
              tone="blue"
              onClick={handleConfirmCurrentHero}
              className="py-2.5 px-6 font-comic text-base tracking-wider gap-2"
            >
              <Check className="w-5 h-5" />
              <span>CONFIRM MULLIGAN FOR {activePlayer.alterEgo.name.toUpperCase()}</span>
            </ToneButton>
          </div>
        )}
      </div>

      {/* Global Scenario Launch Action Bar */}
      <div
        className={`p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${style.panel} ${style.text}`}
      >
        <div>
          <div className="font-comic text-xl flex items-center gap-2">
            <Users className="w-5 h-5 text-comic-blue" />
            <span>
              Mulligan Readiness: {completedCount} of {totalSeats} Heroes Ready
            </span>
          </div>
          <p className={`text-xs ${style.muted}`}>
            {allCompleted
              ? 'All hero opening hands are finalized and ready for action!'
              : 'You can confirm each hero individually or launch directly to keep current hands.'}
          </p>
        </div>

        {/* Main "Start Scenario" Action Button */}
        <ToneButton
          tone={allCompleted ? 'yellow' : 'emerald'}
          onClick={onStartScenario}
          disabled={isResolvingSetup}
          className={`py-4 px-8 font-comic text-2xl tracking-wider gap-3 group ${
            allCompleted ? 'animate-pulse' : ''
          }`}
        >
          <Play className="w-7 h-7 fill-current group-hover:scale-110 transition-transform" />
          <span>
            {allCompleted
              ? 'START THE SCENARIO & BEGIN ROUND 1! ➔'
              : 'CONFIRM ALL & START SCENARIO ➔'}
          </span>
        </ToneButton>
      </div>

      {/* Player Setup abilities that need a decision (e.g. Foresight of T'Challa) */}
      <DecisionPromptModal
        prompt={setupPrompt}
        onSelectOption={(optionId) => {
          if (setupPrompt) onResolvePrompt(setupPrompt.playerId, optionId);
        }}
      />
    </div>
  );
};

export default MulliganScreen;
