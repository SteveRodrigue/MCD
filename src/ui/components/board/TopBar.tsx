import React, { useState } from 'react';
import {
  RefreshCw,
  BookOpen,
  Sparkles,
  Settings,
  Wrench,
  Crown,
  Compass,
  Newspaper,
  Bug,
} from 'lucide-react';
import { GameState, GamePhase } from '../../../engine';
import { useGameSettings } from '../../context/useGameSettings';
import { OptionsMenu } from './OptionsMenu';
import { ReportProblemModal } from './ReportProblemModal';

interface TopBarProps {
  gameState: GameState;
  activeSeatIndex: number;
  legalActionCount?: number;
  onSelectSeat: (index: number) => void;
  onToggleLog: () => void;
  isLogOpen: boolean;
  onReset: () => void;
  onOpenNewspaper?: () => void;
  onHoverNewspaper?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  gameState,
  activeSeatIndex,
  legalActionCount = 0,
  onSelectSeat,
  onToggleLog,
  isLogOpen,
  onReset,
  onOpenNewspaper,
  onHoverNewspaper,
}) => {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const { devMode, toggleDevMode } = useGameSettings();

  return (
    <>
      <header className="w-full bg-amber-50 border-b-3 border-comic-black shadow-comic px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-40 fixed top-0 left-0 right-0">
        {/* Left: Round & Phase Badges */}
        <div className="flex items-center gap-3">
          {/* Round Badge */}
          <div className="bg-comic-red text-white border-3 border-comic-black font-comic text-xl px-4 py-1 rounded shadow-comic flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-comic-yellow fill-comic-yellow animate-pulse" />
            <span className="tracking-wide">ROUND {gameState.roundNumber}</span>
          </div>

          {/* Phase Badge */}
          <div
            className={`font-comic text-base tracking-wider px-4 py-1.5 rounded border-3 border-comic-black shadow-comic uppercase font-black ${
              gameState.phase === GamePhase.PLAYER_PHASE
                ? 'bg-comic-yellow text-comic-black'
                : 'bg-rose-600 text-white'
            }`}
          >
            {gameState.phase === GamePhase.PLAYER_PHASE
              ? 'HEROES ASSEMBLE! (PLAYER PHASE)'
              : 'VILLAIN PHASE'}
          </div>
        </div>

        {/* Center: Multi-Hero Seat Selector (if > 1 Hero) */}
        {gameState.players.length > 1 && (
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border-2 border-comic-black shadow-comic-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase px-2 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-comic-blue" />
              Jump to Hero:
            </span>
            {gameState.players.map((p, idx) => {
              const isFirstPlayer = gameState.firstPlayerIndex === idx;
              const isActiveTurn = gameState.activePlayerIndex === idx;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectSeat(idx)}
                  className={`px-3 py-1 font-comic text-xs rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActiveTurn
                      ? 'bg-comic-red text-white border-comic-black shadow-comic-sm font-bold scale-105 ring-2 ring-comic-yellow'
                      : activeSeatIndex === idx
                        ? 'bg-comic-blue text-white border-comic-black shadow-comic-sm font-bold'
                        : 'bg-slate-100 text-slate-700 border-transparent hover:border-slate-300'
                  }`}
                  title={
                    isActiveTurn
                      ? `Seat ${idx + 1} is currently taking their turn!`
                      : isFirstPlayer
                        ? `Seat ${idx + 1} holds First Player Token`
                        : `Jump to Seat ${idx + 1}`
                  }
                >
                  {isFirstPlayer && (
                    <Crown className="w-3.5 h-3.5 text-comic-yellow shrink-0 fill-comic-yellow" />
                  )}
                  <span>
                    Seat {idx + 1}: {p.activeFormCard.name}
                  </span>
                  {isActiveTurn && (
                    <span className="text-[9px] bg-comic-yellow text-comic-black px-1 rounded font-black">
                      TURN
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Right: Daily Bugle Newspaper, Dev Mode, Combat Log, Options, Reset */}
        <div className="flex items-center gap-2.5">
          {/* 1960s Daily Bugle Newspaper Action Sheet Button */}
          {onOpenNewspaper && (
            <button
              onClick={onOpenNewspaper}
              onMouseEnter={onHoverNewspaper}
              className="px-2.5 py-1.5 font-comic text-xs bg-[#fbf7ee] hover:bg-amber-200 text-slate-900 rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5 cursor-pointer font-bold transition-all hover:scale-105 active:translate-y-0.5"
              title="THE DAILY BUGLE: Inspect all legal moves and battle dispatches (Hover or Click)"
            >
              <Newspaper className="w-4 h-4 text-slate-900" />
              <span className="hidden md:inline font-serif font-black uppercase tracking-tight">
                DAILY BUGLE
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold border border-slate-900 ${
                  legalActionCount > 0 ? 'bg-comic-red text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                {legalActionCount}
              </span>
            </button>
          )}

          {/* Visual Dev Mode Indicator Badge (In Menu Bar) */}
          <button
            onClick={toggleDevMode}
            className={`px-2.5 py-1 font-comic text-xs rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              devMode
                ? 'bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300 line-through opacity-80'
            }`}
            title="Click to toggle Developer Mode"
          >
            <Wrench className={`w-3.5 h-3.5 ${devMode ? 'text-slate-950' : 'text-slate-500'}`} />
            <span>DEV MODE: {devMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Combat Log Drawer Button */}
          <button
            onClick={onToggleLog}
            className={`px-3 py-1.5 font-comic text-xs rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              isLogOpen
                ? 'bg-comic-yellow text-comic-black font-bold'
                : 'bg-white text-slate-800 hover:bg-amber-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>COMBAT LOG {isLogOpen ? '(OPEN)' : ''}</span>
          </button>

          {/* Report a Problem Button */}
          <button
            onClick={() => setIsReportOpen(true)}
            className="px-2.5 py-1.5 font-comic text-xs bg-white hover:bg-rose-50 text-comic-red rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1 cursor-pointer"
            title="Report a bug, improvement, or missing feature"
          >
            <Bug className="w-4 h-4 text-comic-red" />
            <span className="hidden sm:inline">REPORT</span>
          </button>

          {/* Options Menu Button */}
          <button
            onClick={() => setIsOptionsOpen(true)}
            className="px-2.5 py-1.5 font-comic text-xs bg-white hover:bg-amber-100 text-slate-800 rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1 cursor-pointer"
            title="Open Game Options & Settings"
          >
            <Settings className="w-4 h-4 text-comic-blue" />
            <span className="hidden sm:inline">OPTIONS</span>
          </button>

          {/* New Game Reset Button */}
          <button
            onClick={onReset}
            className="px-3 py-1.5 font-comic text-xs bg-white hover:bg-rose-50 text-comic-red rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>NEW GAME</span>
          </button>
        </div>
      </header>

      {/* Options Menu Modal */}
      <OptionsMenu
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        gameState={gameState}
      />

      {/* Report a Problem Modal */}
      <ReportProblemModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        gameState={gameState}
      />
    </>
  );
};

export default TopBar;
