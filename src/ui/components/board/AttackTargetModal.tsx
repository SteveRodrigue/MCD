import React from 'react';
import { createPortal } from 'react-dom';
import { Swords, ShieldAlert, Sparkles, X, Crosshair, Skull } from 'lucide-react';
import { CardInstance, GameState, MinionCard, StatusCard, Keyword } from '../../../engine/models';
import { canBasicAttack, canAllyAttack } from '../../../engine/pipeline/legality-checker';

export interface EnemyTarget {
  id: string;
  name: string;
  type: 'villain' | 'minion';
  instanceId?: string;
  health: number;
  maxHealth: number;
  damage: number;
  traits: string[];
  hasGuard: boolean;
  hasTough: boolean;
  cardInstance?: CardInstance;
}

export function getValidAttackTargets(
  state: GameState,
  playerId: string,
  attackerType: 'hero' | 'ally',
  allyInstanceId?: string,
): EnemyTarget[] {
  const targets: EnemyTarget[] = [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return targets;

  // 1. Villain Check
  const canAtkVillain =
    attackerType === 'hero'
      ? canBasicAttack(state, playerId, 'villain').allowed
      : allyInstanceId
        ? canAllyAttack(state, playerId, allyInstanceId, 'villain').allowed
        : false;

  if (canAtkVillain) {
    const vHealth = state.villain.health;
    const vMaxHealth = state.villain.card.health || 14;
    const hasTough = (state.villain.statusCards || []).includes(StatusCard.TOUGH);
    targets.push({
      id: 'villain',
      name: state.villain.card.name,
      type: 'villain',
      health: vHealth,
      maxHealth: vMaxHealth,
      damage: Math.max(0, vMaxHealth - vHealth),
      traits: state.villain.card.traits || [],
      hasGuard: false,
      hasTough,
    });
  }

  // 2. Engaged Minions Check across all players
  for (const p of state.players) {
    for (const minion of p.engagedMinions || []) {
      const canAtkMinion =
        attackerType === 'hero'
          ? canBasicAttack(state, playerId, 'minion', minion.instanceId).allowed
          : allyInstanceId
            ? canAllyAttack(state, playerId, allyInstanceId, 'minion', minion.instanceId).allowed
            : false;

      if (canAtkMinion) {
        const mMax = (minion.card as MinionCard).health || 1;
        const mDamage = minion.tokens?.damage || 0;
        const mHealth = Math.max(0, mMax - mDamage);
        const hasGuard =
          minion.card.keywords?.includes(Keyword.GUARD) ||
          (minion.card.text || '').includes('Guard') ||
          (minion.card.traits || []).includes('Guard');
        const hasTough = (minion.statusCards || []).includes(StatusCard.TOUGH);

        targets.push({
          id: minion.instanceId,
          name: minion.card.name,
          type: 'minion',
          instanceId: minion.instanceId,
          health: mHealth,
          maxHealth: mMax,
          damage: mDamage,
          traits: minion.card.traits || [],
          hasGuard: !!hasGuard,
          hasTough,
          cardInstance: minion,
        });
      }
    }
  }

  return targets;
}

interface AttackTargetModalProps {
  isOpen: boolean;
  attackerName: string;
  attackerType: 'hero' | 'ally';
  attackDamage: number;
  targets: EnemyTarget[];
  onSelectTarget: (target: EnemyTarget) => void;
  onClose: () => void;
}

export const AttackTargetModal: React.FC<AttackTargetModalProps> = ({
  isOpen,
  attackerName,
  attackerType,
  attackDamage,
  targets,
  onSelectTarget,
  onClose,
}) => {
  if (!isOpen || targets.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-comic-black/80 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl overflow-hidden flex flex-col font-comic">
        {/* Comic dots overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* 1. Pop-Art Header */}
        <div className="relative px-6 py-4 bg-comic-red border-b-4 border-comic-black flex items-center justify-between text-white select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-comic-black rounded-lg shadow-comic-sm">
              <Crosshair className="w-6 h-6 text-comic-yellow animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-comic-yellow">
                <Swords className="w-3.5 h-3.5" />
                <span>
                  {attackerType === 'hero' ? 'Hero Strike' : 'Ally Strike'} • {attackDamage} DMG
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                TARGET SELECTION
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-comic-black hover:bg-slate-800 text-white rounded-lg border-2 border-white/40 shadow-comic-sm transition-transform active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Attacker Banner */}
        <div className="relative px-6 py-2.5 bg-amber-200 border-b-2 border-comic-black flex items-center justify-between text-slate-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-comic-red" />
            <span className="text-xs sm:text-sm font-bold">
              <strong className="font-black uppercase">{attackerName}</strong> is ready to strike!
            </span>
          </div>
          <span className="font-mono text-xs font-black px-2 py-0.5 bg-comic-black text-comic-red rounded border border-comic-black">
            {attackDamage} ATK
          </span>
        </div>

        {/* 3. Targets List */}
        <div className="relative p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Choose an enemy target to attack:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {targets.map((target) => {
              const isVillain = target.type === 'villain';

              return (
                <button
                  key={target.id}
                  onClick={() => {
                    onSelectTarget(target);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-lg border-3 border-comic-black transition-all flex items-center justify-between gap-3 shadow-comic-sm hover:shadow-comic hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer text-left ${
                    isVillain
                      ? 'bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-300'
                      : 'bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg border-2 border-comic-black shrink-0 ${
                        isVillain ? 'bg-comic-red text-white' : 'bg-amber-400 text-slate-950'
                      }`}
                    >
                      {isVillain ? (
                        <Skull className="w-5 h-5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm sm:text-base text-slate-950 truncate">
                          {target.name}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-comic-black ${
                            isVillain ? 'bg-comic-red text-white' : 'bg-comic-yellow text-slate-950'
                          }`}
                        >
                          {isVillain ? 'VILLAIN' : 'MINION'}
                        </span>
                        {target.hasGuard && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-comic-red text-white border border-comic-black animate-pulse">
                            GUARD
                          </span>
                        )}
                        {target.hasTough && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-comic-blue text-white border border-comic-black">
                            TOUGH
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                        <span>
                          HP: <strong className="text-slate-900 font-black">{target.health}</strong>{' '}
                          / {target.maxHealth}
                        </span>
                        {target.damage > 0 && (
                          <span className="text-comic-red font-bold">({target.damage} dmg)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className="font-comic text-xs font-black uppercase px-3 py-1.5 bg-comic-black text-comic-yellow rounded-lg border-2 border-comic-black shadow-comic-xs">
                      STRIKE ➔
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Footer */}
        <div className="relative px-6 py-3 bg-slate-100 border-t-2 border-comic-black flex justify-end">
          <button
            onClick={onClose}
            className="font-comic text-xs font-black py-2 px-4 rounded-lg border-2 border-comic-black bg-slate-200 hover:bg-slate-300 text-slate-800 shadow-comic-sm active:translate-y-0.5 cursor-pointer uppercase"
          >
            Cancel Strike
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AttackTargetModal;
