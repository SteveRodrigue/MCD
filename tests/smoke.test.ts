import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION, GamePhase } from '../src/engine';

describe('Engine Smoke Test', () => {
  it('exports valid engine version and game phase enums', () => {
    expect(ENGINE_VERSION).toBe('0.1.0');
    expect(GamePhase.PLAYER_PHASE).toBe('PLAYER_PHASE');
    expect(GamePhase.VILLAIN_PHASE).toBe('VILLAIN_PHASE');
  });
});
