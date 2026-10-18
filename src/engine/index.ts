/**
 * Marvel Champions Digital - Core Game Engine
 * 100% Headless, deterministic, data-driven, and test-driven.
 */

export { version as ENGINE_VERSION } from '../../package.json';

export * from './models';
export * from './state';
export * from './effects';
export * from './triggers';
export * from './pipeline';
export * from './simulation';
export * from './scenarios';
export * from './decks';
export * from './errors/infinite-loop-error';
export * from './queries/card-inspector';
