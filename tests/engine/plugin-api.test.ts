import { describe, it, expect } from 'vitest';
import { PACK_API_VERSION, type PackHooks } from '../../src/engine/plugin-api';
import { PACK_API_VERSION as MANIFEST_API_VERSION } from '../../src/data/packs/pack-manifest';
import { getSpecialHandler } from '../../src/engine/specials/special-registry';
import { packHooks } from '../../src/data/content/pack-hooks.generated';

describe('plugin-api hook contract', () => {
  it('accepts a special handler and scenario hooks as pack hooks', () => {
    const handler = getSpecialHandler('WAKANDA_FOREVER');
    expect(handler).toBeDefined();
    const hooks: PackHooks = {
      scenarioHooks: { ultron: packHooks.core.scenarioHooks!.ultron },
      specialHandlers: handler ? [handler] : [],
    };
    expect(typeof hooks.scenarioHooks?.ultron.resolveStage1BReveal).toBe('function');
    expect(hooks.specialHandlers?.[0].id).toBe('WAKANDA_FOREVER');
  });

  it('exposes one API version shared with the manifest', () => {
    expect(PACK_API_VERSION).toBe(MANIFEST_API_VERSION);
  });
});
