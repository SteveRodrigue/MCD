import path from 'node:path';
import type { TestProject } from 'vitest/node';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';
import { loadContent } from '../../src/data/content/loader';
import type { LoadedContent } from '../../src/data/content/types';

declare module 'vitest' {
  export interface ProvidedContext {
    loadedContent: LoadedContent;
  }
}

/**
 * Reads and validates the packs enabled in content/config.json once per run, instead of once per
 * test file; `load-content.ts` applies the result in every file.
 */
export default async function setup(project: TestProject): Promise<void> {
  const content = await loadContent(new NodeFsDriver(path.resolve(__dirname, '../../content')));

  // A pack that fails to load is disabled, never thrown (so the app keeps running); a test run
  // should stop and say why instead of running against an empty catalog.
  if (content.failures.length > 0) {
    const reasons = content.failures.map((f) => `${f.packId}: ${f.reason}`).join('\n');
    throw new Error(`Content failed to load:\n${reasons}`);
  }
  project.provide('loadedContent', content);
}
