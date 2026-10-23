import React from 'react';
import { RotateCw, Shuffle } from 'lucide-react';
import { useGameSettings } from '../context/useGameSettings';
import { MODAL_STYLES, getModalStyle, type ModalStyleId } from './modal-styles';
import { ThemePreview } from './ThemePreview';
import { useModalStyle } from './useModalStyle';

export interface ThemePickerProps {
  /** Draw the picker with the active theme's tokens (inside a themed dialog) instead of the neutral comic look. */
  themed?: boolean;
  /** Present while a game is running: shows its theme and, in Random mode, offers a Re-roll. */
  game?: { activeThemeId: ModalStyleId; onReroll: () => void };
}

/**
 * Player-facing theme choice: one fixed theme, or Random (a new theme for every game, drawn from a
 * pool the player controls), plus the card accent switch. Each theme is shown by its own preview.
 */
export const ThemePicker: React.FC<ThemePickerProps> = ({ themed = false, game }) => {
  const { style: active } = useModalStyle();
  const { settings, updateSettings } = useGameSettings();
  const { themeMode, themeId, randomThemePool, cardAccents } = settings;

  const cardClass = (selected: boolean) =>
    `relative p-2 text-left transition-all cursor-pointer ${
      themed
        ? selected
          ? active.tileSelected
          : active.tile
        : `rounded-xl border-[3px] shadow-comic-sm ${
            selected
              ? 'border-comic-red bg-comic-yellow'
              : 'border-comic-black bg-white hover:bg-amber-50'
          }`
    }`;
  const boxClass = themed
    ? `p-3 ${active.inset}`
    : 'p-3 rounded-xl border-2 border-comic-black bg-amber-50 shadow-comic-sm';
  const mutedClass = themed ? active.muted : 'text-slate-600';

  const togglePool = (id: ModalStyleId) => {
    const next = randomThemePool.includes(id)
      ? randomThemePool.filter((p) => p !== id)
      : [...randomThemePool, id];
    if (next.length > 0) updateSettings({ randomThemePool: next });
  };

  return (
    <section aria-label="Theme" className="space-y-3">
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {MODAL_STYLES.map((style) => {
          const selected = themeMode === 'fixed' && themeId === style.id;
          return (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`theme-card-${style.id}`}
              onClick={() => updateSettings({ themeMode: 'fixed', themeId: style.id })}
              className={cardClass(selected)}
            >
              <ThemePreview style={style} heightClass="h-24" />
              <div className="mt-1.5 text-xs font-black uppercase leading-tight">{style.label}</div>
            </button>
          );
        })}

        <button
          type="button"
          role="radio"
          aria-checked={themeMode === 'random'}
          data-testid="theme-random"
          onClick={() => updateSettings({ themeMode: 'random' })}
          className={`${cardClass(themeMode === 'random')} flex flex-col items-center justify-center gap-1.5 min-h-[9rem]`}
        >
          <Shuffle className="w-8 h-8" />
          <div className="text-xs font-black uppercase leading-tight text-center">
            Random each game
          </div>
          <div className={`text-[10px] font-bold text-center ${mutedClass}`}>
            A new theme every time you start a game
          </div>
        </button>
      </div>

      {themeMode === 'random' && (
        <div className={`${boxClass} space-y-2`}>
          <fieldset className="space-y-1.5">
            <legend className={`text-[11px] font-black uppercase tracking-wider ${mutedClass}`}>
              Include in random
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {MODAL_STYLES.map((style) => {
                const included = randomThemePool.includes(style.id);
                return (
                  <label key={style.id} className="flex items-center gap-1.5 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={included}
                      disabled={included && randomThemePool.length === 1}
                      onChange={() => togglePool(style.id)}
                    />
                    {style.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {game && (
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-current/20">
              <span className="text-xs font-bold" data-testid="theme-this-game">
                This game: {getModalStyle(game.activeThemeId)?.label}
              </span>
              <button
                type="button"
                onClick={game.onReroll}
                className={`px-2.5 py-1 flex items-center gap-1.5 text-xs font-black uppercase cursor-pointer ${
                  themed
                    ? active.btnMove
                    : 'rounded-lg border-2 border-comic-black bg-comic-yellow hover:bg-amber-300 shadow-comic-sm'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Re-roll</span>
              </button>
            </div>
          )}
        </div>
      )}

      <label className={`flex items-center justify-between gap-3 cursor-pointer ${boxClass}`}>
        <span>
          <span className="block text-sm font-black">Card accents</span>
          <span className={`block text-xs ${mutedClass}`}>
            Mark cards with their hero, aspect or villain colours in prompts.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Card accents"
          checked={cardAccents}
          onChange={() => updateSettings({ cardAccents: !cardAccents })}
          className="w-5 h-5 shrink-0"
        />
      </label>
    </section>
  );
};
