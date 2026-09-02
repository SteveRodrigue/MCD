import React, { useState } from 'react';
import {
  Shield,
  Heart,
  Users,
  Zap,
  AlertOctagon,
  Sparkles,
  RefreshCw,
  Swords,
  Target,
} from 'lucide-react';
import {
  PlayerState,
  StatusCard,
  GameState,
  HeroCard,
  AlterEgoCard,
  GameAction,
} from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { CardAttachmentFan } from '../cards/CardAttachmentFan';
import { IdentityActionModal } from './IdentityActionModal';
import { AttackTargetModal, EnemyTarget, getValidAttackTargets } from './AttackTargetModal';
import {
  getEffectiveMaxHealth,
  getEffectiveHeroStats,
  getEffectiveHandSize,
  getEffectiveAllyStats,
} from '../../../engine/pipeline/stat-calculator';
import { canPayAbilityCost } from '../../../engine/pipeline/cost-engine';

interface HeroZoneProps {
  player: PlayerState;
  gameState?: GameState;
  seatNumber?: number;
  isFocused?: boolean;
  isMultiHero?: boolean;
  onFocus?: () => void;
  onDispatchAction?: (action: GameAction) => void;
}

export const HeroZone: React.FC<HeroZoneProps> = ({
  player,
  gameState,
  seatNumber,
  isFocused = true,
  isMultiHero = false,
  onFocus,
  onDispatchAction,
}) => {
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);

  const isHero = player.currentForm === 'hero';
  const isPlayerTurn = gameState
    ? gameState.phase === 'PLAYER_PHASE' &&
      gameState.players[gameState.activePlayerIndex]?.id === player.id
    : true;
  const heroCard = player.hero as HeroCard;
  const alterEgoCard = player.alterEgo as AlterEgoCard;

  // Dynamic Stat & Health Calculations
  const effectiveMaxHealth = getEffectiveMaxHealth(player, gameState);
  const baseMaxHealth = heroCard.health || player.maxHealth || 10;
  const hpBonus = Math.max(0, effectiveMaxHealth - baseMaxHealth);

  const healthPercent = Math.max(0, Math.min(100, (player.health / effectiveMaxHealth) * 100));
  const engagedMinions = player.engagedMinions || [];

  const effectiveStats = getEffectiveHeroStats(
    gameState || ({ sideSchemes: [], players: [] } as any),
    player,
  );
  const effectiveHandSize = getEffectiveHandSize(player, gameState);

  const baseAtk = isHero ? heroCard.attack || 0 : 0;
  const baseThw = isHero ? heroCard.thwart || 0 : 0;
  const baseDef = isHero ? heroCard.defense || 0 : 0;
  const baseHandSize = isHero ? heroCard.handSize || 5 : alterEgoCard.handSize || 6;

  const atkBonus = effectiveStats.attack - baseAtk;
  const thwBonus = effectiveStats.thwart - baseThw;
  const defBonus = effectiveStats.defense - baseDef;
  const handBonus = effectiveHandSize - baseHandSize;

  // Action Permissions
  const validHeroAttackTargets = gameState
    ? getValidAttackTargets(gameState, player.id, 'hero')
    : [];
  const canFlip = !player.basicChangeFormUsedThisRound && !player.formChangedThisRound;
  const canRecover =
    !isHero &&
    !player.exhausted &&
    !player.recoveryUsedThisRound &&
    player.health < effectiveMaxHealth;
  const canAttack =
    isHero && !player.exhausted && isPlayerTurn && validHeroAttackTargets.length > 0;
  const canThwart = isHero && !player.exhausted && (gameState?.mainScheme?.threat || 0) > 0;

  // Attack Target Selection State
  const [attackModalState, setAttackModalState] = useState<{
    isOpen: boolean;
    attackerName: string;
    attackerType: 'hero' | 'ally';
    allyInstanceId?: string;
    attackDamage: number;
    targets: EnemyTarget[];
  }>({
    isOpen: false,
    attackerName: '',
    attackerType: 'hero',
    attackDamage: 0,
    targets: [],
  });

  const handleInitiateAttack = (attackerType: 'hero' | 'ally', allyInstanceId?: string) => {
    if (!gameState || !onDispatchAction) return;

    if (attackerType === 'hero') {
      const targets = getValidAttackTargets(gameState, player.id, 'hero');
      if (targets.length === 0) return;
      if (targets.length === 1) {
        onDispatchAction({
          type: 'BASIC_ATTACK',
          playerId: player.id,
          targetType: targets[0].type,
          targetInstanceId: targets[0].instanceId,
        });
      } else {
        setAttackModalState({
          isOpen: true,
          attackerName: player.activeFormCard.name,
          attackerType: 'hero',
          attackDamage: effectiveStats.attack,
          targets,
        });
      }
    } else if (allyInstanceId) {
      const ally = player.allies.find((a) => a.instanceId === allyInstanceId);
      if (!ally) return;
      const allyStats = getEffectiveAllyStats(gameState, ally);
      const targets = getValidAttackTargets(gameState, player.id, 'ally', allyInstanceId);
      if (targets.length === 0) return;
      if (targets.length === 1) {
        onDispatchAction({
          type: 'ALLY_ATTACK',
          playerId: player.id,
          allyInstanceId,
          targetType: targets[0].type,
          targetInstanceId: targets[0].instanceId,
        });
      } else {
        setAttackModalState({
          isOpen: true,
          attackerName: ally.card.name,
          attackerType: 'ally',
          allyInstanceId,
          attackDamage: allyStats.attack,
          targets,
        });
      }
    }
  };

  return (
    <section
      className={`comic-panel p-4 bg-white/95 relative shadow-comic space-y-4 transition-all ${
        !isFocused
          ? 'opacity-90 hover:opacity-100 ring-2 ring-slate-300'
          : 'ring-2 ring-comic-blue shadow-comic-lg'
      }`}
    >
      {/* Zone Title Ribbon */}
      <div className="absolute -top-3 left-4 flex items-center gap-2">
        <div
          className={`text-white border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1 ${
            isFocused ? 'bg-comic-blue' : 'bg-slate-700'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>
            {seatNumber ? `SEAT ${seatNumber}: ` : ''}
            {player.name}
            {isMultiHero && (isFocused ? ' • (ACTIVE HERO)' : '')}
          </span>
        </div>

        {!isFocused && onFocus && (
          <button
            onClick={onFocus}
            className="bg-amber-300 hover:bg-amber-400 text-slate-950 font-comic text-[11px] px-2.5 py-0.5 rounded border border-comic-black shadow-comic-sm cursor-pointer font-bold"
          >
            Switch Active Hand ➔
          </button>
        )}
      </div>

      {/* 1. Engaged Minions Row (Always Visible for this Hero Seat!) */}
      <div className="bg-rose-50/80 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm">
        <div className="flex items-center justify-between border-b border-rose-200 pb-1 mb-2">
          <div className="flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4 text-comic-red" />
            <span className="font-comic text-xs text-comic-red uppercase font-bold">
              Minions Engaged with {player.name} ({engagedMinions.length})
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Encounter Threat Zone
          </span>
        </div>

        {engagedMinions.length > 0 ? (
          <div className="flex flex-wrap gap-4 items-center pt-1">
            {engagedMinions.map((minion) => {
              const isGuard =
                minion.card.traits?.includes('Guard') || minion.card.text?.includes('Guard');
              const isTough = minion.statusCards?.includes(StatusCard.TOUGH) ?? false;

              return (
                <div key={minion.instanceId} className="flex flex-col items-center gap-1">
                  <CardView card={minion.card} instance={minion} size="sm" enableHoverZoom={true} />
                  <div className="flex items-center gap-1">
                    {isGuard && (
                      <span className="bg-slate-900 text-comic-yellow border border-comic-black font-comic text-[10px] px-1.5 py-0.5 rounded font-bold">
                        GUARD
                      </span>
                    )}
                    {isTough && (
                      <span className="bg-sky-400 text-slate-950 border border-comic-black font-comic text-[10px] px-1.5 py-0.5 rounded font-bold">
                        TOUGH
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-2 px-3 border-2 border-dashed border-rose-200 rounded-lg text-center text-xs text-rose-400 font-semibold bg-white/60 flex items-center justify-center gap-2">
            <span>🛡️ No minions engaged with {player.name} (Perimeter secure).</span>
          </div>
        )}
      </div>

      {/* 2. Main Hero Play Area Grid: Identity Station, Allies, Tableau */}
      <div className="flex flex-wrap items-start gap-4 pt-1">
        {/* Identity Station (Shrunk to exact width of card + borders) */}
        <div className="w-fit min-w-[210px] flex flex-col gap-2 bg-sky-50/80 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-comic-blue shrink-0" />
              <span className="font-comic text-sm text-comic-black truncate max-w-[110px]">
                {player.activeFormCard.name}
              </span>
            </div>
            <span
              className={`font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black uppercase shadow-comic-sm font-bold shrink-0 ${
                isHero ? 'bg-comic-red text-white' : 'bg-amber-300 text-slate-950'
              }`}
            >
              {isHero ? 'HERO' : 'ALTER-EGO'}
            </span>
          </div>

          {/* Health Bar (Exact width of card) */}
          <div className="w-full space-y-0.5">
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span className="text-slate-600 flex items-center gap-1">
                <Heart className="w-3 h-3 text-comic-red fill-comic-red" />
                Health:
              </span>
              <div className="flex items-center gap-1">
                <span className="text-comic-blue font-comic text-xs">
                  {player.health} / {effectiveMaxHealth} HP
                </span>
                {hpBonus > 0 && (
                  <span className="bg-emerald-400 text-slate-950 font-comic text-[9px] px-1 py-0.2 rounded border border-comic-black font-bold shadow-comic-sm flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />+{hpBonus}
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-comic-black shadow-comic-sm">
              <div
                className="bg-comic-blue h-full transition-all duration-300"
                style={{ width: `${healthPercent}%` }}
              />
            </div>
          </div>

          {/* Dynamic Combat & Aura Stat Strip */}
          <div className="flex items-center justify-between gap-1 bg-white/90 p-1.5 rounded-lg border border-comic-black text-[10px] font-comic font-bold shadow-comic-sm">
            {isHero ? (
              <>
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-[8px] uppercase">THW</span>
                  <span
                    className={`flex items-center ${thwBonus > 0 ? 'text-emerald-600 font-black' : 'text-slate-900'}`}
                  >
                    {effectiveStats.thwart}
                    {thwBonus > 0 && (
                      <span className="text-[8px] text-emerald-500 ml-0.5">+{thwBonus}</span>
                    )}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-300" />
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-[8px] uppercase">ATK</span>
                  <span
                    className={`flex items-center ${atkBonus > 0 ? 'text-comic-red font-black' : 'text-slate-900'}`}
                  >
                    {effectiveStats.attack}
                    {atkBonus > 0 && (
                      <span className="text-[8px] text-rose-500 ml-0.5">+{atkBonus}</span>
                    )}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-300" />
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-[8px] uppercase">DEF</span>
                  <span
                    className={`flex items-center ${defBonus > 0 ? 'text-blue-600 font-black' : 'text-slate-900'}`}
                  >
                    {effectiveStats.defense}
                    {defBonus > 0 && (
                      <span className="text-[8px] text-blue-500 ml-0.5">+{defBonus}</span>
                    )}
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-300" />
                <div className="flex flex-col items-center">
                  <span className="text-slate-500 text-[8px] uppercase">HAND</span>
                  <span
                    className={`flex items-center ${handBonus > 0 ? 'text-amber-600 font-black' : 'text-slate-900'}`}
                  >
                    {effectiveHandSize}
                    {handBonus > 0 && (
                      <span className="text-[8px] text-amber-500 ml-0.5">+{handBonus}</span>
                    )}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center px-2">
                  <span className="text-slate-500 text-[8px] uppercase">REC</span>
                  <span className="text-slate-900">{effectiveStats.recovery}</span>
                </div>
                <div className="h-4 w-px bg-slate-300" />
                <div className="flex flex-col items-center px-2">
                  <span className="text-slate-500 text-[8px] uppercase">HAND SIZE</span>
                  <span
                    className={`flex items-center ${handBonus > 0 ? 'text-amber-600 font-black' : 'text-slate-900'}`}
                  >
                    {effectiveHandSize}
                    {handBonus > 0 && (
                      <span className="text-[8px] text-amber-500 ml-0.5">+{handBonus}</span>
                    )}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Status Overlay Badges */}
          {player.statusCards.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {player.statusCards.map((st, i) => (
                <span
                  key={i}
                  className={`font-comic text-[10px] px-1.5 py-0.5 rounded border border-comic-black uppercase shadow-comic-sm font-bold ${
                    st === StatusCard.TOUGH
                      ? 'bg-sky-400 text-slate-950'
                      : st === StatusCard.STUNNED
                        ? 'bg-amber-300 text-slate-950'
                        : 'bg-fuchsia-300 text-slate-950'
                  }`}
                >
                  {st}
                </span>
              ))}
            </div>
          )}

          {/* Identity Card */}
          <div className="pt-0.5 flex flex-col justify-center items-center w-full">
            <CardView
              card={player.activeFormCard}
              isExhausted={player.exhausted}
              size="sm"
              showTokens={false}
              enableHoverZoom={true}
              onClick={() => setIsIdentityModalOpen(true)}
            />
            <CardAttachmentFan
              attachments={player.attachments}
              cardsUnderneath={player.cardsUnderneath}
            />
          </div>

          {/* Identity Action Console (Flip, Recover, Attack, Thwart) */}
          {onDispatchAction && (
            <div className="flex flex-col gap-1.5 pt-1 w-full border-t border-slate-200">
              {/* 1. Change Form / Flip Button */}
              <button
                disabled={!canFlip}
                onClick={() => onDispatchAction({ type: 'CHANGE_FORM', playerId: player.id })}
                className={`w-full font-comic text-xs py-1.5 px-2 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1.5 transition-all shadow-comic-sm ${
                  canFlip
                    ? isHero
                      ? 'bg-amber-300 hover:bg-amber-400 text-slate-950 font-bold active:translate-y-0.5'
                      : 'bg-comic-red hover:bg-red-600 text-white font-bold active:translate-y-0.5'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                }`}
                title={
                  canFlip ? 'Change Form (Limit once per round)' : 'Already changed form this round'
                }
              >
                <RefreshCw className={`w-3.5 h-3.5 ${canFlip ? 'animate-pulse' : ''}`} />
                <span>{isHero ? 'Flip to Alter-Ego' : 'Suit Up (Hero Form)'}</span>
              </button>

              {/* 2. Alter-Ego Basic Recover */}
              {!isHero && (
                <button
                  disabled={!canRecover}
                  onClick={() => onDispatchAction({ type: 'BASIC_RECOVER', playerId: player.id })}
                  className={`w-full font-comic text-xs py-1.5 px-2 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1.5 transition-all shadow-comic-sm ${
                    canRecover
                      ? 'bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-bold active:translate-y-0.5'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  }`}
                  title={
                    player.exhausted
                      ? 'Identity is exhausted'
                      : player.health >= effectiveMaxHealth
                        ? 'Already at maximum health'
                        : `Exhaust to recover ${effectiveStats.recovery} HP`
                  }
                >
                  <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                  <span>Recover (+{effectiveStats.recovery} HP)</span>
                </button>
              )}

              {/* 3. Hero Basic Attack & Thwart */}
              {isHero && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    disabled={!canAttack}
                    onClick={() => handleInitiateAttack('hero')}
                    className={`font-comic text-xs py-1 px-1.5 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1 transition-all shadow-comic-sm ${
                      canAttack
                        ? 'bg-comic-red hover:bg-red-600 text-white font-bold active:translate-y-0.5'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      player.exhausted
                        ? 'Hero is exhausted'
                        : `Exhaust to attack for ${effectiveStats.attack} DMG`
                    }
                  >
                    <Swords className="w-3 h-3" />
                    <span>Attack ({effectiveStats.attack})</span>
                  </button>

                  <button
                    disabled={!canThwart}
                    onClick={() =>
                      onDispatchAction({
                        type: 'BASIC_THWART',
                        playerId: player.id,
                        targetType: 'main_scheme',
                      })
                    }
                    className={`font-comic text-xs py-1 px-1.5 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1 transition-all shadow-comic-sm ${
                      canThwart
                        ? 'bg-comic-blue hover:bg-sky-600 text-white font-bold active:translate-y-0.5'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                    title={
                      player.exhausted
                        ? 'Hero is exhausted'
                        : (gameState?.mainScheme?.threat || 0) <= 0
                          ? 'No threat to thwart'
                          : `Exhaust to remove ${effectiveStats.thwart} threat`
                    }
                  >
                    <Target className="w-3 h-3" />
                    <span>Thwart ({effectiveStats.thwart})</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Allies Row (Expands in remaining space) */}
        <div className="flex-1 min-w-[200px] bg-amber-50/60 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2 min-h-[220px]">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600 border-b border-amber-200 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-comic-blue" />
              Allies in Play ({player.allies.length} / 3)
            </span>
          </div>

          {player.allies.length > 0 ? (
            <div className="flex flex-wrap gap-3 items-center pt-1">
              {player.allies.map((ally) => {
                const allyStats = gameState
                  ? getEffectiveAllyStats(gameState, ally)
                  : {
                      attack: (ally.card as any).attack ?? 1,
                      thwart: (ally.card as any).thwart ?? 1,
                    };
                const canAct = isPlayerTurn && !ally.exhausted;
                const canThw =
                  canAct &&
                  ((gameState?.mainScheme?.threat || 0) > 0 ||
                    (gameState?.sideSchemes || []).some((s) => s.threat > 0));

                return (
                  <div key={ally.instanceId} className="flex flex-col items-center gap-1">
                    <CardView
                      card={ally.card}
                      instance={ally}
                      size="sm"
                      enableHoverZoom={true}
                      onClick={() => {
                        if (canAct && onDispatchAction) {
                          // Default action: Thwart if threat > 0, else attack
                          if (canThw) {
                            onDispatchAction({
                              type: 'ALLY_THWART',
                              playerId: player.id,
                              allyInstanceId: ally.instanceId,
                              targetType: 'main_scheme',
                            });
                          } else {
                            handleInitiateAttack('ally', ally.instanceId);
                          }
                        }
                      }}
                    />
                    <CardAttachmentFan
                      attachments={ally.attachments}
                      cardsUnderneath={ally.cardsUnderneath}
                    />
                    {/* Ally Action Mini-Console */}
                    <div className="flex items-center gap-1 w-full justify-center">
                      <button
                        onClick={() => handleInitiateAttack('ally', ally.instanceId)}
                        disabled={!canAct}
                        className="px-1.5 py-0.5 font-comic text-[10px] bg-comic-red hover:bg-red-700 text-white rounded border border-comic-black font-bold shadow-comic-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:translate-y-0.2"
                        title={canAct ? `Attack for ${allyStats.attack} damage` : 'Ally exhausted'}
                      >
                        ⚔️ {allyStats.attack}
                      </button>
                      <button
                        onClick={() =>
                          onDispatchAction?.({
                            type: 'ALLY_THWART',
                            playerId: player.id,
                            allyInstanceId: ally.instanceId,
                            targetType: 'main_scheme',
                          })
                        }
                        disabled={!canThw}
                        className="px-1.5 py-0.5 font-comic text-[10px] bg-sky-500 hover:bg-sky-600 text-white rounded border border-comic-black font-bold shadow-comic-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:translate-y-0.2"
                        title={
                          canThw
                            ? `Thwart main scheme for ${allyStats.thwart} threat`
                            : 'No threat on schemes or ally exhausted'
                        }
                      >
                        🛡️ {allyStats.thwart}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-36 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-center text-xs text-slate-400 font-semibold bg-white/50">
              No allies in play
            </div>
          )}
        </div>

        {/* Tableau: Supports & Upgrades (Expands in remaining space) */}
        <div className="flex-1 min-w-[220px] bg-slate-50 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2 min-h-[220px]">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600 border-b border-slate-200 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-comic-yellow" />
              Tableau: Upgrades & Supports ({player.tableau.length})
            </span>
          </div>

          {player.tableau.length > 0 ? (
            <div className="flex flex-wrap gap-3 items-center pt-1">
              {player.tableau.map((cardInst) => {
                const abilities = cardInst.card.enrichment?.abilities || [];
                const activeAbility = abilities.find(
                  (ab) =>
                    ab.timing === 'ACTION' ||
                    (isHero && ab.timing === 'HERO_ACTION') ||
                    (!isHero && ab.timing === 'ALTER_EGO_ACTION'),
                );
                const canUse =
                  isPlayerTurn &&
                  activeAbility &&
                  gameState &&
                  canPayAbilityCost(gameState, player, activeAbility, cardInst, {}).allowed;

                return (
                  <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                    <CardView
                      card={cardInst.card}
                      instance={cardInst}
                      size="sm"
                      enableHoverZoom={true}
                      onClick={() => {
                        if (activeAbility && canUse && onDispatchAction) {
                          onDispatchAction({
                            type: 'USE_CARD_ABILITY',
                            playerId: player.id,
                            cardInstanceId: cardInst.instanceId,
                            abilityId: activeAbility.id,
                          });
                        }
                      }}
                    />
                    {activeAbility && (
                      <button
                        onClick={() =>
                          onDispatchAction?.({
                            type: 'USE_CARD_ABILITY',
                            playerId: player.id,
                            cardInstanceId: cardInst.instanceId,
                            abilityId: activeAbility.id,
                          })
                        }
                        disabled={!canUse}
                        className="w-full font-comic text-[10px] bg-amber-300 hover:bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded border border-comic-black font-bold shadow-comic-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:translate-y-0.2"
                        title={
                          canUse
                            ? `Trigger ${activeAbility.id}`
                            : cardInst.exhausted
                              ? 'Card is exhausted'
                              : 'Cannot trigger ability'
                        }
                      >
                        ⚡ USE
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-36 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-center text-xs text-slate-400 font-semibold bg-white/50">
              No supports or upgrades
            </div>
          )}
        </div>
      </div>

      {/* Identity Action Selector Modal */}
      <IdentityActionModal
        isOpen={isIdentityModalOpen}
        player={player}
        gameState={gameState}
        onClose={() => setIsIdentityModalOpen(false)}
        onDispatchAction={onDispatchAction}
        onInitiateHeroAttack={() => handleInitiateAttack('hero')}
      />

      {/* Attack Target Selection Modal (ADR-0020 / Target Prompt) */}
      <AttackTargetModal
        isOpen={attackModalState.isOpen}
        attackerName={attackModalState.attackerName}
        attackerType={attackModalState.attackerType}
        attackDamage={attackModalState.attackDamage}
        targets={attackModalState.targets}
        onSelectTarget={(target) => {
          if (attackModalState.attackerType === 'hero') {
            onDispatchAction?.({
              type: 'BASIC_ATTACK',
              playerId: player.id,
              targetType: target.type,
              targetInstanceId: target.instanceId,
            });
          } else if (attackModalState.allyInstanceId) {
            onDispatchAction?.({
              type: 'ALLY_ATTACK',
              playerId: player.id,
              allyInstanceId: attackModalState.allyInstanceId,
              targetType: target.type,
              targetInstanceId: target.instanceId,
            });
          }
          setAttackModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onClose={() => setAttackModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
};

export default HeroZone;
