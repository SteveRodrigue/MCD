import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ModalLayer } from '../layout/ModalLayer';
import { ModalStyleProvider } from '../../theme/ModalStyleContext';
import { DecisionTemplate } from './DecisionTemplate';
import { SequenceTemplate } from './SequenceTemplate';
import { SelectTemplate } from './SelectTemplate';
import { ModalPreview } from './ModalPreviews';
import { LabSidebar } from './LabSidebar';
import { StyleGallery } from './StyleGallery';
import { useFontTest } from './useFontTest';
import { isTypingTarget } from './font-test';
import { cycleKit, cycleModal, cycleStyle, navShortcut } from './lab-nav';
import './lab-fonts.css';
import './font-test.css';
import { BoardKit } from './kits/BoardKit';
import { ElementsKit } from './kits/ElementsKit';
import { NewspaperKit } from './kits/NewspaperKit';
import { SetupKit } from './kits/SetupKit';
import { getModalStyle, type VerbColor } from '../../theme/modal-styles';
import {
  buildTemplatesPath,
  kitOfItem,
  parseTemplatesPath,
  type ArchetypeId,
  type TemplatesRoute,
} from './template-routes';

export interface ModalTemplatesScreenProps {
  onExit?: () => void;
}

const readRoute = (): TemplatesRoute => parseTemplatesPath(window.location.pathname);

/**
 * Design-lab browser for modal styles (`/templates/`). A column of controls on the left (style, kit,
 * modal and fonts, each a cycling choice with a key) and the live, interactive result on the right.
 * The column is portalled to the critical layer so it stays clickable above every modal, and modals
 * start to its right.
 */
export const ModalTemplatesScreen: React.FC<ModalTemplatesScreenProps> = ({ onExit }) => {
  const [route, setRoute] = useState<TemplatesRoute>(readRoute);
  const [verb, setVerb] = useState<VerbColor | null>(null);
  const [forced, setForced] = useState(false);
  const [cardAccents, setCardAccents] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const fontTest = useFontTest();
  const sidebarRef = useRef<HTMLElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(0);

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

  // T, K and P cycle the style, the kit and the modal; Shift goes back. Not while typing in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const match = navShortcut(event);
      if (match === null || isTypingTarget(event.target)) return;
      event.preventDefault();
      const { target, direction } = match;
      if (target === 'style') {
        navigate({ style: cycleStyle(route.style, direction), item: route.item });
      } else if (route.style && target === 'kit') {
        navigate({ style: route.style, item: cycleKit(route.item, direction) });
      } else if (route.style && target === 'modal') {
        navigate({ style: route.style, item: cycleModal(route.item, direction) });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, route]);

  // The column's width pushes the page and the modals to its right.
  useLayoutEffect(() => {
    const bar = sidebarRef.current;
    if (!bar) return;
    const measure = () => setSidebarWidth(bar.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [collapsed]);

  const style = getModalStyle(route.style);
  const isModalKit = kitOfItem(route.item) === 'modals';
  const overlayOffset = useMemo(() => ({ left: sidebarWidth }), [sidebarWidth]);
  const pageStyle = { paddingLeft: sidebarWidth };

  return (
    <div className="min-h-screen bg-slate-900 text-comic-paper font-comic select-none">
      {/* Portalled above the modal layer: a z-index inside the app shell cannot outrank a portal. */}
      <ModalLayer layer="critical" themed={false} className="top-0 left-0 bottom-0">
        <LabSidebar
          ref={sidebarRef}
          route={route}
          onNavigate={navigate}
          verb={verb}
          onVerb={setVerb}
          forced={forced}
          onForced={() => setForced((f) => !f)}
          cardAccents={cardAccents}
          onCardAccents={() => setCardAccents((on) => !on)}
          onReset={resetDemo}
          lastEvent={lastEvent}
          fontTest={fontTest}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onExit={onExit}
        />
      </ModalLayer>

      {style ? (
        <ModalStyleProvider
          style={style}
          overlayInset="p-4"
          overlayOffset={overlayOffset}
          cardAccents={cardAccents}
          verbOverride={verb ?? undefined}
        >
          {isModalKit ? (
            <main
              key={`${style.id}-${route.item}-${resetKey}`}
              style={pageStyle}
              className="min-h-screen bg-slate-700 bg-bendy-dots flex items-center justify-center text-slate-500 font-black uppercase tracking-widest text-sm"
            >
              <span aria-hidden="true">Game board, behind the modal</span>
              {route.item === 'decision' && (
                <DecisionTemplate forced={forced} onAction={setLastEvent} />
              )}
              {route.item === 'sequence' && <SequenceTemplate onAction={setLastEvent} />}
              {route.item === 'select' && <SelectTemplate onAction={setLastEvent} />}
              {!['decision', 'sequence', 'select'].includes(route.item) && (
                <ModalPreview item={route.item as ArchetypeId} onAction={setLastEvent} />
              )}
            </main>
          ) : (
            <main key={`${style.id}-${route.item}-${resetKey}`} style={pageStyle}>
              {route.item === 'elements' && <ElementsKit />}
              {route.item === 'board' && <BoardKit />}
              {route.item === 'newspaper' && <NewspaperKit />}
              {route.item === 'setup' && <SetupKit />}
            </main>
          )}
        </ModalStyleProvider>
      ) : (
        <main style={pageStyle}>
          <StyleGallery />
        </main>
      )}
    </div>
  );
};
