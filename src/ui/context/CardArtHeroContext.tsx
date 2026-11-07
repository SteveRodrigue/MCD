/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo } from 'react';

/**
 * Which hero a card's art belongs to (ADR-0093, decision 16). An art pack tied to a hero shows only
 * on cards of that hero's seat, so a card view needs its owner's hero code. `heroOf` maps every
 * seat to its hero; `seatHero` is the seat the surrounding area belongs to. A card with no seat
 * (villain, scheme, token) has no hero and never shows a pack tied to one.
 */
interface CardArtHeroValue {
  heroOf: Readonly<Record<string, string>>;
  seatHero?: string;
}

const CardArtHeroContext = createContext<CardArtHeroValue>({ heroOf: {} });

interface SeatedPlayer {
  id: string;
  hero: { code: string };
}

/** Once per game screen: tells every card view which hero each seat plays. */
export const CardArtHeroes: React.FC<{ players: SeatedPlayer[]; children: React.ReactNode }> = ({
  players,
  children,
}) => {
  const key = players.map((player) => `${player.id}=${player.hero.code}`).join('|');
  const value = useMemo<CardArtHeroValue>(
    () => ({ heroOf: Object.fromEntries(players.map((player) => [player.id, player.hero.code])) }),
    // The hero of a seat never changes during a game, so the key stands for the players.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return <CardArtHeroContext.Provider value={value}>{children}</CardArtHeroContext.Provider>;
};

/**
 * Marks an area (a hero's board, hand, or a prompt for that player) as that seat's cards. A screen
 * with no game yet (the setup preview) names the hero directly with `heroCode`.
 */
export const CardArtSeat: React.FC<{
  playerId?: string;
  heroCode?: string;
  children: React.ReactNode;
}> = ({ playerId, heroCode, children }) => {
  const { heroOf } = useContext(CardArtHeroContext);
  const value = useMemo<CardArtHeroValue>(
    () => ({ heroOf, seatHero: heroCode ?? (playerId ? heroOf[playerId] : undefined) }),
    [heroOf, playerId, heroCode],
  );
  return <CardArtHeroContext.Provider value={value}>{children}</CardArtHeroContext.Provider>;
};

/** A hero code for the owner of a card: the instance's own owner first, then the seat area. */
export function useCardArtHero(ownerId?: string): string | undefined {
  const { heroOf, seatHero } = useContext(CardArtHeroContext);
  return (ownerId ? heroOf[ownerId] : undefined) ?? seatHero;
}
