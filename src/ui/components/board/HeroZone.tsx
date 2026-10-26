import React, { useState, useMemo } from 'react';
import { getHeroColorPalette, getContrastTextColor } from '../../utils/hero-theme';
import { formatSeatPrefix } from '../../utils/player-seat';
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
  HeroCard,
  AlterEgoCard,
  CardInstance,
  Keyword,
  hasKeyword,
  hasDashPower,
  CardAbility,
  getActiveMainScheme,
} from '../../../engine/models';
import { LegalActionItem } from '../../../engine/pipeline/legal-actions-generator';
import { CardView } from '../cards/CardView';
import { CardAttachmentFan } from '../cards/CardAttachmentFan';
import { getStaircaseExpansion } from '../cards/attachment-fan-utils';
import { FacedownEncounterCard } from '../cards/FacedownEncounterCard';
import { ThreatZoneSubzone } from './ThreatZoneSubzone';
import { EmptyZoneBadge } from './EmptyZoneBadge';
import { useOptionalGameSettings } from '../../context/useGameSettings';
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
  getEffectiveMinionAttack,
  getEffectiveMinionScheme,
} from '../../../engine/pipeline/stat-calculator';
import { canInitiateAbility } from '../../../engine/pipeline/legality-checker';
import { getAvailableResources } from '../../../engine/pipeline/cost-engine';
import { useGameSession } from '../../context/GameStateContext';
import { useModalStyle } from '../../theme/useModalStyle';
import { StatBox, StatStrip } from '../../theme/kit/meters';
import { ToneButton } from '../../theme/kit/controls';

interface HeroZoneProps {
  player: PlayerState;
  seatNumber?: number;
  isFocused?: boolean;
  isMultiHero?: boolean;
  devMode?: boolean;
  onFocus?: () => void;
  onInitiateAction?: (item: LegalActionItem) => void;
}

export const HeroZone: React.FC<HeroZoneProps> = ({
  player,
  seatNumber,
  isFocused = true,
  isMultiHero = false,
  devMode: devModeProp,
  onFocus,
  onInitiateAction,
}) => {
  const { state: gameState, dispatch: onDispatchAction } = useGameSession();
  const { style } = useModalStyle();
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const palette = useMemo(() => getHeroColorPalette(player), [player]);

  const settings = useOptionalGameSettings();
  const isDevMode = devModeProp ?? settings?.devMode ?? false;

  const isHero = player.currentForm === 'hero';
  const isPlayerTurn =
    gameState.phase === 'PLAYER_PHASE' &&
    gameState.players[gameState.activePlayerIndex]?.id === player.id;
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
  // An empty Threat Zone or Tableau is not drawn; its count is a badge in the ribbon (Issue #379).
  const isThreatZoneEmpty = engagedMinions.length === 0 && !hasDealtCards && !hasObligations;
  const isTableauEmpty = player.tableau.length === 0;

  const effectiveStats = getEffectiveHeroStats(gameState, player);
  const effectiveHandSize = getEffectiveHandSize(player, gameState);
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
  const validHeroAttackTargets = getValidAttackTargets(gameState, player.id, 'hero');
  const validHeroThwartTargets = getValidThwartTargets(gameState, player.id, 'hero');
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

  const stepEvent = gameState.villainPhaseStepEvent;
  const isTargetOfDamageEvent = Boolean(
    stepEvent &&
    stepEvent.targetPlayerId === player.id &&
    (stepEvent.type === 'VILLAIN_ATTACK' || stepEvent.type === 'MINION_ATTACK') &&
    stepEvent.amount !== undefined &&
    stepEvent.amount > 0,
  );
  const splashDamageAmount = isTargetOfDamageEvent ? stepEvent!.amount! : 0;

  const isTargetOfIncomingAttack = Boolean(
    gameState.activeAttackContext?.targetPlayerId === player.id ||
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
    attackerCode?: string;
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
    thwarterCode?: string;
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
    if (attackerType === 'hero') {
      const targets = getValidAttackTargets(gameState, player.id, 'hero');
      if (targets.length === 0) return;
      setAttackModalState({
        isOpen: true,
        attackerName: player.activeFormCard.name,
        attackerCode: player.activeFormCard.code,
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
        attackerCode: ally.card.code,
        attackerType: 'ally',
        allyInstanceId,
        attackDamage: allyStats.attack,
        targets,
      });
    }
  };

  const handleInitiateThwart = (thwarterType: 'hero' | 'ally', allyInstanceId?: string) => {
    if (thwarterType === 'hero') {
      const targets = getValidThwartTargets(gameState, player.id, 'hero');
      if (targets.length === 0) return;
      setThwartModalState({
        isOpen: true,
        thwarterName: player.activeFormCard.name,
        thwarterCode: player.activeFormCard.code,
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
        thwarterCode: ally.card.code,
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
      data-testid="hero-zone"
      onClick={!isFocused && onFocus ? onFocus : undefined}
      className={`p-4 relative space-y-4 transition-all ${style.panel} ${style.text} ${
        isTargetOfIncomingAttack
          ? 'ring-4 ring-rose-500'
          : !isFocused
            ? 'ring-1 ring-current/30 opacity-90 cursor-pointer'
            : 'ring-2 ring-comic-blue'
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
          data-testid="hero-zone-ribbon"
          className={`text-xs px-3 py-0.5 tracking-wider flex items-center gap-1.5 ${style.badge} ${
            isFocused ? '' : 'bg-slate-700 text-white'
          }`}
          style={{
            backgroundColor: isFocused ? palette.primary : undefined,
            color: isFocused ? palette.contrastText.primary : undefined,
          }}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>
            {formatSeatPrefix(seatNumber, isMultiHero)}
            {player.name}
            {!isFocused && ' • (WAITING)'}
          </span>
          {isFocused && (
            <span
              className={`text-micro px-1.5 py-0.2 font-black ml-1 ${style.badge}`}
              style={{
                backgroundColor: palette.accent || palette.secondary,
                color: getContrastTextColor(palette.accent || palette.secondary),
              }}
            >
              ★ ACTIVE HERO
            </span>
          )}
          {isMultiHero && gameState.players[gameState.firstPlayerIndex]?.id === player.id && (
            <span
              data-testid="first-player-badge"
              title="This seat holds the First Player token"
              className={`text-micro px-1.5 py-0.2 font-black ml-1 bg-comic-yellow text-comic-black ${style.badge}`}
            >
              👑 FIRST PLAYER
            </span>
          )}
          {isTargetOfIncomingAttack && (
            <span
              className={`text-micro px-1.5 py-0.2 font-black ml-1 bg-comic-red text-white animate-pulse ${style.badge}`}
            >
              💥 UNDER ATTACK
            </span>
          )}
        </div>

        {!isFocused && onFocus && (
          <ToneButton tone="amber" onClick={onFocus} className="text-mini px-2.5 py-0.5 font-bold">
            Switch Active Hand ➔
          </ToneButton>
        )}

        {isThreatZoneEmpty && (
          <EmptyZoneBadge
            zone="minions"
            icon={<AlertOctagon className="w-3 h-3 text-comic-red" />}
            label="Minions"
            title={`No minions engaged with ${player.name} (Perimeter secure)`}
          />
        )}
        {isTableauEmpty && (
          <EmptyZoneBadge
            zone="tableau"
            icon={<Zap className="w-3 h-3 text-comic-yellow" />}
            label="Tableau"
            title="No upgrades or supports in play"
          />
        )}
      </div>

      {/* 1. Engaged Minions & Dealt Encounter Cards Row (Drawn while it holds a minion, a dealt card or an obligation) */}
      {!isThreatZoneEmpty && (
        <div data-testid="threat-zone" className={`p-3 ${style.inset}`}>
          <div className="flex items-center justify-between border-b border-current/20 pb-1 mb-2">
            <div className="flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-comic-red" />
              <span className={`text-xs uppercase font-bold ${style.emphasis}`}>
                {hasDealtCards || hasObligations
                  ? `Threat Zone: ${player.name} (${engagedMinions.length} Minions • ${dealtCards.length} Dealt Cards${
                      hasObligations ? ` • ${obligations.length} Obligations` : ''
                    })`
                  : `Minions Engaged with ${player.name} (${engagedMinions.length})`}
              </span>
            </div>
            <span className={`text-micro font-bold uppercase ${style.muted}`}>
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
                    const minionAtk = getEffectiveMinionAttack(gameState, minion);
                    const minionSch = getEffectiveMinionScheme(gameState, minion);
                    const atkDash = hasDashPower(minion.card, 'attack');
                    const schDash = hasDashPower(minion.card, 'scheme');
                    const atkDisplay = atkDash ? '–' : minionAtk;
                    const schDisplay = schDash ? '–' : minionSch;
                    const { extraBottomPx: verticalExtraPx, extraLeftClass: horizontalExtraClass } =
                      getStaircaseExpansion(minion.attachments, minion.cardsUnderneath);

                    return (
                      <div
                        key={minion.instanceId}
                        className={`flex flex-col items-center gap-1 transition-all ${horizontalExtraClass}`}
                        style={
                          verticalExtraPx > 0 ? { marginBottom: `${verticalExtraPx}px` } : undefined
                        }
                      >
                        <CardAttachmentFan
                          attachments={minion.attachments}
                          cardsUnderneath={minion.cardsUnderneath}
                        >
                          <CardView
                            card={minion.card}
                            instance={minion}
                            size="sm"
                            enableHoverZoom={true}
                          />
                        </CardAttachmentFan>
                        <div className="flex items-center gap-1 flex-wrap justify-center z-raised">
                          <span
                            className={`bg-sky-50 text-comic-blue text-nano px-1 py-0.2 font-bold ${style.badge}`}
                            title={`Scheme: ${schDisplay}`}
                          >
                            SCH {schDisplay}
                          </span>
                          <span
                            className={`bg-rose-50 text-comic-red text-nano px-1 py-0.2 font-bold ${style.badge}`}
                            title={`Attack: ${atkDisplay}`}
                          >
                            ATK {atkDisplay}
                          </span>
                          {isGuard && (
                            <span
                              className={`bg-slate-900 text-comic-yellow text-micro px-1.5 py-0.5 font-bold ${style.badge}`}
                            >
                              GUARD
                            </span>
                          )}
                          {isTough && (
                            <span
                              className={`bg-sky-400 text-slate-950 text-micro px-1.5 py-0.5 font-bold ${style.badge}`}
                            >
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
                  className={`py-2 px-3 border-2 border-dashed border-current/30 rounded-lg text-center text-xs font-semibold flex items-center justify-center gap-2 ${style.muted} ${
                    hasDealtCards ? 'flex-1 self-stretch' : 'w-full'
                  }`}
                >
                  <span>🛡️ No minions engaged with {player.name} (Perimeter secure).</span>
                </div>
              )}
            </ThreatZoneSubzone>
          </div>
        </div>
      )}

      {/* 2. Main Hero Play Area: Two-Tier Layout (Row 1: Hero & Allies Roster, Row 2: Tableau Upgrades & Supports) */}
      <div className="flex flex-col gap-3 pt-1 w-full">
        {/* ROW 1: Hero & Allies Roster Container */}
        <div
          data-testid="hero-allies-roster"
          className={`flex flex-col md:flex-row items-stretch gap-3 p-3 transition-all ${style.inset} ${
            isTargetOfIncomingAttack ? 'ring-4 ring-rose-500 animate-pulse' : ''
          }`}
        >
          {/* Identity Station */}
          <div
            data-testid="identity-station"
            className="w-full md:w-[220px] flex flex-col gap-2 shrink-0"
          >
            {isTargetOfIncomingAttack && (
              <div
                className={`w-full text-center py-1 px-2 bg-comic-red text-white text-xs font-black uppercase tracking-wider animate-bounce ${style.buttonShape}`}
              >
                💥 UNDER ATTACK
              </div>
            )}

            {/* Header: Identity Name + Form Badge on top row */}
            <div className="flex flex-col gap-1 w-full">
              <div className="flex justify-between items-center gap-1.5 w-full">
                <div className="flex items-center gap-1 min-w-0">
                  <Shield className="w-4 h-4 shrink-0" style={{ color: palette.primary }} />
                  <span className="text-sm truncate" title={player.activeFormCard.name}>
                    {player.activeFormCard.name}
                  </span>
                </div>
                <span
                  className={`text-micro px-1.5 py-0.5 uppercase font-bold shrink-0 ${style.badge} ${
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
                      className={`text-nano px-1 py-0.2 uppercase font-bold ${style.badge} ${
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
              <div
                className={`relative z-content flex flex-col items-center justify-center min-w-[36px] ${
                  isHero ? 'gap-1' : 'gap-1.5'
                }`}
                data-testid="identity-stats-column"
              >
                {isHero ? (
                  <>
                    <StatBox
                      label="THW"
                      tone="sky"
                      value={effectiveStats.thwart}
                      bonus={thwBonus}
                      title={`Thwart: ${effectiveStats.thwart}${thwBonus > 0 ? ` (+${thwBonus})` : ''}`}
                    />
                    <StatBox
                      label="ATK"
                      tone="rose"
                      value={effectiveStats.attack}
                      bonus={atkBonus}
                      title={`Attack: ${effectiveStats.attack}${atkBonus > 0 ? ` (+${atkBonus})` : ''}`}
                    />
                    <StatBox
                      label="DEF"
                      tone="emerald"
                      value={effectiveStats.defense}
                      bonus={defBonus}
                      title={`Defense: ${effectiveStats.defense}${defBonus > 0 ? ` (+${defBonus})` : ''}`}
                    />
                  </>
                ) : (
                  <StatBox
                    label="REC"
                    tone="amber"
                    roomy
                    value={effectiveStats.recovery}
                    bonus={recBonus}
                    title={`Recovery: ${effectiveStats.recovery}${recBonus > 0 ? ` (+${recBonus})` : ''}`}
                  />
                )}
                <StatBox
                  label="HS"
                  tone="slate"
                  roomy={!isHero}
                  value={effectiveHandSize}
                  bonus={handBonus}
                  title={`Hand Size: ${effectiveHandSize}${handBonus > 0 ? ` (+${handBonus})` : ''}`}
                />
                <StatBox
                  label="RES"
                  tone="indigo"
                  roomy={!isHero}
                  value={availableResources.total}
                  title={`Available Resources: ${availableResources.total} (${availableResources.breakdown})`}
                  testId="hero-available-resources-counter"
                />
              </div>

              {/* Center Column (Card) */}
              <div
                className="flex flex-col justify-center items-center relative shrink-0 cursor-pointer"
                data-testid="hero-identity-card"
                onClick={() => setIsIdentityModalOpen(true)}
              >
                <CardAttachmentFan
                  attachments={player.attachments}
                  cardsUnderneath={player.cardsUnderneath}
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
                </CardAttachmentFan>
                {isTargetOfDamageEvent && (
                  <ComicDamageSplash
                    amount={splashDamageAmount}
                    onomatopoeia={stepEvent?.onomatopoeia || 'BANG!'}
                  />
                )}
              </div>

              {/* Right Column (Vertical HP Gauge) */}
              <div
                className="relative z-content flex flex-col items-center justify-center gap-1 shrink-0"
                data-testid="identity-hp-column"
              >
                <div className="flex flex-col items-center text-center">
                  <Heart className="w-2.5 h-2.5 text-comic-red fill-comic-red" />
                  {hpBonus > 0 && (
                    <span
                      className={`bg-emerald-400 text-slate-950 text-nano px-1 font-bold flex items-center gap-0.5 mt-0.5 ${style.badge}`}
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
                  className="h-36 w-3.5 bg-neutral-800 rounded-full border border-black overflow-hidden relative flex flex-col justify-end"
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
                <span className="text-micro font-black leading-none">
                  {player.health}/{effectiveMaxHealth}
                </span>
              </div>
            </div>

            {/* Bottom Action Row: Single horizontal row */}
            <div
              className="w-full pt-1 border-t border-current/20"
              data-testid="identity-action-row"
            >
              {!isHero ? (
                <div className="grid grid-cols-2 gap-1.5 w-full">
                  {/* Suit Up / Flip */}
                  <ToneButton
                    tone="red"
                    disabled={!canFlip}
                    onClick={() => onDispatchAction({ type: 'CHANGE_FORM', playerId: player.id })}
                    className="text-xs py-1.5 px-1 gap-1 truncate font-bold uppercase"
                    title={
                      canFlip
                        ? 'Suit Up (Hero Form) (Limit once per round)'
                        : 'Already changed form this round'
                    }
                  >
                    <RefreshCw className={`w-3 h-3 shrink-0 ${canFlip ? 'animate-pulse' : ''}`} />
                    <span className="truncate">Suit Up</span>
                  </ToneButton>

                  {/* Recover */}
                  <ToneButton
                    tone="amber"
                    disabled={!canRecover}
                    onClick={() => onDispatchAction({ type: 'BASIC_RECOVER', playerId: player.id })}
                    className="text-xs py-1.5 px-1 gap-1 truncate font-bold uppercase"
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
                  </ToneButton>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5 w-full">
                  {/* Flip */}
                  <ToneButton
                    tone="amber"
                    disabled={!canFlip}
                    onClick={() => onDispatchAction({ type: 'CHANGE_FORM', playerId: player.id })}
                    className="text-xs py-1.5 px-1 gap-1 truncate font-bold uppercase"
                    title={
                      canFlip
                        ? 'Flip to Alter-Ego (Limit once per round)'
                        : 'Already changed form this round'
                    }
                  >
                    <RefreshCw className={`w-3 h-3 shrink-0 ${canFlip ? 'animate-pulse' : ''}`} />
                    <span className="truncate">Flip</span>
                  </ToneButton>

                  {/* Attack */}
                  <ToneButton
                    tone="red"
                    disabled={!canAttack}
                    onClick={() => handleInitiateAttack('hero')}
                    className="text-xs py-1.5 px-1 gap-1 truncate font-bold uppercase"
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
                  </ToneButton>

                  {/* Thwart */}
                  <ToneButton
                    tone="blue"
                    disabled={!canThwart}
                    onClick={() => handleInitiateThwart('hero')}
                    className="text-xs py-1.5 px-1 gap-1 truncate font-bold uppercase"
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
                  </ToneButton>
                </div>
              )}
            </div>
          </div>

          {/* Vertical comic divider on md+ screens */}
          <div className="hidden md:block w-0.5 bg-current/15 self-stretch my-1 shrink-0" />

          {/* Nested Allies Section */}
          <div
            data-testid="nested-allies-section"
            className="flex-1 flex flex-col min-w-0 space-y-2 pt-2 md:pt-0"
          >
            <div
              className={`flex items-center justify-between text-xs font-bold uppercase border-b border-current/20 pb-1.5 ${style.muted}`}
            >
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
                  const allyStats = getEffectiveAllyStats(gameState, ally);
                  const atkDash = hasDashPower(allyCard, 'attack');
                  const thwDash = hasDashPower(allyCard, 'thwart');
                  const atkBonus = atkDash ? 0 : allyStats.attack - baseAtk;
                  const thwBonus = thwDash ? 0 : allyStats.thwart - baseThw;
                  const atkDisplay = atkDash ? '–' : allyStats.attack;
                  const thwDisplay = thwDash ? '–' : allyStats.thwart;

                  const canAct = isPlayerTurn && !ally.exhausted;
                  const canAtk = canAct && !atkDash;
                  const canThw =
                    canAct &&
                    !thwDash &&
                    ((getActiveMainScheme(gameState)?.threat || 0) > 0 ||
                      gameState.sideSchemes.some((s) => s.threat > 0));

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
                      {/* Ally Action Mini-Console (Positioned above card (z-raised)) */}
                      <div className="flex items-center gap-1 w-full justify-center mb-1 z-raised">
                        <ToneButton
                          tone="red"
                          onClick={() => handleInitiateAttack('ally', ally.instanceId)}
                          disabled={!canAtk}
                          className="px-1.5 py-0.5 text-micro font-bold gap-0.5"
                          title={
                            canAct
                              ? `Attack for ${allyStats.attack} damage${atkBonus > 0 ? ` (+${atkBonus} bonus)` : ''}`
                              : 'Ally exhausted'
                          }
                        >
                          <span>⚔️ {atkDisplay}</span>
                          {atkBonus > 0 && (
                            <span className="text-yellow-300 text-nano font-black">
                              (+{atkBonus})
                            </span>
                          )}
                        </ToneButton>
                        <ToneButton
                          tone="sky"
                          onClick={() => handleInitiateThwart('ally', ally.instanceId)}
                          disabled={!canThw}
                          className="px-1.5 py-0.5 text-micro font-bold gap-0.5"
                          title={
                            canThw
                              ? `Thwart scheme for ${allyStats.thwart} threat${thwBonus > 0 ? ` (+${thwBonus} bonus)` : ''}`
                              : 'No threat on schemes or ally exhausted'
                          }
                        >
                          <span>🛡️ {thwDisplay}</span>
                          {thwBonus > 0 && (
                            <span className="text-yellow-300 text-nano font-black">
                              (+{thwBonus})
                            </span>
                          )}
                        </ToneButton>
                      </div>

                      <StatStrip
                        items={[
                          { label: 'THW', value: thwDisplay, bonus: thwBonus, tone: 'emerald' },
                          { label: 'ATK', value: atkDisplay, bonus: atkBonus, tone: 'rose' },
                        ]}
                      />

                      {/* Dedicated Host Card & Attachment Anchor Container (Coordinates align with top of host card) */}
                      <CardAttachmentFan
                        attachments={ally.attachments}
                        cardsUnderneath={ally.cardsUnderneath}
                      >
                        {(() => {
                          const allyTraitsDetails = getEffectiveCardTraitsDetails(ally.card, ally);
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
                      </CardAttachmentFan>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className={`h-36 w-full border-2 border-dashed border-current/30 rounded-lg flex flex-col items-center justify-center text-center p-3 text-xs font-semibold ${style.muted}`}
              >
                <Users className="w-6 h-6 opacity-60 mb-1" />
                <span>No allies in play</span>
                <span className="text-micro font-normal">Ally Limit: {effectiveAllyLimit}</span>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Tableau Upgrades & Supports (not drawn while empty) */}
        {!isTableauEmpty && (
          <div data-testid="tableau-section" className={`w-full p-3 space-y-2 ${style.inset}`}>
            <div
              className={`flex items-center justify-between text-xs font-bold uppercase border-b border-current/20 pb-1.5 ${style.muted}`}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-comic-yellow" />
                Tableau: Upgrades & Supports ({player.tableau.length})
              </span>
            </div>

            <div className="flex flex-wrap gap-3 items-center pt-1">
              {player.tableau.map((cardInst) => {
                const abilities = cardInst.card.enrichment?.abilities || [];
                const activeAbilities = abilities.filter(
                  (ab) =>
                    ab.timing === 'ACTION' ||
                    (isHero && ab.timing === 'HERO_ACTION') ||
                    (!isHero && ab.timing === 'ALTER_EGO_ACTION'),
                );
                const legality = evaluateTableauCardLegality(cardInst, player.currentForm, {
                  gameState,
                  playerId: player.id,
                });

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
                      const costCheck = canInitiateAbility(gameState, player.id, ab, cardInst, {});
                      const isPlayerPhase = gameState.phase === 'PLAYER_PHASE';
                      const canUse = isPlayerPhase && costCheck.allowed;
                      const isCoopCall = isPlayerPhase && !isPlayerTurn;
                      const label = isCoopCall
                        ? '🤝 CALL / USE'
                        : ab.id.includes('add')
                          ? '⚡ ADD TOKENS'
                          : ab.id.includes('blast')
                            ? '💥 BLAST'
                            : '⚡ USE';

                      const hasPaymentCost =
                        ab.cost?.resourceCost ||
                        (ab.cost?.discardCard && ab.cost.discardCard.from === 'HAND');

                      return (
                        <ToneButton
                          tone="amber"
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
                            onDispatchAction({
                              type: 'USE_CARD_ABILITY',
                              playerId: player.id,
                              cardInstanceId: cardInst.instanceId,
                              abilityId: ab.id,
                            });
                          }}
                          disabled={!canUse}
                          className="w-full text-micro px-1.5 py-0.5 font-bold"
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
                        </ToneButton>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Identity Action Selector Modal */}
      <IdentityActionModal
        isOpen={isIdentityModalOpen}
        player={player}
        onClose={() => setIsIdentityModalOpen(false)}
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
          onClose={() => setSelectedAllyForModal(null)}
          onInitiateAllyAttack={(id) => handleInitiateAttack('ally', id)}
          onInitiateAllyThwart={(id) => handleInitiateThwart('ally', id)}
        />
      )}

      {/* Tableau (Support/Upgrade/Attachment) Action Selector Modal */}
      {selectedTableauCardForModal && (
        <TableauActionModal
          isOpen={!!selectedTableauCardForModal}
          cardInstance={selectedTableauCardForModal}
          player={player}
          onClose={() => setSelectedTableauCardForModal(null)}
          onSelectAbility={handleSelectTableauAbility}
        />
      )}

      {/* Attack Target Selection Modal (ADR-0020 / Target Prompt) */}
      <AttackTargetModal
        isOpen={attackModalState.isOpen}
        attackerName={attackModalState.attackerName}
        attackerCode={attackModalState.attackerCode}
        attackerType={attackModalState.attackerType}
        attackDamage={attackModalState.attackDamage}
        targets={attackModalState.targets}
        onSelectTarget={(target) => {
          if (attackModalState.attackerType === 'hero') {
            onDispatchAction({
              type: 'BASIC_ATTACK',
              playerId: player.id,
              targetType: target.type,
              targetInstanceId: target.instanceId,
            });
          } else if (attackModalState.allyInstanceId) {
            onDispatchAction({
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
        thwarterCode={thwartModalState.thwarterCode}
        thwarterType={thwartModalState.thwarterType}
        thwartValue={thwartModalState.thwartValue}
        consequentialDamage={thwartModalState.consequentialDamage}
        targets={thwartModalState.targets}
        onSelectTarget={(target) => {
          if (thwartModalState.thwarterType === 'hero') {
            onDispatchAction({
              type: 'BASIC_THWART',
              playerId: player.id,
              targetType: target.type,
              targetInstanceId: target.instanceId,
            });
          } else if (thwartModalState.allyInstanceId) {
            onDispatchAction({
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
