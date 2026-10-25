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
import { GamePhase } from '../../../engine';
import { useGameSettings } from '../../context/useGameSettings';
import { OptionsMenu } from './OptionsMenu';
import { ReportProblemModal } from './ReportProblemModal';
import { useGameSession } from '../../context/GameStateContext';
import { useModalStyle } from '../../theme/useModalStyle';
import { useNewspaperProps } from '../../theme/useNewspaperProps';

interface TopBarProps {
  activeSeatIndex: number;
  legalActionCount?: number;
  onSelectSeat: (index: number) => void;
  onToggleLog: () => void;
  isLogOpen: boolean;
  onReset: () => void;
  onOpenNewspaper?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSeatIndex,
  legalActionCount = 0,
  onSelectSeat,
  onToggleLog,
  isLogOpen,
  onReset,
  onOpenNewspaper,
}) => {
  const { state: gameState } = useGameSession();
  const { style } = useModalStyle();
  const newspaperProps = useNewspaperProps();
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  let devMode = false;
  let toggleDevMode = () => {};
  try {
    const settings = useGameSettings();
    devMode = settings.devMode;
    toggleDevMode = settings.toggleDevMode;
  } catch {
    // Rendered outside GameSettingsProvider
  }

  return (
    <>
      <header
        className={`px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-sticky sticky top-0 w-full transition-all duration-300 shadow-comic !rounded-none !border-x-0 !border-t-0 !border-b-[3px] ${style.inset}`}
      >
        {/* Left: Round & Phase Badges */}
        <div className="flex items-center gap-3">
          {/* Round Badge */}
          <div
            className={`border-[3px] font-comic text-xl px-4 py-1 rounded shadow-comic flex items-center gap-2 ${style.verbs.red.banner} ${style.verbs.red.rule}`}
          >
            <Sparkles className="w-5 h-5 text-comic-yellow fill-comic-yellow animate-pulse" />
            <span className="tracking-wide">ROUND {gameState.roundNumber}</span>
          </div>

          {/* Phase Badge */}
          <div
            className={`font-comic text-base tracking-wider px-4 py-1.5 rounded border-[3px] shadow-comic uppercase font-black ${
              gameState.phase === GamePhase.PLAYER_PHASE
                ? `${style.verbs.yellow.banner} ${style.verbs.yellow.rule}`
                : `${style.verbs.red.banner} ${style.verbs.red.rule}`
            }`}
          >
            {gameState.phase === GamePhase.PLAYER_PHASE ? (
              <>
                <span className="hidden lg:inline">HEROES ASSEMBLE! (PLAYER PHASE)</span>
                <span className="lg:hidden">PLAYER PHASE</span>
              </>
            ) : (
              'VILLAIN PHASE'
            )}
          </div>
        </div>

        {/* Center: Multi-Hero Seat Selector (if > 1 Hero) */}
        {gameState.players.length > 1 && (
          <div className={`flex items-center gap-1.5 p-1 ${style.panel}`}>
            <span
              className={`text-mini font-bold uppercase px-2 flex items-center gap-1 ${style.muted}`}
            >
              <Compass className="w-3.5 h-3.5 text-comic-blue shrink-0" />
              <span className="hidden md:inline">Jump to Hero:</span>
            </span>
            {gameState.players.map((p, idx) => {
              const isFirstPlayer = gameState.firstPlayerIndex === idx;
              const isActiveTurn = gameState.activePlayerIndex === idx;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectSeat(idx)}
                  className={`px-3 py-1 text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    isActiveTurn
                      ? `${style.btnGo} font-bold scale-105 ring-2 ring-comic-yellow`
                      : activeSeatIndex === idx
                        ? `${style.tileSelected} font-bold !scale-100`
                        : style.tile
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
                    Seat {idx + 1}
                    <span className="hidden sm:inline">: {p.activeFormCard.name}</span>
                  </span>
                  {isActiveTurn && (
                    <span className="text-nano bg-comic-yellow text-comic-black px-1 rounded font-black">
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
              {...newspaperProps}
              className="px-2.5 py-1.5 font-news-headline text-xs bg-[#fbf7ee] hover:bg-amber-200 text-slate-900 rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5 cursor-pointer font-bold transition-all hover:scale-105 active:translate-y-0.5"
              title="THE DAILY BUGLE: Inspect all legal moves and battle dispatches (Click to open)"
            >
              <Newspaper className="w-4 h-4 text-slate-900" />
              <span className="hidden md:inline font-news-headline font-black uppercase tracking-tight">
                DAILY BUGLE
              </span>
              <span
                className={`text-micro px-1.5 py-0.2 rounded font-mono font-bold border border-slate-900 ${
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
            className={`px-2.5 py-1 text-xs rounded border-2 border-comic-black shadow-comic-sm flex items-center gap-1.5 transition-all cursor-pointer ${
              devMode
                ? 'bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300 line-through opacity-80'
            }`}
            title="Click to toggle Developer Mode"
          >
            <Wrench className={`w-3.5 h-3.5 ${devMode ? 'text-slate-950' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">DEV MODE: {devMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Combat Log Drawer Button */}
          <button
            onClick={onToggleLog}
            className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              isLogOpen ? `${style.btnGo} font-bold` : style.btnMove
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">COMBAT LOG {isLogOpen ? '(OPEN)' : ''}</span>
          </button>

          {/* Report a Problem Button */}
          <button
            onClick={() => setIsReportOpen(true)}
            className={`px-2.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer ${style.btnMove}`}
            title="Report a bug, improvement, or missing feature"
          >
            <Bug className="w-4 h-4 text-comic-red" />
            <span className="hidden sm:inline">REPORT</span>
          </button>

          {/* Options Menu Button */}
          <button
            onClick={() => setIsOptionsOpen(true)}
            className={`px-2.5 py-1.5 text-xs flex items-center gap-1 cursor-pointer ${style.btnMove}`}
            title="Open Game Options & Settings"
          >
            <Settings className="w-4 h-4 text-comic-blue" />
            <span className="hidden sm:inline">OPTIONS</span>
          </button>

          {/* New Game Reset Button */}
          <button
            onClick={onReset}
            className={`px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer ${style.btnMove}`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">NEW GAME</span>
          </button>
        </div>
      </header>

      {/* Options Menu Modal */}
      <OptionsMenu isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />

      {/* Report a Problem Modal */}
      <ReportProblemModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </>
  );
};

export default TopBar;
