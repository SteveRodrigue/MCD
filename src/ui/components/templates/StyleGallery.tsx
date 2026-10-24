import React from 'react';
import { Check } from 'lucide-react';
import { MODAL_STYLES, VERB_COLORS, VERB_MEANING, VERB_SWATCH } from '../../theme/modal-styles';
import { ThemePreview } from '../../theme/ThemePreview';

/**
 * The overview of every style: a preview, the name, the tagline, the traits. It has no buttons: the
 * Style list in the lab controls (or the T key) opens a style. The text under each preview uses the
 * readable body font, not the comic headline font.
 */
export const StyleGallery: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 md:px-8 pb-12 pt-6 font-body">
    <div className="mb-6 grid gap-4 md:grid-cols-2">
      <div>
        <h2 className="text-2xl font-black uppercase text-comic-yellow">All styles</h2>
        <p className="text-sm text-slate-300 mt-1">
          Every style shows the same modals and the same verb colours. Open one with the Style list
          on the left, or press <kbd className="px-1 border border-slate-500 rounded">T</kbd> to
          cycle through them.
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
          className="bg-slate-800 border-2 border-slate-600 rounded-xl p-3 flex flex-col gap-3"
        >
          <ThemePreview style={style} />
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
        </section>
      ))}
    </div>
  </div>
);
