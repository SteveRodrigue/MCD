import React, { useState, useMemo } from 'react';
import { getHeroColorPalette, getContrastTextColor } from '../../utils/hero-theme';
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
  CardInstance,
  GameAction,
  Keyword,
  hasKeyword,
  CardAbility,
  getActiveMainScheme,
} from '../../../engine/models';
import { LegalActionItem } from '../../../engine/pipeline/legal-actions-generator';
import { CardView } from '../cards/CardView';
import { CardAttachmentFan } from '../cards/CardAttachmentFan';
import { FacedownEncounterCard } from '../cards/FacedownEncounterCard';
import { ThreatZoneSubzone } from './ThreatZoneSubzone';
import { useGameSettings } from '../../context/useGameSettings';
import { IdentityActionModal } from './IdentityActionModal';
import { ComicDamageSplash } from './ComicDamageSplash';
import { AttackTargetModal } from './AttackTargetModal';
import { AllyActionModal } from './AllyActionModal';
import { TableauActionModal } from './TableauActionModal';
import { evaluateTableauCardLegality } from './tableau-card-legality';
import { ThwartTargetModal } from './ThwartTargetModal';
import { EnemyTarget, getValidAttackTargets } from './attack-target-utils';
import { SchemeTarget, getValidThwartTargets } from './thwart-target-utils';
import {
  getEffectiveMaxHealth,
  getEffectiveHeroStats,
  getEffectiveHandSize,
  getEffectiveAllyStats,
  getEffectiveAllyLimit,
  getEffectivePlayerTraitsDetails,
  getEffectiveCardTraitsDetails,
} from '../../../engine/pipeline/stat-calculator';
import { canInitiateAbility } from '../../../engine/pipeline/legality-checker';
import { getAvailableResources } from '../../../engine/pipeline/cost-engine';

interface HeroZoneProps {
  player: PlayerState;
  gameState?: GameState;
  seatNumber?: number;
  isFocused?: boolean;
  isMultiHero?: boolean;
  devMode?: boolean;
  onFocus?: () => void;
  onDispatchAction?: (action: GameAction) => void;
  onInitiateAction?: (item: LegalActionItem) => void;
}

export const HeroZone: React.FC<HeroZoneProps> = ({
  player,
  gameState,
  seatNumber,
  isFocused = true,
  isMultiHero = false,
  devMode: devModeProp,
  onFocus,
  onDispatchAction,
  onInitiateAction,
}) => {
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const palette = useMemo(() => getHeroColorPalette(player), [player]);

  let isDevMode = devModeProp ?? false;
  try {
    const settings = useGameSettings();
    if (devModeProp === undefined && settings) {
      isDevMode = settings.devMode;
    }
  } catch {
    // Rendered outside GameSettingsProvider
  }

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
  const dealtCards = player.dealtEncounterCards || [];
  const hasDealtCards = dealtCards.length > 0;
  const obligations = player.obligations || [];
  const hasObligations = obligations.length > 0;

  // Stat formulas need a game state; a bare player (isolated renders) gets an empty board.
  const statState = gameState || ({ sideSchemes: [], players: [] } as any);
  const effectiveStats = getEffectiveHeroStats(statState, player);
  const effectiveHandSize = getEffectiveHandSize(player, statState);
  const effectiveAllyLimit = getEffectiveAllyLimit(player, gameState);
  const identityTraitsDetails = getEffectivePlayerTraitsDetails(player);
  const availableResources = getAvailableResources(player, gameState);

  const baseAtk = isHero ? heroCard.attack || 0 : 0;
  const baseThw = isHero ? heroCard.thwart || 0 : 0;
  const baseDef = isHero ? heroCard.defense || 0 : 0;
  const baseRec = !isHero ? alterEgoCard.recover || 0 : 0;
  const baseHandSize = isHero ? heroCard.handSize || 5 : alterEgoCard.handSize || 6;

  const atkBonus = effectiveStats.attack - baseAtk;
  const thwBonus = effectiveStats.thwart - baseThw;
  const defBonus = effectiveStats.defense - baseDef;
  const recBonus = effectiveStats.recovery - baseRec;
  const handBonus = effectiveHandSize - baseHandSize;

  // Action Permissions
  const validHeroAttackTargets = gameState
    ? getValidAttackTargets(gameState, player.id, 'hero')
    : [];
  const validHeroThwartTargets = gameState
    ? getValidThwartTargets(gameState, player.id, 'hero')
    : [];
  const canFlip = !player.basicChangeFormUsedThisRound && !player.formChangedThisRound;
  const canRecover =
    !isHero &&
    !player.exhausted &&
    !player.recoveryUsedThisRound &&
    player.health < effectiveMaxHealth;
  const canAttack =
    isHero && !player.exhausted && isPlayerTurn && validHeroAttackTargets.length > 0;
  const canThwart =
    isHero && !player.exhausted && isPlayerTurn && validHeroThwartTargets.some((t) => t.allowed);

  const stepEvent = gameState?.villainPhaseStepEvent;
  const isTargetOfDamageEvent = Boolean(
    stepEvent &&
    stepEvent.targetPlayerId === player.id &&
    (stepEvent.type === 'VILLAIN_ATTACK' || stepEvent.type === 'MINION_ATTACK') &&
    stepEvent.amount !== undefined &&
    stepEvent.amount > 0,
  );
  const splashDamageAmount = isTargetOfDamageEvent ? stepEvent!.amount! : 0;

  const isTargetOfIncomingAttack = Boolean(
    gameState?.activeAttackContext?.targetPlayerId === player.id ||
    (stepEvent?.targetPlayerId === player.id &&
      stepEvent?.type === 'VILLAIN_ATTACK' &&
      !stepEvent?.combatOutcome),
  );

  // Ally & Tableau Action Selection States
  const [selectedAllyForModal, setSelectedAllyForModal] = useState<CardInstance | null>(null);
  const [selectedTableauCardForModal, setSelectedTableauCardForModal] =
    useState<CardInstance | null>(null);

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

  // Thwart Target Selection State
  const [thwartModalState, setThwartModalState] = useState<{
    isOpen: boolean;
    thwarterName: string;
    thwarterType: 'hero' | 'ally';
    allyInstanceId?: string;
    thwartValue: number;
    consequentialDamage?: number;
    targets: SchemeTarget[];
  }>({
    isOpen: false,
    thwarterName: '',
    thwarterType: 'hero',
    thwartValue: 0,
    targets: [],
  });

  const handleInitiateAttack = (attackerType: 'hero' | 'ally', allyInstanceId?: string) => {
    if (!gameState || !onDispatchAction) return;

    if (attackerType === 'hero') {
      const targets = getValidAttackTargets(gameState, player.id, 'hero');
      if (targets.length === 0) return;
      setAttackModalState({
        isOpen: true,
        attackerName: player.activeFormCard.name,
        attackerType: 'hero',
        attackDamage: effectiveStats.attack,
        targets,
      });
    } else if (allyInstanceId) {
      const ally = player.allies.find((a) => a.instanceId === allyInstanceId);
      if (!ally) return;
      const allyStats = getEffectiveAllyStats(gameState, ally);
      const targets = getValidAttackTargets(gameState, player.id, 'ally', allyInstanceId);
      if (targets.length === 0) return;
      setAttackModalState({
        isOpen: true,
        attackerName: ally.card.name,
        attackerType: 'ally',
        allyInstanceId,
        attackDamage: allyStats.attack,
        targets,
      });
    }
  };

  const handleInitiateThwart = (thwarterType: 'hero' | 'ally', allyInstanceId?: string) => {
    if (!gameState || !onDispatchAction) return;

    if (thwarterType === 'hero') {
      const targets = getValidThwartTargets(gameState, player.id, 'hero');
      if (targets.length === 0) return;
      setThwartModalState({
        isOpen: true,
        thwarterName: player.activeFormCard.name,
        thwarterType: 'hero',
        thwartValue: effectiveStats.thwart,
        targets,
      });
    } else if (allyInstanceId) {
      const ally = player.allies.find((a) => a.instanceId === allyInstanceId);
      if (!ally) return;
      const allyStats = getEffectiveAllyStats(gameState, ally);
      const targets = getValidThwartTargets(gameState, player.id, 'ally', allyInstanceId);
      if (targets.length === 0) return;
      const consequential =
        (ally.card as any).thwartCost ?? (ally.card as any).consequentialDamage?.thwart ?? 1;
      setThwartModalState({
        isOpen: true,
        thwarterName: ally.card.name,
        thwarterType: 'ally',
        allyInstanceId,
        thwartValue: allyStats.thwart,
        consequentialDamage: consequential,
        targets,
      });
    }
  };

  const handleSelectTableauAbility = (ability: CardAbility, cardInst: CardInstance) => {
    const hasPaymentCost =
      ability.cost?.resourceCost ||
      (ability.cost?.resources && ability.cost.resources.length > 0) ||
      (ability.cost?.discardCard && ability.cost.discardCard.from === 'HAND');

    if (hasPaymentCost && onInitiateAction) {
      onInitiateAction({
        id: `action_tableau_${cardInst.instanceId}_${ability.id}`,
        category: 'board',
        headline: `Activate ${cardInst.card.name}`,
        subtext: ability.steps?.[0]?.effectParams?.description
          ? String(ability.steps[0].effectParams.description)
          : `Trigger ${cardInst.card.name} (${ability.id})`,
        action: {
          type: 'USE_CARD_ABILITY',
          playerId: player.id,
          cardInstanceId: cardInst.instanceId,
          abilityId: ability.id,
        },
        badge: 'ACTION',
        iconType: 'ability',
        requiresModal: 'payment',
        targetCardInstance: cardInst,
        cardCode: cardInst.card.code,
      });
      setSelectedTableauCardForModal(null);
      return;
    }

    if (!onDispatchAction) return;
    onDispatchAction({
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      cardInstanceId: cardInst.instanceId,
      abilityId: ability.id,
    });
    setSelectedTableauCardForModal(null);
  };

  return (
    <section
      onClick={!isFocused && onFocus ? onFocus : undefined}
      className={`comic-panel p-4 relative shadow-comic space-y-4 transition-all ${
        isTargetOfIncomingAttack
          ? 'ring-4 ring-rose-500 bg-rose-50/60 shadow-comic-lg'
          : !isFocused
            ? 'ring-1 ring-slate-300/80 bg-slate-100/90 cursor-pointer'
            : 'bg-white/95 ring-2 ring-comic-blue shadow-comic-lg'
      }`}
      style={
        isTargetOfIncomingAttack
          ? { borderColor: '#dc2626' }
          : isFocused
            ? { borderColor: palette.primary }
            : undefined
      }
    >
      {/* Zone Title Ribbon */}
      <div className="absolute -top-3 left-4 flex items-center gap-2">
        <div
          className={`border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1.5 ${
            isFocused ? '' : 'bg-slate-700 text-white'
          }`}
          style={{
            backgroundColor: isFocused ? palette.primary : undefined,
            color: isFocused ? palette.contrastText.primary : undefined,
          }}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>
            {seatNumber && isMultiHero ? `SEAT ${seatNumber}: ` : ''}
            {player.name}
            {!isFocused && ' • (WAITING)'}
          </span>
          {isFocused && (
            <span
              className="text-[10px] px-1.5 py-0.2 rounded font-black border border-comic-black ml-1 shadow-comic-xs"
              style={{
                backgroundColor: palette.accent || palette.secondary,
                color: getContrastTextColor(palette.accent || palette.secondary),
              }}
            >
              ★ ACTIVE HERO
            </span>
          )}
          {isTargetOfIncomingAttack && (
            <span className="text-[10px] px-1.5 py-0.2 rounded font-black border border-comic-black ml-1 bg-comic-red text-white shadow-comic-xs animate-pulse">
              💥 UNDER ATTACK
            </span>
          )}
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

      {/* 1. Engaged Minions & Dealt Encounter Cards Row (Always Visible for this Hero Seat!) */}
      <div
        data-testid="threat-zone"
        className="bg-rose-50/80 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm"
      >
        <div className="flex items-center justify-between border-b border-rose-200 pb-1 mb-2">
          <div className="flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4 text-comic-red" />
            <span className="font-comic text-xs text-comic-red uppercase font-bold">
              {hasDealtCards || hasObligations
                ? `Threat Zone: ${player.name} (${engagedMinions.length} Minions • ${dealtCards.length} Dealt Cards${
                    hasObligations ? ` • ${obligations.length} Obligations` : ''
                  })`
                : `Minions Engaged with ${player.name} (${engagedMinions.length})`}
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Encounter Threat Zone
          </span>
        </div>

        <div className="flex flex-wrap items-start gap-4 pt-1">
          {hasDealtCards && (
            <ThreatZoneSubzone testId="threat-zone-facedown" label="Encounter Facedown">
              <FacedownEncounterCard
                cards={dealtCards}
                heroName={player.name}
                devMode={isDevMode}
              />
            </ThreatZoneSubzone>
          )}

          {hasObligations && (
            <ThreatZoneSubzone
              testId="threat-zone-obligations"
              label="Obligations"
              count={obligations.length}
            >
              {obligations.map((obligation) => (
                <CardView
                  key={obligation.instanceId}
                  card={obligation.card}
                  instance={obligation}
                  size="sm"
                  enableHoverZoom={true}
                />
              ))}
            </ThreatZoneSubzone>
          )}

          <ThreatZoneSubzone
            testId="threat-zone-minions"
            label="Minions Engaged"
            count={engagedMinions.length}
            grow={engagedMinions.length === 0}
          >
            {engagedMinions.length > 0 ? (
              <div className="flex flex-wrap gap-4 items-center">
                {engagedMinions.map((minion) => {
                  const isGuard = hasKeyword(minion.card, Keyword.GUARD);
                  const isTough = minion.statusCards?.includes(StatusCard.TOUGH) ?? false;
                  const attachmentCount = minion.attachments?.length || 0;
                  const verticalExtraPx = attachmentCount > 0 ? attachmentCount * 70 : 0;
                  const horizontalExtraClass = attachmentCount > 0 ? 'ml-4 sm:ml-6' : '';

                  return (
                    <div
                      key={minion.instanceId}
                      className={`flex flex-col items-center gap-1 transition-all ${horizontalExtraClass}`}
                      style={
                        verticalExtraPx > 0 ? { marginBottom: `${verticalExtraPx}px` } : undefined
                      }
                    >
                      <div className="relative flex flex-col items-center">
                        <div className="relative z-30 flex flex-col items-center">
                          <CardView
                            card={minion.card}
                            instance={minion}
                            size="sm"
                            enableHoverZoom={true}
                          />
                        </div>
                        <CardAttachmentFan
                          attachments={minion.attachments}
                          cardsUnderneath={minion.cardsUnderneath}
                          mode="staircase"
                        />
                      </div>
                      <div className="flex items-center gap-1 flex-wrap justify-center z-30">
                        <span
                          className="bg-white text-comic-blue border border-comic-black font-comic text-[9px] px-1 py-0.2 rounded font-bold shadow-comic-xs"
                          title={`Scheme: ${(minion.card as any).scheme ?? 0}`}
                        >
                          SCH {(minion.card as any).scheme ?? 0}
                        </span>
                        <span
                          className="bg-white text-comic-red border border-comic-black font-comic text-[9px] px-1 py-0.2 rounded font-bold shadow-comic-xs"
                          title={`Attack: ${(minion.card as any).attack ?? 0}`}
                        >
                          ATK {(minion.card as any).attack ?? 0}
                        </span>
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
              <div
                className={`py-2 px-3 border-2 border-dashed border-rose-200 rounded-lg text-center text-xs text-rose-400 font-semibold bg-white/60 flex items-center justify-center gap-2 ${
                  hasDealtCards ? 'flex-1 self-stretch' : 'w-full'
                }`}
              >
                <span>🛡️ No minions engaged with {player.name} (Perimeter secure).</span>
              </div>
            )}
          </ThreatZoneSubzone>
        </div>
      </div>

      {/* 2. Main Hero Play Area: Two-Tier Layout (Row 1: Hero & Allies Roster, Row 2: Tableau Upgrades & Supports) */}
      <div className="flex flex-col gap-3 pt-1 w-full">
        {/* ROW 1: Hero & Allies Roster Container */}
        <div
          data-testid="hero-allies-roster"
          className={`flex flex-col md:flex-row items-stretch gap-3 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm transition-all ${
            isTargetOfIncomingAttack
              ? 'bg-rose-100/90 ring-4 ring-rose-500 animate-pulse border-rose-600 shadow-comic-lg'
              : 'bg-sky-50/80'
          }`}
        >
          {/* Identity Station */}
          <div
            data-testid="identity-station"
            className="w-full md:w-[220px] flex flex-col gap-2 shrink-0"
          >
            {isTargetOfIncomingAttack && (
              <div className="w-full text-center py-1 px-2 bg-comic-red text-white font-comic text-xs font-black uppercase tracking-wider rounded border-2 border-comic-black shadow-comic-sm animate-bounce">
                💥 UNDER ATTACK
              </div>
            )}

            {/* Header: Identity Name + Form Badge on top row */}
            <div className="flex flex-col gap-1 w-full">
              <div className="flex justify-between items-center gap-1.5 w-full">
                <div className="flex items-center gap-1 min-w-0">
                  <Shield className="w-4 h-4 shrink-0" style={{ color: palette.primary }} />
                  <span
                    className="font-comic text-sm text-comic-black truncate"
                    title={player.activeFormCard.name}
                  >
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
              {/* Compact Status Badges */}
              {player.statusCards.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {player.statusCards.map((st, i) => (
                    <span
                      key={i}
                      className={`font-comic text-[9px] px-1 py-0.2 rounded border border-comic-black uppercase shadow-comic-xs font-bold ${
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
            </div>

            {/* Center Tri-Column Row */}
            <div className="flex items-center justify-center gap-2 w-full">
              {/* Left Column (Stats) */}
              {isHero ? (
                <div
                  className="relative z-10 flex flex-col gap-1 items-center justify-center min-w-[36px]"
                  data-testid="identity-stats-column"
                >
                  {/* THW */}
                  <div
                    className="flex flex-col items-center justify-center w-full px-1 py-0.5 bg-sky-50 border border-comic-black rounded shadow-comic-xs text-center"
                    title={`Thwart: ${effectiveStats.thwart}${thwBonus > 0 ? ` (+${thwBonus})` : ''}`}
                  >
                    <span className="text-[8px] font-bold text-sky-800 uppercase leading-none">
                      THW
                    </span>
                    <span
                      className={`font-comic text-xs font-black leading-tight ${thwBonus > 0 ? 'text-comic-blue' : 'text-slate-900'}`}
                    >
                      {effectiveStats.thwart}
                      {thwBonus > 0 && (
                        <span className="text-[8px] text-sky-600 font-bold ml-0.5">
                          +{thwBonus}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* ATK */}
                  <div
                    className="flex flex-col items-center justify-center w-full px-1 py-0.5 bg-rose-50 border border-comic-black rounded shadow-comic-xs text-center"
                    title={`Attack: ${effectiveStats.attack}${atkBonus > 0 ? ` (+${atkBonus})` : ''}`}
                  >
                    <span className="text-[8px] font-bold text-rose-800 uppercase leading-none">
                      ATK
                    </span>
                    <span
                      className={`font-comic text-xs font-black leading-tight ${atkBonus > 0 ? 'text-comic-red' : 'text-slate-900'}`}
                    >
                      {effectiveStats.attack}
                      {atkBonus > 0 && (
                        <span className="text-[8px] text-rose-500 font-bold ml-0.5">
                          +{atkBonus}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* DEF */}
                  <div
                    className="flex flex-col items-center justify-center w-full px-1 py-0.5 bg-emerald-50 border border-comic-black rounded shadow-comic-xs text-center"
                    title={`Defense: ${effectiveStats.defense}${defBonus > 0 ? ` (+${defBonus})` : ''}`}
                  >
                    <span className="text-[8px] font-bold text-emerald-800 uppercase leading-none">
                      DEF
                    </span>
                    <span
                      className={`font-comic text-xs font-black leading-tight ${defBonus > 0 ? 'text-emerald-600' : 'text-slate-900'}`}
                    >
                      {effectiveStats.defense}
                      {defBonus > 0 && (
                        <span className="text-[8px] text-emerald-500 font-bold ml-0.5">
                          +{defBonus}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* HS */}
                  <div
                    className="flex flex-col items-center justify-center w-full px-1 py-0.5 bg-slate-100 border border-comic-black rounded shadow-comic-xs text-center"
                    title={`Hand Size: ${effectiveHandSize}${handBonus > 0 ? ` (+${handBonus})` : ''}`}
                  >
                    <span className="text-[8px] font-bold text-slate-600 uppercase leading-none">
                      HS
                    </span>
                    <span
                      className={`font-comic text-xs font-black leading-tight ${handBonus > 0 ? 'text-slate-800' : 'text-slate-900'}`}
                    >
                      {effectiveHandSize}
                      {handBonus > 0 && (
                        <span className="text-[8px] text-slate-600 font-bold ml-0.5">
                          +{handBonus}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* RES */}
                  <div
                    className="flex flex-col items-center justify-center w-full px-1 py-0.5 bg-indigo-50 border border-comic-black rounded shadow-comic-xs text-center"
                    title={`Available Resources: ${availableResources.total} (${availableResources.breakdown})`}
                    data-testid="hero-available-resources-counter"
                  >
                    <span className="text-[8px] font-bold text-indigo-700 uppercase leading-none">
                      RES
                    </span>
                    <span className="font-comic text-xs font-black leading-tight text-indigo-950">
                      {availableResources.total}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="relative z-10 flex flex-col gap-1.5 items-center justify-center min-w-[36px]"
                  data-testid="identity-stats-column"
                >
                  {/* REC */}
                  <div
                    className="flex flex-col items-center justify-center w-full px-1 py-1 bg-amber-50 border border-comic-black rounded shadow-comic-xs text-center"
                    title={`Recovery: ${effectiveStats.recovery}${recBonus > 0 ? ` (+${recBonus})` : ''}`}
                  >
                    <span className="text-[8px] font-bold text-amber-800 uppercase leading-none">
                      REC
                    </span>
                    <span
                      className={`font-comic text-xs font-black leading-tight ${recBonus > 0 ? 'text-amber-600' : 'text-slate-900'}`}
                    >
                      {effectiveStats.recovery}
                      {recBonus > 0 && (
                        <span className="text-[8px] text-amber-500 font-bold ml-0.5">
                          +{recBonus}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* HS */}
                  <div
                    className="flex flex-col items-center justify-center w-full px-1 py-1 bg-slate-100 border border-comic-black rounded shadow-comic-xs text-center"
                    title={`Hand Size: ${effectiveHandSize}${handBonus > 0 ? ` (+${handBonus})` : ''}`}
                  >
                    <span className="text-[8px] font-bold text-slate-600 uppercase leading-none">
                      HS
                    </span>
                    <span
                      className={`font-comic text-xs font-black leading-tight ${handBonus > 0 ? 'text-slate-800' : 'text-slate-900'}`}
                    >
                      {effectiveHandSize}
                      {handBonus > 0 && (
                        <span className="text-[8px] text-slate-600 font-bold ml-0.5">
                          +{handBonus}
                        </span>
                      )}
                    </span>
                  </div>
                  {/* RES */}
                  <div
                    className="flex flex-col items-center justify-center w-full px-1 py-1 bg-indigo-50 border border-comic-black rounded shadow-comic-xs text-center"
                    title={`Available Resources: ${availableResources.total} (${availableResources.breakdown})`}
                    data-testid="hero-available-resources-counter"
                  >
                    <span className="text-[8px] font-bold text-indigo-700 uppercase leading-none">
                      RES
                    </span>
                    <span className="font-comic text-xs font-black leading-tight text-indigo-950">
                      {availableResources.total}
                    </span>
                  </div>
                </div>
              )}

              {/* Center Column (Card) */}
              <div
                className="flex flex-col justify-center items-center relative shrink-0 cursor-pointer"
                data-testid="hero-identity-card"
                onClick={() => setIsIdentityModalOpen(true)}
              >
                <CardView
                  card={player.activeFormCard}
                  dynamicTraits={identityTraitsDetails.dynamicTraits}
                  effectiveTraits={identityTraitsDetails.traits}
                  isExhausted={player.exhausted}
                  size="sm"
                  showTokens={false}
                  enableHoverZoom={true}
                />
                {isTargetOfDamageEvent && (
                  <ComicDamageSplash
                    amount={splashDamageAmount}
                    onomatopoeia={stepEvent?.onomatopoeia || 'BANG!'}
                  />
                )}
                <CardAttachmentFan
                  attachments={player.attachments}
                  cardsUnderneath={player.cardsUnderneath}
                />
              </div>

              {/* Right Column (Vertical HP Gauge) */}
              <div
                className="relative z-10 flex flex-col items-center justify-center gap-1 shrink-0"
                data-testid="identity-hp-column"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center gap-0.5">
                    <Heart className="w-2.5 h-2.5 text-comic-red fill-comic-red" />
                    <span className="font-comic text-[10px] font-black text-slate-900 leading-none">
                      {player.health}/{effectiveMaxHealth}
                    </span>
                  </div>
                  {hpBonus > 0 && (
                    <span
                      className="bg-emerald-400 text-slate-950 font-comic text-[8px] px-1 rounded border border-comic-black font-bold shadow-comic-xs flex items-center gap-0.5 mt-0.5"
                      title={`+${hpBonus} bonus HP`}
                    >
                      <Sparkles className="w-2 h-2" />+{hpBonus}
                    </span>
                  )}
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={player.health}
                  aria-valuemin={0}
                  aria-valuemax={effectiveMaxHealth}
                  aria-label="Identity Health"
                  className="h-36 w-3.5 bg-neutral-800 rounded-full border border-black overflow-hidden relative flex flex-col justify-end shadow-comic-xs"
                >
                  <div
                    className="w-full transition-all duration-300 rounded-b-full"
                    style={{
                      height: `${healthPercent}%`,
                      backgroundColor:
                        healthPercent > 50
                          ? palette.primary || '#10b981'
                          : healthPercent > 25
                            ? '#f59e0b'
                            : '#ef4444',
                    }}
                  />
                </div>
                <span className="font-comic text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                  HP
                </span>
              </div>
            </div>

            {/* Bottom Action Row: Single horizontal row */}
            {onDispatchAction && (
              <div
                className="w-full pt-1 border-t border-slate-200"
                data-testid="identity-action-row"
              >
                {!isHero ? (
                  <div className="grid grid-cols-2 gap-1.5 w-full">
                    {/* Suit Up / Flip */}
                    <button
                      disabled={!canFlip}
                      onClick={() => onDispatchAction({ type: 'CHANGE_FORM', playerId: player.id })}
                      className={`font-comic text-xs py-1.5 px-1 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1 transition-all shadow-comic-sm truncate font-bold uppercase ${
                        canFlip
                          ? 'bg-comic-red hover:bg-red-600 text-white active:translate-y-0.5'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                      title={
                        canFlip
                          ? 'Suit Up (Hero Form) (Limit once per round)'
                          : 'Already changed form this round'
                      }
                    >
                      <RefreshCw className={`w-3 h-3 shrink-0 ${canFlip ? 'animate-pulse' : ''}`} />
                      <span className="truncate">Suit Up</span>
                    </button>

                    {/* Recover */}
                    <button
                      disabled={!canRecover}
                      onClick={() =>
                        onDispatchAction({ type: 'BASIC_RECOVER', playerId: player.id })
                      }
                      className={`font-comic text-xs py-1.5 px-1 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1 transition-all shadow-comic-sm truncate font-bold uppercase ${
                        canRecover
                          ? 'bg-amber-300 hover:bg-amber-400 text-slate-950 active:translate-y-0.5'
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
                      <Heart className="w-3 h-3 shrink-0 fill-rose-600 text-rose-600" />
                      <span className="truncate">Recover (+{effectiveStats.recovery})</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    {/* Flip */}
                    <button
                      disabled={!canFlip}
                      onClick={() => onDispatchAction({ type: 'CHANGE_FORM', playerId: player.id })}
                      className={`font-comic text-xs py-1.5 px-1 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1 transition-all shadow-comic-sm truncate font-bold uppercase ${
                        canFlip
                          ? 'bg-amber-300 hover:bg-amber-400 text-slate-950 active:translate-y-0.5'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                      title={
                        canFlip
                          ? 'Flip to Alter-Ego (Limit once per round)'
                          : 'Already changed form this round'
                      }
                    >
                      <RefreshCw className={`w-3 h-3 shrink-0 ${canFlip ? 'animate-pulse' : ''}`} />
                      <span className="truncate">Flip</span>
                    </button>

                    {/* Attack */}
                    <button
                      disabled={!canAttack}
                      onClick={() => handleInitiateAttack('hero')}
                      className={`font-comic text-xs py-1.5 px-1 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1 transition-all shadow-comic-sm truncate font-bold uppercase ${
                        canAttack
                          ? 'bg-comic-red hover:bg-red-600 text-white active:translate-y-0.5'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                      title={
                        player.exhausted
                          ? 'Hero is exhausted'
                          : !canAttack
                            ? 'No valid attack targets'
                            : `Exhaust to attack for ${effectiveStats.attack} DMG`
                      }
                    >
                      <Swords className="w-3 h-3 shrink-0" />
                      <span className="truncate">Attack ({effectiveStats.attack})</span>
                    </button>

                    {/* Thwart */}
                    <button
                      disabled={!canThwart}
                      onClick={() => handleInitiateThwart('hero')}
                      className={`font-comic text-xs py-1.5 px-1 rounded-lg border-2 border-comic-black flex items-center justify-center gap-1 transition-all shadow-comic-sm truncate font-bold uppercase ${
                        canThwart
                          ? 'bg-comic-blue hover:bg-sky-600 text-white active:translate-y-0.5'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                      title={
                        player.exhausted
                          ? 'Hero is exhausted'
                          : !canThwart
                            ? 'No threat to thwart'
                            : `Exhaust to remove ${effectiveStats.thwart} threat`
                      }
                    >
                      <Target className="w-3 h-3 shrink-0" />
                      <span className="truncate">Thwart ({effectiveStats.thwart})</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vertical comic divider on md+ screens */}
          <div className="hidden md:block w-0.5 bg-comic-black/15 self-stretch my-1 shrink-0" />

          {/* Nested Allies Section */}
          <div
            data-testid="nested-allies-section"
            className="flex-1 flex flex-col min-w-0 space-y-2 pt-2 md:pt-0"
          >
            <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-600 border-b border-comic-black/15 pb-1.5">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-comic-blue" />
                Allies in Play ({player.allies.length} / {effectiveAllyLimit})
              </span>
            </div>

            {player.allies.length > 0 ? (
              <div className="flex flex-wrap gap-3 items-start pt-1">
                {player.allies.map((ally) => {
                  const allyCard = ally.card as any;
                  const baseAtk = allyCard.attack ?? 0;
                  const baseThw = allyCard.thwart ?? 0;
                  const allyStats = gameState
                    ? getEffectiveAllyStats(gameState, ally)
                    : {
                        attack: baseAtk || 1,
                        thwart: baseThw || 1,
                      };
                  const atkBonus = allyStats.attack - baseAtk;
                  const thwBonus = allyStats.thwart - baseThw;

                  const canAct = isPlayerTurn && !ally.exhausted;
                  const canThw =
                    canAct &&
                    (((gameState ? getActiveMainScheme(gameState) : undefined)?.threat || 0) > 0 ||
                      (gameState?.sideSchemes || []).some((s) => s.threat > 0));

                  const attachmentCount = ally.attachments?.length || 0;
                  // Dynamic vertical expansion: each fan-down attachment offsets ~68-70px
                  const verticalExtraPx = attachmentCount > 0 ? attachmentCount * 70 : 0;
                  const horizontalExtraClass = attachmentCount > 0 ? 'ml-4 sm:ml-6' : '';

                  return (
                    <div
                      key={ally.instanceId}
                      className={`flex flex-col items-center transition-all ${horizontalExtraClass}`}
                      style={{ marginBottom: `${verticalExtraPx}px` }}
                    >
                      {/* Ally Action Mini-Console (Positioned above card at z-30) */}
                      <div className="flex items-center gap-1 w-full justify-center mb-1 z-30">
                        <button
                          onClick={() => handleInitiateAttack('ally', ally.instanceId)}
                          disabled={!canAct}
                          className="px-1.5 py-0.5 font-comic text-[10px] bg-comic-red hover:bg-red-700 text-white rounded border border-comic-black font-bold shadow-comic-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:translate-y-0.2 flex items-center gap-0.5"
                          title={
                            canAct
                              ? `Attack for ${allyStats.attack} damage${atkBonus > 0 ? ` (+${atkBonus} bonus)` : ''}`
                              : 'Ally exhausted'
                          }
                        >
                          <span>⚔️ {allyStats.attack}</span>
                          {atkBonus > 0 && (
                            <span className="text-yellow-300 text-[9px] font-black">
                              (+{atkBonus})
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleInitiateThwart('ally', ally.instanceId)}
                          disabled={!canThw}
                          className="px-1.5 py-0.5 font-comic text-[10px] bg-sky-500 hover:bg-sky-600 text-white rounded border border-comic-black font-bold shadow-comic-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:translate-y-0.2 flex items-center gap-0.5"
                          title={
                            canThw
                              ? `Thwart scheme for ${allyStats.thwart} threat${thwBonus > 0 ? ` (+${thwBonus} bonus)` : ''}`
                              : 'No threat on schemes or ally exhausted'
                          }
                        >
                          <span>🛡️ {allyStats.thwart}</span>
                          {thwBonus > 0 && (
                            <span className="text-yellow-300 text-[9px] font-black">
                              (+{thwBonus})
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Pop-Art Ally Stat Bonus Strip (Matching Hero stat display) */}
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/95 border border-comic-black rounded shadow-comic-xs text-[9px] font-comic font-bold mb-1 z-30">
                        <div className="flex items-center gap-0.5">
                          <span className="text-slate-500 uppercase text-[8px]">THW</span>
                          <span
                            className={`flex items-center ${
                              thwBonus > 0 ? 'text-emerald-600 font-black' : 'text-slate-900'
                            }`}
                          >
                            {allyStats.thwart}
                            {thwBonus > 0 && (
                              <span className="text-[8px] text-emerald-600 ml-0.5">
                                +{thwBonus}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-3 w-px bg-slate-300" />
                        <div className="flex items-center gap-0.5">
                          <span className="text-slate-500 uppercase text-[8px]">ATK</span>
                          <span
                            className={`flex items-center ${
                              atkBonus > 0 ? 'text-comic-red font-black' : 'text-slate-900'
                            }`}
                          >
                            {allyStats.attack}
                            {atkBonus > 0 && (
                              <span className="text-[8px] text-rose-500 ml-0.5">+{atkBonus}</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Dedicated Host Card & Attachment Anchor Container (Coordinates align with top of host card) */}
                      <div className="relative flex flex-col items-center">
                        <div className="relative z-30 flex flex-col items-center">
                          {(() => {
                            const allyTraitsDetails = getEffectiveCardTraitsDetails(
                              ally.card,
                              ally,
                            );
                            return (
                              <CardView
                                card={ally.card}
                                instance={ally}
                                dynamicTraits={allyTraitsDetails.dynamicTraits}
                                effectiveTraits={allyTraitsDetails.traits}
                                size="sm"
                                enableHoverZoom={true}
                                onClick={() => setSelectedAllyForModal(ally)}
                              />
                            );
                          })()}
                        </div>

                        {/* Fan-Down Staircase Attachments Stack (Anchored to top of host card) */}
                        <CardAttachmentFan
                          attachments={ally.attachments}
                          cardsUnderneath={ally.cardsUnderneath}
                          mode="staircase"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-36 w-full border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-3 text-xs text-slate-400 font-semibold bg-white/40">
                <Users className="w-6 h-6 text-slate-300 mb-1" />
                <span>No allies in play</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Ally Limit: {effectiveAllyLimit}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Tableau Upgrades & Supports */}
        <div
          data-testid="tableau-section"
          className="w-full bg-slate-50 p-3 rounded-xl border-2 border-comic-black shadow-comic-sm space-y-2"
        >
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
                const activeAbilities = abilities.filter(
                  (ab) =>
                    ab.timing === 'ACTION' ||
                    (isHero && ab.timing === 'HERO_ACTION') ||
                    (!isHero && ab.timing === 'ALTER_EGO_ACTION'),
                );
                const legality = evaluateTableauCardLegality(
                  cardInst,
                  player.currentForm,
                  gameState ? { gameState, playerId: player.id } : undefined,
                );

                return (
                  <div key={cardInst.instanceId} className="flex flex-col items-center gap-1">
                    <CardView
                      card={cardInst.card}
                      instance={cardInst}
                      size="sm"
                      enableHoverZoom={true}
                      isUsable={legality.isUsable}
                      unusableBadge={legality.badge}
                      unusableReason={legality.reason}
                      onClick={
                        legality.isUsable
                          ? () => setSelectedTableauCardForModal(cardInst)
                          : undefined
                      }
                    />
                    {activeAbilities.map((ab) => {
                      const costCheck = gameState
                        ? canInitiateAbility(gameState, player.id, ab, cardInst, {})
                        : { allowed: false, reason: 'Game state not loaded' };
                      const canUse = isPlayerTurn && costCheck.allowed;
                      const label = ab.id.includes('add')
                        ? '⚡ ADD TOKENS'
                        : ab.id.includes('blast')
                          ? '💥 BLAST'
                          : '⚡ USE';

                      const hasPaymentCost =
                        ab.cost?.resourceCost ||
                        (ab.cost?.resources && ab.cost.resources.length > 0) ||
                        (ab.cost?.discardCard && ab.cost.discardCard.from === 'HAND');

                      return (
                        <button
                          key={ab.id}
                          onClick={() => {
                            if (hasPaymentCost && onInitiateAction) {
                              onInitiateAction({
                                id: `action_tableau_${cardInst.instanceId}_${ab.id}`,
                                category: 'board',
                                headline: `Activate ${cardInst.card.name}`,
                                subtext: ab.steps?.[0]?.effectParams?.description
                                  ? String(ab.steps[0].effectParams.description)
                                  : `Trigger ${cardInst.card.name} (${ab.id})`,
                                action: {
                                  type: 'USE_CARD_ABILITY',
                                  playerId: player.id,
                                  cardInstanceId: cardInst.instanceId,
                                  abilityId: ab.id,
                                },
                                badge: 'ACTION',
                                iconType: 'ability',
                                requiresModal: 'payment',
                                targetCardInstance: cardInst,
                                cardCode: cardInst.card.code,
                              });
                              return;
                            }
                            onDispatchAction?.({
                              type: 'USE_CARD_ABILITY',
                              playerId: player.id,
                              cardInstanceId: cardInst.instanceId,
                              abilityId: ab.id,
                            });
                          }}
                          disabled={!canUse}
                          className="w-full font-comic text-[10px] bg-amber-300 hover:bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded border border-comic-black font-bold shadow-comic-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:translate-y-0.2"
                          title={
                            canUse
                              ? `Trigger ${ab.id}`
                              : costCheck.reason ||
                                (cardInst.exhausted
                                  ? 'Card is exhausted'
                                  : 'Cannot trigger ability')
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
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
        onInitiateAction={onInitiateAction}
        onInitiateHeroAttack={() => handleInitiateAttack('hero')}
        onInitiateHeroThwart={() => handleInitiateThwart('hero')}
      />

      {/* Ally Action Selector Modal */}
      {selectedAllyForModal && (
        <AllyActionModal
          isOpen={!!selectedAllyForModal}
          ally={selectedAllyForModal}
          player={player}
          gameState={gameState}
          onClose={() => setSelectedAllyForModal(null)}
          onInitiateAllyAttack={(id) => handleInitiateAttack('ally', id)}
          onInitiateAllyThwart={(id) => handleInitiateThwart('ally', id)}
          onDispatchAction={onDispatchAction}
        />
      )}

      {/* Tableau (Support/Upgrade/Attachment) Action Selector Modal */}
      {selectedTableauCardForModal && (
        <TableauActionModal
          isOpen={!!selectedTableauCardForModal}
          cardInstance={selectedTableauCardForModal}
          player={player}
          gameState={gameState}
          onClose={() => setSelectedTableauCardForModal(null)}
          onSelectAbility={handleSelectTableauAbility}
        />
      )}

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

      {/* Thwart Target Selection Modal */}
      <ThwartTargetModal
        isOpen={thwartModalState.isOpen}
        thwarterName={thwartModalState.thwarterName}
        thwarterType={thwartModalState.thwarterType}
        thwartValue={thwartModalState.thwartValue}
        consequentialDamage={thwartModalState.consequentialDamage}
        targets={thwartModalState.targets}
        onSelectTarget={(target) => {
          if (thwartModalState.thwarterType === 'hero') {
            onDispatchAction?.({
              type: 'BASIC_THWART',
              playerId: player.id,
              targetType: target.type,
              targetInstanceId: target.instanceId,
            });
          } else if (thwartModalState.allyInstanceId) {
            onDispatchAction?.({
              type: 'ALLY_THWART',
              playerId: player.id,
              allyInstanceId: thwartModalState.allyInstanceId,
              targetType: target.type,
              targetInstanceId: target.instanceId,
            });
          }
          setThwartModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onClose={() => setThwartModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </section>
  );
};

export default HeroZone;
