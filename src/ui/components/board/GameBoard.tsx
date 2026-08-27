import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { GameState } from '../../../engine/models';
import { TopBar } from './TopBar';
import { VillainZone } from './VillainZone';
import { HeroZone } from './HeroZone';
import { PlayerHandTray } from './PlayerHandTray';
import { CombatLogDrawer } from './CombatLogDrawer';
import { CardView } from '../cards/CardView';

interface GameBoardProps {
  gameState: GameState;
  onReset: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onReset }) => {
  const [activeSeatIndex, setActiveSeatIndex] = useState<number>(0);
  const [isLogOpen, setIsLogOpen] = useState<boolean>(false);

  const activePlayer = gameState.players[activeSeatIndex] || gameState.players[0];
  const topPlayerDiscard = activePlayer.discard[activePlayer.discard.length - 1];

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
        {/* Scenario Tier: Encounter Deck (left), Villain Card, Main Scheme, Side Schemes */}
        <VillainZone
          villain={gameState.villain}
          mainScheme={gameState.mainScheme}
          sideSchemes={gameState.sideSchemes}
          encounterDeckCount={gameState.encounterDeck.length}
          encounterDiscard={gameState.encounterDiscard}
          accelerationTokens={gameState.accelerationTokens}
        />

        {/* Hero Tier: Player Deck & Discard at Left of Hero Seat Area */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Left: Player Deck & Discard Station (2 cols) */}
          <div className="md:col-span-2 comic-panel p-3 bg-white/95 relative shadow-comic flex md:flex-col items-center justify-center gap-3">
            <div className="absolute -top-3 left-3 bg-comic-blue text-white border border-comic-black font-comic text-[10px] px-2 py-0.5 tracking-wider shadow-comic-sm">
              PLAYER PILES
            </div>
            {/* Draw Pile */}
            <div className="flex flex-col items-center pt-2">
              <div className="w-20 h-28 bg-comic-blue border-2 border-comic-black rounded-lg shadow-comic-sm flex flex-col items-center justify-center p-2 text-center relative overflow-hidden bg-bendy-dots">
                <Layers className="w-6 h-6 text-white mb-1" />
                <span className="font-comic text-lg text-white leading-none">{activePlayer.deck.length}</span>
                <span className="text-[9px] font-bold text-sky-200 uppercase">DECK</span>
              </div>
            </div>

            {/* Discard Pile */}
            <div className="flex flex-col items-center">
              {topPlayerDiscard ? (
                <div className="relative">
                  <CardView card={topPlayerDiscard.card} size="sm" showTokens={false} enableHoverZoom={true} />
                  <span className="absolute -bottom-2 -right-2 bg-slate-900 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black">
                    {activePlayer.discard.length}
                  </span>
                </div>
              ) : (
                <div className="w-20 h-28 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-1">
                  <span className="font-comic text-xs text-slate-400">DISCARD</span>
                  <span className="text-[10px] text-slate-400 font-bold">EMPTY</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Hero Play Area (Identity, Engaged Minions, Allies, Tableau: 10 cols) */}
          <div className="md:col-span-10">
            <HeroZone player={activePlayer} />
          </div>
        </div>
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
