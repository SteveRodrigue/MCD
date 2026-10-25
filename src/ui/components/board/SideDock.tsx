import React from 'react';
import { ModalLayer } from '../layout/ModalLayer';
import { useGameSession } from '../../context/GameStateContext';
import { useGameSettings } from '../../context/useGameSettings';
import { CombatLogPanel } from './CombatLogPanel';
import { QuickMenu } from './QuickMenu';

interface SideDockProps {
  legalActionCount: number;
  extraActionCount: number;
  isNewspaperOpen: boolean;
  onOpenNewspaper: () => void;
  onReset: () => void;
}

/**
 * The right column of the table, always docked: the quick menu rail above the combat log. The board
 * sits beside it (see the column width in `GameBoard`), so no row of the board is spent on a menu.
 * Desktop only: small screens and touch are not supported yet.
 */
export const SideDock: React.FC<SideDockProps> = ({
  legalActionCount,
  extraActionCount,
  isNewspaperOpen,
  onOpenNewspaper,
  onReset,
}) => {
  const { state: gameState } = useGameSession();
  const { devMode } = useGameSettings();
  return (
    <ModalLayer layer="drawer" className="inset-y-0 right-0 w-[420px] p-2 flex flex-col gap-2">
      <QuickMenu
        legalActionCount={legalActionCount}
        extraActionCount={extraActionCount}
        isNewspaperOpen={isNewspaperOpen}
        onOpenNewspaper={onOpenNewspaper}
        onReset={onReset}
      />
      <CombatLogPanel logs={gameState.log} devMode={devMode} />
    </ModalLayer>
  );
};

export default SideDock;
