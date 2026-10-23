import { ALL_THEME_IDS, type ModalStyleId } from './modal-styles';
import type { ThemeMode } from './theme-settings';

export interface ResolveThemeInput {
  mode: ThemeMode;
  /** Used when `mode` is 'fixed'. */
  themeId: ModalStyleId;
  /** Themes Random may pick from; empty means every theme. */
  pool: readonly ModalStyleId[];
  /** The theme of the previous game: Random avoids repeating it. */
  previousId?: ModalStyleId | null;
  /** Injected so tests are deterministic. UI only: never the engine RNG. */
  random?: () => number;
}

/**
 * Picks the theme for a game. Fixed returns the player's choice; Random picks uniformly from the
 * pool and never repeats `previousId` when another theme is available.
 */
export const resolveTheme = ({
  mode,
  themeId,
  pool,
  previousId = null,
  random = Math.random,
}: ResolveThemeInput): ModalStyleId => {
  if (mode === 'fixed') return themeId;

  const eligible = pool.length > 0 ? pool : ALL_THEME_IDS;
  const candidates = eligible.length > 1 ? eligible.filter((id) => id !== previousId) : eligible;
  return candidates[Math.min(Math.floor(random() * candidates.length), candidates.length - 1)];
};
