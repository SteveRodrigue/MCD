import React from 'react';
import { RefreshCw, Heart, Zap, Swords, Target, X } from 'lucide-react';
import { PlayerState, GameState, GameAction } from '../../../engine/models';
import {
  getEffectiveMaxHealth,
  getEffectiveHeroStats,
} from '../../../engine/pipeline/stat-calculator';
import { canChangeForm, canBasicRecover, canBasicAttack, canBasicThwart } from '../../../engine/pipeline/legality-checker';
import { canPayAbilityCost } from '../../../engine/pipeline/cost-engine';

interface IdentityActionModalProps {
  isOpen: boolean;
  player: PlayerState;
  gameState?: GameState;
  onClose: () => void;
  onDispatchAction?: (action: GameAction) => void;
}

export const IdentityActionModal: React.FC<IdentityActionModalProps> = ({
  isOpen,
  player,
  gameState,
  onClose,
  onDispatchAction,
}) => {
  if (!isOpen) return null;

  const isHero = player.currentForm === 'hero';
  const effectiveMaxHealth = getEffectiveMaxHealth(player, gameState);
  const effectiveStats = getEffectiveHeroStats(gameState || ({ sideSchemes: [], players: [] } as any), player);
  const isPlayerTurn = gameState
    ? gameState.phase === 'PLAYER_PHASE' && gameState.players[gameState.activePlayerIndex]?.id === player.id
    : true;

  // 1. Change Form Check
  const flipCheck = gameState ? canChangeForm(gameState, player.id) : { allowed: !player.formChangedThisRound };
  const canFlip = isPlayerTurn && flipCheck.allowed;

  // 2. Recover Check
  const recoverCheck = gameState ? canBasicRecover(gameState, player.id) : { allowed: !player.exhausted && player.health < effectiveMaxHealth };
  const canRecover = !isHero && isPlayerTurn && recoverCheck.allowed && player.health < effectiveMaxHealth;

  // 3. Attack Check
  const attackCheck = gameState ? canBasicAttack(gameState, player.id, 'villain') : { allowed: isHero && !player.exhausted };
  const canAttack = isHero && isPlayerTurn && attackCheck.allowed;

  // 4. Thwart Check
  const thwartCheck = gameState ? canBasicThwart(gameState, player.id, 'main_scheme') : { allowed: isHero && !player.exhausted };
  const canThwart = isHero && isPlayerTurn && thwartCheck.allowed;

  // 5. Identity Abilities (e.g. Tony Stark Futurist, Carol Danvers Rechannel, Peter Parker Scientist)
  const idAbilities = player.activeFormCard.enrichment?.abilities || [];
  const actionableAbilities = idAbilities.filter(
    (ab) =>
      ab.timing === 'ACTION' ||
      (isHero && ab.timing === 'HERO_ACTION') ||
      (!isHero && ab.timing === 'ALTER_EGO_ACTION'),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-[#fbf7ee] text-slate-900 border-4 border-slate-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-sm overflow-hidden flex flex-col font-serif">
        {/* Header Banner */}
        <div className="bg-[#f4ebd9] border-b-2 border-slate-900 p-3 relative select-none">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 bg-slate-900 text-white hover:bg-comic-red rounded border-2 border-slate-950 shadow-comic-sm transition-all cursor-pointer z-10 flex items-center justify-center"
            title="Cancel & Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-700 font-bold border-b border-slate-800 pb-1 mb-1 pr-8">
            <span>IDENTITY ACTIONS</span>
            <span
              className={`font-comic font-black px-1.5 py-0.2 rounded border border-slate-900 uppercase text-[9px] ${
                isHero ? 'bg-comic-red text-white' : 'bg-amber-300 text-slate-950'
              }`}
            >
              {isHero ? 'HERO FORM' : 'ALTER-EGO FORM'}
            </span>
          </div>

          <div className="text-center py-1">
            <h2 className="text-2xl font-black uppercase tracking-tight font-serif text-slate-950 leading-none">
              {player.activeFormCard.name}
            </h2>
            <p className="text-[11px] italic text-slate-700 font-serif mt-0.5">
              Choose an available action for this character:
            </p>
          </div>
        </div>

        {/* Action Options List */}
        <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto divide-y divide-slate-300">
          {/* 1. Alter-Ego Recover Action */}
          {!isHero && (
            <div className="pt-2 first:pt-0">
              <button
                disabled={!canRecover}
                onClick={() => {
                  onDispatchAction?.({ type: 'BASIC_RECOVER', playerId: player.id });
                  onClose();
                }}
                className={`w-full text-left p-2.5 rounded border-2 border-slate-900 transition-all flex items-center justify-between gap-2 shadow-sm ${
                  canRecover
                    ? 'bg-emerald-100 hover:bg-emerald-200 cursor-pointer hover:shadow-md'
                    : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-full border border-slate-900 ${canRecover ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-500'}`}>
                    <Heart className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <span className="font-comic font-bold text-xs block text-slate-950">
                      Recover (+{effectiveStats.recovery} HP)
                    </span>
                    <span className="text-[10px] text-slate-600 block">
                      {player.health >= effectiveMaxHealth
                        ? `Already at maximum health (${player.health} / ${effectiveMaxHealth} HP)`
                        : player.exhausted
                          ? 'Identity is exhausted'
                          : `Exhaust ${player.activeFormCard.name} to heal from ${player.health} to ${Math.min(effectiveMaxHealth, player.health + effectiveStats.recovery)} HP`}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 shrink-0">
                  REC: {effectiveStats.recovery}
                </span>
              </button>
            </div>
          )}

          {/* 2. Identity Special Abilities (e.g. Tony Stark Futurist) */}
          {actionableAbilities.map((ab) => {
            const abilityKey = ab.id;
            const alreadyUsed = (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1;
            const costCheck = gameState ? canPayAbilityCost(gameState, player, ab, undefined, {}) : { allowed: !alreadyUsed };
            const canTrigger = isPlayerTurn && !alreadyUsed && costCheck.allowed;

            return (
              <div key={ab.id} className="pt-2 first:pt-0">
                <button
                  disabled={!canTrigger}
                  onClick={() => {
                    onDispatchAction?.({
                      type: 'USE_CARD_ABILITY',
                      playerId: player.id,
                      cardInstanceId: player.activeFormCard.code,
                      abilityId: ab.id,
                    });
                    onClose();
                  }}
                  className={`w-full text-left p-2.5 rounded border-2 border-slate-900 transition-all flex items-center justify-between gap-2 shadow-sm ${
                    canTrigger
                      ? 'bg-amber-100 hover:bg-amber-200 cursor-pointer hover:shadow-md'
                      : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full border border-slate-900 ${canTrigger ? 'bg-amber-400 text-slate-950' : 'bg-slate-300 text-slate-500'}`}>
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-comic font-bold text-xs block text-slate-950">
                        {ab.id.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-600 block">
                        {alreadyUsed
                          ? 'Already used this round (Limit: once per round)'
                          : ab.steps?.[0]?.params?.description
                            ? String(ab.steps[0].params.description)
                            : ab.id === 'futurist'
                              ? 'Look at top 3 cards of deck, add 1 Tech card to hand, discard rest.'
                              : `Trigger ${player.activeFormCard.name}'s special ability`}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 shrink-0">
                    ACTION
                  </span>
                </button>
              </div>
            );
          })}

          {/* 3. Hero Basic Attack & Thwart */}
          {isHero && (
            <>
              {/* Hero Strike */}
              <div className="pt-2 first:pt-0">
                <button
                  disabled={!canAttack}
                  onClick={() => {
                    onDispatchAction?.({ type: 'BASIC_ATTACK', playerId: player.id, targetType: 'villain' });
                    onClose();
                  }}
                  className={`w-full text-left p-2.5 rounded border-2 border-slate-900 transition-all flex items-center justify-between gap-2 shadow-sm ${
                    canAttack
                      ? 'bg-rose-100 hover:bg-rose-200 cursor-pointer hover:shadow-md'
                      : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full border border-slate-900 ${canAttack ? 'bg-comic-red text-white' : 'bg-slate-300 text-slate-500'}`}>
                      <Swords className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-comic font-bold text-xs block text-slate-950">
                        Attack ({effectiveStats.attack} DMG)
                      </span>
                      <span className="text-[10px] text-slate-600 block">
                        {player.exhausted ? 'Hero is exhausted' : `Exhaust to attack villain for ${effectiveStats.attack} damage`}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-rose-300 shrink-0">
                    {effectiveStats.attack} ATK
                  </span>
                </button>
              </div>

              {/* Hero Thwart */}
              <div className="pt-2">
                <button
                  disabled={!canThwart}
                  onClick={() => {
                    onDispatchAction?.({ type: 'BASIC_THWART', playerId: player.id, targetType: 'main_scheme' });
                    onClose();
                  }}
                  className={`w-full text-left p-2.5 rounded border-2 border-slate-900 transition-all flex items-center justify-between gap-2 shadow-sm ${
                    canThwart
                      ? 'bg-sky-100 hover:bg-sky-200 cursor-pointer hover:shadow-md'
                      : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-full border border-slate-900 ${canThwart ? 'bg-sky-500 text-white' : 'bg-slate-300 text-slate-500'}`}>
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-comic font-bold text-xs block text-slate-950">
                        Thwart ({effectiveStats.thwart} THW)
                      </span>
                      <span className="text-[10px] text-slate-600 block">
                        {player.exhausted
                          ? 'Hero is exhausted'
                          : (gameState?.mainScheme?.threat || 0) <= 0
                            ? 'No threat on main scheme (Target not valid)'
                            : `Exhaust to remove ${effectiveStats.thwart} threat from main scheme`}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-sky-300 shrink-0">
                    {effectiveStats.thwart} THW
                  </span>
                </button>
              </div>
            </>
          )}

          {/* 4. Change Form / Flip */}
          <div className="pt-2">
            <button
              disabled={!canFlip}
              onClick={() => {
                onDispatchAction?.({ type: 'CHANGE_FORM', playerId: player.id });
                onClose();
              }}
              className={`w-full text-left p-2.5 rounded border-2 border-slate-900 transition-all flex items-center justify-between gap-2 shadow-sm ${
                canFlip
                  ? isHero
                    ? 'bg-amber-100 hover:bg-amber-200 cursor-pointer'
                    : 'bg-comic-red/20 hover:bg-comic-red/30 cursor-pointer'
                  : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-full border border-slate-900 ${canFlip ? 'bg-slate-900 text-white' : 'bg-slate-300 text-slate-500'}`}>
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-comic font-bold text-xs block text-slate-950">
                    {isHero ? 'Flip to Alter-Ego' : 'Suit Up (Hero Form)'}
                  </span>
                  <span className="text-[10px] text-slate-600 block">
                    {!flipCheck.allowed ? 'Already changed form this round (Limit: once per round)' : 'Change identity form'}
                  </span>
                </div>
              </div>
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 shrink-0">
                1 / ROUND
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Back / Cancel Action Bar */}
        <div className="p-3 bg-[#f4ebd9] border-t-2 border-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-comic text-xs px-4 py-2 rounded border-2 border-slate-950 shadow-comic-sm active:translate-y-0.5 font-bold cursor-pointer uppercase flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Back / Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdentityActionModal;
