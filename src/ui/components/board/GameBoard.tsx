import React, { useState } from 'react';
import { GameState } from '../../../engine/models';
import { TopBar } from './TopBar';
import { VillainZone } from './VillainZone';
import { HeroZone } from './HeroZone';
import { PlayerHandTray } from './PlayerHandTray';
import { CombatLogDrawer } from './CombatLogDrawer';
import { useGameSettings } from '../../context/GameSettingsContext';

interface GameBoardProps {
  gameState: GameState;
  onReset: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onReset }) => {
  const [activeSeatIndex, setActiveSeatIndex] = useState<number>(0);
  const [isLogOpen, setIsLogOpen] = useState<boolean>(false);
  const { sideBySideLayout } = useGameSettings();

  const totalPlayers = gameState.players.length;
  const isDualHeroMode = sideBySideLayout && totalPlayers >= 2;

  // Active (Current) Player
  const player1Index = activeSeatIndex;
  const player1 = gameState.players[player1Index] || gameState.players[0];

  // Next Player to play in clockwise turn order
  const player2Index = (activeSeatIndex + 1) % totalPlayers;
  const player2 = gameState.players[player2Index];

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-comic-paper">
      {/* 1. Sticky Top Navigation Bar */}
      <TopBar
        gameState={gameState}
        activeSeatIndex={activeSeatIndex}
        onSelectSeat={setActiveSeatIndex}
        onToggleLog={() => setIsLogOpen((prev) => !prev)}
        isLogOpen={isLogOpen}
        onReset={onReset}
      />

      {/* 2. Main Play Areas Tabletop */}
      <main
        className={`flex-1 w-full mx-auto p-4 md:p-6 space-y-6 pb-8 transition-all ${
          isDualHeroMode ? 'max-w-[1700px]' : 'max-w-7xl'
        }`}
      >
        {/* Tier 1: Scenario & Villain Zone */}
        <VillainZone
          villain={gameState.villain}
          mainScheme={gameState.mainScheme}
          sideSchemes={gameState.sideSchemes}
          encounterDeck={gameState.encounterDeck}
          encounterDiscard={gameState.encounterDiscard}
          accelerationTokens={gameState.accelerationTokens}
        />

        {/* Tier 2: Hero Play Area (Single or Side-by-Side Dual Column) */}
        {isDualHeroMode ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* Column 1: Current Active Hero */}
            <HeroZone
              player={player1}
              seatNumber={player1Index + 1}
              isFocused={true}
              isSideBySide={true}
            />

            {/* Column 2: Next Hero in Turn Order */}
            <HeroZone
              player={player2}
              seatNumber={player2Index + 1}
              isFocused={false}
              isSideBySide={true}
              onFocus={() => setActiveSeatIndex(player2Index)}
            />
          </div>
        ) : (
          <HeroZone
            player={player1}
            seatNumber={totalPlayers > 1 ? player1Index + 1 : undefined}
            isFocused={true}
            isSideBySide={false}
          />
        )}
      </main>

      {/* 3. Sticky Bottom Player Hand Dock */}
      <PlayerHandTray
        hand={player1.hand}
        deck={player1.deck}
        discard={player1.discard}
        setAsideCards={player1.setAsideCards}
        heroName={player1.name}
        handSizeLimit={(player1.activeFormCard as any).handSize ?? 6}
      />

      {/* 4. Slide-Out Combat Log & History Drawer */}
      <CombatLogDrawer
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={gameState.log}
      />
    </div>
  );
};

export default GameBoard;
