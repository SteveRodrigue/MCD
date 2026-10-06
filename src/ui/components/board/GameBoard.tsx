import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  GameState,
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
import { TopBar } from './TopBar';
import { VillainZone } from './VillainZone';
import { HeroZone } from './HeroZone';
import { PlayerHandTray } from './PlayerHandTray';
import { CombatLogDrawer } from './CombatLogDrawer';
import { DevStepErrorBanner } from './DevStepErrorBanner';
import { DecisionPromptModal } from './DecisionPromptModal';
import { DailyBugleActionNewspaper } from './DailyBugleActionNewspaper';
import { EndTurnConfirmationModal } from './EndTurnConfirmationModal';
import { CardPaymentModal } from './CardPaymentModal';
import { useEdgeScroll } from '../../hooks/useEdgeScroll';
import { useGameSettings } from '../../context/useGameSettings';
import {
  getLegalActionsForPlayer,
  LegalActionItem,
} from '../../../engine/pipeline/legal-actions-generator';
import { getEffectiveHandSize } from '../../../engine/pipeline/stat-calculator';
import { peekDecisionPrompt } from '../../../engine/pipeline';

interface GameBoardProps {
  gameState: GameState;
  onReset: () => void;
  onDispatchAction?: (action: GameAction) => void;
}

const SPEED_MAP: Record<string, number> = {
  slow: 18, // Slower baseline
  normal: 45, // Responsive default
  fast: 90, // High-speed glide
};

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onReset, onDispatchAction }) => {
  const [activeSeatIndex, setActiveSeatIndex] = useState<number>(0);
  const [isLogOpen, setIsLogOpen] = useState<boolean>(true);
  const [isNewspaperOpen, setIsNewspaperOpen] = useState<boolean>(false);
  const [isEndTurnPromptOpen, setIsEndTurnPromptOpen] = useState<boolean>(false);
  const [paymentModalCard, setPaymentModalCard] = useState<CardInstance | null>(null);
  const [pendingPaymentAction, setPendingPaymentAction] = useState<LegalActionItem | null>(null);
  const [pendingPromptPayment, setPendingPromptPayment] = useState<{
    optionId: string;
    playerId: string;
    card: CardInstance;
    abilityCost: {
      amount: number;
      resourceType?: 'physical' | 'energy' | 'mental' | 'wild';
      requirePrinted?: boolean;
    };
  } | null>(null);

  const { edgeScrollSpeed, villainPhasePacing, setVillainPhasePacing, devMode } = useGameSettings();
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
    if (onDispatchAction) {
      onDispatchAction({ type: 'ADVANCE_VILLAIN_PHASE' });
    }
  }, [gameState.phase, decisionPrompt, onDispatchAction]);

  const handleSkipVillainPacing = useCallback(() => {
    setIsBoostModalOpen(false);
    if (setVillainPhasePacing) {
      setVillainPhasePacing('instant');
    }
    if (onDispatchAction) {
      onDispatchAction({ type: 'ADVANCE_VILLAIN_PHASE' });
    }
  }, [setVillainPhasePacing, onDispatchAction]);

  const prevOutcomeIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const outcome = gameState.lastCombatOutcome;
    if (
      outcome &&
      outcome.id &&
      outcome.id !== prevOutcomeIdRef.current &&
      gameState.phase === 'VILLAIN_PHASE' &&
      !decisionPrompt &&
      villainPhasePacing !== 'instant'
    ) {
      setActiveCombatOutcome(outcome);
      setIsBoostModalOpen(true);
      prevOutcomeIdRef.current = outcome.id;
    }
  }, [gameState.lastCombatOutcome, gameState.phase, decisionPrompt, villainPhasePacing]);

  // Auto-advance timer during VILLAIN_PHASE
  useEffect(() => {
    if (gameState.phase !== 'VILLAIN_PHASE') return;
    if (gameState.winner) return;
    if (decisionPrompt) return;
    if (isBoostModalOpen) return;
    if (!isAutoPlaying) return;
    if (villainPhasePacing === 'manual') return;

    if (villainPhasePacing === 'instant') {
      handleNextVillainStep();
      return;
    }

    const delay = villainPhasePacing === 'auto_fast' ? 450 : 900;
    const timer = setTimeout(() => {
      handleNextVillainStep();
    }, delay);

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

  // Auto-detect when active actions drop from >0 to 0 during an active turn to prompt End Turn confirmation (ADR-0026 / Issue #169)
  const prevActionCountRef = useRef<number>(legalReport.activeActionCount);
  const prevPlayerIdRef = useRef<string>(activePlayer.id);
  const prevRoundRef = useRef<number>(gameState.roundNumber);
  const prevPhaseRef = useRef<GamePhase>(gameState.phase);

  useEffect(() => {
    const isSamePlayerTurn =
      prevPhaseRef.current === GamePhase.PLAYER_PHASE &&
      gameState.phase === GamePhase.PLAYER_PHASE &&
      prevRoundRef.current === gameState.roundNumber &&
      prevPlayerIdRef.current === activePlayer.id;

    // Reset prompt and suppress auto-prompting when transitioning round, phase, or active player
    if (!isSamePlayerTurn) {
      setIsEndTurnPromptOpen(false);
      prevActionCountRef.current = legalReport.activeActionCount;
      prevPlayerIdRef.current = activePlayer.id;
      prevRoundRef.current = gameState.roundNumber;
      prevPhaseRef.current = gameState.phase;
      return;
    }

    // Only prompt when actions drop from >0 to 0 during an ongoing turn
    if (
      prevActionCountRef.current > 0 &&
      legalReport.activeActionCount === 0 &&
      legalReport.isPlayerTurn &&
      !gameState.winner
    ) {
      setIsEndTurnPromptOpen(true);
    }

    prevActionCountRef.current = legalReport.activeActionCount;
    prevPlayerIdRef.current = activePlayer.id;
    prevRoundRef.current = gameState.roundNumber;
    prevPhaseRef.current = gameState.phase;
  }, [
    legalReport.activeActionCount,
    legalReport.isPlayerTurn,
    gameState.winner,
    gameState.phase,
    gameState.roundNumber,
    activePlayer.id,
  ]);

  // Horizontal Panoramic Track Edge-Scroll Hook (ADR-0017)
  const { containerRef, canScrollLeft, canScrollRight, scrollToChild, scrollByAmount } =
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

  // Synchronize activePlayerIndex with active seat in multiplayer
  useEffect(() => {
    if (isMultiHero && gameState.activePlayerIndex !== undefined) {
      handleSelectSeat(gameState.activePlayerIndex);
    }
  }, [isMultiHero, gameState.activePlayerIndex, handleSelectSeat]);

  // Centralized Action Dispatcher with Payment Interception (Option A / Issue #162)
  const handleDispatchAction = (action: GameAction) => {
    if (!onDispatchAction) return;

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
        const needsResourcePayment =
          Boolean(ability.cost.resourceCost) ||
          Boolean(ability.cost.resources && ability.cost.resources.length > 0);
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

  // Single Hero (Active Player)
  const singlePlayer = gameState.players[0];

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-comic-paper overflow-x-hidden">
      {/* 1. Sticky Top Navigation Bar */}
      <TopBar
        gameState={gameState}
        activeSeatIndex={activeSeatIndex}
        legalActionCount={legalReport.activeActionCount}
        onSelectSeat={handleSelectSeat}
        onToggleLog={() => setIsLogOpen((prev) => !prev)}
        isLogOpen={isLogOpen}
        onReset={onReset}
        onOpenNewspaper={() => setIsNewspaperOpen((prev) => !prev)}
      />

      {/* 2. Panoramic Tabletop Main Stage */}
      <main
        className={`flex-1 flex flex-col items-center justify-start p-2 md:p-4 pt-20 md:pt-24 gap-4 max-w-full transition-all duration-300 ${
          isLogOpen ? 'w-full lg:w-[calc(100%-420px)]' : 'w-full'
        }`}
      >
        {/* Villain Phase Stepper Ribbon (Issue #140) */}
        {gameState.phase === 'VILLAIN_PHASE' && (
          <VillainPhaseStepper
            gameState={gameState}
            pacing={villainPhasePacing}
            onNextStep={handleNextVillainStep}
            onToggleAutoPlay={() => setIsAutoPlaying((prev) => !prev)}
            onSkip={handleSkipVillainPacing}
            isAutoPlaying={isAutoPlaying}
          />
        )}

        {/* Scenario Main Villain & Schemes Console */}
        <VillainZone
          villain={getActiveVillain(gameState)}
          mainScheme={getActiveMainScheme(gameState)}
          sideSchemes={gameState.sideSchemes}
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

        {/* Multi-Hero Panoramic Track (or Solo Play Area) */}
        {isMultiHero ? (
          <div className="relative w-full overflow-hidden px-2 py-1">
            {/* Edge Navigation Buttons */}
            {canScrollLeft && (
              <button
                onClick={() => scrollByAmount(-400)}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-comic-yellow hover:bg-amber-400 text-comic-black p-2 rounded-full border-2 border-comic-black shadow-comic transition-all cursor-pointer"
                title="Scroll Left"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {canScrollRight && (
              <button
                onClick={() => scrollByAmount(400)}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-comic-yellow hover:bg-amber-400 text-comic-black p-2 rounded-full border-2 border-comic-black shadow-comic transition-all cursor-pointer"
                title="Scroll Right"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Scrollable Panoramic Track */}
            <div
              ref={containerRef}
              className="w-full overflow-x-auto no-scrollbar scroll-smooth px-4 py-2"
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
                          ? 'opacity-100 z-10 scale-[1.00] transition-all duration-300'
                          : 'opacity-60 grayscale-[35%] hover:opacity-95 hover:grayscale-0 z-0 transition-all duration-300 cursor-pointer'
                      }`}
                    >
                      {/* Hero Play Area */}
                      <HeroZone
                        player={player}
                        gameState={gameState}
                        seatNumber={idx + 1}
                        isFocused={isFocused}
                        isMultiHero={true}
                        onFocus={() => handleSelectSeat(idx)}
                        onDispatchAction={handleDispatchAction}
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
                        gameState={gameState}
                        onDispatchAction={handleDispatchAction}
                        onFocus={() => handleSelectSeat(idx)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Single Player (Solo Mode Tabletop) */
          <div className="max-w-5xl lg:max-w-6xl w-full mx-auto px-2 sm:px-4 md:px-6 space-y-6">
            <HeroZone
              player={singlePlayer}
              gameState={gameState}
              seatNumber={1}
              isFocused={true}
              isMultiHero={false}
              onDispatchAction={handleDispatchAction}
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
              gameState={gameState}
              onDispatchAction={handleDispatchAction}
            />
          </div>
        )}
      </main>

      {/* 3. 1960s Daily Bugle Newspaper Action Popover */}
      <DailyBugleActionNewspaper
        report={legalReport}
        isOpen={isNewspaperOpen}
        onClose={() => setIsNewspaperOpen(false)}
        onSelectAction={handleSelectNewspaperAction}
      />

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
                    const reqType =
                      ab.cost.resourceCost && typeof ab.cost.resourceCost === 'object'
                        ? (Object.keys(ab.cost.resourceCost)[0] as any)
                        : ab.cost.resources && ab.cost.resources.length > 0
                          ? (ab.cost.resources[0] as any)
                          : undefined;
                    const amount =
                      typeof ab.cost.resourceCost === 'number'
                        ? ab.cost.resourceCost
                        : reqType && typeof ab.cost.resourceCost === 'object'
                          ? (ab.cost.resourceCost as any)[reqType] || 1
                          : ab.cost.resources && ab.cost.resources.length > 0
                            ? ab.cost.resources.length
                            : 0;
                    const discardCount =
                      ab.cost.discardCard?.from === 'HAND' ? ab.cost.discardCard.count || 1 : 0;
                    const discardFilter = ab.cost.discardCard?.filter;
                    const scaling = ab.steps?.find(
                      (s) => s.effectParams?.scaling === 'PER_RESOURCE_SPENT',
                    )?.effectParams?.scaling;
                    if (amount > 0 || discardCount > 0) {
                      return {
                        amount,
                        resourceType: reqType,
                        requirePrinted: ab.cost.requirePrinted,
                        scaling: scaling as string | undefined,
                        title: pendingPaymentAction.headline,
                        discardCount,
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
          gameState={gameState}
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

      {/* 7. Slide-Out Combat Log & History Drawer */}
      <CombatLogDrawer
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={gameState.log}
        gameState={gameState}
        devMode={devMode}
      />
      <DevStepErrorBanner logs={gameState.log} devMode={devMode} />

      {/* 8. Interactive Decision Prompt Modal (ADR-0020 / ADR-0032 / ADR-0038) */}
      <DecisionPromptModal
        prompt={decisionPrompt}
        onSelectOption={(optionId, payload) => {
          const activePrompt = decisionPrompt;
          if (!activePrompt) return;

          const isDecline =
            optionId === 'pass' ||
            optionId === 'PASS' ||
            optionId.includes('decline') ||
            optionId.includes('none');

          const selectedOption = activePrompt.options?.find((o) => o.id === optionId);
          const promptPlayer =
            gameState.players.find((p) => p.id === activePrompt.playerId) || activePlayer;

          const optParams = selectedOption?.params as Record<string, any> | undefined;
          const requiresPayment =
            !isDecline &&
            Boolean(
              (selectedOption as any)?.requiresPayment ||
              optParams?.requiresPayment ||
              optParams?.resourceCost ||
              (optParams?.ability?.cost?.resourceCost !== undefined &&
                optParams?.ability?.cost?.resourceCost !== 0),
            );

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

            const resCost = optParams?.resourceCost;
            const ability = optParams?.ability;
            const costAmount =
              resCost?.amount ??
              (typeof ability?.cost?.resourceCost === 'number'
                ? ability.cost.resourceCost
                : (inPlayCard?.card?.cost ?? 1));
            const resourceType =
              resCost?.resourceType ??
              (typeof ability?.cost?.resourceCost === 'object' && ability.cost.resourceCost !== null
                ? Object.keys(ability.cost.resourceCost)[0]
                : undefined);

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
                resourceType: resourceType as any,
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
  );
};

export default GameBoard;
