import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { ModalLayer } from '../components/layout/ModalLayer';
import { CardRef, type CardReference } from './CardRef';
import { ActionBurst } from './ActionBurst';
import { useModalStyle } from './useModalStyle';
import type { BurstState } from './useActionBurst';
import type { ModalStyle, VerbColor, VerbTokens } from './modal-styles';

export interface ModalScaffoldProps {
  title: React.ReactNode;
  /** Small label above the title (e.g. 'DECISION POINT'). */
  kicker?: string;
  /** Lucide icon shown in the header icon box. */
  icon?: React.ReactNode;
  /** Gameplay meaning of the header colour. */
  verb?: VerbColor;
  /** The card that caused this modal. Always shown with its thumbnail; `null` only when no card is involved. */
  trigger: CardReference | null;
  /** Counter or badge on the right of the header. */
  headerRight?: React.ReactNode;
  /** Makes the modal dismissible: adds a close button and the Escape key. Omit for forced prompts. */
  onClose?: () => void;
  /** Also close when the backdrop is clicked (needs `onClose`). */
  closeOnBackdrop?: boolean;
  /** Stacking layer; forced prompts that must outrank other modals use 'critical'. */
  layer?: 'modal' | 'critical';
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Sound-effect burst to show right now (from `useActionBurst`). */
  burst?: BurstState | null;
  testId?: string;
}

interface HeaderProps {
  layout: ModalStyle['headerLayout'];
  style: ModalStyle;
  verb: VerbTokens;
  title: React.ReactNode;
  titleId: string;
  kicker?: string;
  icon?: React.ReactNode;
  trigger: CardReference | null;
  right?: React.ReactNode;
}

/** Zigzag bottom edge for the burst header: 16 teeth across the width. */
const BURST_CLIP = `polygon(0 0, 100% 0, 100% 82%, ${Array.from({ length: 16 }, (_, i) => {
  const x = 100 - (i + 1) * (100 / 16);
  return `${(x + 100 / 32).toFixed(2)}% 100%, ${x.toFixed(2)}% 82%`;
}).join(', ')})`;

const ModalHeader: React.FC<HeaderProps> = ({
  layout,
  style,
  verb,
  title,
  titleId,
  kicker,
  icon,
  trigger,
  right,
}) => {
  const iconBox = icon ? <div className={`shrink-0 ${verb.iconBox}`}>{icon}</div> : null;

  const kickerRow = (
    <div
      className={`flex items-center gap-2 min-w-0 text-[10px] font-black uppercase tracking-wider ${verb.kicker}`}
    >
      {kicker && (
        <span className="truncate">{layout === 'caption' ? `★ ${kicker} ★` : kicker}</span>
      )}
      {trigger && (
        <>
          <span aria-hidden="true">▸</span>
          <CardRef {...trigger} size="xs" />
        </>
      )}
    </div>
  );

  const titleEl = (extra: string) => (
    <h2
      id={titleId}
      className={`font-black uppercase tracking-tight leading-none ${verb.title} ${extra}`}
    >
      {title}
    </h2>
  );

  if (layout === 'caption') {
    return (
      <div className="relative flex items-center justify-between gap-3 px-5 pt-5">
        <div
          className={`inline-flex items-center gap-2.5 px-4 py-2 border-[3px] border-comic-black rounded-md shadow-comic-sm -rotate-1 min-w-0 ${verb.banner}`}
        >
          {icon && <span className={`shrink-0 ${verb.iconBox}`}>{icon}</span>}
          <div className="min-w-0">
            {kickerRow}
            {titleEl('text-lg sm:text-xl truncate')}
          </div>
        </div>
        {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
      </div>
    );
  }

  if (layout === 'burst') {
    return (
      <div
        className={`relative px-6 pt-5 pb-9 flex items-start justify-between gap-4 ${verb.banner}`}
        style={{ clipPath: BURST_CLIP }}
      >
        <div className="flex items-center gap-4 min-w-0">
          {iconBox}
          <div className="min-w-0">
            {kickerRow}
            {titleEl('text-2xl sm:text-3xl -rotate-1 mt-1')}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span
            aria-hidden="true"
            className="rotate-6 bg-comic-yellow text-comic-black border-[3px] border-comic-black px-2 py-0.5 text-sm font-black shadow-comic-sm"
          >
            {verb.word}
          </span>
          {right}
        </div>
      </div>
    );
  }

  if (layout === 'masthead') {
    return (
      <div className={`relative px-5 pt-3 pb-2 ${verb.banner} ${style.header}`}>
        <div
          className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-y-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${verb.rule} ${verb.kicker}`}
        >
          <span className="truncate">{kicker}</span>
          {trigger && <CardRef {...trigger} size="xs" />}
          <span className="hidden sm:inline">{style.flavor}</span>
        </div>
        <div className="flex items-center justify-center gap-3 py-2.5">
          {iconBox}
          {titleEl('text-2xl sm:text-4xl text-center')}
          {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
        </div>
        <div className={`border-t-4 border-double ${verb.rule}`} />
      </div>
    );
  }

  if (layout === 'tab') {
    return (
      <div className="relative pt-3">
        <div className="flex items-end justify-between gap-3 px-5">
          <div
            className={`px-4 py-1.5 rounded-t-md border-2 border-b-0 ${verb.rule} ${verb.banner} min-w-0`}
          >
            {kickerRow}
          </div>
          <span
            aria-hidden="true"
            className="-rotate-6 mb-1 border-4 border-double border-red-700 px-3 py-0.5 text-sm font-black uppercase tracking-[0.2em] text-red-700 opacity-85 shrink-0"
          >
            {verb.word}
          </span>
        </div>
        <div
          className={`px-5 py-3 flex items-center justify-between gap-3 border-y-2 ${verb.rule} ${verb.banner}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {iconBox}
            {titleEl('text-xl sm:text-2xl truncate')}
          </div>
          {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative px-5 py-3.5 flex items-center justify-between select-none ${style.header} ${verb.rule} ${verb.banner}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {iconBox}
        <div className="min-w-0">
          {kickerRow}
          {titleEl('text-xl sm:text-2xl drop-shadow-xs truncate')}
        </div>
      </div>
      {right && <div className="shrink-0 ml-3 flex items-center gap-2">{right}</div>}
    </div>
  );
};

/**
 * The one modal shell for every style. Backdrop, frame, texture, header, scrollable body and
 * optional footer all come from the active `ModalStyle` (see `modal-styles.ts`).
 */
export const ModalScaffold: React.FC<ModalScaffoldProps> = ({
  title,
  kicker,
  icon,
  verb = 'yellow',
  trigger,
  headerRight,
  onClose,
  closeOnBackdrop = false,
  layer = 'modal',
  maxWidthClass = 'max-w-2xl',
  children,
  footer,
  burst = null,
  testId,
}) => {
  const { style, overlayInset, overlayTop } = useModalStyle();
  const titleId = useId();
  const frameRef = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog on open (unless something inside already has it) and returns on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = frameRef.current;
    if (frame && !frame.contains(document.activeElement)) frame.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const headerControls =
    headerRight || onClose ? (
      <>
        {headerRight}
        {onClose && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`p-1.5 cursor-pointer ${style.btnMove}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </>
    ) : undefined;

  return (
    <ModalLayer
      layer={layer}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`inset-0 flex items-center justify-center ${overlayInset} ${style.overlay}`}
      style={overlayTop === undefined ? undefined : { paddingTop: overlayTop }}
      onClick={(event) => {
        if (closeOnBackdrop && onClose && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={frameRef}
        tabIndex={-1}
        className={`relative w-full outline-none ${maxWidthClass} max-h-full overflow-hidden flex flex-col ${style.frame} ${style.text}`}
      >
        <div
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-none ${style.textureClass}`}
          style={style.texture}
        />

        {style.headerLayout === 'tab' && (
          <>
            <span
              aria-hidden="true"
              className="absolute -top-1 left-3 w-14 h-5 bg-white/45 rotate-[-18deg] z-10"
            />
            <span
              aria-hidden="true"
              className="absolute -top-1 right-3 w-14 h-5 bg-white/45 rotate-[18deg] z-10"
            />
          </>
        )}

        <ModalHeader
          layout={style.headerLayout}
          style={style}
          verb={style.verbs[verb]}
          title={title}
          titleId={titleId}
          kicker={kicker}
          icon={icon}
          trigger={trigger}
          right={headerControls}
        />

        <ActionBurst burst={burst} />

        <div className={`relative min-h-0 flex-1 overflow-y-auto ${style.body}`}>{children}</div>

        {footer && (
          <div
            className={`relative px-5 py-3.5 flex items-center justify-between gap-3 ${style.footer}`}
          >
            {footer}
          </div>
        )}
      </div>
    </ModalLayer>
  );
};
