/**
 * Marvel Champions Digital - Core Game Engine
 * 100% Headless, deterministic, and test-driven.
 */

export const ENGINE_VERSION = '0.1.0';

export interface GameEngineState {
  version: string;
  initialized: boolean;
}

export function createInitialState(): GameEngineState {
  return {
    version: ENGINE_VERSION,
    initialized: true,
  };
}
