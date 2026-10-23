import React from 'react';
import { Check } from 'lucide-react';
import {
  MODAL_STYLES,
  VERB_COLORS,
  VERB_MEANING,
  VERB_SWATCH,
  type ModalStyle,
  type ModalStyleId,
} from './modal-styles';
import { ARCHETYPES, type ArchetypeId } from './template-routes';

/** Static mini modal drawn from the style tokens, so the gallery can never drift from the real thing. */
const StylePreview: React.FC<{ style: ModalStyle }> = ({ style }) => (
  <div
    className={`relative h-52 rounded-lg overflow-hidden flex items-center justify-center p-4 ${style.previewPage}`}
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
          <div className="w-7 h-7 bg-slate-300 rounded-sm shrink-0" />
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
          className={`h-6 w-1/2 ml-auto flex items-center justify-center text-[9px] font-black ${style.btnGo}`}
        >
          CONFIRM
        </div>
      </div>
    </div>
  </div>
);

export interface StyleGalleryProps {
  onOpen: (style: ModalStyleId, archetype: ArchetypeId) => void;
}

export const StyleGallery: React.FC<StyleGalleryProps> = ({ onOpen }) => (
  <div className="max-w-7xl mx-auto px-4 md:px-8 pb-12 pt-6">
    <div className="mb-6 grid gap-4 md:grid-cols-2">
      <div>
        <h2 className="text-2xl font-black uppercase text-comic-yellow">Pick a style</h2>
        <p className="text-sm text-slate-300 mt-1">
          Every style shows the same three modals and the same verb colours. Open one, click through
          the other styles from the top bar, and tell me which one you want to keep or tweak.
        </p>
      </div>
      <div className="bg-slate-800 border-2 border-slate-600 rounded-lg p-3 text-xs space-y-2">
        <div className="font-black uppercase text-slate-200">
          Verb colours (same in every style)
        </div>
        <div className="flex flex-wrap gap-2">
          {VERB_COLORS.map((verb) => (
            <span
              key={verb}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-600"
            >
              <span
                className="w-3 h-3 rounded-full border border-white/40"
                style={{ backgroundColor: VERB_SWATCH[verb] }}
              />
              {VERB_MEANING[verb]}
            </span>
          ))}
        </div>
        <div className="flex items-start gap-1.5 text-slate-300">
          <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
          <span>
            Card Anchoring Rule: whenever a card is named, its text shown, its ability used or it
            triggered the modal, its thumbnail is shown.
          </span>
        </div>
      </div>
    </div>

    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {MODAL_STYLES.map((style) => (
        <section
          key={style.id}
          aria-label={style.label}
          data-testid={`gallery-style-${style.id}`}
          className="bg-slate-800 border-2 border-slate-600 rounded-xl p-3 flex flex-col gap-3 hover:border-comic-yellow transition-colors"
        >
          <StylePreview style={style} />
          <div>
            <h3 className="text-lg font-black uppercase text-white leading-tight">{style.label}</h3>
            <p className="text-sm text-slate-300">{style.tagline}</p>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {style.traits.map((trait) => (
              <li
                key={trait}
                className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-600 text-slate-300"
              >
                {trait}
              </li>
            ))}
          </ul>
          <div className="text-xs text-slate-400">
            Best for: <span className="text-slate-200 font-bold">{style.bestFor}</span>
          </div>
          <div className="flex gap-2 mt-auto">
            {ARCHETYPES.map((arch) => (
              <button
                key={arch.id}
                type="button"
                title={arch.description}
                onClick={() => onOpen(style.id, arch.id)}
                className="flex-1 px-2 py-1.5 rounded-lg bg-comic-yellow hover:bg-amber-400 text-comic-black border-2 border-comic-black font-black text-xs uppercase cursor-pointer shadow-comic-sm"
              >
                {arch.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  </div>
);
