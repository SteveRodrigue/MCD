import React, { useState } from 'react';
import { GameState } from '../../../engine/models';
import { TopBar } from './TopBar';
import { VillainZone } from './VillainZone';
import { HeroZone } from './HeroZone';
import { PlayerHandTray } from './PlayerHandTray';
import { CombatLogDrawer } from './CombatLogDrawer';

interface GameBoardProps {
  gameState: GameState;
  onReset: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onReset }) => {
  const [activeSeatIndex, setActiveSeatIndex] = useState<number>(0);
  const [isLogOpen, setIsLogOpen] = useState<boolean>(false);

  const activePlayer = gameState.players[activeSeatIndex] || gameState.players[0];

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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 pb-8">
        {/* Tier 1: Scenario & Villain Zone */}
        {/* [Encounter Deck & Discard] -> [Villain Card & HP] -> [Main Scheme] -> [Side Schemes] */}
        <VillainZone
          villain={gameState.villain}
          mainScheme={gameState.mainScheme}
          sideSchemes={gameState.sideSchemes}
          encounterDeckCount={gameState.encounterDeck.length}
          encounterDiscard={gameState.encounterDiscard}
          accelerationTokens={gameState.accelerationTokens}
        />

        {/* Tier 2: Hero Play Area (Per Hero Seat) */}
        {/* [Player Deck & Discard] -> [Hero Identity & HP] -> [Allies] -> [Tableau] */}
        <HeroZone player={activePlayer} />
      </main>

      {/* 3. Sticky Bottom Player Hand Dock */}
      <PlayerHandTray
        hand={activePlayer.hand}
        heroName={activePlayer.name}
        handSizeLimit={(activePlayer.activeFormCard as any).handSize ?? 6}
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
