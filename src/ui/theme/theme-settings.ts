import { ALL_THEME_IDS, DEFAULT_MODAL_STYLE, isThemeId, type ModalStyleId } from './modal-styles';

export type ThemeMode = 'fixed' | 'random';

/** Player-facing theme preferences, stored with the other game settings. */
export interface ThemeSettings {
  themeMode: ThemeMode;
  /** The theme used when `themeMode` is 'fixed'. */
  themeId: ModalStyleId;
  /** Themes Random may pick from. */
  randomThemePool: ModalStyleId[];
  /** Draw faction / hero / villain colours on card-bearing modal elements. */
  cardAccents: boolean;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  themeMode: 'fixed',
  themeId: DEFAULT_MODAL_STYLE.id,
  randomThemePool: [...ALL_THEME_IDS],
  cardAccents: true,
};

/**
 * Repairs theme settings read from storage: an unknown mode or theme id (renamed or removed in a
 * later version) falls back to the default, unknown pool entries are dropped, and an empty pool
 * means every theme.
 */
export const sanitizeThemeSettings = <T extends object>(raw: T): T & ThemeSettings => {
  const source = raw as Partial<Record<keyof ThemeSettings, unknown>>;
  const pool = Array.isArray(source.randomThemePool)
    ? [...new Set(source.randomThemePool.filter(isThemeId))]
    : [];

  return {
    ...raw,
    themeMode:
      source.themeMode === 'fixed' || source.themeMode === 'random'
        ? source.themeMode
        : DEFAULT_THEME_SETTINGS.themeMode,
    themeId: isThemeId(source.themeId) ? source.themeId : DEFAULT_THEME_SETTINGS.themeId,
    randomThemePool: pool.length > 0 ? pool : [...ALL_THEME_IDS],
    cardAccents:
      typeof source.cardAccents === 'boolean'
        ? source.cardAccents
        : DEFAULT_THEME_SETTINGS.cardAccents,
  };
};
