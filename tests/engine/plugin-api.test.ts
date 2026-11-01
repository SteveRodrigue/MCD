import { describe, it, expect } from 'vitest';
import { PACK_API_VERSION, type PackHooks } from '../../src/engine/plugin-api';
import { PACK_API_VERSION as MANIFEST_API_VERSION } from '../../src/data/packs/pack-manifest';
import { rhinoPlugin } from '../../src/engine/scenarios';
import { getSpecialHandler } from '../../src/engine/specials/special-registry';
import '../../src/engine/specials/wakanda-forever';

describe('plugin-api hook contract', () => {
  it('accepts the existing scenario plugin and special handler as pack hooks', () => {
    const handler = getSpecialHandler('WAKANDA_FOREVER');
    expect(handler).toBeDefined();
    const hooks: PackHooks = {
      scenarioPlugins: [rhinoPlugin],
      specialHandlers: handler ? [handler] : [],
    };
    expect(hooks.scenarioPlugins?.[0].definition.id).toBe('rhino');
    expect(hooks.specialHandlers?.[0].id).toBe('WAKANDA_FOREVER');
  });

  it('exposes one API version shared with the manifest', () => {
    expect(PACK_API_VERSION).toBe(MANIFEST_API_VERSION);
  });
});
