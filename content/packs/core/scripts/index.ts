import type { PackHooks } from '@engine/plugin-api';
import { ultronScenarioHooks } from './scenarios/ultron';
import { wakandaForeverSpecialHandler } from './wakanda-forever';

/** Code the Core pack needs beyond its JSON data (ADR-0092): found through the generated hook map. */
const hooks: PackHooks = {
  specialHandlers: [wakandaForeverSpecialHandler],
  scenarioHooks: { ultron: ultronScenarioHooks },
};

export default hooks;
