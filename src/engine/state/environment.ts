import { CardInstance, GameState } from '../models';
import { appendLog } from './game-log';

/**
 * Puts an environment card into play in the villain's play area (RR v1.8 glossary "Environment").
 * Like any card put into play, it stays until a card or scenario effect moves it. Used when an
 * environment is revealed and when a search or setup effect puts one into play.
 */
export function putEnvironmentIntoPlay(state: GameState, instance: CardInstance): void {
  state.environments.push(instance);
  appendLog(state, {
    category: 'phase',
    key: 'environment.entersPlay',
    params: { card: instance.card.name },
    onomatopoeia: 'ENVIRONMENT!',
  });
}
