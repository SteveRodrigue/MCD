import path from 'node:path';
import { bootContent } from '../../src/data/content/apply';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';

// Fills the engine singletons (card catalog, supplemental registry, modular sets, starter decks)
// through the content loader, before the catalog is frozen and before any test runs.
await bootContent(new NodeFsDriver(path.resolve(__dirname, '../../content')));
