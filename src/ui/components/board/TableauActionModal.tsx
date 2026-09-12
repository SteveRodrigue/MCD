import React from 'react';
import { createPortal } from 'react-dom';
import { Zap, X, Layers } from 'lucide-react';
import { CardInstance, PlayerState, GameState, CardAbility } from '../../../engine/models';
import { canPayAbilityCost } from '../../../engine/pipeline/cost-engine';

interface TableauActionModalProps {
  isOpen: boolean;
  cardInstance: CardInstance | null;
  player: PlayerState;
  gameState?: GameState;
  onClose: () => void;
  onSelectAbility: (ability: CardAbility, cardInstance: CardInstance) => void;
}

export const TableauActionModal: React.FC<TableauActionModalProps> = ({
  isOpen,
  cardInstance,
  player,
  gameState,
  onClose,
  onSelectAbility,
}) => {
  if (!isOpen || !cardInstance) return null;

  const isHero = player.currentForm === 'hero';
  const isPlayerTurn = gameState
    ? gameState.phase === 'PLAYER_PHASE' &&
      gameState.players[gameState.activePlayerIndex]?.id === player.id
    : true;

  const abilities = cardInstance.card.enrichment?.abilities || [];
  const actionableAbilities = abilities.filter(
    (ab) =>
      ab.timing === 'ACTION' ||
      (isHero && ab.timing === 'HERO_ACTION') ||
      (!isHero && ab.timing === 'ALTER_EGO_ACTION') ||
      ab.timing === 'RESOURCE',
  );

  const cardType = (cardInstance.card.type || 'UPGRADE').toUpperCase();
  const tokens = cardInstance.tokens || {};
  const tokenEntries = Object.entries(tokens).filter(([_, count]) => (count as number) > 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-comic-black/80 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-150">
      <div className="relative w-full max-w-md bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl overflow-hidden flex flex-col font-comic">
        {/* Comic dots pattern */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* 1. Header */}
        <div className="relative px-5 py-3.5 bg-amber-300 border-b-4 border-comic-black flex items-center justify-between text-slate-950 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-comic-black text-amber-300 rounded-lg shadow-comic-sm">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-800">
                <span>{cardType} CARD ACTIONS</span>
                {cardInstance.exhausted && (
                  <span className="bg-slate-800 text-white px-1.5 py-0.2 rounded text-[9px]">
                    EXHAUSTED
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-slate-950">
                {cardInstance.card.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 bg-comic-black hover:bg-slate-800 text-white rounded-lg border-2 border-white/40 shadow-comic-sm transition-transform active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Token & Status Strip */}
        <div className="relative px-5 py-2 bg-amber-100 border-b-2 border-comic-black flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <span className="font-bold text-slate-800 uppercase text-[11px]">
              {cardInstance.card.traits?.join(' • ') || cardType}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {tokenEntries.map(([type, count]) => (
              <span
                key={type}
                className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded border border-comic-black font-black text-[10px] uppercase shadow-comic-xs"
              >
                {type}: {count}
              </span>
            ))}
            {tokenEntries.length === 0 && (
              <span className="text-[11px] text-slate-500 italic">No counters</span>
            )}
          </div>
        </div>

        {/* 3. Abilities List */}
        <div className="relative p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select an ability to activate:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {actionableAbilities.map((ab) => {
              const alreadyUsed = (player.usedAbilitiesThisRound?.[ab.id] || 0) >= 1;
              const costCheck = gameState
                ? canPayAbilityCost(gameState, player, ab, cardInstance, {})
                : { allowed: false, reason: 'Game state unavailable' };
              const canTrigger = isPlayerTurn && !alreadyUsed && costCheck.allowed;

              const description =
                ab.steps?.[0]?.params?.description || `Trigger ${ab.id.replace(/_/g, ' ')}`;

              return (
                <button
                  key={ab.id}
                  disabled={!canTrigger}
                  onClick={() => {
                    onClose();
                    onSelectAbility(ab, cardInstance);
                  }}
                  className={`w-full p-3 rounded-lg border-3 border-comic-black transition-all flex items-center justify-between gap-3 text-left ${
                    canTrigger
                      ? 'bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300 shadow-comic-sm hover:shadow-comic hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer'
                      : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg border-2 border-comic-black shrink-0 ${
                        canTrigger ? 'bg-amber-400 text-slate-950' : 'bg-slate-300 text-slate-500'
                      }`}
                    >
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-950">
                          {ab.id.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded border border-comic-black bg-comic-black text-amber-300">
                          {ab.timing.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-slate-600 block mt-0.5">
                        {canTrigger
                          ? String(description)
                          : alreadyUsed
                            ? 'Already used this round'
                            : costCheck.reason || 'Cannot trigger ability'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    <span
                      className={`font-comic text-xs font-black uppercase px-2.5 py-1 rounded border-2 border-comic-black shadow-comic-xs ${
                        canTrigger ? 'bg-comic-black text-amber-300' : 'bg-slate-300 text-slate-500'
                      }`}
                    >
                      USE ➔
                    </span>
                  </div>
                </button>
              );
            })}

            {actionableAbilities.length === 0 && (
              <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg text-center text-slate-500 text-xs">
                This card has no activated abilities that can be triggered right now.
              </div>
            )}
          </div>
        </div>

        {/* 4. Footer */}
        <div className="relative px-5 py-3 bg-slate-100 border-t-2 border-comic-black flex justify-end">
          <button
            onClick={onClose}
            className="font-comic text-xs font-black py-2 px-4 rounded-lg border-2 border-comic-black bg-slate-200 hover:bg-slate-300 text-slate-800 shadow-comic-sm active:translate-y-0.5 cursor-pointer uppercase"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TableauActionModal;
