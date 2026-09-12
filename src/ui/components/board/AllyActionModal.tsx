import React from 'react';
import { createPortal } from 'react-dom';
import { Swords, Target, Zap, X, Shield, Skull } from 'lucide-react';
import { CardInstance, PlayerState, GameState, GameAction, AllyCard } from '../../../engine/models';
import { getEffectiveAllyStats } from '../../../engine/pipeline/stat-calculator';
import { getValidAttackTargets } from './attack-target-utils';
import { getValidThwartTargets } from './thwart-target-utils';
import { canPayAbilityCost } from '../../../engine/pipeline/cost-engine';

interface AllyActionModalProps {
  isOpen: boolean;
  ally: CardInstance;
  player: PlayerState;
  gameState?: GameState;
  onClose: () => void;
  onInitiateAllyAttack: (allyInstanceId: string) => void;
  onInitiateAllyThwart: (allyInstanceId: string) => void;
  onDispatchAction?: (action: GameAction) => void;
}

export const AllyActionModal: React.FC<AllyActionModalProps> = ({
  isOpen,
  ally,
  player,
  gameState,
  onClose,
  onInitiateAllyAttack,
  onInitiateAllyThwart,
  onDispatchAction,
}) => {
  if (!isOpen || !ally) return null;

  const allyCard = ally.card as AllyCard;
  const allyStats = gameState
    ? getEffectiveAllyStats(gameState, ally)
    : {
        attack: (ally.card as any).attack ?? 1,
        thwart: (ally.card as any).thwart ?? 1,
      };

  const isPlayerTurn = gameState
    ? gameState.phase === 'PLAYER_PHASE' &&
      gameState.players[gameState.activePlayerIndex]?.id === player.id
    : true;

  const currentDamage = ally.tokens?.damage || 0;
  const maxHealth = allyCard.health || 2;
  const currentHealth = Math.max(0, maxHealth - currentDamage);

  const attackTargets = gameState
    ? getValidAttackTargets(gameState, player.id, 'ally', ally.instanceId)
    : [];
  const canAttack = isPlayerTurn && !ally.exhausted && attackTargets.length > 0;

  const thwartTargets = gameState
    ? getValidThwartTargets(gameState, player.id, 'ally', ally.instanceId)
    : [];
  const canThwart = isPlayerTurn && !ally.exhausted && thwartTargets.some((t) => t.allowed);

  const consequentialAtk =
    (allyCard as any).attackCost ?? (allyCard as any).consequentialDamage?.attack ?? 1;
  const consequentialThw =
    (allyCard as any).thwartCost ?? (allyCard as any).consequentialDamage?.thwart ?? 1;

  // Activated abilities on the ally card
  const abilities = ally.card.enrichment?.abilities || [];
  const actionableAbilities = abilities.filter(
    (ab) => ab.timing === 'ACTION' || ab.timing === 'HERO_ACTION',
  );

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
        <div className="relative px-5 py-3.5 bg-amber-400 border-b-4 border-comic-black flex items-center justify-between text-slate-950 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-comic-black text-amber-300 rounded-lg shadow-comic-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-800">
                <span>ALLY ACTIONS</span>
                {ally.exhausted && (
                  <span className="bg-slate-800 text-white px-1.5 py-0.2 rounded text-[9px]">
                    EXHAUSTED
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-slate-950">
                {ally.card.name}
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

        {/* 2. Ally Stats Strip */}
        <div className="relative px-5 py-2 bg-amber-100 border-b-2 border-comic-black flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800">
              HP: <strong className="font-black text-slate-950">{currentHealth}</strong> /{' '}
              {maxHealth}
            </span>
            {currentDamage > 0 && (
              <span className="text-comic-red font-bold text-[11px]">({currentDamage} dmg)</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
            <span className="bg-comic-red text-white px-1.5 py-0.5 rounded border border-comic-black">
              {allyStats.attack} ATK
            </span>
            <span className="bg-sky-500 text-white px-1.5 py-0.5 rounded border border-comic-black">
              {allyStats.thwart} THW
            </span>
          </div>
        </div>

        {/* 3. Action Choices */}
        <div className="relative p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Choose an action for this ally:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {/* Action 1: Attack */}
            <button
              disabled={!canAttack}
              onClick={() => {
                onClose();
                onInitiateAllyAttack(ally.instanceId);
              }}
              className={`w-full p-3 rounded-lg border-3 border-comic-black transition-all flex items-center justify-between gap-3 text-left ${
                canAttack
                  ? 'bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-300 shadow-comic-sm hover:shadow-comic hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer'
                  : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg border-2 border-comic-black shrink-0 ${
                    canAttack ? 'bg-comic-red text-white' : 'bg-slate-300 text-slate-500'
                  }`}
                >
                  <Swords className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-950">
                      Attack ({allyStats.attack} DMG)
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 block mt-0.5">
                    {ally.exhausted
                      ? 'Ally is exhausted'
                      : !isPlayerTurn
                        ? 'Not your turn'
                        : attackTargets.length === 0
                          ? 'No valid attack targets'
                          : `Exhaust to attack an enemy (takes ${consequentialAtk} consequential damage)`}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <span className="text-[10px] text-comic-red font-bold flex items-center gap-0.5">
                  <Skull className="w-3 h-3" /> -{consequentialAtk} HP
                </span>
                <span
                  className={`font-comic text-xs font-black uppercase px-2.5 py-1 rounded border-2 border-comic-black shadow-comic-xs ${
                    canAttack ? 'bg-comic-black text-comic-yellow' : 'bg-slate-300 text-slate-500'
                  }`}
                >
                  STRIKE ➔
                </span>
              </div>
            </button>

            {/* Action 2: Thwart */}
            <button
              disabled={!canThwart}
              onClick={() => {
                onClose();
                onInitiateAllyThwart(ally.instanceId);
              }}
              className={`w-full p-3 rounded-lg border-3 border-comic-black transition-all flex items-center justify-between gap-3 text-left ${
                canThwart
                  ? 'bg-sky-50 hover:bg-sky-100 ring-1 ring-sky-300 shadow-comic-sm hover:shadow-comic hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer'
                  : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-lg border-2 border-comic-black shrink-0 ${
                    canThwart ? 'bg-comic-blue text-white' : 'bg-slate-300 text-slate-500'
                  }`}
                >
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-950">
                      Thwart ({allyStats.thwart} THW)
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 block mt-0.5">
                    {ally.exhausted
                      ? 'Ally is exhausted'
                      : !isPlayerTurn
                        ? 'Not your turn'
                        : !thwartTargets.some((t) => t.allowed)
                          ? 'No schemes can be thwarted'
                          : `Exhaust to remove threat from a scheme (takes ${consequentialThw} consequential damage)`}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <span className="text-[10px] text-comic-red font-bold flex items-center gap-0.5">
                  <Skull className="w-3 h-3" /> -{consequentialThw} HP
                </span>
                <span
                  className={`font-comic text-xs font-black uppercase px-2.5 py-1 rounded border-2 border-comic-black shadow-comic-xs ${
                    canThwart ? 'bg-comic-black text-sky-300' : 'bg-slate-300 text-slate-500'
                  }`}
                >
                  FOIL ➔
                </span>
              </div>
            </button>

            {/* Action 3: Ally Activated Abilities (if declared) */}
            {actionableAbilities.map((ab) => {
              const alreadyUsed = (player.usedAbilitiesThisRound?.[ab.id] || 0) >= 1;
              const costCheck = gameState
                ? canPayAbilityCost(gameState, player, ab, ally, {})
                : { allowed: false };
              const canTrigger = isPlayerTurn && !alreadyUsed && costCheck.allowed;

              return (
                <button
                  key={ab.id}
                  disabled={!canTrigger}
                  onClick={() => {
                    onDispatchAction?.({
                      type: 'USE_CARD_ABILITY',
                      playerId: player.id,
                      cardInstanceId: ally.instanceId,
                      abilityId: ab.id,
                    });
                    onClose();
                  }}
                  className={`w-full p-3 rounded-lg border-3 border-comic-black transition-all flex items-center justify-between gap-3 text-left ${
                    canTrigger
                      ? 'bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300 shadow-comic-sm hover:shadow-comic cursor-pointer'
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
                      <span className="font-black text-sm text-slate-950 block">
                        {ab.id.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-600 block mt-0.5">
                        {alreadyUsed
                          ? 'Already used this round'
                          : ab.steps?.[0]?.params?.description
                            ? String(ab.steps[0].params.description)
                            : `Trigger ${ally.card.name}'s special ability`}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`font-comic text-xs font-black uppercase px-2.5 py-1 rounded border-2 border-comic-black shadow-comic-xs shrink-0 ${
                      canTrigger ? 'bg-comic-black text-amber-300' : 'bg-slate-300 text-slate-500'
                    }`}
                  >
                    TRIGGER ➔
                  </span>
                </button>
              );
            })}
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

export default AllyActionModal;
