import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  GameAction,
  CardInstance,
  CombatResolutionSummary,
  GamePhase,
  getActiveVillain,
  getActiveMainScheme,
  getVillainsInPlay,
  getMainSchemesInPlay,
} from '../../../engine/models';
import { VillainPhaseStepper } from './VillainPhaseStepper';
import { CombatBoostModal } from './CombatBoostModal';
import { SideDock } from './SideDock';
import { ExtraActionsPill } from './ExtraActionsPill';
import { VillainZone } from './VillainZone';
import { RemovedFromGameBox } from './RemovedFromGameBox';
import { HeroZone } from './HeroZone';
import { PlayerHandTray } from './PlayerHandTray';
import { CardArtSeat } from '../../context/CardArtHeroContext';
import { DevStepErrorBanner } from './DevStepErrorBanner';
import { GameOverScreen } from './GameOverScreen';
import { DecisionPromptModal } from './DecisionPromptModal';
import { BoostEffectModal } from './BoostEffectModal';
import { DailyBugleActionNewspaper } from './DailyBugleActionNewspaper';
import { EndTurnConfirmationModal } from './EndTurnConfirmationModal';
import { CardPaymentModal } from './CardPaymentModal';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { useGameSettings } from '../../context/useGameSettings';
import { GameSessionContext, useGameSession } from '../../context/GameStateContext';
import { syncGameStats } from '../../services/stats-storage-service';
import {
  getLegalActionsForPlayer,
  LegalActionItem,
} from '../../../engine/pipeline/legal-actions-generator';
import { getEffectiveHandSize } from '../../../engine/pipeline/stat-calculator';
import {
  extractResourceCost,
  getDiscardCostBounds,
  getResourceCostTotal,
} from '../../../engine/pipeline/cost-engine';
import type { ResourceCost } from '../../../data/supplemental/schema';
import { peekDecisionPrompt } from '../../../engine/pipeline';
import { optionOwnResourceCost, optionRequiresPayment } from '../../utils/option-requires-payment';
import { useModalStyle } from '../../theme/useModalStyle';

interface GameBoardProps {
  onReset: () => void;
}

/** Narrowest side slot (px) that still fits the villain phase panel; below it the bar is used. */
const STEPPER_PANEL_MIN_WIDTH = 240;

const SPEED_MAP: Record<string, number> = {
  slow: 18, // Slower baseline
  normal: 45, // Responsive default
  fast: 90, // High-speed glide
};

/**
 * The table, or the end screen alone when every hero is eliminated (#246): with no player left
 * there is no seat to show.
 */
export const GameBoard: React.FC<GameBoardProps> = ({ onReset }) => {
  const { stats, winner, players } = useGameSession().state;
  // Synced here, not in the table, so the final state of a game lost by elimination still counts.
  useEffect(() => {
    if (stats) syncGameStats(stats, !!winner).catch(() => {});
  }, [stats, winner]);

  return players.length === 0 ? (
    <GameOverScreen onReset={onReset} />
  ) : (
    <GameTable onReset={onReset} />
  );
};

const GameTable: React.FC<GameBoardProps> = ({ onReset }) => {
  const session = useGameSession();
  const { state: gameState, dispatch: onDispatchAction } = session;
  const [selectedSeatIndex, setActiveSeatIndex] = useState<number>(0);
  // An eliminated hero leaves the table (#246): a seat past the last one falls back to the last.
  const activeSeatIndex = Math.min(selectedSeatIndex, gameState.players.length - 1);
  const [isNewspaperOpen, setIsNewspaperOpen] = useState<boolean>(false);
  const { style } = useModalStyle();
  const [isEndTurnPromptOpen, setIsEndTurnPromptOpen] = useState<boolean>(false);
  const [paymentModalCard, setPaymentModalCard] = useState<CardInstance | null>(null);
  const [pendingPaymentAction, setPendingPaymentAction] = useState<LegalActionItem | null>(null);
  const [pendingPromptPayment, setPendingPromptPayment] = useState<{
    optionId: string;
    playerId: string;
    card: CardInstance;
    abilityCost: {
      amount: number;
      resources?: ResourceCost;
      requirePrinted?: boolean;
    };
  } | null>(null);

  const { edgeScrollSpeed, villainPhasePacing, setVillainPhasePacing, phaseStepperSide, devMode } =
    useGameSettings();
  // The villain phase steps fill the free space beside the villain zone when it is wide enough;
  // otherwise they stay under the villain zone (never over). Measuring the slot keeps the choice stable.
  const stepperSlotRef = useRef<HTMLDivElement>(null);
  const [stepperSlotWidth, setStepperSlotWidth] = useState(0);
  useEffect(() => {
    const slot = stepperSlotRef.current;
    if (!slot || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setStepperSlotWidth(slot.clientWidth));
    observer.observe(slot);
    setStepperSlotWidth(slot.clientWidth);
    return () => observer.disconnect();
  }, [phaseStepperSide]);
  const stepperAsPanel =
    phaseStepperSide !== 'under' && stepperSlotWidth >= STEPPER_PANEL_MIN_WIDTH;
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [activeCombatOutcome, setActiveCombatOutcome] = useState<CombatResolutionSummary | null>(
    null,
  );
  const [isBoostModalOpen, setIsBoostModalOpen] = useState<boolean>(false);
  const decisionPrompt = peekDecisionPrompt(gameState);

  const handleNextVillainStep = useCallback(() => {
    if (gameState.phase !== 'VILLAIN_PHASE') return;
    if (decisionPrompt) return;
    setIsBoostModalOpen(false);
    onDispatchAction({ type: 'ADVANCE_VILLAIN_PHASE' });
  }, [gameState.phase, decisionPrompt, onDispatchAction]);

  const handleSkipVillainPacing = useCallback(() => {
    setIsBoostModalOpen(false);
    if (setVillainPhasePacing) {
      setVillainPhasePacing('instant');
    }
    onDispatchAction({ type: 'ADVANCE_VILLAIN_PHASE' });
  }, [setVillainPhasePacing, onDispatchAction]);

  const prevOutcomeIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const outcome = gameState.lastCombatOutcome;
    if (
      outcome &&
      outcome.id &&
      outcome.id !== prevOutcomeIdRef.current &&
      gameState.phase === 'VILLAIN_PHASE' &&
      villainPhasePacing !== 'instant'
    ) {
      setActiveCombatOutcome(outcome);
      setIsBoostModalOpen(true);
      prevOutcomeIdRef.current = outcome.id;
    }
  }, [gameState.lastCombatOutcome, gameState.phase, villainPhasePacing]);

  // Auto-advance timer during VILLAIN_PHASE
  useEffect(() => {
    if (gameState.phase !== 'VILLAIN_PHASE') return;
    if (gameState.winner) return;
    if (decisionPrompt) return;
    if (isBoostModalOpen) return;
    if (!isAutoPlaying) return;
    if (villainPhasePacing === 'manual') return;

    // Instant pacing still yields one tick, so a step never dispatches inside the effect itself
    const delay =
      villainPhasePacing === 'instant' ? 0 : villainPhasePacing === 'auto_fast' ? 450 : 900;
    const timer = setTimeout(handleNextVillainStep, delay);

    return () => clearTimeout(timer);
  }, [
    gameState.phase,
    gameState.winner,
    decisionPrompt,
    gameState.villainPhaseStep,
    gameState.villainPhaseStepEvent,
    isBoostModalOpen,
    isAutoPlaying,
    villainPhasePacing,
    handleNextVillainStep,
  ]);

  const totalPlayers = gameState.players.length;
  const isMultiHero = totalPlayers >= 2;

  // Active Player & Legal Actions Report
  const activePlayer = gameState.players[gameState.activePlayerIndex] || gameState.players[0];
  const legalReport = useMemo(
    () => getLegalActionsForPlayer(gameState, activePlayer.id),
    [gameState, activePlayer.id],
  );

  // Call for Action (teammates, multi-hero only) and Villain actions waiting: the EXTRA! pill and the
  // Daily Bugle button of the rail ring while any is available in the player phase.
  const teamActionCount = isMultiHero ? legalReport.callForActionCount : 0;
  const villainActionCount = legalReport.villainActionCount || 0;
  const extraActionCount =
    gameState.phase === GamePhase.PLAYER_PHASE ? teamActionCount + villainActionCount : 0;

  // Auto-detect when active actions drop from >0 to 0 during an active turn to prompt End Turn confirmation (ADR-0026 / Issue #169, #310)
  const [turnWatch, setTurnWatch] = useState({
    phase: gameState.phase,
    round: gameState.roundNumber,
    playerId: activePlayer.id,
    actionCount: legalReport.activeActionCount,
  });
  const isSamePlayerTurn =
    turnWatch.phase === GamePhase.PLAYER_PHASE &&
    gameState.phase === GamePhase.PLAYER_PHASE &&
    turnWatch.round === gameState.roundNumber &&
    turnWatch.playerId === activePlayer.id;

  // Reset prompt and suppress auto-prompting when transitioning round, phase, or active player
  let endTurnPromptOpen = isSamePlayerTurn && isEndTurnPromptOpen;
  let watchedActionCount = legalReport.activeActionCount;
  if (isSamePlayerTurn) {
    // Dismiss modal whenever active actions become available again (#310)
    if (legalReport.activeActionCount > 0) endTurnPromptOpen = false;

    // Only prompt when actions drop from >0 to 0 during an ongoing turn and no decision prompt is pending
    if (
      !decisionPrompt &&
      turnWatch.actionCount > 0 &&
      legalReport.activeActionCount === 0 &&
      legalReport.isPlayerTurn &&
      !gameState.winner
    ) {
      endTurnPromptOpen = true;
    }

    // Preserve the watched action count across active decision prompts; update once resolved (#310)
    if (decisionPrompt) watchedActionCount = turnWatch.actionCount;
  }
  if (endTurnPromptOpen !== isEndTurnPromptOpen) setIsEndTurnPromptOpen(endTurnPromptOpen);
  if (
    turnWatch.phase !== gameState.phase ||
    turnWatch.round !== gameState.roundNumber ||
    turnWatch.playerId !== activePlayer.id ||
    turnWatch.actionCount !== watchedActionCount
  ) {
    setTurnWatch({
      phase: gameState.phase,
      round: gameState.roundNumber,
      playerId: activePlayer.id,
      actionCount: watchedActionCount,
    });
  }

  // Horizontal Panoramic Track Edge-Scroll Hook (ADR-0017)
  const { trackRef, canScrollLeft, canScrollRight, scrollToChild, scrollToEdge } =
    useEdgeScroll<HTMLDivElement>({
      edgeThreshold: 95,
      maxSpeed: SPEED_MAP[edgeScrollSpeed] || 45,
      enabled: isMultiHero,
    });

  const heroStationRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Smoothly center the active hero whenever activeSeatIndex changes
  const handleSelectSeat = useCallback(
    (seatIdx: number) => {
      setActiveSeatIndex(seatIdx);
      const targetElement = heroStationRefs.current[seatIdx];
      if (targetElement) {
        scrollToChild(targetElement);
      }
    },
    [scrollToChild],
  );

  // Auto-align to initial active seat on mount
  useEffect(() => {
    if (isMultiHero) {
      const targetElement = heroStationRefs.current[activeSeatIndex];
      if (targetElement) {
        scrollToChild(targetElement);
      }
    }
  }, [isMultiHero, activeSeatIndex, scrollToChild]);

  // Synchronize activePlayerIndex with active seat in multiplayer; the effect above scrolls to it
  const followedPlayerIndex = isMultiHero ? gameState.activePlayerIndex : undefined;
  const [seatFollowedIndex, setSeatFollowedIndex] = useState<number | undefined>(undefined);
  if (followedPlayerIndex !== seatFollowedIndex) {
    setSeatFollowedIndex(followedPlayerIndex);
    if (followedPlayerIndex !== undefined) setActiveSeatIndex(followedPlayerIndex);
  }

  // Centralized Action Dispatcher with Payment Interception (Option A / Issue #162)
  const handleDispatchAction = (action: GameAction) => {
    if (action.type === 'USE_CARD_ABILITY') {
      const hasPaymentCards = (action.paymentCardInstanceIds?.length || 0) > 0;
      const hasGenerators = (action.generatorInstanceIds?.length || 0) > 0;
      const hasDiscardCards = (action.discardCardInstanceIds?.length || 0) > 0;

      // Find the player executing this action
      const player = gameState.players.find((p) => p.id === action.playerId) || activePlayer;

      // Locate the card and ability
      let targetCardInstance: CardInstance | undefined;
      if (player.activeFormCard.code === action.cardInstanceId) {
        targetCardInstance = {
          instanceId: player.activeFormCard.code,
          card: player.activeFormCard,
          exhausted: player.exhausted,
        };
      } else {
        targetCardInstance =
          player.tableau.find((c) => c.instanceId === action.cardInstanceId) ||
          player.allies?.find((a) => a.instanceId === action.cardInstanceId) ||
          player.attachments?.find((a) => a.instanceId === action.cardInstanceId) ||
          getVillainsInPlay(gameState)
            .flatMap((v) => v.attachments || [])
            .find((a) => a.instanceId === action.cardInstanceId) ||
          getMainSchemesInPlay(gameState)
            .flatMap((m) => m.attachments || [])
            .find((a) => a.instanceId === action.cardInstanceId);
      }

      const ability = targetCardInstance?.card.enrichment?.abilities?.find(
        (a) => a.id === action.abilityId,
      );

      if (ability?.cost) {
        const needsResourcePayment = Boolean(ability.cost.resourceCost);
        const needsDiscardPayment =
          ability.cost.discardCard?.from === 'HAND' && ability.cost.discardCard.mode !== 'RANDOM';

        const missingResourcePayment = needsResourcePayment && !hasPaymentCards && !hasGenerators;
        const missingDiscardPayment = needsDiscardPayment && !hasDiscardCards;

        if (missingResourcePayment || missingDiscardPayment) {
          const item: LegalActionItem = {
            id: `pending_payment_${action.cardInstanceId}_${action.abilityId}`,
            category: 'board',
            headline: `Action: ${ability.id.replace(/_/g, ' ').toUpperCase()}`,
            subtext: `Pay costs for ${targetCardInstance?.card.name || 'card'}`,
            action,
            requiresModal: 'payment',
            targetCardInstance,
          };
          setPendingPaymentAction(item);
          setPaymentModalCard(targetCardInstance || null);
          return;
        }
      }
    }

    onDispatchAction(action);
  };

  // Execute action from Daily Bugle or interactive tabletop element
  const handleSelectNewspaperAction = (item: LegalActionItem) => {
    if (item.requiresModal === 'payment' && item.targetCardInstance) {
      setPendingPaymentAction(item);
      setPaymentModalCard(item.targetCardInstance);
    } else {
      handleDispatchAction(item.action);
    }
  };

  // The Out of Play box is drawn only while it holds a removed card or a defeated hero (Issue #379).
  const isOutOfPlayEmpty =
    (gameState.removedFromGame?.length ?? 0) === 0 &&
    (gameState.eliminatedPlayers?.length ?? 0) === 0;

  // Single Hero (Active Player)
  const singlePlayer = gameState.players[0];

  // Everything below dispatches through the payment interception above
  return (
    <GameSessionContext.Provider value={{ ...session, dispatch: handleDispatchAction }}>
      <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-clip">
        <div className="flex-1 flex flex-col min-w-0 w-[calc(100%-420px)]">
          {/* Jump buttons of the hero track: sticky at the middle of the screen, not of the tall track */}
          {isMultiHero && (
            <div data-testid="track-jump-buttons" className="sticky top-1/2 h-0 w-full z-lifted">
              {(['left', 'right'] as const).map((side) => {
                const canScroll = side === 'left' ? canScrollLeft : canScrollRight;
                const Arrow = side === 'left' ? ChevronLeft : ChevronRight;
                return (
                  canScroll && (
                    <div
                      key={side}
                      className={`absolute ${side === 'left' ? 'left-2' : 'right-2'} -translate-y-1/2 pointer-events-none`}
                    >
                      <button
                        data-no-edge-scroll=""
                        onClick={() => scrollToEdge(side)}
                        className={`block p-2 pointer-events-auto transition-all cursor-pointer ${style.btnGo} rounded-full!`}
                        title={side === 'left' ? 'Scroll Left' : 'Scroll Right'}
                      >
                        <Arrow className="w-6 h-6" />
                      </button>
                    </div>
                  )
                );
              })}
            </div>
          )}

          {/* 1. Panoramic Tabletop Main Stage */}
          <main className="flex-1 flex flex-col items-center justify-start p-2 md:p-4 gap-4 max-w-full">
            {/* Scenario Main Villain & Out of Play Console */}
            <div
              data-testid="villain-stage"
              className="w-full grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-4"
            >
              {(['left', 'right'] as const).map((side) => (
                <div
                  key={side}
                  ref={side === phaseStepperSide ? stepperSlotRef : undefined}
                  data-testid={`stepper-slot-${side}`}
                  className={`relative min-w-0 ${side === 'left' ? 'order-first' : 'order-last'}`}
                >
                  {side === phaseStepperSide &&
                    gameState.phase === 'VILLAIN_PHASE' &&
                    stepperAsPanel && (
                      <div
                        className={`absolute inset-y-0 w-60 max-w-full ${side === 'left' ? 'right-0' : 'left-0'}`}
                      >
                        <VillainPhaseStepper
                          variant="panel"
                          pacing={villainPhasePacing}
                          onNextStep={handleNextVillainStep}
                          onToggleAutoPlay={() => setIsAutoPlaying((prev) => !prev)}
                          onSkip={handleSkipVillainPacing}
                          isAutoPlaying={isAutoPlaying}
                        />
                      </div>
                    )}
                </div>
              ))}
              <div
                data-testid="villain-row"
                className="flex flex-nowrap items-start justify-center gap-4"
              >
                {extraActionCount > 0 && (
                  <ExtraActionsPill
                    teamActionCount={teamActionCount}
                    villainActionCount={villainActionCount}
                    isNewspaperOpen={isNewspaperOpen}
                    onOpen={() => setIsNewspaperOpen(true)}
                  />
                )}
                {!isOutOfPlayEmpty && (
                  <RemovedFromGameBox
                    cards={gameState.removedFromGame || []}
                    eliminatedPlayers={gameState.eliminatedPlayers}
                  />
                )}
                <VillainZone
                  villain={getActiveVillain(gameState)}
                  mainScheme={getActiveMainScheme(gameState)}
                  sideSchemes={gameState.sideSchemes}
                  environments={gameState.environments}
                  outOfPlayEmpty={isOutOfPlayEmpty}
                  encounterDeck={gameState.encounterDeck}
                  encounterDiscard={gameState.encounterDiscard}
                  accelerationTokens={gameState.accelerationTokens}
                  onSelectAttachment={(att) => {
                    const matchAction = legalReport.boardActions.find(
                      (a) =>
                        a.targetCardInstance?.instanceId === att.instanceId ||
                        (a.action as any)?.cardInstanceId === att.instanceId,
                    );
                    if (matchAction) {
                      handleSelectNewspaperAction(matchAction);
                    }
                  }}
                />
              </div>
            </div>

            {/* Villain Phase Stepper Ribbon: placed under the villain zone when 'under' is chosen or side slot is too narrow (never over) */}
            {gameState.phase === 'VILLAIN_PHASE' && !stepperAsPanel && (
              <VillainPhaseStepper
                pacing={villainPhasePacing}
                onNextStep={handleNextVillainStep}
                onToggleAutoPlay={() => setIsAutoPlaying((prev) => !prev)}
                onSkip={handleSkipVillainPacing}
                isAutoPlaying={isAutoPlaying}
              />
            )}

            {/* Multi-Hero Panoramic Track (or Solo Play Area) */}
            {isMultiHero ? (
              <div className="relative w-full overflow-hidden px-2 py-1">
                {/* Scrollable Panoramic Track */}
                <div
                  ref={trackRef}
                  className="w-full overflow-x-auto no-scrollbar scroll-smooth px-4 pt-4 pb-2"
                >
                  <div className="flex items-start justify-center min-w-full w-max gap-6">
                    {gameState.players.map((player, idx) => {
                      const isFocused = activeSeatIndex === idx;

                      return (
                        <div
                          key={player.id}
                          ref={(el) => {
                            heroStationRefs.current[idx] = el;
                          }}
                          onClick={!isFocused ? () => handleSelectSeat(idx) : undefined}
                          className={`w-[820px] lg:w-[880px] shrink-0 space-y-4 ${
                            isFocused
                              ? 'opacity-100 z-content transition-all duration-300'
                              : 'opacity-60 grayscale-35 hover:opacity-95 hover:grayscale-0 z-table transition-all duration-300 cursor-pointer'
                          }`}
                        >
                          <CardArtSeat playerId={player.id}>
                            {/* Hero Play Area */}
                            <HeroZone
                              player={player}
                              seatNumber={idx + 1}
                              isFocused={isFocused}
                              isMultiHero={true}
                              onFocus={() => handleSelectSeat(idx)}
                              onInitiateAction={handleSelectNewspaperAction}
                            />

                            {/* Hero Hand Tray */}
                            <PlayerHandTray
                              hand={player.hand}
                              deck={player.deck}
                              discard={player.discard}
                              setAsideCards={player.setAsideCards}
                              heroName={player.name}
                              handSizeLimit={getEffectiveHandSize(player, gameState)}
                              seatNumber={idx + 1}
                              isFocused={isFocused}
                              isMultiHero={true}
                              player={player}
                              onFocus={() => handleSelectSeat(idx)}
                            />
                          </CardArtSeat>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Single Player (Solo Mode Tabletop) */
              <div className="max-w-5xl lg:max-w-6xl w-full mx-auto px-2 sm:px-4 md:px-6 space-y-6">
                <CardArtSeat playerId={singlePlayer.id}>
                  <HeroZone
                    player={singlePlayer}
                    seatNumber={1}
                    isFocused={true}
                    isMultiHero={false}
                    onInitiateAction={handleSelectNewspaperAction}
                  />
                  <PlayerHandTray
                    hand={singlePlayer.hand}
                    deck={singlePlayer.deck}
                    discard={singlePlayer.discard}
                    setAsideCards={singlePlayer.setAsideCards}
                    heroName={singlePlayer.name}
                    handSizeLimit={getEffectiveHandSize(singlePlayer, gameState)}
                    seatNumber={1}
                    isFocused={true}
                    isMultiHero={false}
                    player={singlePlayer}
                  />
                </CardArtSeat>
              </div>
            )}
          </main>
        </div>

        {/* 3. 1960s Daily Bugle Newspaper Action Popover */}
        <CardArtSeat playerId={activePlayer.id}>
          <DailyBugleActionNewspaper
            report={legalReport}
            isOpen={isNewspaperOpen}
            onClose={() => setIsNewspaperOpen(false)}
            onSelectAction={handleSelectNewspaperAction}
          />
        </CardArtSeat>

        {/* 5. Automatic End Turn Confirmation Modal */}
        <EndTurnConfirmationModal
          isOpen={isEndTurnPromptOpen}
          playerName={activePlayer.name}
          turnAction={legalReport.turnAction}
          onConfirmEndTurn={() => {
            setIsEndTurnPromptOpen(false);
            if (legalReport.turnAction && onDispatchAction) {
              onDispatchAction(legalReport.turnAction.action);
            }
          }}
          onDismiss={() => setIsEndTurnPromptOpen(false)}
        />

        {/* 6. Card Payment Modal (Triggered via Newspaper, In-Play Interaction, or Decision Prompt) */}
        {(paymentModalCard || pendingPromptPayment) && (
          <CardPaymentModal
            isOpen={true}
            cardToPlay={pendingPromptPayment?.card || paymentModalCard}
            abilityCost={
              pendingPromptPayment
                ? pendingPromptPayment.abilityCost
                : pendingPaymentAction?.action.type === 'USE_CARD_ABILITY'
                  ? (() => {
                      const ab = paymentModalCard?.card.enrichment?.abilities?.find(
                        (a) => a.id === (pendingPaymentAction.action as any).abilityId,
                      );
                      if (!ab?.cost) return undefined;
                      const amount = extractResourceCost(ab.cost).requiredAmount;
                      const discardBounds =
                        ab.cost.discardCard?.from === 'HAND'
                          ? getDiscardCostBounds(ab.cost.discardCard)
                          : undefined;
                      const discardCount = discardBounds?.max ?? 0;
                      const discardFilter = ab.cost.discardCard?.filter;
                      const scalesWithResources = ab.steps?.some(
                        (s) =>
                          typeof s.effectParams?.amount === 'object' &&
                          (s.effectParams.amount as { from?: string } | null)?.from ===
                            'RESOURCES_SPENT',
                      );
                      if (amount > 0 || discardCount > 0) {
                        return {
                          amount,
                          resources: ab.cost.resourceCost,
                          requirePrinted: ab.cost.requirePrinted,
                          scalesWithResources,
                          title: pendingPaymentAction.headline,
                          discardCount,
                          discardMin: discardBounds?.min,
                          discardFilter,
                        };
                      }
                      return undefined;
                    })()
                  : undefined
            }
            player={
              pendingPromptPayment
                ? gameState.players.find((p) => p.id === pendingPromptPayment.playerId) ||
                  activePlayer
                : pendingPaymentAction?.action?.playerId
                  ? gameState.players.find((p) => p.id === pendingPaymentAction.action.playerId) ||
                    activePlayer
                  : activePlayer
            }
            onClose={() => {
              if (pendingPromptPayment && onDispatchAction) {
                const activePrompt = peekDecisionPrompt(gameState);
                const passOption = activePrompt?.options?.find(
                  (o) => o.id === 'pass_play_from_zone' || o.effect === 'PLAY_CARD_FROM_ZONE_PASS',
                );
                if (passOption) {
                  onDispatchAction({
                    type: 'RESOLVE_DECISION_PROMPT',
                    playerId: pendingPromptPayment.playerId,
                    selectedOptionId: passOption.id,
                  });
                }
              }
              setPaymentModalCard(null);
              setPendingPaymentAction(null);
              setPendingPromptPayment(null);
            }}
            onConfirmPlay={(
              paymentHandCardIds: string[],
              generatorCardIds: string[],
              targetInstanceId?: string,
              selectedDiscardCardIds?: string[],
            ) => {
              if (onDispatchAction) {
                if (pendingPromptPayment) {
                  onDispatchAction({
                    type: 'RESOLVE_DECISION_PROMPT',
                    playerId: pendingPromptPayment.playerId,
                    selectedOptionId: pendingPromptPayment.optionId,
                    paymentCardInstanceIds: paymentHandCardIds,
                    generatorInstanceIds: generatorCardIds,
                  });
                } else if (pendingPaymentAction?.action.type === 'USE_CARD_ABILITY') {
                  onDispatchAction({
                    ...pendingPaymentAction.action,
                    paymentCardInstanceIds: paymentHandCardIds,
                    generatorInstanceIds: generatorCardIds,
                    targetInstanceId,
                    discardCardInstanceIds: selectedDiscardCardIds,
                  });
                } else if (paymentModalCard) {
                  onDispatchAction({
                    type: 'PLAY_CARD',
                    playerId: activePlayer.id,
                    cardInstanceId: paymentModalCard.instanceId,
                    paymentCardInstanceIds: paymentHandCardIds,
                    generatorInstanceIds: generatorCardIds,
                    discardCardInstanceIds: selectedDiscardCardIds,
                    targetInstanceId,
                  });
                }
              }
              setPaymentModalCard(null);
              setPendingPaymentAction(null);
              setPendingPromptPayment(null);
            }}
          />
        )}

        {/* 7. Side dock: quick menu rail above the combat log */}
        <SideDock
          legalActionCount={legalReport.activeActionCount}
          extraActionCount={extraActionCount}
          isNewspaperOpen={isNewspaperOpen}
          onOpenNewspaper={() => setIsNewspaperOpen((prev) => !prev)}
          onReset={onReset}
        />
        <DevStepErrorBanner logs={gameState.log} devMode={devMode} />
        <GameOverScreen onReset={onReset} />

        {/* 8. Interactive Decision Prompt Modal (ADR-0020 / ADR-0032 / ADR-0038) */}
        {!isBoostModalOpen && decisionPrompt?.kind !== 'BOOST_ABILITY_REVEAL' && (
          <DecisionPromptModal
            prompt={decisionPrompt}
            players={gameState.players}
            onSelectOption={(optionId, payload) => {
              const activePrompt = decisionPrompt;
              if (!activePrompt) return;

              const selectedOption = activePrompt.options?.find((o) => o.id === optionId);
              const promptPlayer =
                gameState.players.find((p) => p.id === activePrompt.playerId) || activePlayer;

              const optParams = selectedOption?.params as Record<string, any> | undefined;
              const requiresPayment = selectedOption
                ? optionRequiresPayment(selectedOption)
                : false;

              if (requiresPayment && selectedOption) {
                const cardInstanceId =
                  (optParams?.costCardInstanceId as string | undefined) ||
                  (optParams?.sourceCardInstanceId as string | undefined);
                const inPlayCard =
                  (optParams?.cardInstance as CardInstance | undefined) ||
                  (cardInstanceId
                    ? promptPlayer.hand.find((c) => c.instanceId === cardInstanceId) ||
                      promptPlayer.tableau.find((c) => c.instanceId === cardInstanceId) ||
                      promptPlayer.discard.find((c) => c.instanceId === cardInstanceId) ||
                      gameState.players
                        .flatMap((p) => p.discard)
                        .find((c) => c.instanceId === cardInstanceId)
                    : undefined) ||
                  (activePrompt.sourceCardCode
                    ? promptPlayer.hand.find((c) => c.card.code === activePrompt.sourceCardCode) ||
                      promptPlayer.tableau.find((c) => c.card.code === activePrompt.sourceCardCode)
                    : undefined);

                const resCost = optParams?.resourceCost ?? optionOwnResourceCost(selectedOption);
                const ability = optParams?.ability;
                const resources: ResourceCost | undefined =
                  resCost?.resources ?? ability?.cost?.resourceCost;
                const costAmount =
                  resCost?.amount ??
                  (resources ? getResourceCostTotal(resources) : undefined) ??
                  inPlayCard?.card?.cost ??
                  1;

                // Fallback synthetic card if prompt is from an encounter card or villain attachment
                const paymentCard = inPlayCard || {
                  instanceId: cardInstanceId || activePrompt.promptId,
                  card: activePrompt.triggerSourceCard || {
                    code: activePrompt.sourceCardCode || 'encounter_cost',
                    name: activePrompt.sourceCardName || 'Card Cost',
                    type: 'encounter' as any,
                    cost: costAmount,
                  },
                  ownerId: activePrompt.playerId,
                };

                setPendingPromptPayment({
                  optionId,
                  playerId: activePrompt.playerId,
                  card: paymentCard as CardInstance,
                  abilityCost: {
                    amount: costAmount,
                    resources,
                    requirePrinted: ability?.cost?.requirePrinted,
                  },
                });
                setPaymentModalCard(paymentCard as CardInstance);
                return;
              }

              if (onDispatchAction) {
                onDispatchAction({
                  type: 'RESOLVE_DECISION_PROMPT',
                  playerId: activePrompt.playerId,
                  selectedOptionId: optionId,
                  ...payload,
                });
              }
            }}
          />
        )}

        {/* 8b. Boost Ability Reveal Modal (Issue #503) */}
        <BoostEffectModal
          isOpen={
            !gameState.winner &&
            !isBoostModalOpen &&
            decisionPrompt?.kind === 'BOOST_ABILITY_REVEAL'
          }
          prompt={decisionPrompt}
          pacing={villainPhasePacing}
          isAutoPlaying={isAutoPlaying}
          onContinue={() => {
            if (decisionPrompt && onDispatchAction) {
              onDispatchAction({
                type: 'RESOLVE_DECISION_PROMPT',
                playerId: decisionPrompt.playerId,
                selectedOptionId: decisionPrompt.options?.[0]?.id || 'resolve_boost',
              });
            }
          }}
        />

        {/* 9. Combat Boost & Damage Resolution Modal (Issue #140) */}
        <CombatBoostModal
          isOpen={isBoostModalOpen && Boolean(activeCombatOutcome)}
          outcome={activeCombatOutcome || undefined}
          onContinue={() => {
            setIsBoostModalOpen(false);
            setActiveCombatOutcome(null);
            handleNextVillainStep();
          }}
        />
      </div>
    </GameSessionContext.Provider>
  );
};

export default GameBoard;
