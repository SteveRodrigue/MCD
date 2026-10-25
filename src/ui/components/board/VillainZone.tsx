import React, { useState, useMemo } from 'react';
import { Skull, AlertTriangle, Layers, Flame, Eye, ArrowDownUp, Filter, Heart } from 'lucide-react';
import {
  VillainState,
  MainSchemeState,
  SideSchemeState,
  CardInstance,
  StatusCard,
  NormalizedCard,
} from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { CardAttachmentFan } from '../cards/CardAttachmentFan';
import { getStaircaseExpansion } from '../cards/attachment-fan-utils';
import { useGameSettings } from '../../context/useGameSettings';
import {
  PileCardTile,
  PileChoice,
  PileGrid,
  PileGroup,
  PileToolbar,
  PileViewerModal,
} from './PileViewerModal';
import { getEncounterSetName } from './villain-zone-utils';
import { getEffectiveVillainStats } from '../../../engine/pipeline/stat-calculator';
import { getCardBackUrl, getCardBackFallbackColor } from '../../services/card-cache-service';
import { useModalStyle } from '../../theme/useModalStyle';
import { ZonePanel } from '../../theme/kit/surfaces';

interface VillainZoneProps {
  villain: VillainState;
  mainScheme: MainSchemeState;
  sideSchemes: SideSchemeState[];
  encounterDeck: CardInstance[];
  encounterDiscard: CardInstance[];
  accelerationTokens: number;
  onSelectAttachment?: (attachment: CardInstance) => void;
}

type SortMode = 'deck_order' | 'card_type' | 'encounter_set';
type DeckDirection = 'top_to_bottom' | 'bottom_to_top';

function getCardTypeName(card: NormalizedCard): string {
  const type = card.type || (card as any).type_code || 'encounter';
  if (type === 'minion') return 'Minions';
  if (type === 'treachery') return 'Treacheries';
  if (type === 'side_scheme' || type === 'player_side_scheme') return 'Side Schemes';
  if (type === 'attachment') return 'Attachments';
  if (type === 'obligation') return 'Obligations';
  if (type === 'main_scheme') return 'Main Schemes';
  if (type === 'villain') return 'Villains';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export const VillainZone: React.FC<VillainZoneProps> = ({
  villain,
  mainScheme,
  sideSchemes,
  encounterDeck,
  encounterDiscard,
  accelerationTokens,
  onSelectAttachment,
}) => {
  const { devMode } = useGameSettings();
  const { style } = useModalStyle();
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [deckImageError, setDeckImageError] = useState(false);

  // Inspector View Sort States
  const [sortMode, setSortMode] = useState<SortMode>('deck_order');
  const [deckDirection, setDeckDirection] = useState<DeckDirection>('top_to_bottom');

  const threatPercent = Math.min(100, (mainScheme.threat / mainScheme.targetThreat) * 100);
  const healthPercent = Math.max(0, (villain.health / villain.maxHealth) * 100);

  const effectiveStats = useMemo(() => getEffectiveVillainStats({} as any, villain), [villain]);
  const baseAtk = villain.card.attack ?? 0;
  const baseSch = villain.card.scheme ?? 0;
  const atkBonus = effectiveStats.attack - baseAtk;
  const schBonus = effectiveStats.scheme - baseSch;

  const topDiscard = encounterDiscard[encounterDiscard.length - 1];

  // Process and sort Encounter Deck for Inspector View
  const processedDeckItems = useMemo(() => {
    // Attach original deck index (0-based: 0 is top of deck)
    const items = encounterDeck.map((instance, originalIndex) => ({
      instance,
      originalIndex,
      encounterSet: getEncounterSetName(instance.card),
      cardType: getCardTypeName(instance.card),
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

    if (sortMode === 'encounter_set') {
      return [...items].sort((a, b) => {
        if (a.encounterSet !== b.encounterSet) return a.encounterSet.localeCompare(b.encounterSet);
        return a.originalIndex - b.originalIndex;
      });
    }

    return items;
  }, [encounterDeck, sortMode, deckDirection]);

  // Group items by category if not in pure deck order
  const groupedDeckItems = useMemo(() => {
    if (sortMode === 'deck_order') return null;

    const groupKey = sortMode === 'card_type' ? 'cardType' : 'encounterSet';
    const groups: Record<string, typeof processedDeckItems> = {};

    processedDeckItems.forEach((item) => {
      const key = item[groupKey];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });

    return groups;
  }, [processedDeckItems, sortMode]);

  const { extraBottomPx: villainBottomPx, extraLeftClass: villainLeftClass } =
    getStaircaseExpansion(villain.attachments, villain.cardsUnderneath);

  return (
    <>
      <ZonePanel
        data-testid="villain-zone"
        title="VILLAIN & SCENARIO ZONE"
        icon={<Skull className="w-3.5 h-3.5 text-comic-red" />}
        className="hover:z-raised focus-within:z-raised"
        bodyClassName="p-4"
      >
        <div className="flex flex-wrap items-stretch gap-4">
          {/* 1. Encounter Discard & Draw Piles (Left of Villain, Left-to-Right: Discard -> Deck) */}
          <div className="flex items-center justify-center gap-3 shrink-0 self-start">
            {/* Encounter Discard Pile (Open Information • Click to Inspect) */}
            <div className="flex flex-col items-center">
              {topDiscard ? (
                <div
                  onClick={() => setShowDiscardModal(true)}
                  className="relative cursor-pointer group"
                  title="Inspect Encounter Discard Pile"
                >
                  <CardView
                    card={topDiscard.card}
                    size="sm"
                    showTokens={false}
                    enableHoverZoom={true}
                  />
                  <span
                    className={`absolute -bottom-2 -right-2 text-xs px-1.5 py-0.5 ${style.chip}`}
                  >
                    {encounterDiscard.length}
                  </span>
                </div>
              ) : (
                <div
                  className={`w-28 h-40 border-dashed flex flex-col items-center justify-center text-center p-1 ${style.inset} ${style.muted}`}
                >
                  <span className="text-xs">DISCARD</span>
                  <span className="text-micro font-bold">EMPTY</span>
                </div>
              )}
            </div>

            {/* Encounter Draw Pile (Face-Down Default • Click to Inspect in Dev Mode) */}
            <div
              data-testid="encounter-deck-pile"
              onClick={() => devMode && setShowDeckModal(true)}
              className={`flex flex-col items-center group ${devMode ? 'cursor-pointer' : 'cursor-default'}`}
              title={
                devMode
                  ? 'Inspect Encounter Deck (Dev Mode Active)'
                  : 'Encounter Draw Deck (Hidden Information • Enable Dev Mode to inspect)'
              }
            >
              <div
                className={`w-28 h-40 border-2 border-black rounded-lg flex flex-col items-center justify-center p-2 text-center relative overflow-hidden transition-all ${
                  devMode ? 'group-hover:border-comic-yellow' : ''
                }`}
                style={{
                  backgroundColor: getCardBackFallbackColor('encounter'),
                }}
              >
                {!deckImageError ? (
                  <img
                    src={getCardBackUrl('encounter')}
                    alt="Encounter Deck"
                    onError={() => setDeckImageError(true)}
                    className="absolute inset-0 w-full h-full object-cover"
                    data-testid="encounter-deck-image"
                  />
                ) : (
                  <div
                    data-testid="encounter-deck-fallback"
                    className="absolute inset-0 w-full h-full"
                    style={{ backgroundColor: getCardBackFallbackColor('encounter') }}
                  />
                )}
                <span className="absolute bottom-1 right-1 z-content bg-slate-950/80 text-white text-xs font-bold px-1.5 py-0.5 rounded border border-white/30 backdrop-blur-xs leading-none">
                  {encounterDeck.length}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Villain Panel & Attachments */}
          <div
            data-testid="villain-main-panel"
            className={`w-fit flex flex-col gap-2 p-3 shrink-0 transition-all ${style.inset}`}
            style={villainBottomPx > 0 ? { paddingBottom: `${villainBottomPx + 12}px` } : undefined}
          >
            {/* Header: Villain Icon, Name, Stage Badge & Status Badges */}
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-1 min-w-0">
                  <Skull className="w-4 h-4 text-comic-red shrink-0" />
                  <span className="text-sm truncate max-w-[130px]" title={villain.card.name}>
                    {villain.card.name}
                  </span>
                </div>
                <span className={`text-micro px-1.5 py-0.5 shrink-0 ${style.chip}`}>
                  {villain.card.stage ? `STAGE ${villain.card.stage}` : 'VILLAIN'}
                </span>
              </div>
              {/* Status Badges */}
              {villain.statusCards.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {villain.statusCards.map((st, i) => (
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
            <div className="flex-1 flex items-center justify-center gap-2 w-full">
              {/* Left Column (Stats) */}
              <div
                data-testid="villain-stats-column"
                className="relative z-content flex flex-col gap-1.5 items-center justify-center min-w-[36px]"
              >
                {/* SCH */}
                <div
                  className={`flex flex-col items-center justify-center w-full px-1 py-0.5 bg-sky-50 text-center ${style.badge}`}
                  title={`Scheme: ${effectiveStats.scheme}${schBonus > 0 ? ` (+${schBonus})` : ''}`}
                >
                  <span className="text-nano font-bold text-sky-800 uppercase leading-none">
                    SCH
                  </span>
                  <span className="text-xs font-black leading-tight text-comic-blue">
                    {effectiveStats.scheme}
                    {schBonus > 0 && (
                      <span className="text-nano text-sky-600 font-bold ml-0.5">+{schBonus}</span>
                    )}
                  </span>
                </div>
                {/* ATK */}
                <div
                  className={`flex flex-col items-center justify-center w-full px-1 py-0.5 bg-rose-50 text-center ${style.badge}`}
                  title={`Attack: ${effectiveStats.attack}${atkBonus > 0 ? ` (+${atkBonus})` : ''}`}
                >
                  <span className="text-nano font-bold text-rose-800 uppercase leading-none">
                    ATK
                  </span>
                  <span className="text-xs font-black leading-tight text-comic-red">
                    {effectiveStats.attack}
                    {atkBonus > 0 && (
                      <span className="text-nano text-rose-500 font-bold ml-0.5">+{atkBonus}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Center Column (Card) */}
              <div
                data-testid="villain-center-card-column"
                className={`flex flex-col justify-center items-center relative shrink-0 transition-all ${villainLeftClass}`}
              >
                <CardAttachmentFan
                  attachments={villain.attachments}
                  cardsUnderneath={villain.cardsUnderneath}
                  onSelectAttachment={onSelectAttachment}
                >
                  <CardView
                    card={villain.card}
                    size="sm"
                    showTokens={false}
                    enableHoverZoom={true}
                  />
                </CardAttachmentFan>
              </div>

              {/* Right Column (Vertical HP Gauge) */}
              <div
                data-testid="villain-hp-column"
                className="relative z-content flex flex-col items-center justify-center gap-1 shrink-0"
              >
                <div className="flex items-center">
                  <Heart className="w-2.5 h-2.5 text-comic-red fill-comic-red" />
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={villain.health}
                  aria-valuemin={0}
                  aria-valuemax={villain.maxHealth}
                  aria-label="Villain Health"
                  className="h-36 w-3.5 bg-neutral-800 rounded-full border border-black overflow-hidden relative flex flex-col justify-end"
                >
                  <div
                    className="w-full transition-all duration-300 rounded-b-full"
                    style={{
                      height: `${healthPercent}%`,
                      backgroundColor:
                        healthPercent > 50 ? '#10b981' : healthPercent > 25 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <span className="text-micro font-black leading-none">
                  {villain.health}/{villain.maxHealth}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Main Scheme Panel (Landscape Card + Vertical Threat Meter on the Right) */}
          <div className={`w-fit flex flex-col gap-2 p-3 shrink-0 ${style.inset}`}>
            {/* Header: Title on Left, Text Version Threat Limit on Top Right */}
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-4 h-4 text-comic-red shrink-0" />
                <span className="text-sm truncate">{mainScheme.card.name}</span>
                {accelerationTokens > 0 && (
                  <span
                    className={`bg-comic-yellow text-comic-black text-micro px-1.5 py-0.5 animate-pulse shrink-0 ${style.badge}`}
                  >
                    ⚡ +{accelerationTokens}
                  </span>
                )}
              </div>

              {/* Text version of threat on the top right */}
              <div className="shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 tracking-wide ${style.badge} ${
                    threatPercent > 75
                      ? 'bg-comic-red text-white'
                      : threatPercent > 40
                        ? 'bg-comic-yellow text-comic-black'
                        : 'bg-comic-blue text-white'
                  }`}
                >
                  {mainScheme.threat} / {mainScheme.targetThreat} THREAT
                </span>
              </div>
            </div>

            {/* Main Scheme Card with Vertical Threat Meter on the Right */}
            <div className="flex items-stretch gap-2.5 pt-0.5">
              <CardView
                card={mainScheme.card}
                size="md"
                showTokens={false}
                enableHoverZoom={true}
              />

              {/* Vertical Threat Meter Gauge on the Right */}
              <div className="flex flex-col items-center justify-between h-[176px] py-0.5 shrink-0">
                <div
                  className="relative w-5 h-full bg-slate-200 rounded-full border-2 border-black overflow-hidden flex flex-col justify-end"
                  title={`Threat: ${mainScheme.threat} / {mainScheme.targetThreat} (${Math.round(threatPercent)}%)`}
                >
                  {/* Dynamic Vertical Fill Bar (Bottom to Top) with color transition from Blue -> Yellow -> Red */}
                  <div
                    className={`w-full transition-all duration-300 ${
                      threatPercent > 75
                        ? 'bg-gradient-to-t from-amber-400 via-orange-500 to-comic-red'
                        : threatPercent > 40
                          ? 'bg-gradient-to-t from-comic-blue via-sky-400 to-amber-400'
                          : 'bg-gradient-to-t from-sky-600 to-comic-blue'
                    }`}
                    style={{ height: `${threatPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Active Side Schemes & Player Schemes (Takes remaining width) */}
          <div
            className={`flex-1 min-w-[200px] flex flex-col gap-2 p-3 min-h-[220px] relative z-content hover:z-zoom focus-within:z-zoom ${style.inset}`}
          >
            <div
              className={`flex items-center gap-1.5 text-xs font-bold uppercase border-b border-current/20 pb-1.5 ${style.muted}`}
            >
              <Flame className="w-4 h-4 text-comic-red" />
              <span>Active Side Schemes ({sideSchemes.length})</span>
            </div>

            {sideSchemes.length > 0 ? (
              <div className="flex flex-wrap gap-3 items-center pt-1 overflow-visible">
                {sideSchemes.map((scheme) => {
                  const { extraBottomPx, extraLeftClass } = getStaircaseExpansion(
                    scheme.attachments,
                    scheme.cardsUnderneath,
                  );
                  return (
                    <div
                      key={scheme.instanceId}
                      className={`flex flex-col items-center gap-1 relative z-content hover:z-zoom focus-within:z-zoom ${extraLeftClass}`}
                      style={extraBottomPx > 0 ? { marginBottom: `${extraBottomPx}px` } : undefined}
                    >
                      <CardAttachmentFan
                        attachments={scheme.attachments}
                        cardsUnderneath={scheme.cardsUnderneath}
                      >
                        <CardView card={scheme.card} size="sm" enableHoverZoom={true} />
                      </CardAttachmentFan>
                      <span
                        className={`bg-comic-yellow text-comic-black text-micro px-1.5 py-0.5 relative z-raised ${style.badge}`}
                      >
                        ⚠️ {scheme.threat} THREAT
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className={`flex-1 flex flex-col items-center justify-center p-3 text-center text-xs font-semibold border-2 border-dashed border-current/30 rounded-lg ${style.muted}`}
              >
                <span>No side schemes active</span>
              </div>
            )}
          </div>
        </div>
      </ZonePanel>

      {/* Encounter Deck Inspector Modal (Dev Mode with Sorting & Set Labels) */}
      {showDeckModal && (
        <PileViewerModal
          title={`Encounter Deck Inspector (${encounterDeck.length} Cards)`}
          description="Sort view by Deck Order, Card Type, or Encounter Set. Each card displays its Encounter Set label below."
          icon={<Eye className="w-5 h-5" />}
          verb="yellow"
          devBadge
          closeLabel="Close Inspector"
          onClose={() => setShowDeckModal(false)}
          testId="encounter-deck-inspector"
          controls={
            <PileToolbar>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-comic-blue" />
                <span className="text-xs uppercase">Sort View By:</span>
                <div className="flex gap-1.5">
                  <PileChoice
                    active={sortMode === 'deck_order'}
                    onClick={() => setSortMode('deck_order')}
                  >
                    Deck Order
                  </PileChoice>
                  <PileChoice
                    active={sortMode === 'card_type'}
                    onClick={() => setSortMode('card_type')}
                  >
                    Card Type
                  </PileChoice>
                  <PileChoice
                    active={sortMode === 'encounter_set'}
                    onClick={() => setSortMode('encounter_set')}
                  >
                    Encounter Set
                  </PileChoice>
                </div>
              </div>

              {sortMode === 'deck_order' && (
                <div className="flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4" />
                  <PileChoice
                    onClick={() =>
                      setDeckDirection((prev) =>
                        prev === 'top_to_bottom' ? 'bottom_to_top' : 'top_to_bottom',
                      )
                    }
                  >
                    {deckDirection === 'top_to_bottom'
                      ? '⬆️ Top to Bottom (#1 ⟶ #N)'
                      : '⬇️ Bottom to Top (#N ⟶ #1)'}
                  </PileChoice>
                </div>
              )}
            </PileToolbar>
          }
        >
          {/* Cards Display Grid (Grouped or Flat) */}
          {groupedDeckItems ? (
            <div className="space-y-4">
              {Object.entries(groupedDeckItems).map(([groupName, groupItems]) => (
                <PileGroup key={groupName} title={`${groupName} (${groupItems.length} Cards)`}>
                  {groupItems.map(({ instance, originalIndex, encounterSet }) => (
                    <PileCardTile
                      key={instance.instanceId}
                      instance={instance}
                      rank={originalIndex + 1}
                      // Only show the Encounter Set label if NOT sorting by Encounter Set
                      label={sortMode !== 'encounter_set' ? encounterSet : undefined}
                    />
                  ))}
                </PileGroup>
              ))}
            </div>
          ) : (
            <PileGrid>
              {processedDeckItems.map(({ instance, originalIndex, encounterSet }) => (
                <PileCardTile
                  key={instance.instanceId}
                  instance={instance}
                  rank={originalIndex + 1}
                  label={encounterSet}
                />
              ))}
            </PileGrid>
          )}
        </PileViewerModal>
      )}

      {/* Encounter Discard Pile Modal */}
      {showDiscardModal && (
        <PileViewerModal
          title={`Encounter Discard Pile (${encounterDiscard.length} Cards)`}
          description="Discard piles are open information. Listed in discard order."
          icon={<Layers className="w-5 h-5" />}
          verb="red"
          closeLabel="Close Discard Viewer"
          onClose={() => setShowDiscardModal(false)}
          testId="encounter-discard-viewer"
        >
          <PileGrid>
            {encounterDiscard.map((cardInst, idx) => (
              <PileCardTile
                key={cardInst.instanceId}
                instance={cardInst}
                rank={idx + 1}
                label={getEncounterSetName(cardInst.card)}
              />
            ))}
          </PileGrid>
        </PileViewerModal>
      )}
    </>
  );
};

export default VillainZone;
