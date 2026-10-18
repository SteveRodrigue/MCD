import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION, GamePhase } from '../src/engine';
import packageJson from '../package.json';

describe('Engine Smoke Test', () => {
  it('exports valid engine version and game phase enums', () => {
    expect(ENGINE_VERSION).toBe(packageJson.version);
    expect(GamePhase.PLAYER_PHASE).toBe('PLAYER_PHASE');
    expect(GamePhase.VILLAIN_PHASE).toBe('VILLAIN_PHASE');
  });
});
