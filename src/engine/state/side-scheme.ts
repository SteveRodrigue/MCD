import {
  CardInstance,
  GameState,
  PlayerSideSchemeCard,
  SideSchemeCard,
  getPerPlayerCount,
} from '../models';
import { syncVillainMaxHealth } from '../pipeline/stat-calculator';

/**
 * Puts a side scheme into play with its base threat (scaled per player unless fixed) and brings
 * the villain's hit points in line with the scheme's constant modifiers (The "Immortal" Klaw).
 * Returns the threat placed.
 */
export function placeSideScheme(
  state: GameState,
  instance: CardInstance,
  ownerId?: string,
): number {
  const card = instance.card as unknown as SideSchemeCard | PlayerSideSchemeCard;
  const threat = (card.baseThreat ?? 0) * (card.baseThreatFixed ? 1 : getPerPlayerCount(state));
  state.sideSchemes.push({
    instanceId: instance.instanceId,
    card,
    threat,
    ...(ownerId ? { ownerId } : {}),
  });
  syncVillainMaxHealth(state);
  return threat;
}
