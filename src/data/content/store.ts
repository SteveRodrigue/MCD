import type { LoadedContent } from './types.ts';

const EMPTY: LoadedContent = { packs: [], failures: [], descriptions: [] };
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
