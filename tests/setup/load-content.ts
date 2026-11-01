import path from 'node:path';
import { bootContent } from '../../src/data/content/apply';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';

// Fills the engine singletons (card catalog, supplemental registry, modular sets, starter decks)
// through the content loader, before the catalog is frozen and before any test runs.
const content = await bootContent(new NodeFsDriver(path.resolve(__dirname, '../../content')));

// A pack that fails to load is disabled, never thrown (so the app keeps running); a test run
// should stop and say why instead of running against an empty catalog.
if (content.failures.length > 0) {
  const reasons = content.failures.map((f) => `${f.packId}: ${f.reason}`).join('\n');
  throw new Error(`Content failed to load:\n${reasons}`);
}
