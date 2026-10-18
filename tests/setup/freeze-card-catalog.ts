import { cardCatalog } from '../../src/data/importer/card-loader';

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
}

for (const card of cardCatalog.getAllCards()) deepFreeze(card);
