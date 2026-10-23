import React, { useState } from 'react';
import { Archive, Skull } from 'lucide-react';
import { CardInstance, NormalizedCard, PlayerState } from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { useModalStyle } from '../../theme/useModalStyle';
import { PileCardTile, PileChoice, PileGrid, PileGroup, PileViewerModal } from './PileViewerModal';

import { getEncounterSetName } from './villain-zone-utils';

export interface RemovedFromGameBoxProps {
  cards: CardInstance[];
  eliminatedPlayers?: PlayerState[];
}

function getCardSetOrTypeLabel(card: NormalizedCard): string {
  const encSet = getEncounterSetName(card);
  if (encSet && encSet !== 'Encounter Set') return encSet;
  if (card.faction) {
    return card.faction.charAt(0).toUpperCase() + card.faction.slice(1);
  }
  if (card.type) {
    return card.type.charAt(0).toUpperCase() + card.type.slice(1);
  }
  return encSet;
}

/** Newest card first, for piles that append (removed, discard): `#1` is then the top, as in a deck. */
function topFirst(cards: CardInstance[]): CardInstance[] {
  return [...cards].reverse();
}

interface DefeatedZone {
  key: string;
  title: string;
  cards: CardInstance[];
}

/**
 * The zones of an eliminated player's play area, which left the game with them (RR v1.8 Player
 * Elimination step 5), each listed top first. A deck draws from index 0; a pile that appends has
 * its top card last.
 */
function getDefeatedZones(player: PlayerState): DefeatedZone[] {
  return [
    { key: 'hand', title: 'Hand', cards: player.hand },
    { key: 'deck', title: 'Deck', cards: player.deck },
    { key: 'discard', title: 'Discard Pile', cards: topFirst(player.discard) },
    { key: 'tableau', title: 'Upgrades & Supports', cards: player.tableau },
    { key: 'allies', title: 'Allies', cards: player.allies },
    { key: 'attachments', title: 'Attached to Identity', cards: player.attachments ?? [] },
    { key: 'set-aside', title: 'Set-Aside Nemesis', cards: player.setAsideCards },
    { key: 'underneath', title: 'Underneath', cards: player.cardsUnderneath ?? [] },
  ];
}

/** A card with its pile position (`#1` = top of the pile) and its set or type label. */
const CardTile: React.FC<{ cardInst: CardInstance; rank: number }> = ({ cardInst, rank }) => (
  <PileCardTile
    testId="card-tile"
    instance={cardInst}
    rank={rank}
    label={getCardSetOrTypeLabel(cardInst.card)}
  />
);

/** A titled grid of cards listed top first. */
const PileSection: React.FC<{ zone: DefeatedZone }> = ({ zone }) => (
  <PileGroup
    testId={`defeated-zone-${zone.key}`}
    title={`${zone.title} (${zone.cards.length} Cards)`}
  >
    {zone.cards.map((cardInst, idx) => (
      <CardTile key={cardInst.instanceId} cardInst={cardInst} rank={idx + 1} />
    ))}
  </PileGroup>
);

export const RemovedFromGameBox: React.FC<RemovedFromGameBoxProps> = ({
  cards = [],
  eliminatedPlayers = [],
}) => {
  const { style } = useModalStyle();
  const [showModal, setShowModal] = useState<boolean>(false);
  // The eliminated player being inspected; null shows the general removed pile.
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // The removed pile appends, so its newest card is last.
  const topCard = cards.length > 0 ? cards[cards.length - 1] : undefined;

  const selectedEliminatedPlayer = eliminatedPlayers.find((p) => p.id === selectedPlayerId);
  const selectedZones = selectedEliminatedPlayer ? getDefeatedZones(selectedEliminatedPlayer) : [];

  const inspect = (playerId: string | null) => {
    setSelectedPlayerId(playerId);
    setShowModal(true);
  };

  return (
    <>
      <section
        data-testid="removed-from-game-box"
        className="comic-panel p-4 bg-white/95 relative hover:z-raised focus-within:z-raised shadow-comic shrink-0"
      >
        {/* Zone Title Ribbon */}
        <div className="absolute -top-3 left-4 bg-slate-900 text-white border border-comic-black font-comic text-xs px-3 py-0.5 tracking-wider shadow-comic-sm flex items-center gap-1">
          <Archive className="w-3.5 h-3.5" />
          <span>OUT OF PLAY</span>
        </div>

        <div
          data-testid="out-of-play-stacks"
          className="flex flex-wrap items-center justify-center gap-4 pt-2"
        >
          {/* General Removed from Game Pile */}
          {topCard ? (
            <div
              data-testid="removed-from-game-pile"
              onClick={() => inspect(null)}
              className="relative cursor-pointer group"
              title={`Inspect Removed from Game Pile (${cards.length} Cards)`}
            >
              <CardView card={topCard.card} size="sm" showTokens={false} enableHoverZoom={true} />
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-comic-red text-white font-comic text-[9px] px-1 py-0.5 rounded border border-comic-black shadow-comic-xs uppercase font-bold pointer-events-none">
                REMOVED
              </span>
              <span className="absolute -bottom-2 -right-2 bg-slate-900 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black shadow-comic-sm">
                {cards.length}
              </span>
            </div>
          ) : (
            <div
              data-testid="removed-from-game-pile-empty"
              onClick={() => inspect(null)}
              className="w-28 h-40 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-center p-1 cursor-pointer hover:border-slate-400"
              title="Removed from Game (Empty)"
            >
              <span className="font-comic text-xs text-slate-400">REMOVED</span>
              <span className="text-[10px] text-slate-400 font-bold">EMPTY</span>
            </div>
          )}

          {/* Defeated Hero(es) (Issue #357) */}
          {eliminatedPlayers.map((player) => {
            const heroCard = player.activeFormCard || player.hero;
            // A deck draws from index 0, so that is the card under the hero.
            const topDeckCard = player.deck[0];

            return (
              <div
                key={player.id}
                data-testid={`defeated-hero-stack-${player.id}`}
                onClick={() => inspect(player.id)}
                className="relative cursor-pointer group shrink-0"
                title={`Inspect Defeated Hero: ${player.name} (${player.deck.length} Cards in Deck)`}
              >
                {/* The whole stack (hero and deck peek) greys out until hovered */}
                <div
                  data-testid={`defeated-hero-visual-${player.id}`}
                  className="relative grayscale contrast-125 opacity-80 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-200"
                >
                  {/* Deck Card Peek Underneath (facedown, subtle peek offset, no fanning) */}
                  {topDeckCard && (
                    <div
                      data-testid={`defeated-hero-deck-peek-${player.id}`}
                      className="absolute -top-1 -left-1 w-full h-full pointer-events-none"
                    >
                      <CardView card={topDeckCard.card} size="sm" isFacedown showTokens={false} />
                    </div>
                  )}

                  {/* Hero Card on Top (a later positioned sibling paints over the peek) */}
                  <div data-testid={`defeated-hero-card-${player.id}`} className="relative">
                    <CardView card={heroCard} size="sm" showTokens={false} enableHoverZoom={true} />

                    {/* DEFEATED Ribbon Badge */}
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-comic-red text-white font-comic text-[9px] px-1.5 py-0.5 rounded border border-comic-black shadow-comic-xs uppercase font-bold pointer-events-none whitespace-nowrap">
                      DEFEATED
                    </span>

                    {/* Deck Count Badge */}
                    <span
                      className="absolute -bottom-2 -right-2 bg-slate-900 text-white font-comic text-xs px-1.5 py-0.5 rounded-full border border-comic-black shadow-comic-sm"
                      title={`${player.deck.length} cards in deck`}
                    >
                      {player.deck.length}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Removed from Game / Defeated Heroes Modal */}
      {showModal && (
        <PileViewerModal
          title={
            selectedEliminatedPlayer
              ? `${selectedEliminatedPlayer.name} — Defeated Hero`
              : `Removed from Game (${cards.length} Cards)`
          }
          description={
            selectedEliminatedPlayer
              ? 'The play area of the eliminated player. All of it left the game (RR v1.8 Player Elimination). #1 is the top of each pile.'
              : 'Cards removed from the game are out of play and cannot reenter the game. #1 is the most recently removed.'
          }
          icon={<Archive className="w-5 h-5" />}
          verb="red"
          closeLabel="Close"
          onClose={() => setShowModal(false)}
          testId="removed-from-game-modal"
          controls={
            /* Navigation Tabs (when eliminated heroes are present) */
            eliminatedPlayers.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <PileChoice
                  active={!selectedEliminatedPlayer}
                  onClick={() => setSelectedPlayerId(null)}
                >
                  <span data-testid="removed-tab">Removed Cards ({cards.length})</span>
                </PileChoice>
                {eliminatedPlayers.map((p) => (
                  <PileChoice
                    key={p.id}
                    active={selectedEliminatedPlayer?.id === p.id}
                    onClick={() => setSelectedPlayerId(p.id)}
                  >
                    <span data-testid={`defeated-tab-${p.id}`} className="flex items-center gap-1">
                      <Skull className="w-3 h-3" />
                      <span>{p.name} (Defeated)</span>
                    </span>
                  </PileChoice>
                ))}
              </div>
            ) : undefined
          }
        >
          {/* Modal Body Content */}
          {selectedEliminatedPlayer ? (
            /* Defeated Hero: the whole play area that left the game */
            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-4">
                <CardView
                  card={selectedEliminatedPlayer.activeFormCard || selectedEliminatedPlayer.hero}
                  size="sm"
                  showTokens={false}
                  enableHoverZoom={true}
                />
                <div className="space-y-2">
                  <p className="font-comic text-sm uppercase">
                    HP {selectedEliminatedPlayer.health} / {selectedEliminatedPlayer.maxHealth}
                  </p>
                  <ul
                    data-testid="defeated-zone-counts"
                    className="flex flex-wrap gap-2 text-xs font-semibold"
                  >
                    {selectedZones.map((zone) => (
                      <li key={zone.key} className={`px-2 py-0.5 ${style.inset}`}>
                        {zone.title}: {zone.cards.length}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {selectedZones
                .filter((zone) => zone.cards.length > 0)
                .map((zone) => (
                  <PileSection key={zone.key} zone={zone} />
                ))}
            </div>
          ) : cards.length === 0 ? (
            <div className={`py-8 text-center font-comic ${style.muted}`}>
              No cards have been removed from the game.
            </div>
          ) : (
            /* Generic Removed Cards Grid, newest first */
            <PileGrid>
              {topFirst(cards).map((cardInst, idx) => (
                <CardTile key={cardInst.instanceId} cardInst={cardInst} rank={idx + 1} />
              ))}
            </PileGrid>
          )}
        </PileViewerModal>
      )}
    </>
  );
};

export default RemovedFromGameBox;
