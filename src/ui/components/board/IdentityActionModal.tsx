import React from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Heart, Zap, Swords, Target, X, Sparkles } from 'lucide-react';
import { PlayerState, GameState, GameAction, HeroCard, AlterEgoCard } from '../../../engine/models';
import {
  getEffectiveMaxHealth,
  getEffectiveHeroStats,
} from '../../../engine/pipeline/stat-calculator';
import {
  canChangeForm,
  canBasicRecover,
  canBasicThwart,
  canInitiateAbility,
} from '../../../engine/pipeline/legality-checker';
import { getIdentityAttackState } from './identity-action-utils';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';

interface IdentityActionModalProps {
  isOpen: boolean;
  player: PlayerState;
  gameState?: GameState;
  onClose: () => void;
  onDispatchAction?: (action: GameAction) => void;
  onInitiateHeroAttack?: () => void;
  onInitiateHeroThwart?: () => void;
}

export const IdentityActionModal: React.FC<IdentityActionModalProps> = ({
  isOpen,
  player,
  gameState,
  onClose,
  onDispatchAction,
  onInitiateHeroAttack,
  onInitiateHeroThwart,
}) => {
  if (!isOpen) return null;

  const isHero = player.currentForm === 'hero';
  const effectiveMaxHealth = getEffectiveMaxHealth(player, gameState);
  const effectiveStats = getEffectiveHeroStats(
    gameState || ({ sideSchemes: [], players: [] } as any),
    player,
  );
  const isPlayerTurn = gameState
    ? gameState.phase === 'PLAYER_PHASE' &&
      gameState.players[gameState.activePlayerIndex]?.id === player.id
    : true;

  // 1. Change Form Check
  const flipCheck = gameState
    ? canChangeForm(gameState, player.id)
    : { allowed: !player.formChangedThisRound };
  const canFlip = isPlayerTurn && flipCheck.allowed;

  // 2. Recover Check
  const recoverCheck = gameState
    ? canBasicRecover(gameState, player.id)
    : { allowed: !player.exhausted && player.health < effectiveMaxHealth };
  const canRecover =
    !isHero && isPlayerTurn && recoverCheck.allowed && player.health < effectiveMaxHealth;

  // 3. Attack Check
  const attackState = getIdentityAttackState(player, gameState, effectiveStats.attack);
  const { canAttack, canAttackVillain, eligibleMinion } = attackState;

  // 4. Thwart Check
  const canThwartMain = gameState
    ? canBasicThwart(gameState, player.id, 'main_scheme').allowed
    : false;
  const eligibleSideScheme = gameState?.sideSchemes.find(
    (s) => canBasicThwart(gameState, player.id, 'side_scheme', s.instanceId).allowed,
  );
  const canThwart = isHero && isPlayerTurn && (canThwartMain || !!eligibleSideScheme);

  // 5. Identity Abilities
  const idAbilities = player.activeFormCard.enrichment?.abilities || [];
  const actionableAbilities = idAbilities.filter(
    (ab) =>
      ab.timing === 'ACTION' ||
      (isHero && ab.timing === 'HERO_ACTION') ||
      (!isHero && ab.timing === 'ALTER_EGO_ACTION'),
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

        {/* 1. Header Banner */}
        <div
          className={`relative px-5 py-3.5 border-b-4 border-comic-black flex items-center justify-between select-none ${
            isHero ? 'bg-comic-red text-white' : 'bg-comic-yellow text-comic-black'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <CardArtThumbnail
              cardCode={player.activeFormCard.code}
              cardName={player.activeFormCard.name}
              size="sm"
            />
            <div>
              <div
                className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-wider ${
                  isHero ? 'text-comic-yellow' : 'text-slate-800'
                }`}
              >
                <span>{isHero ? 'HERO IDENTITY' : 'ALTER-EGO IDENTITY'}</span>
                {player.exhausted && (
                  <span className="bg-comic-black text-white px-1.5 py-0.2 rounded text-[9px]">
                    EXHAUSTED
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight leading-none drop-shadow-xs">
                {player.activeFormCard.name}
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

        {/* 2. Character Overview Banner */}
        <div className="relative px-5 py-2 bg-amber-100 border-b-2 border-comic-black flex items-center justify-between text-slate-900 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-comic-red" />
            <span>
              Health: {player.health} / {effectiveMaxHealth} HP
            </span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 bg-comic-black text-comic-yellow rounded">
            HAND SIZE:{' '}
            {(player.activeFormCard as unknown as HeroCard | AlterEgoCard).handSize ??
              (isHero ? 5 : 6)}
          </span>
        </div>

        {/* 3. Action Options List */}
        <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
          {/* Alter-Ego Recover Action */}
          {!isHero && (
            <button
              disabled={!canRecover}
              onClick={() => {
                onDispatchAction?.({ type: 'BASIC_RECOVER', playerId: player.id });
                onClose();
              }}
              className={`w-full text-left p-2.5 rounded-lg border-2 border-comic-black transition-all flex items-center justify-between gap-2 shadow-comic-sm ${
                canRecover
                  ? 'bg-emerald-100 hover:bg-emerald-200 cursor-pointer hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
                  : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-full border border-comic-black ${
                    canRecover ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-500'
                  }`}
                >
                  <Heart className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <span className="font-comic font-black text-xs block text-slate-950">
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
              <span
                className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-comic-black ${
                  canRecover ? 'bg-comic-black text-amber-300' : 'bg-slate-300 text-slate-500'
                } shrink-0`}
              >
                REC: {effectiveStats.recovery}
              </span>
            </button>
          )}

          {/* Identity Special Abilities */}
          {actionableAbilities.map((ab) => {
            const abilityKey = ab.id;
            const alreadyUsed = (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1;
            const costCheck = gameState
              ? canInitiateAbility(gameState, player.id, ab, undefined, {})
              : { allowed: !alreadyUsed };
            const canTrigger = isPlayerTurn && !alreadyUsed && costCheck.allowed;

            return (
              <button
                key={ab.id}
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
                className={`w-full text-left p-2.5 rounded-lg border-2 border-comic-black transition-all flex items-center justify-between gap-2 shadow-comic-sm ${
                  canTrigger
                    ? 'bg-amber-100 hover:bg-comic-yellow cursor-pointer hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
                    : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-full border border-comic-black ${
                      canTrigger
                        ? 'bg-comic-yellow text-comic-black'
                        : 'bg-slate-300 text-slate-500'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-comic font-black text-xs block text-slate-950">
                      {ab.id.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-600 block">
                      {alreadyUsed
                        ? 'Already used this round (Limit: once per round)'
                        : ab.steps?.[0]?.effectParams?.description
                          ? String(ab.steps[0].effectParams.description)
                          : ab.id === 'futurist'
                            ? 'Look at top 3 cards of deck, add 1 Tech card to hand, discard rest.'
                            : `Trigger ${player.activeFormCard.name}'s special ability`}
                    </span>
                  </div>
                </div>
                <span
                  className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-comic-black ${
                    canTrigger ? 'bg-comic-black text-amber-300' : 'bg-slate-300 text-slate-500'
                  } shrink-0`}
                >
                  ACTION
                </span>
              </button>
            );
          })}

          {/* Hero Basic Attack & Thwart */}
          {isHero && (
            <>
              {/* Hero Strike */}
              <button
                disabled={!canAttack}
                onClick={() => {
                  onClose();
                  if (onInitiateHeroAttack) {
                    onInitiateHeroAttack();
                  } else if (canAttackVillain) {
                    onDispatchAction?.({
                      type: 'BASIC_ATTACK',
                      playerId: player.id,
                      targetType: 'villain',
                    });
                  } else if (eligibleMinion?.instanceId) {
                    onDispatchAction?.({
                      type: 'BASIC_ATTACK',
                      playerId: player.id,
                      targetType: 'minion',
                      targetInstanceId: eligibleMinion.instanceId,
                    });
                  }
                }}
                className={`w-full text-left p-2.5 rounded-lg border-2 border-comic-black transition-all flex items-center justify-between gap-2 shadow-comic-sm ${
                  canAttack
                    ? 'bg-rose-100 hover:bg-rose-200 cursor-pointer hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
                    : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-full border border-comic-black ${
                      canAttack ? 'bg-comic-red text-white' : 'bg-slate-300 text-slate-500'
                    }`}
                  >
                    <Swords className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-comic font-black text-xs block text-slate-950">
                      Attack ({effectiveStats.attack} DMG)
                    </span>
                    <span className="text-[10px] text-slate-600 block">{attackState.subtext}</span>
                  </div>
                </div>
                <span
                  className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-comic-black ${
                    canAttack ? 'bg-comic-black text-rose-300' : 'bg-slate-300 text-slate-500'
                  } shrink-0`}
                >
                  {effectiveStats.attack} ATK
                </span>
              </button>

              {/* Hero Thwart */}
              <button
                disabled={!canThwart}
                onClick={() => {
                  onClose();
                  if (onInitiateHeroThwart) {
                    onInitiateHeroThwart();
                  } else if (canThwartMain) {
                    onDispatchAction?.({
                      type: 'BASIC_THWART',
                      playerId: player.id,
                      targetType: 'main_scheme',
                    });
                  } else if (eligibleSideScheme) {
                    onDispatchAction?.({
                      type: 'BASIC_THWART',
                      playerId: player.id,
                      targetType: 'side_scheme',
                      targetInstanceId: eligibleSideScheme.instanceId,
                    });
                  }
                }}
                className={`w-full text-left p-2.5 rounded-lg border-2 border-comic-black transition-all flex items-center justify-between gap-2 shadow-comic-sm ${
                  canThwart
                    ? 'bg-sky-100 hover:bg-sky-200 cursor-pointer hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
                    : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-full border border-comic-black ${
                      canThwart ? 'bg-sky-500 text-white' : 'bg-slate-300 text-slate-500'
                    }`}
                  >
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-comic font-black text-xs block text-slate-950">
                      Thwart ({effectiveStats.thwart} THW)
                    </span>
                    <span className="text-[10px] text-slate-600 block">
                      {player.exhausted
                        ? 'Hero is exhausted'
                        : !canThwart
                          ? 'No threat on schemes (Target not valid)'
                          : canThwartMain
                            ? `Exhaust to remove ${effectiveStats.thwart} threat from main scheme`
                            : `Exhaust to remove ${effectiveStats.thwart} threat from ${eligibleSideScheme?.card.name}`}
                    </span>
                  </div>
                </div>
                <span
                  className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-comic-black ${
                    canThwart ? 'bg-comic-black text-sky-300' : 'bg-slate-300 text-slate-500'
                  } shrink-0`}
                >
                  {effectiveStats.thwart} THW
                </span>
              </button>
            </>
          )}

          {/* Change Form / Flip */}
          <button
            disabled={!canFlip}
            onClick={() => {
              onDispatchAction?.({ type: 'CHANGE_FORM', playerId: player.id });
              onClose();
            }}
            className={`w-full text-left p-2.5 rounded-lg border-2 border-comic-black transition-all flex items-center justify-between gap-2 shadow-comic-sm ${
              canFlip
                ? isHero
                  ? 'bg-amber-100 hover:bg-comic-yellow cursor-pointer hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
                  : 'bg-comic-red/20 hover:bg-comic-red/30 cursor-pointer hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
                : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-full border border-comic-black ${
                  canFlip ? 'bg-comic-black text-white' : 'bg-slate-300 text-slate-500'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <span className="font-comic font-black text-xs block text-slate-950">
                  {isHero ? 'Flip to Alter-Ego' : 'Suit Up (Hero Form)'}
                </span>
                <span className="text-[10px] text-slate-600 block">
                  {!flipCheck.allowed
                    ? 'Already changed form this round (Limit: once per round)'
                    : 'Change identity form'}
                </span>
              </div>
            </div>
            <span
              className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-comic-black ${
                canFlip ? 'bg-comic-black text-amber-300' : 'bg-slate-300 text-slate-500'
              } shrink-0`}
            >
              1 / ROUND
            </span>
          </button>
        </div>

        {/* 4. Footer */}
        <div className="p-3 bg-comic-paper border-t-2 border-comic-black flex justify-end">
          <button
            onClick={onClose}
            className="bg-comic-black hover:bg-slate-800 text-white font-comic text-xs px-4 py-2 rounded-lg border-2 border-comic-black shadow-comic-sm active:translate-y-0.5 font-bold cursor-pointer uppercase flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default IdentityActionModal;
