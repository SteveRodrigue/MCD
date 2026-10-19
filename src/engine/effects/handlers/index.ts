import type { StepHandlerMap } from './types';
import { DAMAGE_HANDLERS } from './damage';
import { CARDS_HANDLERS } from './cards';
import { ENCOUNTER_HANDLERS } from './encounter';
import { COMBAT_HANDLERS } from './combat';
import { STATE_HANDLERS } from './state';
import { RESOURCES_HANDLERS } from './resources';
import { CHOICE_HANDLERS } from './choice';

/** One handler per effect; `satisfies` fails the build when an effect has none. */
export const EFFECT_HANDLERS = {
  ...DAMAGE_HANDLERS,
  ...CARDS_HANDLERS,
  ...ENCOUNTER_HANDLERS,
  ...COMBAT_HANDLERS,
  ...STATE_HANDLERS,
  ...RESOURCES_HANDLERS,
  ...CHOICE_HANDLERS,
} satisfies StepHandlerMap;
