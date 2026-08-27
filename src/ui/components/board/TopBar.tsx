import React from 'react';
import { RefreshCw, BookOpen, Users, Sparkles } from 'lucide-react';
import { GameState, GamePhase } from '../../../engine';

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

  return (
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
              className={`px-3 py-1 font-comic text-xs rounded border transition-all ${
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

      {/* Right: Combat Log Drawer & New Game Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleLog}
          className={`px-3 py-1.5 font-comic text-xs rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5 transition-all ${
            isLogOpen
              ? 'bg-comic-yellow text-comic-black'
              : 'bg-white text-slate-800 hover:bg-amber-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>COMBAT LOG {isLogOpen ? '(OPEN)' : ''}</span>
        </button>

        <button
          onClick={onReset}
          className="px-3 py-1.5 font-comic text-xs bg-white hover:bg-rose-50 text-comic-red rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>NEW GAME</span>
        </button>
      </div>
    </header>
  );
};

export default TopBar;
