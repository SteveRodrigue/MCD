import React from 'react';
import { GameState } from '../../../engine/models';

interface GameOverScreenProps {
  gameState: GameState;
  onReset: () => void;
}

/**
 * End of game (#246): victory or defeat for the whole group. Eliminated heroes win or lose with
 * the group (RR v1.8 Player Elimination), so every hero is listed, those who fell on the way
 * marked as defeated.
 */
export const GameOverScreen: React.FC<GameOverScreenProps> = ({ gameState, onReset }) => {
  if (!gameState.winner) return null;
  const victory = gameState.winner === 'HEROES';
  const fallen = gameState.eliminatedPlayers ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={victory ? 'Victory' : 'Defeat'}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-comic-black/70 p-4"
    >
      <div
        className={`max-w-lg w-full border-4 border-comic-black shadow-comic-lg p-6 text-center ${
          victory ? 'bg-yellow-300' : 'bg-comic-red text-white'
        }`}
      >
        <h2 className="font-comic text-5xl uppercase tracking-wide mb-2">
          {victory ? 'Victory!' : 'Defeat!'}
        </h2>
        <p className="font-bold mb-4">
          {victory
            ? 'The heroes have won the day.'
            : 'The heroes have fallen, or the villain has completed the scheme.'}
        </p>
        <ul className="mb-6 space-y-1 font-bold" aria-label="Heroes">
          {gameState.players.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
          {fallen.map((p) => (
            <li key={p.id} className="line-through opacity-80">
              {p.name} <span className="no-underline">(defeated)</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onReset}
          className="border-4 border-comic-black bg-white text-comic-black font-comic uppercase px-6 py-2 shadow-comic hover:translate-y-0.5"
        >
          New game
        </button>
      </div>
    </div>
  );
};

export default GameOverScreen;
