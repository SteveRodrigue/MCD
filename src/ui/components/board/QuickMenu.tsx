import React, { useEffect, useRef, useState } from 'react';
import { Bug, MoreHorizontal, Newspaper, RefreshCw, Settings, Wrench } from 'lucide-react';
import { GamePhase } from '../../../engine';
import { useGameSettings } from '../../context/useGameSettings';
import { useGameSession } from '../../context/GameStateContext';
import { OptionsMenu } from './OptionsMenu';
import { ReportProblemModal } from './ReportProblemModal';
import { useModalStyle } from '../../theme/useModalStyle';
import { useNewspaperProps } from '../../theme/useNewspaperProps';
import { useThemeExtras } from '../../theme/useThemeExtras';
import { Beacon, ThemedButton } from '../../theme/kit/controls';
import { ThemedMenu } from '../../theme/kit/surfaces';

interface QuickMenuProps {
  /** Legal moves of the active hero, shown on the Daily Bugle button. */
  legalActionCount?: number;
  /** Call for Action and Villain actions waiting: the Daily Bugle button rings while above 0. */
  extraActionCount?: number;
  isNewspaperOpen?: boolean;
  onReset: () => void;
  /** No Daily Bugle button without it. */
  onOpenNewspaper?: () => void;
}

const bugleLabel = (legal: number, extra: number): string =>
  `Daily Bugle: ${legal} legal move${legal === 1 ? '' : 's'}${
    extra > 0 ? `, ${extra} extra action${extra === 1 ? '' : 's'} waiting` : ''
  }`;

/**
 * The quick menu: one slim rail above the combat log. Round and phase, the Daily Bugle, Options and a
 * `⋯` menu for the rarely used controls. Every control is an icon with an accessible name, so the
 * rail never wraps.
 */
export const QuickMenu: React.FC<QuickMenuProps> = ({
  legalActionCount = 0,
  extraActionCount = 0,
  isNewspaperOpen = false,
  onReset,
  onOpenNewspaper,
}) => {
  const { state: gameState } = useGameSession();
  const { devMode, toggleDevMode } = useGameSettings();
  const { style } = useModalStyle();
  const newspaperProps = useNewspaperProps();
  const { newspaper } = useThemeExtras();
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setIsMoreOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMoreOpen]);

  const isPlayerPhase = gameState.phase === GamePhase.PLAYER_PHASE;
  const afterClosing = (action: () => void) => () => {
    setIsMoreOpen(false);
    action();
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label="Quick menu"
        className={`relative flex items-center gap-1.5 px-2 py-1.5 shrink-0 ${style.panel}`}
      >
        <span
          title={`Round ${gameState.roundNumber}`}
          className={`font-comic text-base px-2 py-0.5 ${style.buttonShape} ${style.verbs.red.banner}`}
        >
          R{gameState.roundNumber}
        </span>

        <span
          title={isPlayerPhase ? 'Heroes assemble! (Player phase)' : 'Villain phase'}
          className={`flex-1 min-w-0 truncate text-center font-comic text-base tracking-wider px-2 py-0.5 uppercase font-black ${style.buttonShape} ${
            isPlayerPhase ? style.verbs.yellow.banner : style.verbs.red.banner
          }`}
        >
          {isPlayerPhase ? 'PLAYER PHASE' : 'VILLAIN PHASE'}
        </span>

        {onOpenNewspaper && (
          <Beacon active={extraActionCount > 0 && !isNewspaperOpen}>
            <button
              type="button"
              onClick={onOpenNewspaper}
              {...newspaperProps}
              aria-label={bugleLabel(legalActionCount, extraActionCount)}
              title="THE DAILY BUGLE: Inspect all legal moves and battle dispatches"
              className={`relative p-2 flex items-center cursor-pointer transition-all hover:scale-105 active:translate-y-0.5 ${newspaper.pill}`}
            >
              <Newspaper className="w-4 h-4" />
              <span
                className={`absolute -top-2 -right-2 text-micro px-1.5 font-mono font-bold ${style.badge} ${
                  legalActionCount > 0 ? 'bg-comic-red text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                {legalActionCount}
              </span>
            </button>
          </Beacon>
        )}

        <ThemedButton
          variant="icon"
          aria-label="Options"
          title="Open Game Options & Settings"
          onClick={() => setIsOptionsOpen(true)}
          icon={<Settings className="w-4 h-4 text-comic-blue" />}
        />

        <div ref={moreRef} className="relative">
          <ThemedButton
            variant="icon"
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={isMoreOpen}
            title="Report a problem, Dev mode, New game"
            onClick={() => setIsMoreOpen((open) => !open)}
            icon={<MoreHorizontal className="w-4 h-4" />}
          />
          {devMode && (
            <span
              aria-hidden="true"
              data-testid="dev-mode-dot"
              title="Dev mode is on"
              className="pointer-events-none absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-comic-green border border-slate-900"
            />
          )}
          {isMoreOpen && (
            <div className="absolute right-0 top-full mt-2 z-raised w-56">
              <ThemedMenu
                title="Menu"
                items={[
                  {
                    id: 'report',
                    label: 'Report a problem',
                    icon: <Bug className="w-4 h-4 text-comic-red" />,
                    onSelect: afterClosing(() => setIsReportOpen(true)),
                  },
                  {
                    id: 'dev-mode',
                    label: `Dev mode: ${devMode ? 'ON' : 'OFF'}`,
                    icon: <Wrench className="w-4 h-4" />,
                    onSelect: afterClosing(toggleDevMode),
                  },
                  {
                    id: 'new-game',
                    label: 'New game',
                    icon: <RefreshCw className="w-4 h-4" />,
                    onSelect: afterClosing(onReset),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      <OptionsMenu isOpen={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />
      <ReportProblemModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </>
  );
};

export default QuickMenu;
