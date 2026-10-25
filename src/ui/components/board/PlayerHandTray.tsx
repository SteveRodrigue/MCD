import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTimeout } from '../../hooks/useTimeout';
import { Layers, Sparkles, Skull, Eye, Filter, ArrowDownUp, Plus } from 'lucide-react';
import { CardInstance, NormalizedCard, PlayerState } from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { useGameSettings } from '../../context/useGameSettings';
import { CardPaymentModal } from './CardPaymentModal';
import {
  PileCardTile,
  PileChoice,
  PileGrid,
  PileGroup,
  PileToolbar,
  PileViewerModal,
} from './PileViewerModal';

import { useGameSession } from '../../context/GameStateContext';
import { useHandFanLayout } from '../../hooks/useHandFanLayout';
import { getHeroColorPalette } from '../../utils/hero-theme';
import { getCardBackUrl, getCardBackFallbackColor } from '../../services/card-cache-service';
import { getFanZIndex } from '../cards/fan-z';

interface PlayerHandTrayProps {
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  setAsideCards?: CardInstance[];
  heroName: string;
  handSizeLimit: number;
  seatNumber?: number;
  isFocused?: boolean;
  isMultiHero?: boolean;
  player?: PlayerState;
  onFocus?: () => void;
  onCardClick?: (cardInst: CardInstance) => void;
}

interface HandCardProps {
  cardInst: CardInstance;
  isPlayable: boolean;
  unplayableReason?: string;
  onSelect: (cardInst: CardInstance) => void;
}

/** One hand card; props are stable across a state update that leaves the card alone (ADR-0089). */
const HandCard = React.memo(function HandCard({
  cardInst,
  isPlayable,
  unplayableReason,
  onSelect,
}: HandCardProps) {
  const handleClick = useCallback(() => onSelect(cardInst), [onSelect, cardInst]);
  return (
    <CardView
      card={cardInst.card}
      instance={cardInst}
      size="hand"
      isPlayable={isPlayable}
      unplayableReason={unplayableReason}
      enableHoverZoom={true}
      zoomOrigin="bottom"
      onClick={handleClick}
    />
  );
});

type PlayerSortMode = 'deck_order' | 'card_type' | 'affinity' | 'cost';
type DeckDirection = 'top_to_bottom' | 'bottom_to_top';
type CostDirection = 'low_to_high' | 'high_to_low';

function getPlayerCardAffinity(card: NormalizedCard): string {
  const faction = (card.faction || '').toLowerCase();
  if (faction === 'justice') return 'Justice';
  if (faction === 'aggression') return 'Aggression';
  if (faction === 'leadership') return 'Leadership';
  if (faction === 'protection') return 'Protection';
  if (faction === 'basic') return 'Basic';
  if (faction === 'hero' || card.setCode === 'spider_man') {
    return 'Hero Signature (Spider-Man)';
  }
  if (card.setCode) {
    return card.setCode
      .split('_')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return 'Basic';
}

function getPlayerCardTypeName(card: NormalizedCard): string {
  const type = card.type || 'card';
  if (type === 'event') return 'Events';
  if (type === 'ally') return 'Allies';
  if (type === 'upgrade') return 'Upgrades';
  if (type === 'support') return 'Supports';
  if (type === 'resource') return 'Resources';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getPlayerCardCostGroup(card: NormalizedCard): string {
  const isNoCost = card.type === 'resource' || card.cost === undefined || card.cost === null;

  if (isNoCost) {
    return 'Resource Cards (No Cost)';
  }
  return 'Cards with Cost';
}

function getPlayerCardCostValue(card: NormalizedCard): number {
  if (card.type === 'resource' || card.cost === undefined || card.cost === null) {
    return 999;
  }
  return card.cost;
}

/** Dev Mode: copies a card from the deck inspector into the hand. */
const DevAddToHand: React.FC<{ instance: CardInstance; onAdd: (instanceId: string) => void }> = ({
  instance,
  onAdd,
}) => (
  <button
    type="button"
    onClick={() => onAdd(instance.instanceId)}
    className="w-full bg-comic-yellow hover:bg-amber-300 text-comic-black text-micro font-bold py-1 px-1.5 rounded border border-comic-black shadow-comic-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
    title={`Dev Mode: Add ${instance.card.name} to hand`}
  >
    <Plus className="w-3 h-3" />
    <span>+ Hand</span>
  </button>
);

export const PlayerHandTray: React.FC<PlayerHandTrayProps> = ({
  hand,
  deck,
  discard,
  setAsideCards = [],
  heroName,
  handSizeLimit = 6,
  seatNumber,
  isFocused = true,
  isMultiHero = false,
  player,
  onFocus,
  onCardClick,
}) => {
  const { state: gameState, dispatch: onDispatchAction, getPlayability } = useGameSession();
  const playabilityById = getPlayability();
  const { devMode } = useGameSettings();
  const later = useTimeout();
  const palette = useMemo(() => getHeroColorPalette(player), [player]);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showNemesisModal, setShowNemesisModal] = useState(false);
  const [playingCard, setPlayingCard] = useState<CardInstance | null>(null);
  const [turnWarning, setTurnWarning] = useState<string | null>(null);
  const [deckImageError, setDeckImageError] = useState(false);

  const activePlayer = gameState.players[gameState.activePlayerIndex ?? 0];
  const isActivePlayerTurn = gameState.phase === 'PLAYER_PHASE' && activePlayer?.id === player?.id;

  const handleCardClick = (cardInst: CardInstance) => {
    const playability = playabilityById.get(cardInst.instanceId);
    if (playability) {
      if (!playability.isPlayable) {
        setTurnWarning(`Cannot play ${cardInst.card.name}: ${playability.reasons.join(' • ')}`);
        later(() => setTurnWarning(null), 4500);
        return;
      }
    }

    if (onCardClick) {
      onCardClick(cardInst);
    }
    if (player) {
      setPlayingCard(cardInst);
    }
  };

  // The latest click handler behind one stable function, so memoised hand cards keep their props.
  const handleCardClickRef = useRef(handleCardClick);
  useEffect(() => {
    handleCardClickRef.current = handleCardClick;
  });
  const selectHandCard = useCallback(
    (cardInst: CardInstance) => handleCardClickRef.current(cardInst),
    [],
  );

  const handleEndTurn = () => {
    if (player) {
      onDispatchAction({
        type: 'END_PLAYER_TURN',
        playerId: player.id,
      });
    }
  };

  const handleDevAddCard = (cardInstanceId: string) => {
    if (player) {
      onDispatchAction({
        type: 'DEV_ADD_CARD_TO_HAND',
        playerId: player.id,
        cardInstanceId,
      });
    }
  };

  // Dynamic Fan-Out Stack Layout Hook (size="hand" ~130px card width, +15% over sm)
  const handFan = useHandFanLayout({
    cardCount: hand.length,
    cardWidth: 130, // size="hand" portrait width (130px)
    defaultGap: 12,
    padding: 16,
  });

  const [hoveredHandCardId, setHoveredHandCardId] = useState<string | null>(null);

  // Inspector View Sort States
  const [sortMode, setSortMode] = useState<PlayerSortMode>('deck_order');
  const [deckDirection, setDeckDirection] = useState<DeckDirection>('top_to_bottom');
  const [costDirection, setCostDirection] = useState<CostDirection>('low_to_high');

  // Process and sort Player Deck for Inspector View
  const processedDeckItems = useMemo(() => {
    // Attach original deck index (0-based: 0 is top of deck)
    const items = deck.map((instance, originalIndex) => ({
      instance,
      originalIndex,
      affinity: getPlayerCardAffinity(instance.card),
      cardType: getPlayerCardTypeName(instance.card),
      costGroup: getPlayerCardCostGroup(instance.card),
      costValue: getPlayerCardCostValue(instance.card),
    }));

    if (sortMode === 'deck_order') {
      return deckDirection === 'top_to_bottom' ? items : [...items].reverse();
    }

    if (sortMode === 'card_type') {
      return [...items].sort((a, b) => {
        if (a.cardType !== b.cardType) return a.cardType.localeCompare(b.cardType);
        return a.originalIndex - b.originalIndex;
      });
    }

    if (sortMode === 'affinity') {
      return [...items].sort((a, b) => {
        if (a.affinity !== b.affinity) return a.affinity.localeCompare(b.affinity);
        return a.originalIndex - b.originalIndex;
      });
    }

    if (sortMode === 'cost') {
      return [...items].sort((a, b) => {
        // Keep Resource Cards (No Cost) always at the bottom
        const aIsNoCost = a.costGroup === 'Resource Cards (No Cost)';
        const bIsNoCost = b.costGroup === 'Resource Cards (No Cost)';
        if (aIsNoCost && !bIsNoCost) return 1;
        if (!aIsNoCost && bIsNoCost) return -1;

        if (a.costValue !== b.costValue) {
          return costDirection === 'low_to_high'
            ? a.costValue - b.costValue
            : b.costValue - a.costValue;
        }
        return a.originalIndex - b.originalIndex;
      });
    }

    return items;
  }, [deck, sortMode, deckDirection, costDirection]);

  // Group items by category if not in pure deck order
  const groupedDeckItems = useMemo(() => {
    if (sortMode === 'deck_order') return null;

    if (sortMode === 'cost') {
      const withCost = processedDeckItems.filter((i) => i.costGroup === 'Cards with Cost');
      const noCost = processedDeckItems.filter((i) => i.costGroup === 'Resource Cards (No Cost)');
      const groups: Record<string, typeof processedDeckItems> = {};
      if (withCost.length > 0) groups['Cards with Cost'] = withCost;
      if (noCost.length > 0) groups['Resource Cards (No Cost)'] = noCost;
      return groups;
    }

    const groupKey = sortMode === 'card_type' ? 'cardType' : 'affinity';
    const groups: Record<string, typeof processedDeckItems> = {};

    processedDeckItems.forEach((item) => {
      const key = item[groupKey];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [processedDeckItems, sortMode]);

  // Check if player has any playable cards remaining in hand
  const hasPlayableCardInHand = [...playabilityById.values()].some((p) => p.isPlayable);

  const shouldPulseEndTurn = isActivePlayerTurn && !hasPlayableCardInHand;

  return (
    <>
      <section
        className={`comic-panel px-3.5 pt-3 pb-2.5 relative shadow-comic transition-all overflow-visible ${
          !isFocused
            ? 'ring-1 ring-slate-300/80 bg-slate-100/90'
            : 'bg-amber-100/95 ring-2 ring-comic-blue shadow-comic-lg'
        }`}
        style={isFocused ? { borderColor: palette.primary } : undefined}
      >
        {/* Zone Title Ribbon */}
        <div className="absolute -top-3 left-4 right-4 flex items-center justify-between z-content">
          <div className="flex items-center gap-2">
            <div
              className={`border border-comic-black text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1 ${
                isActivePlayerTurn
                  ? 'bg-comic-red font-bold text-white'
                  : isFocused
                    ? ''
                    : 'bg-slate-700 text-white'
              }`}
              style={{
                backgroundColor: isActivePlayerTurn
                  ? undefined
                  : isFocused
                    ? palette.primary
                    : undefined,
                color: isActivePlayerTurn
                  ? undefined
                  : isFocused
                    ? palette.contrastText.primary
                    : undefined,
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-comic-yellow" />
              <span>
                {seatNumber && isMultiHero ? `SEAT ${seatNumber}: ` : ''}
                {heroName}'s HAND ({hand.length} / {handSizeLimit})
                {gameState.phase === 'VILLAIN_PHASE'
                  ? ' • (VILLAIN PHASE)'
                  : isActivePlayerTurn
                    ? ' • (ACTIVE TURN)'
                    : ' • (WAITING)'}
              </span>
            </div>

            {!isFocused && onFocus && (
              <button
                onClick={onFocus}
                className="bg-amber-300 hover:bg-amber-400 text-slate-950 text-mini px-2.5 py-0.5 rounded border border-comic-black shadow-comic-sm cursor-pointer font-bold"
              >
                Focus Hand ➔
              </button>
            )}
          </div>

          {gameState.phase === 'PLAYER_PHASE' && isActivePlayerTurn && (
            <button
              onClick={handleEndTurn}
              className={`bg-comic-yellow hover:bg-yellow-400 text-comic-black text-xs px-3 py-0.5 rounded border border-comic-black shadow-comic-sm cursor-pointer font-black flex items-center gap-1 transition-all hover:scale-105 ${
                shouldPulseEndTurn ? 'animate-pulse ring-2 ring-comic-yellow' : ''
              }`}
              title={
                shouldPulseEndTurn
                  ? 'No more playable cards in hand — Click to end your hero turn'
                  : "End your hero's turn and pass to the next hero (or begin Villain Phase)"
              }
            >
              <span>END TURN ➔</span>
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-stretch gap-3 overflow-visible pt-1">
          {/* Turn Warning Toast (Mobile View) */}
          {turnWarning && (
            <div className="p-2 bg-rose-500 text-white text-xs rounded-lg border-2 border-comic-black shadow-comic-sm flex items-center justify-between animate-pulse md:hidden">
              <span>⚠️ {turnWarning}</span>
              <button
                onClick={() => setTurnWarning(null)}
                className="text-white hover:text-black font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Column 1: Vertical Piles & Utilities Sidebar */}
          <div className="w-full md:w-32 lg:w-36 shrink-0 flex flex-row md:flex-col items-stretch justify-center gap-1 bg-white/90 p-1.5 rounded-xl border-2 border-comic-black shadow-comic-sm">
            {/* Draw Pile & Tutor */}
            <div className="flex flex-col items-stretch w-full gap-0.5 md:flex-1">
              <div
                data-testid="player-deck-pile"
                onClick={() => devMode && setShowDeckModal(true)}
                className={`relative flex items-center justify-center rounded overflow-hidden border border-comic-black shadow-comic-sm transition-transform ${
                  devMode ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'
                } h-10 md:h-auto md:min-h-14 md:flex-1`}
                style={{
                  backgroundColor: getCardBackFallbackColor('player'),
                }}
                title={
                  devMode
                    ? 'Inspect & Tutor from Player Deck (Dev Mode Active)'
                    : 'Player Draw Deck'
                }
              >
                {!deckImageError ? (
                  <img
                    src={getCardBackUrl('player')}
                    alt="Player Card Back"
                    onError={() => setDeckImageError(true)}
                    className="absolute inset-0 w-full h-full object-cover"
                    data-testid="player-deck-image"
                  />
                ) : (
                  <div
                    data-testid="player-deck-fallback"
                    className="absolute inset-0 w-full h-full"
                    style={{ backgroundColor: getCardBackFallbackColor('player') }}
                  />
                )}
                <span className="absolute bottom-1 right-1 z-content bg-slate-950/80 text-white text-xs font-bold px-1.5 py-0.5 rounded border border-comic-black shadow-comic-xs backdrop-blur-xs leading-none">
                  {deck.length}
                </span>
              </div>

              {devMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeckModal(true);
                  }}
                  className="w-full px-2 py-0.5 rounded bg-comic-yellow text-comic-black hover:bg-amber-300 border border-comic-black shadow-comic-sm text-nano font-bold flex items-center justify-center gap-1 cursor-pointer transition-transform hover:scale-[1.02]"
                  title="Dev Mode: Select card from deck and add to hand"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Add</span>
                </button>
              )}
            </div>

            {/* Discard Pile */}
            <div
              onClick={() => discard.length > 0 && setShowDiscardModal(true)}
              className={`w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-800 border border-comic-black shadow-comic-sm text-center ${
                discard.length > 0
                  ? 'cursor-pointer hover:bg-amber-100 transition-transform hover:scale-[1.02]'
                  : 'cursor-default opacity-60'
              }`}
              title="Inspect Discard Pile"
            >
              <span className="text-mini font-bold whitespace-nowrap">
                DISCARD: {discard.length}
              </span>
            </div>

            {/* Nemesis Set */}
            <div
              onClick={() => setAsideCards.length > 0 && setShowNemesisModal(true)}
              className={`w-full flex items-center justify-center gap-1.5 px-2 py-1 rounded bg-rose-50 text-rose-900 border border-comic-black shadow-comic-sm text-center ${
                setAsideCards.length > 0
                  ? 'cursor-pointer hover:bg-rose-100 transition-transform hover:scale-[1.02]'
                  : 'cursor-default opacity-60'
              }`}
              title="Inspect Nemesis Set (Out of Play)"
            >
              <Skull className="w-3.5 h-3.5 text-rose-700 shrink-0" />
              <span className="text-mini font-bold whitespace-nowrap">
                NEMESIS: {setAsideCards.length}
              </span>
            </div>
          </div>

          {/* Column 2: Cards in Hand (Fan-Out Stack • Leftmost Card on Top) */}
          <div className="flex-1 min-w-0 flex flex-col justify-center overflow-visible">
            {turnWarning && (
              <div className="hidden md:flex mb-1.5 p-1.5 bg-rose-500 text-white text-xs rounded-lg border-2 border-comic-black shadow-comic-sm items-center justify-between animate-pulse">
                <span>⚠️ {turnWarning}</span>
                <button
                  onClick={() => setTurnWarning(null)}
                  className="text-white hover:text-black font-bold ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            <div
              ref={handFan.containerRef}
              data-testid="hand-fan-row"
              className="relative isolate hover:z-zoom focus-within:z-zoom flex items-center justify-start overflow-visible px-1 min-h-[184px] w-full"
            >
              {hand.map((cardInst, index) => {
                const isHovered = hoveredHandCardId === cardInst.instanceId;
                const playability = playabilityById.get(cardInst.instanceId) ?? {
                  isPlayable: true,
                  reasons: [],
                  availableResources: 0,
                };

                return (
                  <div
                    key={cardInst.instanceId}
                    onMouseEnter={() => setHoveredHandCardId(cardInst.instanceId)}
                    onMouseLeave={() => setHoveredHandCardId(null)}
                    style={{
                      zIndex: getFanZIndex(hand.length, index, isHovered),
                      marginLeft: index === 0 ? 0 : `${handFan.overlapMargin}px`,
                    }}
                    className={`shrink-0 relative flex transition-transform duration-150 ease-out cursor-pointer ${
                      isHovered ? '-translate-y-8' : 'hover:-translate-y-2'
                    }`}
                  >
                    <HandCard
                      cardInst={cardInst}
                      isPlayable={playability.isPlayable}
                      unplayableReason={playability.reasons[0]}
                      onSelect={selectHandCard}
                    />
                  </div>
                );
              })}

              {hand.length === 0 && (
                <div className="w-full py-6 text-center border-2 border-dashed border-slate-300 rounded-xl bg-white/60">
                  <span className="text-xs text-slate-400">
                    Hand is empty. (Cards will be drawn during Upkeep).
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Player Deck Inspector Modal (Dev Mode with Sorting & Card Names) */}
      {showDeckModal && (
        <PileViewerModal
          title={`Player Deck Inspector (${deck.length} Cards)`}
          description="Sort view by Deck Order, Card Type, Affinity (Aspect), or Cost. Cards display their name below."
          icon={<Eye className="w-5 h-5" />}
          verb="blue"
          devBadge
          closeLabel="Close Inspector"
          onClose={() => setShowDeckModal(false)}
          testId="player-deck-inspector"
          controls={
            <PileToolbar>
              {/* Left: Sort Category Selector */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-comic-blue" />
                <span className="font-bold uppercase">Sort By:</span>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'deck_order', label: 'Deck Order' },
                      { id: 'card_type', label: 'Card Type' },
                      { id: 'affinity', label: 'Affinity (Aspect)' },
                      { id: 'cost', label: 'Resource Cost' },
                    ] as const
                  ).map((btn) => (
                    <PileChoice
                      key={btn.id}
                      active={sortMode === btn.id}
                      onClick={() => setSortMode(btn.id)}
                    >
                      {btn.label}
                    </PileChoice>
                  ))}
                </div>
              </div>

              {/* Right: Direction / Reverse Toggle */}
              <div className="flex items-center gap-2">
                <ArrowDownUp className="w-4 h-4 text-comic-red" />
                {sortMode === 'deck_order' && (
                  <PileChoice
                    active
                    onClick={() =>
                      setDeckDirection((prev) =>
                        prev === 'top_to_bottom' ? 'bottom_to_top' : 'top_to_bottom',
                      )
                    }
                  >
                    {deckDirection === 'top_to_bottom'
                      ? '▼ Top to Bottom (Draw Order)'
                      : '▲ Bottom to Top'}
                  </PileChoice>
                )}

                {sortMode === 'cost' && (
                  <PileChoice
                    active
                    onClick={() =>
                      setCostDirection((prev) =>
                        prev === 'low_to_high' ? 'high_to_low' : 'low_to_high',
                      )
                    }
                  >
                    {costDirection === 'low_to_high'
                      ? 'Low to High (0 ➔ 4)'
                      : 'High to Low (4 ➔ 0)'}
                  </PileChoice>
                )}

                {(sortMode === 'card_type' || sortMode === 'affinity') && (
                  <span className="font-sans italic text-mini opacity-70">
                    Grouped categorically
                  </span>
                )}
              </div>
            </PileToolbar>
          }
        >
          {/* Cards Grid Area */}
          {groupedDeckItems ? (
            <div className="space-y-4">
              {Object.entries(groupedDeckItems).map(([groupTitle, groupItems]) => (
                <PileGroup key={groupTitle} title={`${groupTitle} (${groupItems.length})`}>
                  {groupItems.map(({ instance, originalIndex }) => (
                    <PileCardTile
                      key={instance.instanceId}
                      instance={instance}
                      rank={originalIndex + 1}
                      label={instance.card.name}
                    >
                      {devMode && <DevAddToHand instance={instance} onAdd={handleDevAddCard} />}
                    </PileCardTile>
                  ))}
                </PileGroup>
              ))}
            </div>
          ) : (
            <PileGrid>
              {processedDeckItems.map(({ instance, originalIndex }) => (
                <PileCardTile
                  key={instance.instanceId}
                  instance={instance}
                  rank={originalIndex + 1}
                  label={instance.card.name}
                >
                  {devMode && <DevAddToHand instance={instance} onAdd={handleDevAddCard} />}
                </PileCardTile>
              ))}
            </PileGrid>
          )}
        </PileViewerModal>
      )}

      {/* Player Discard Pile Modal */}
      {showDiscardModal && (
        <PileViewerModal
          title={`Player Discard Pile (${discard.length} Cards)`}
          description="Discard piles are open information. Listed in discard order."
          icon={<Layers className="w-5 h-5" />}
          verb="blue"
          closeLabel="Close Discard Viewer"
          onClose={() => setShowDiscardModal(false)}
          testId="player-discard-viewer"
        >
          <PileGrid>
            {discard.map((cardInst, idx) => (
              <PileCardTile
                key={cardInst.instanceId}
                instance={cardInst}
                rank={idx + 1}
                label={cardInst.card.name}
              />
            ))}
          </PileGrid>
        </PileViewerModal>
      )}

      {/* Nemesis Set / Out of Play Modal */}
      {showNemesisModal && (
        <PileViewerModal
          title="Nemesis Set • Set Aside (Out of Play)"
          description={`These 5 cards are set aside at game start and enter play if "Shadow of the Past" is revealed.`}
          icon={<Skull className="w-5 h-5" />}
          verb="red"
          closeLabel="Close Out of Play Viewer"
          onClose={() => setShowNemesisModal(false)}
          maxWidthClass="max-w-4xl"
          testId="nemesis-set-viewer"
        >
          <PileGrid>
            {setAsideCards.map((cardInst) => (
              <PileCardTile
                key={cardInst.instanceId}
                instance={cardInst}
                size="md"
                label={cardInst.card.name}
              />
            ))}
          </PileGrid>
        </PileViewerModal>
      )}

      {/* Card Payment & Action Modal */}
      {playingCard && player && (
        <CardPaymentModal
          isOpen={Boolean(playingCard)}
          onClose={() => setPlayingCard(null)}
          cardToPlay={playingCard}
          player={player}
          onConfirmPlay={(
            paymentHandCardIds,
            generatorCardIds,
            targetInstanceId,
            selectedDiscardCardIds,
          ) => {
            onDispatchAction({
              type: 'PLAY_CARD',
              playerId: player.id,
              cardInstanceId: playingCard.instanceId,
              paymentCardInstanceIds: paymentHandCardIds,
              generatorInstanceIds: generatorCardIds,
              discardCardInstanceIds: selectedDiscardCardIds,
              targetInstanceId,
            });
            setPlayingCard(null);
          }}
        />
      )}
    </>
  );
};

export default PlayerHandTray;
