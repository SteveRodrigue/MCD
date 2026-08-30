import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GameState, GameAction } from '../../../engine/models';
import { TopBar } from './TopBar';
import { VillainZone } from './VillainZone';
import { HeroZone } from './HeroZone';
import { PlayerHandTray } from './PlayerHandTray';
import { CombatLogDrawer } from './CombatLogDrawer';
import { DecisionPromptModal } from './DecisionPromptModal';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { useGameSettings } from '../../context/GameSettingsContext';

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
  const { edgeScrollSpeed } = useGameSettings();

  const totalPlayers = gameState.players.length;
  const isMultiHero = totalPlayers >= 2;

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

  // Single Hero (Active Player)
  const singlePlayer = gameState.players[0];

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-comic-paper overflow-x-hidden">
      {/* 1. Sticky Top Navigation Bar */}
      <TopBar
        gameState={gameState}
        activeSeatIndex={activeSeatIndex}
        onSelectSeat={handleSelectSeat}
        onToggleLog={() => setIsLogOpen((prev) => !prev)}
        isLogOpen={isLogOpen}
        onReset={onReset}
      />

      {/* 2. Main Play Areas Tabletop */}
      <main className="flex-1 w-full flex flex-col space-y-6 pb-8 pt-4">
        {/* Tier 1: Scenario & Villain Zone (Centered & Pinned at Top) */}
        <div className="max-w-7xl w-full mx-auto px-4 md:px-6">
          <VillainZone
            villain={gameState.villain}
            mainScheme={gameState.mainScheme}
            sideSchemes={gameState.sideSchemes}
            encounterDeck={gameState.encounterDeck}
            encounterDiscard={gameState.encounterDiscard}
            accelerationTokens={gameState.accelerationTokens}
          />
        </div>

        {/* Tier 2: Hero Play Areas & Hands */}
        {isMultiHero ? (
          /* Panoramic Horizontal Tabletop (1 to 4 Players - ADR-0017) */
          <div className="relative w-full overflow-hidden">
            {/* Left Edge Pan Button Indicator */}
            {canScrollLeft && (
              <button
                onClick={() => scrollByAmount(-500)}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-40 bg-comic-black text-comic-yellow font-comic text-xs px-3.5 py-2 rounded-full border-2 border-comic-yellow shadow-comic-lg flex items-center gap-1.5 cursor-pointer animate-pulse hover:bg-slate-900 hover:scale-105 transition-all"
                title="Pan Tabletop Left (or hover near screen edge)"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PAN LEFT</span>
              </button>
            )}

            {/* Right Edge Pan Button Indicator */}
            {canScrollRight && (
              <button
                onClick={() => scrollByAmount(500)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-40 bg-comic-black text-comic-yellow font-comic text-xs px-3.5 py-2 rounded-full border-2 border-comic-yellow shadow-comic-lg flex items-center gap-1.5 cursor-pointer animate-pulse hover:bg-slate-900 hover:scale-105 transition-all"
                title="Pan Tabletop Right (or hover near screen edge)"
              >
                <span>PAN RIGHT</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Panoramic Horizontal Track (Direct frame-rate panning) */}
            <div
              ref={containerRef}
              className="w-full overflow-x-auto overflow-y-visible px-6 md:px-12 py-3 flex items-start gap-8 select-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
          <div className="max-w-7xl w-full mx-auto px-4 md:px-6 space-y-6">
            <HeroZone
              player={singlePlayer}
              gameState={gameState}
              seatNumber={1}
              isFocused={true}
              isMultiHero={false}
            />
          </div>
        )}
      </main>

      {/* 3. Sticky Bottom Player Hand Dock (Single Player Mode Only) */}
      {!isMultiHero && (
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
      )}

      {/* 4. Slide-Out Combat Log & History Drawer */}
      <CombatLogDrawer
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={gameState.log}
      />

      {/* 5. Interactive Decision Prompt Modal (ADR-0020) */}
      <DecisionPromptModal
        prompt={gameState.pendingDecisionPrompt}
        onSelectOption={(optionId) => {
          if (gameState.pendingDecisionPrompt && onDispatchAction) {
            onDispatchAction({
              type: 'RESOLVE_DECISION_PROMPT',
              playerId: gameState.pendingDecisionPrompt.playerId,
              selectedOptionId: optionId,
            });
          }
        }}
      />
    </div>
  );
};

export default GameBoard;
