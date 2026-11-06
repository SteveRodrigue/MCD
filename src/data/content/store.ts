import type { ContentDriver, ContentWriter, LoadedContent } from './types.ts';

const EMPTY: LoadedContent = {
  packs: [],
  failures: [],
  descriptions: [],
  artPacks: [],
  artPackWarnings: [],
  artPackCardLabels: {},
};
let current: LoadedContent = EMPTY;

/** What `applyContent` last put into the engine singletons (empty before the first boot). */
export function getLoadedContent(): LoadedContent {
  return current;
}

export function setLoadedContent(content: LoadedContent): void {
  current = content;
}

export function clearLoadedContent(): void {
  current = EMPTY;
}

let activeDriver: (ContentDriver & ContentWriter) | undefined;

/** The driver passed to `bootContent` (Node in tests, Fetch in the browser). */
export function getActiveDriver(): (ContentDriver & ContentWriter) | undefined {
  return activeDriver;
}

export function setActiveDriver(driver: (ContentDriver & ContentWriter) | undefined): void {
  activeDriver = driver;
}

let disabledArtPacks: ReadonlySet<string> = new Set();
let artPackVersion = 0;
const artPackListeners = new Set<() => void>();

/** Ids of the art packs the player switched off. They show no art (ADR-0093). */
export function getDisabledArtPacks(): ReadonlySet<string> {
  return disabledArtPacks;
}

/** Replaces the switched-off set; listeners run only when it really changed. */
export function setDisabledArtPacks(ids: readonly string[]): void {
  const next = new Set(ids);
  const unchanged =
    next.size === disabledArtPacks.size && [...next].every((id) => disabledArtPacks.has(id));
  if (unchanged) return;
  disabledArtPacks = next;
  artPackVersion += 1;
  for (const listener of [...artPackListeners]) listener();
}

/** Changes whenever the switched-off set changes; the card art index rebuilds on it. */
export function getArtPackVersion(): number {
  return artPackVersion;
}

/** `useSyncExternalStore` subscription for components that show art pack images. */
export function subscribeArtPacks(listener: () => void): () => void {
  artPackListeners.add(listener);
  return () => {
    artPackListeners.delete(listener);
  };
}
