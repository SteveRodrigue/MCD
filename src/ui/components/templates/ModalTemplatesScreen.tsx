import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Home, LayoutGrid, Layout, RotateCcw } from 'lucide-react';
import { ModalLayer } from '../layout/ModalLayer';
import { ModalStyleProvider } from '../../theme/ModalStyleContext';
import { ACCENT_KINDS, ACCENT_PALETTE } from '../../theme/card-accents';
import { DecisionTemplate } from './DecisionTemplate';
import { SequenceTemplate } from './SequenceTemplate';
import { SelectTemplate } from './SelectTemplate';
import { StyleGallery } from './StyleGallery';
import {
  MODAL_STYLES,
  VERB_COLORS,
  VERB_MEANING,
  VERB_SWATCH,
  getModalStyle,
  type ModalStyleId,
  type VerbColor,
} from '../../theme/modal-styles';
import {
  ARCHETYPES,
  buildTemplatesPath,
  parseTemplatesPath,
  type ArchetypeId,
  type TemplatesRoute,
} from './template-routes';

export interface ModalTemplatesScreenProps {
  onExit?: () => void;
}

const readRoute = (): TemplatesRoute => parseTemplatesPath(window.location.pathname);

const pillBase =
  'px-3 py-1.5 rounded-lg border-2 font-black text-xs uppercase transition-all shrink-0 cursor-pointer flex items-center gap-1.5';
const pillOn = 'bg-comic-yellow text-comic-black border-comic-yellow shadow-comic-sm';
const pillOff = 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700';

/**
 * Design-lab browser for modal styles (`/templates/`). Gallery of styles, then any style x
 * archetype live and interactive. Lab chrome is portalled to the critical layer so it stays clickable above every modal.
 */
export const ModalTemplatesScreen: React.FC<ModalTemplatesScreenProps> = ({ onExit }) => {
  const [route, setRoute] = useState<TemplatesRoute>(readRoute);
  const [verb, setVerb] = useState<VerbColor | null>(null);
  const [forced, setForced] = useState(false);
  const [cardAccents, setCardAccents] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  const resetDemo = useCallback(() => {
    setLastEvent(null);
    setResetKey((k) => k + 1);
  }, []);

  const navigate = useCallback(
    (next: TemplatesRoute) => {
      const path = buildTemplatesPath(next);
      if (window.location.pathname !== path) window.history.pushState({}, '', path);
      setRoute(next);
      resetDemo();
    },
    [resetDemo],
  );

  useEffect(() => {
    const onPop = () => {
      setRoute(readRoute());
      resetDemo();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [resetDemo]);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => setBarHeight(bar.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const style = getModalStyle(route.style);
  const openStyle = (id: ModalStyleId, archetype: ArchetypeId = route.archetype) =>
    navigate({ style: id, archetype });

  return (
    <div className="min-h-screen bg-slate-900 text-comic-paper font-comic select-none">
      {/* Portalled above the modal layer: a z-index inside the app shell cannot outrank a portal. */}
      <ModalLayer layer="critical" className="top-0 left-0 right-0">
        <header
          ref={barRef}
          className="bg-comic-black border-b-4 border-comic-yellow shadow-comic-md"
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-1.5 bg-comic-yellow text-comic-black rounded-lg shadow-comic-sm">
                <Layout className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-comic-yellow">
                  Design system reference lab
                </div>
                <h1 className="text-lg font-black uppercase text-white leading-none truncate">
                  Modal styles
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                aria-current={style ? undefined : 'page'}
                onClick={() => navigate({ style: null, archetype: route.archetype })}
                className={`${pillBase} ${style ? pillOff : pillOn}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>All styles</span>
              </button>
              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="px-3 py-1.5 bg-comic-red hover:bg-red-700 text-white rounded-lg border-2 border-comic-black font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-comic-sm"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Back to game</span>
                </button>
              )}
            </div>
          </div>

          {style && (
            <>
              <nav
                aria-label="Styles"
                className="border-t-2 border-slate-700 bg-slate-900 px-4 py-1.5 overflow-x-auto"
              >
                <div className="max-w-7xl mx-auto flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                    Style
                  </span>
                  {MODAL_STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-current={s.id === style.id ? 'page' : undefined}
                      onClick={() => openStyle(s.id)}
                      className={`${pillBase} ${s.id === style.id ? pillOn : pillOff}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </nav>
              <div className="border-t-2 border-slate-700 bg-slate-800 px-4 py-1.5 overflow-x-auto">
                <div className="max-w-7xl mx-auto flex items-center gap-2">
                  <nav aria-label="Modal types" className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                      Modal
                    </span>
                    {ARCHETYPES.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        title={a.description}
                        aria-current={a.id === route.archetype ? 'page' : undefined}
                        onClick={() => navigate({ style: style.id, archetype: a.id })}
                        className={`${pillBase} ${a.id === route.archetype ? pillOn : pillOff}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </nav>

                  <span className="w-px h-5 bg-slate-600 shrink-0" />

                  <div
                    role="group"
                    aria-label="Header verb colour"
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                      Verb
                    </span>
                    <button
                      type="button"
                      aria-pressed={verb === null}
                      onClick={() => setVerb(null)}
                      className={`${pillBase} ${verb === null ? pillOn : pillOff}`}
                    >
                      Default
                    </button>
                    {VERB_COLORS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={verb === v}
                        aria-label={`${v}: ${VERB_MEANING[v]}`}
                        title={`${v}: ${VERB_MEANING[v]}`}
                        onClick={() => setVerb(v)}
                        className={`w-7 h-7 rounded-full border-2 shrink-0 cursor-pointer ${
                          verb === v ? 'border-white scale-110' : 'border-slate-500'
                        }`}
                        style={{ backgroundColor: VERB_SWATCH[v] }}
                      />
                    ))}
                  </div>

                  <span className="w-px h-5 bg-slate-600 shrink-0" />

                  {route.archetype === 'decision' && (
                    <button
                      type="button"
                      aria-pressed={forced}
                      onClick={() => setForced((f) => !f)}
                      className={`${pillBase} ${forced ? 'bg-comic-red text-white border-comic-red' : pillOff}`}
                    >
                      Forced: {forced ? 'on' : 'off'}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-pressed={cardAccents}
                    onClick={() => setCardAccents((on) => !on)}
                    className={`${pillBase} ${cardAccents ? pillOn : pillOff}`}
                  >
                    Card accent: {cardAccents ? 'on' : 'off'}
                  </button>
                  <button type="button" onClick={resetDemo} className={`${pillBase} ${pillOff}`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                  {lastEvent && (
                    <span
                      role="status"
                      className="text-xs font-bold text-amber-300 bg-slate-900 border border-slate-600 rounded px-2 py-1 whitespace-nowrap"
                    >
                      {lastEvent}
                    </span>
                  )}
                </div>
              </div>
              <div className="border-t-2 border-slate-700 bg-slate-950 px-4 py-1 text-[11px] text-slate-400">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
                  <span className="truncate">
                    <strong className="text-comic-yellow">{style.label}:</strong> {style.tagline}
                  </span>
                  {cardAccents && (
                    <span
                      aria-label="Card accent legend"
                      className="hidden md:flex items-center gap-2 shrink-0"
                    >
                      {ACCENT_KINDS.map((kind) => (
                        <span key={kind} className="inline-flex items-center gap-1">
                          <span className="flex w-2.5 h-3 overflow-hidden rounded-sm border border-white/30">
                            {ACCENT_PALETTE[kind].colors.map((c) => (
                              <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                            ))}
                          </span>
                          {ACCENT_PALETTE[kind].label}
                        </span>
                      ))}
                    </span>
                  )}
                  <code className="font-mono text-amber-300 shrink-0">
                    {buildTemplatesPath(route)}
                  </code>
                </div>
              </div>
            </>
          )}
        </header>
      </ModalLayer>

      {style ? (
        <ModalStyleProvider
          style={style}
          overlayInset="px-4 pb-4"
          overlayTop={barHeight + 16}
          cardAccents={cardAccents}
        >
          <main
            key={`${style.id}-${route.archetype}-${resetKey}`}
            className="min-h-screen bg-slate-700 bg-bendy-dots flex items-center justify-center text-slate-500 font-black uppercase tracking-widest text-sm"
          >
            <span aria-hidden="true">Game board, behind the modal</span>
            {route.archetype === 'decision' && (
              <DecisionTemplate forced={forced} verb={verb ?? undefined} onAction={setLastEvent} />
            )}
            {route.archetype === 'sequence' && (
              <SequenceTemplate verb={verb ?? undefined} onAction={setLastEvent} />
            )}
            {route.archetype === 'select' && (
              <SelectTemplate verb={verb ?? undefined} onAction={setLastEvent} />
            )}
          </main>
        </ModalStyleProvider>
      ) : (
        <main style={{ paddingTop: barHeight }}>
          <StyleGallery onOpen={openStyle} />
        </main>
      )}
    </div>
  );
};
