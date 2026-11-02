import { describe, expect, it } from 'vitest';
import {
  CARD_TYPE_VALUES,
  KEYWORD_VALUES,
  RESOURCE_TYPE_VALUES,
} from '../../../src/engine/models/enum-values';
import { CardType, Keyword, ResourceType } from '../../../src/engine/models/enums';

describe('enum-values', () => {
  it('lists the same values as the enums', () => {
    expect([...CARD_TYPE_VALUES]).toEqual(Object.values(CardType));
    expect([...RESOURCE_TYPE_VALUES]).toEqual(Object.values(ResourceType));
    expect([...KEYWORD_VALUES]).toEqual(Object.values(Keyword));
  });
});
