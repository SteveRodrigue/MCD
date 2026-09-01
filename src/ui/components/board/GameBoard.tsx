import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GameState, GameAction, CardInstance } from '../../../engine/models';
import { TopBar } from './TopBar';
import { VillainZone } from './VillainZone';
import { HeroZone } from './HeroZone';
import { PlayerHandTray } from './PlayerHandTray';
import { CombatLogDrawer } from './CombatLogDrawer';
import { DecisionPromptModal } from './DecisionPromptModal';
import { DailyBugleActionNewspaper } from './DailyBugleActionNewspaper';
import { EndTurnConfirmationModal } from './EndTurnConfirmationModal';
import { CardPaymentModal } from './CardPaymentModal';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { useGameSettings } from '../../context/GameSettingsContext';
import { getLegalActionsForPlayer, LegalActionItem } from '../../../engine/pipeline/legal-actions-generator';

interface GameBoardProps {
  gameState: GameState;
  onReset: () => void;
  onDispatchAction?: (action: GameAction) => void;
}

const SPEED_MAP: Record<string, number> = {
  slow: 18, // Slower baseline
  normal: 45, // Responsive default
  fast: 90, // High-speed glide
};

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onReset, onDispatchAction }) => {
  const [activeSeatIndex, setActiveSeatIndex] = useState<number>(0);
  const [isLogOpen, setIsLogOpen] = useState<boolean>(false);
  const [isNewspaperOpen, setIsNewspaperOpen] = useState<boolean>(false);
  const [isEndTurnPromptOpen, setIsEndTurnPromptOpen] = useState<boolean>(false);
  const [paymentModalCard, setPaymentModalCard] = useState<CardInstance | null>(null);

  const { edgeScrollSpeed } = useGameSettings();

  const totalPlayers = gameState.players.length;
  const isMultiHero = totalPlayers >= 2;

  // Active Player & Legal Actions Report
  const activePlayer = gameState.players[gameState.activePlayerIndex] || gameState.players[0];
  const legalReport = useMemo(
    () => getLegalActionsForPlayer(gameState, activePlayer.id),
    [gameState, activePlayer.id],
  );

  // Auto-detect when active actions drop from >0 to 0 to prompt End Turn confirmation
  const prevActionCountRef = useRef<number>(legalReport.activeActionCount);
  useEffect(() => {
    if (
      prevActionCountRef.current > 0 &&
      legalReport.activeActionCount === 0 &&
      legalReport.isPlayerTurn &&
      !gameState.winner
    ) {
      setIsEndTurnPromptOpen(true);
    }
    prevActionCountRef.current = legalReport.activeActionCount;
  }, [legalReport.activeActionCount, legalReport.isPlayerTurn, gameState.winner]);

  // Horizontal Panoramic Track Edge-Scroll Hook (ADR-0017)
  const {
    containerRef,
    canScrollLeft,
    canScrollRight,
    scrollToChild,
    scrollByAmount,
  } = useEdgeScroll<HTMLDivElement>({
    edgeThreshold: 95,
    maxSpeed: SPEED_MAP[edgeScrollSpeed] || 45,
    enabled: isMultiHero,
  });

  const heroStationRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Smoothly center the active hero whenever activeSeatIndex changes
  const handleSelectSeat = (seatIdx: number) => {
    setActiveSeatIndex(seatIdx);
    const targetElement = heroStationRefs.current[seatIdx];
    if (targetElement) {
      scrollToChild(targetElement);
    }
  };

  // Auto-align to initial active seat on mount
  useEffect(() => {
    if (isMultiHero) {
      const targetElement = heroStationRefs.current[activeSeatIndex];
      if (targetElement) {
        scrollToChild(targetElement);
      }
    }
  }, [isMultiHero, activeSeatIndex, scrollToChild]);

  // Execute action from Daily Bugle
  const handleSelectNewspaperAction = (item: LegalActionItem) => {
    if (item.requiresModal === 'payment' && item.targetCardInstance) {
      setPaymentModalCard(item.targetCardInstance);
    } else if (onDispatchAction) {
      onDispatchAction(item.action);
    }
  };

  // Single Hero (Active Player)
  const singlePlayer = gameState.players[0];

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-comic-paper overflow-x-hidden">
      {/* 1. Sticky Top Navigation Bar */}
      <TopBar
        gameState={gameState}
        activeSeatIndex={activeSeatIndex}
        legalActionCount={legalReport.activeActionCount}
        onSelectSeat={handleSelectSeat}
        onToggleLog={() => setIsLogOpen((prev) => !prev)}
        isLogOpen={isLogOpen}
        onReset={onReset}
        onOpenNewspaper={() => setIsNewspaperOpen(true)}
        onHoverNewspaper={() => setIsNewspaperOpen(true)}
      />

      {/* 2. Panoramic Tabletop Main Stage */}
      <main className="flex-1 w-full flex flex-col items-center justify-start p-2 md:p-4 pt-20 md:pt-24 gap-4 max-w-full">
        {/* Scenario Main Villain & Schemes Console */}
        <VillainZone
          villain={gameState.villain}
          mainScheme={gameState.mainScheme}
          sideSchemes={gameState.sideSchemes}
          encounterDeck={gameState.encounterDeck}
          encounterDiscard={gameState.encounterDiscard}
          accelerationTokens={gameState.accelerationTokens}
        />

        {/* Multi-Hero Panoramic Track (or Solo Play Area) */}
        {isMultiHero ? (
          <div className="relative w-full overflow-hidden px-2 py-1">
            {/* Edge Navigation Buttons */}
            {canScrollLeft && (
              <button
                onClick={() => scrollByAmount(-400)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-comic-yellow hover:bg-amber-400 text-comic-black p-2 rounded-full border-2 border-comic-black shadow-comic transition-all cursor-pointer"
                title="Scroll Left"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scrollByAmount(400)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-comic-yellow hover:bg-amber-400 text-comic-black p-2 rounded-full border-2 border-comic-black shadow-comic transition-all cursor-pointer"
                title="Scroll Right"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Scrollable Panoramic Track */}
            <div
              ref={containerRef}
              className="flex items-start gap-6 overflow-x-auto no-scrollbar scroll-smooth px-4 py-2"
            >
              {gameState.players.map((player, idx) => {
                const isFocused = activeSeatIndex === idx;

                return (
                  <div
                    key={player.id}
                    ref={(el) => {
                      heroStationRefs.current[idx] = el;
                    }}
                    className={`w-[820px] lg:w-[880px] shrink-0 space-y-4 transition-all duration-300 ${
                      isFocused ? 'opacity-100 z-10' : 'opacity-90 hover:opacity-100 z-0'
                    }`}
                  >
                    {/* Hero Play Area */}
                    <HeroZone
                      player={player}
                      gameState={gameState}
                      seatNumber={idx + 1}
                      isFocused={isFocused}
                      isMultiHero={true}
                      onFocus={() => handleSelectSeat(idx)}
                      onDispatchAction={onDispatchAction}
                    />

                    {/* Hero Hand Tray */}
                    <PlayerHandTray
                      hand={player.hand}
                      deck={player.deck}
                      discard={player.discard}
                      setAsideCards={player.setAsideCards}
                      heroName={player.name}
                      handSizeLimit={(player.activeFormCard as any).handSize ?? 6}
                      seatNumber={idx + 1}
                      isFocused={isFocused}
                      isMultiHero={true}
                      player={player}
                      gameState={gameState}
                      onDispatchAction={onDispatchAction}
                      onFocus={() => handleSelectSeat(idx)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Single Player (Solo Mode Tabletop) */
          <div className="max-w-5xl lg:max-w-6xl w-full mx-auto px-2 sm:px-4 md:px-6 space-y-6">
            <HeroZone
              player={singlePlayer}
              gameState={gameState}
              seatNumber={1}
              isFocused={true}
              isMultiHero={false}
              onDispatchAction={onDispatchAction}
            />
            <PlayerHandTray
              hand={singlePlayer.hand}
              deck={singlePlayer.deck}
              discard={singlePlayer.discard}
              setAsideCards={singlePlayer.setAsideCards}
              heroName={singlePlayer.name}
              handSizeLimit={(singlePlayer.activeFormCard as any).handSize ?? 6}
              seatNumber={1}
              isFocused={true}
              isMultiHero={false}
              player={singlePlayer}
              gameState={gameState}
              onDispatchAction={onDispatchAction}
            />
          </div>
        )}
      </main>

      {/* 3. 1960s Daily Bugle Newspaper Action Popover */}
      <DailyBugleActionNewspaper
        report={legalReport}
        isOpen={isNewspaperOpen}
        onClose={() => setIsNewspaperOpen(false)}
        onSelectAction={handleSelectNewspaperAction}
      />

      {/* 5. Automatic End Turn Confirmation Modal */}
      <EndTurnConfirmationModal
        isOpen={isEndTurnPromptOpen}
        playerName={activePlayer.name}
        turnAction={legalReport.turnAction}
        onConfirmEndTurn={() => {
          setIsEndTurnPromptOpen(false);
          if (legalReport.turnAction && onDispatchAction) {
            onDispatchAction(legalReport.turnAction.action);
          }
        }}
        onDismiss={() => setIsEndTurnPromptOpen(false)}
      />

      {/* 6. Card Payment Modal (Triggered via Newspaper) */}
      {paymentModalCard && (
        <CardPaymentModal
          isOpen={true}
          cardToPlay={paymentModalCard}
          player={activePlayer}
          gameState={gameState}
          onClose={() => setPaymentModalCard(null)}
          onConfirmPlay={(paymentHandCardIds: string[], generatorCardIds: string[], targetInstanceId?: string) => {
            if (onDispatchAction) {
              onDispatchAction({
                type: 'PLAY_CARD',
                playerId: activePlayer.id,
                cardInstanceId: paymentModalCard.instanceId,
                paymentCardInstanceIds: paymentHandCardIds,
                generatorInstanceIds: generatorCardIds,
                targetInstanceId,
              });
            }
            setPaymentModalCard(null);
          }}
        />
      )}

      {/* 7. Slide-Out Combat Log & History Drawer */}
      <CombatLogDrawer
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={gameState.log}
      />

      {/* 8. Interactive Decision Prompt Modal (ADR-0020 / ADR-0032) */}
      <DecisionPromptModal
        prompt={gameState.pendingDecisionQueue?.[0] || gameState.pendingDecisionPrompt}
        onSelectOption={(optionId) => {
          const activePrompt = gameState.pendingDecisionQueue?.[0] || gameState.pendingDecisionPrompt;
          if (activePrompt && onDispatchAction) {
            onDispatchAction({
              type: 'RESOLVE_DECISION_PROMPT',
              playerId: activePrompt.playerId,
              selectedOptionId: optionId,
            });
          }
        }}
      />
    </div>
  );
};

export default GameBoard;
