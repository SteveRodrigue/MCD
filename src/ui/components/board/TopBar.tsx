import React, { useState } from 'react';
import { RefreshCw, BookOpen, Users, Sparkles, Settings, Wrench } from 'lucide-react';
import { GameState, GamePhase } from '../../../engine';
import { useGameSettings } from '../../context/GameSettingsContext';
import { OptionsMenu } from './OptionsMenu';

interface TopBarProps {
  gameState: GameState;
  activeSeatIndex: number;
  onSelectSeat: (index: number) => void;
  onToggleLog: () => void;
  isLogOpen: boolean;
  onReset: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  gameState,
  activeSeatIndex,
  onSelectSeat,
  onToggleLog,
  isLogOpen,
  onReset,
}) => {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const { devMode, toggleDevMode } = useGameSettings();

  return (
    <>
      <header className="w-full bg-amber-50 border-b-3 border-comic-black shadow-comic px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-30 sticky top-0">
        {/* Left: Round & Phase Badges */}
        <div className="flex items-center gap-3">
          {/* Round Badge */}
          <div className="bg-comic-red text-white border-2 border-comic-black font-comic text-lg px-3 py-0.5 rounded shadow-comic-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-comic-yellow" />
            <span>ROUND {gameState.roundNumber}</span>
          </div>

          {/* Phase Badge */}
          <div
            className={`font-comic text-sm tracking-wider px-3 py-1 rounded border-2 border-comic-black shadow-comic-sm uppercase ${
              gameState.phase === GamePhase.PLAYER_PHASE
                ? 'bg-comic-yellow text-comic-black'
                : 'bg-rose-600 text-white'
            }`}
          >
            {gameState.phase === GamePhase.PLAYER_PHASE ? 'HEROES ACT! (PLAYER PHASE)' : 'VILLAIN PHASE'}
          </div>
        </div>

        {/* Center: Multi-Hero Seat Selector (if > 1 Hero) */}
        {gameState.players.length > 1 && (
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border-2 border-comic-black shadow-comic-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase px-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Hero Seat:
            </span>
            {gameState.players.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => onSelectSeat(idx)}
                className={`px-3 py-1 font-comic text-xs rounded border transition-all cursor-pointer ${
                  activeSeatIndex === idx
                    ? 'bg-comic-blue text-white border-comic-black shadow-comic-sm font-bold'
                    : 'bg-slate-100 text-slate-700 border-transparent hover:border-slate-300'
                }`}
              >
                Seat {idx + 1}: {p.activeFormCard.name}
              </button>
            ))}
          </div>
        )}

        {/* Right: Dev Mode Indicator, Combat Log, Options, Reset */}
        <div className="flex items-center gap-2.5">
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
      <OptionsMenu isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />
    </>
  );
};

export default TopBar;
