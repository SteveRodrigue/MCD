import React from 'react';
import { ChevronsLeft, ChevronsRight, Home, Layout, RotateCcw } from 'lucide-react';
import { ACCENT_KINDS, ACCENT_PALETTE } from '../../theme/card-accents';
import {
  MODAL_STYLES,
  VERB_COLORS,
  VERB_MEANING,
  VERB_SWATCH,
  getModalStyle,
  type VerbColor,
} from '../../theme/modal-styles';
import { CyclePicker, type CycleGroup } from './CyclePicker';
import { FontSwitcher } from './FontSwitcher';
import { cycleKit, cycleModal, cycleStyle } from './lab-nav';
import {
  ARCHETYPES,
  ARCHETYPE_GROUPS,
  DEFAULT_ITEM,
  KITS,
  buildTemplatesPath,
  kitOfItem,
  type TemplatesRoute,
} from './template-routes';
import type { useFontTest } from './useFontTest';

const GALLERY = '';

const STYLE_GROUPS: CycleGroup[] = [
  {
    options: [
      { value: GALLERY, label: 'All styles (gallery)' },
      ...MODAL_STYLES.map((s) => ({ value: s.id, label: s.label })),
    ],
  },
];

const KIT_GROUPS: CycleGroup[] = [{ options: KITS.map((k) => ({ value: k.id, label: k.label })) }];

const NO_PROMPT = '';

const MODAL_GROUPS: CycleGroup[] = ARCHETYPE_GROUPS.map((group) => ({
  label: group,
  options: ARCHETYPES.filter((a) => a.group === group).map((a) => ({
    value: a.id,
    label: a.label,
  })),
}));

const pillBase =
  'px-2.5 py-1.5 rounded-lg border-2 font-black text-xs uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5';
const pillOn = 'bg-comic-yellow text-comic-black border-comic-yellow shadow-comic-sm';
const pillOff = 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2.5 border-t-2 border-slate-700 pt-3">
    <h2 className="text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</h2>
    {children}
  </section>
);

export interface LabSidebarProps {
  route: TemplatesRoute;
  onNavigate: (route: TemplatesRoute) => void;
  verb: VerbColor | null;
  onVerb: (verb: VerbColor | null) => void;
  forced: boolean;
  onForced: () => void;
  cardAccents: boolean;
  onCardAccents: () => void;
  onReset: () => void;
  lastEvent: string | null;
  fontTest: ReturnType<typeof useFontTest>;
  collapsed: boolean;
  onToggle: () => void;
  onExit?: () => void;
}

/**
 * The lab's controls, in a column on the left: the style, the kit and the modal (each a cycling
 * choice with a key), the demo switches, and the font test. It is portalled above every modal by the
 * screen, so it is never covered or dimmed.
 */
export const LabSidebar = React.forwardRef<HTMLElement, LabSidebarProps>(
  (
    {
      route,
      onNavigate,
      verb,
      onVerb,
      forced,
      onForced,
      cardAccents,
      onCardAccents,
      onReset,
      lastEvent,
      fontTest,
      collapsed,
      onToggle,
      onExit,
    },
    ref,
  ) => {
    const style = getModalStyle(route.style);
    const kit = kitOfItem(route.item);
    const isModalKit = kit === 'modals';

    if (collapsed) {
      return (
        <aside
          ref={ref}
          data-lab-chrome
          aria-label="Lab controls"
          className="h-full w-12 bg-comic-black border-r-4 border-comic-yellow flex flex-col items-center py-2"
        >
          <button
            type="button"
            aria-label="Show the lab controls"
            title="Show the lab controls"
            onClick={onToggle}
            className="p-1.5 bg-comic-yellow text-comic-black rounded-lg shadow-comic-sm cursor-pointer"
          >
            <ChevronsRight className="w-5 h-5" />
          </button>
        </aside>
      );
    }

    return (
      <aside
        ref={ref}
        data-lab-chrome
        aria-label="Lab controls"
        className="h-full w-[19rem] bg-comic-black border-r-4 border-comic-yellow shadow-comic-md flex flex-col"
      >
        <div className="shrink-0 px-3 py-2.5 flex items-center justify-between gap-2 border-b-2 border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-comic-yellow text-comic-black rounded-lg shadow-comic-sm shrink-0">
              <Layout className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-comic-yellow">
                Design system reference lab
              </div>
              <h1 className="text-base font-black uppercase text-white leading-none truncate">
                Modal styles
              </h1>
            </div>
          </div>
          <button
            type="button"
            aria-label="Hide the lab controls"
            title="Hide the lab controls"
            onClick={onToggle}
            className="p-1.5 bg-slate-800 text-slate-300 border-2 border-slate-600 rounded-lg hover:bg-slate-700 cursor-pointer shrink-0"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <section className="space-y-2.5">
            <CyclePicker
              name="Style"
              label="Style"
              hint="The theme. The first stop is the gallery of all styles."
              shortcut="T"
              value={style ? style.id : GALLERY}
              groups={STYLE_GROUPS}
              onChange={(value) =>
                onNavigate({
                  style: value === GALLERY ? null : getModalStyle(value)!.id,
                  item: route.item,
                })
              }
              onStep={(direction) =>
                onNavigate({ style: cycleStyle(route.style, direction), item: route.item })
              }
            />
            {style && (
              <>
                <CyclePicker
                  name="Kit"
                  label="Kit"
                  hint="Modals, elements, board, newspaper or setup."
                  shortcut="K"
                  value={kit}
                  groups={KIT_GROUPS}
                  onChange={(value) =>
                    onNavigate({
                      style: style.id,
                      item: DEFAULT_ITEM[value as keyof typeof DEFAULT_ITEM],
                    })
                  }
                  onStep={(direction) =>
                    onNavigate({ style: style.id, item: cycleKit(route.item, direction) })
                  }
                />
                <CyclePicker
                  name="Prompt"
                  label="Prompts"
                  hint="Every modal: prompts, targets and menus, dialogs. Picking one opens the Modals kit."
                  shortcut="P"
                  value={isModalKit ? route.item : NO_PROMPT}
                  groups={
                    isModalKit
                      ? MODAL_GROUPS
                      : [
                          { options: [{ value: NO_PROMPT, label: 'Choose a prompt…' }] },
                          ...MODAL_GROUPS,
                        ]
                  }
                  onChange={(value) => {
                    const archetype = ARCHETYPES.find((a) => a.id === value);
                    if (archetype) onNavigate({ style: style.id, item: archetype.id });
                  }}
                  onStep={(direction) =>
                    onNavigate({ style: style.id, item: cycleModal(route.item, direction) })
                  }
                />
              </>
            )}
          </section>

          {style && (
            <Section title="Demo">
              {isModalKit && (
                <div role="group" aria-label="Header verb colour" className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      aria-pressed={verb === null}
                      onClick={() => onVerb(null)}
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
                        onClick={() => onVerb(v)}
                        className={`w-7 h-7 rounded-full border-2 shrink-0 cursor-pointer ${
                          verb === v ? 'border-white scale-110' : 'border-slate-500'
                        }`}
                        style={{ backgroundColor: VERB_SWATCH[v] }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {route.item === 'decision' && (
                  <button
                    type="button"
                    aria-pressed={forced}
                    onClick={onForced}
                    className={`${pillBase} ${forced ? 'bg-comic-red text-white border-comic-red' : pillOff}`}
                  >
                    Forced: {forced ? 'on' : 'off'}
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={cardAccents}
                  onClick={onCardAccents}
                  className={`${pillBase} ${cardAccents ? pillOn : pillOff}`}
                >
                  Card accent: {cardAccents ? 'on' : 'off'}
                </button>
                <button type="button" onClick={onReset} className={`${pillBase} ${pillOff}`}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
              {lastEvent && (
                <span
                  role="status"
                  className="block text-xs font-bold text-amber-300 bg-slate-900 border border-slate-600 rounded px-2 py-1"
                >
                  {lastEvent}
                </span>
              )}
            </Section>
          )}

          <Section title="Fonts">
            <FontSwitcher
              pair={fontTest.pair}
              sizes={fontTest.sizes}
              style={style}
              onSelect={fontTest.setFont}
              onStepSize={fontTest.stepFontSize}
              onClearSize={fontTest.clearFontSize}
              onReset={fontTest.reset}
            />
          </Section>

          {style && (
            <Section title="About this style">
              <p className="text-[11px] text-slate-300 leading-snug">
                <strong className="text-comic-yellow">{style.label}:</strong> {style.tagline}
              </p>
              {cardAccents && (
                <ul aria-label="Card accent legend" className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {ACCENT_KINDS.map((kind) => (
                    <li key={kind} className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span className="flex w-2.5 h-3 overflow-hidden rounded-sm border border-white/30 shrink-0">
                        {ACCENT_PALETTE[kind].colors.map((c) => (
                          <span key={c} className="flex-1" style={{ backgroundColor: c }} />
                        ))}
                      </span>
                      {ACCENT_PALETTE[kind].label}
                    </li>
                  ))}
                </ul>
              )}
              <code className="block font-mono text-[11px] text-amber-300 break-all">
                {buildTemplatesPath(route)}
              </code>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Keys: <kbd className="px-1 border border-slate-500 rounded">T</kbd> style{' '}
                <kbd className="px-1 border border-slate-500 rounded">K</kbd> kit{' '}
                <kbd className="px-1 border border-slate-500 rounded">P</kbd> prompt, Shift goes
                back.
              </p>
            </Section>
          )}
        </div>

        {onExit && (
          <div className="shrink-0 px-3 py-2.5 border-t-2 border-slate-700">
            <button
              type="button"
              onClick={onExit}
              className="w-full px-3 py-1.5 bg-comic-red hover:bg-red-700 text-white rounded-lg border-2 border-comic-black font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shadow-comic-sm"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to game</span>
            </button>
          </div>
        )}
      </aside>
    );
  },
);
LabSidebar.displayName = 'LabSidebar';
