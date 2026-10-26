import type { PlayerState } from '../../engine/models';

export interface PlayerSeatInfo {
  player: PlayerState | undefined;
  seatNumber: number | undefined;
  isMultiHero: boolean;
  /** e.g. "SEAT 2: " in multiplayer, or "" in solo */
  seatPrefix: string;
  /** e.g. "SEAT 2: Black Panther / T'Challa" in multiplayer, or "Black Panther / T'Challa" in solo */
  label: string;
}

/** Formats the "SEAT N: " prefix when in multiplayer, or an empty string in solo. */
export function formatSeatPrefix(seatNumber?: number, isMultiHero?: boolean): string {
  return seatNumber && isMultiHero ? `SEAT ${seatNumber}: ` : '';
}

/**
 * Resolves player, seat index, multiplayer flag, and formatted seat/hero label.
 * Eliminates duplicate seat prefix string formatting across UI components.
 */
export function resolvePlayerSeatInfo(
  players: PlayerState[] | undefined,
  playerId: string | undefined,
): PlayerSeatInfo {
  const allPlayers = players ?? [];
  const isMultiHero = allPlayers.length > 1;
  const playerIndex = playerId ? allPlayers.findIndex((p) => p.id === playerId) : -1;
  const player = playerIndex >= 0 ? allPlayers[playerIndex] : undefined;
  const seatNumber = playerIndex >= 0 ? playerIndex + 1 : undefined;

  const playerName = player?.name ?? '';
  const seatPrefix = formatSeatPrefix(seatNumber, isMultiHero);
  const label = `${seatPrefix}${playerName}`;

  return {
    player,
    seatNumber,
    isMultiHero,
    seatPrefix,
    label,
  };
}
