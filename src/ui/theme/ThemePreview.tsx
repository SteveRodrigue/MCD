import React from 'react';
import { VERB_COLORS, VERB_MEANING, themeFontVars, type ModalStyle } from './modal-styles';

/** Static mini modal drawn from the style tokens, so the gallery and the player's picker never drift from the real thing. */
export const ThemePreview: React.FC<{ style: ModalStyle; heightClass?: string }> = ({
  style,
  heightClass = 'h-52',
}) => (
  <div
    className={`relative ${heightClass} rounded-lg overflow-hidden flex items-center justify-center p-4 ${style.previewPage}`}
    style={themeFontVars(style)}
  >
    <div className={`relative w-full overflow-hidden ${style.frame} ${style.text}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none ${style.textureClass}`}
        style={style.texture}
      />
      <div
        className={`relative px-3 py-2 text-xs font-black uppercase border-b-4 ${style.verbs.yellow.banner} ${style.verbs.yellow.title} ${style.verbs.yellow.rule}`}
      >
        Decision point
      </div>
      <div className="relative p-2.5 space-y-2">
        <div className={`flex items-center gap-2 p-1.5 ${style.panel}`}>
          <div className="w-7 h-7 bg-slate-300 rounded-xs shrink-0" />
          <div className="space-y-1 flex-1">
            <div className="h-1.5 w-2/3 bg-current opacity-60 rounded-full" />
            <div className="h-1.5 w-1/2 bg-current opacity-25 rounded-full" />
          </div>
        </div>
        <div className="flex gap-1.5">
          {VERB_COLORS.map((verb) => (
            <div
              key={verb}
              title={VERB_MEANING[verb]}
              className={`flex-1 h-4 border-b-2 ${style.verbs[verb].banner} ${style.verbs[verb].rule}`}
            />
          ))}
        </div>
        <div
          className={`h-6 w-1/2 ml-auto flex items-center justify-center text-nano font-black ${style.btnGo}`}
        >
          CONFIRM
        </div>
      </div>
    </div>
  </div>
);
