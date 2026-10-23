import React from 'react';
import { Skull, Trophy } from 'lucide-react';
import { useGameSession } from '../../context/GameStateContext';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';

interface GameOverScreenProps {
  onReset: () => void;
}

/**
 * End of game (#246): victory or defeat for the whole group. Eliminated heroes win or lose with
 * the group (RR v1.8 Player Elimination), so every hero is listed, those who fell on the way
 * marked as defeated.
 */
export const GameOverScreen: React.FC<GameOverScreenProps> = ({ onReset }) => {
  const { state: gameState } = useGameSession();
  const { style } = useModalStyle();
  if (!gameState.winner) return null;
  const victory = gameState.winner === 'HEROES';
  const fallen = gameState.eliminatedPlayers ?? [];

  return (
    <ModalScaffold
      layer="critical"
      title={victory ? 'Victory!' : 'Defeat!'}
      label={victory ? 'Victory' : 'Defeat'}
      kicker="End of game"
      verb={victory ? 'green' : 'red'}
      trigger={null}
      icon={victory ? <Trophy className="w-6 h-6" /> : <Skull className="w-6 h-6" />}
      maxWidthClass="max-w-lg"
      testId="game-over-screen"
      footer={
        <button
          type="button"
          onClick={onReset}
          className={`mx-auto px-6 py-2 font-comic font-black uppercase cursor-pointer ${style.btnGo}`}
        >
          New game
        </button>
      }
    >
      <p className="font-bold text-center">
        {victory
          ? 'The heroes have won the day.'
          : 'The heroes have fallen, or the villain has completed the scheme.'}
      </p>
      <ul className="space-y-1 font-bold text-center" aria-label="Heroes">
        {gameState.players.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
        {fallen.map((p) => (
          <li key={p.id} className="line-through opacity-80">
            {p.name} <span className="no-underline">(defeated)</span>
          </li>
        ))}
      </ul>
    </ModalScaffold>
  );
};

export default GameOverScreen;
