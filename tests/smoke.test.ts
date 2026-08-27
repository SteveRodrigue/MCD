import { describe, it, expect } from 'vitest';
import { createInitialState, ENGINE_VERSION } from '../src/engine';

describe('Engine Smoke Test', () => {
  it('initializes the engine state with valid version', () => {
    const state = createInitialState();
    expect(state.initialized).toBe(true);
    expect(state.version).toBe(ENGINE_VERSION);
  });
});
