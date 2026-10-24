import { THEME_EXTRAS, type ThemeExtras } from './theme-extras';
import { useModalStyle } from './useModalStyle';

/** Table, type roles, form and Newspaper tokens of the active theme. */
export const useThemeExtras = (): ThemeExtras => THEME_EXTRAS[useModalStyle().style.id];
