import type { PackHooks } from '@engine/plugin-api';
import { ultronDroneSpecialHandler } from './scenarios/ultron';
import { wakandaForeverSpecialHandler } from './wakanda-forever';

/** Code the Core pack needs beyond its JSON data (ADR-0092): found through the generated hook map. */
const hooks: PackHooks = {
  specialHandlers: [wakandaForeverSpecialHandler, ultronDroneSpecialHandler],
};

export default hooks;
