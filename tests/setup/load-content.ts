import { inject } from 'vitest';
import { applyContent } from '../../src/data/content/apply';

// Fills the engine singletons (card catalog, supplemental registry, modular sets, starter decks)
// from the content `global-content.ts` loaded once, before the catalog is frozen and before any
// test runs. A copy, so a test that changes loaded content never reaches the next file.
applyContent(structuredClone(inject('loadedContent')));
