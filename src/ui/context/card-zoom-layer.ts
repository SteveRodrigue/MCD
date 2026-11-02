import { createContext, useContext } from 'react';

/**
 * True inside a clipping surface (a modal's scrolling body). Cards there draw their hover zoom in a
 * portal on document.body, above every modal, so the zoomed card is never clipped by the panel
 * (ADR-0012: zoom happens on the z-axis, over everything).
 */
export const CardZoomLayerContext = createContext(false);

export const useFloatingCardZoom = (): boolean => useContext(CardZoomLayerContext);
