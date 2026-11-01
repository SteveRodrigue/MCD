import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  CardAbilitySchema,
  findEventDiscardSelfViolations,
} from '../../src/data/supplemental/schema';
import { prepareSave } from '../../src/data/content/editor-model';
import { getLoadedContent } from '../../src/data/content/store';
import { validateCardInput } from '../../scripts/validate-card';
import { supplementalFileNames, supplementalPath } from '../../src/tools/content-paths';

describe('Event Discard Invariant (Issue #271 / RR v1.8 Event)', () => {
  describe('findEventDiscardSelfViolations helper', () => {
    it('returns an error when an event card declares cost.discardSelf', () => {
      const violation = findEventDiscardSelfViolations('event', {
        abilities: [
          {
            id: 'test_event_ability',
            cost: { discardSelf: true },
          },
        ],
      });
      expect(violation).toBe(
        "Event cards cannot declare 'cost.discardSelf'; events discard intrinsically per RR v1.8 Event",
      );
    });

    it('returns null when an event card does not declare cost.discardSelf', () => {
      const violation = findEventDiscardSelfViolations('event', {
        abilities: [
          {
            id: 'test_event_ability',
            cost: { discardSelf: false },
          },
        ],
      });
      expect(violation).toBeNull();
    });

    it('returns null for non-event cards even if cost.discardSelf is present', () => {
      const violation = findEventDiscardSelfViolations('upgrade', {
        abilities: [
          {
            id: 'test_upgrade_ability',
            cost: { discardSelf: true },
          },
        ],
      });
      expect(violation).toBeNull();
    });

    it('returns null when cardTypeCode or enrichment is missing/undefined', () => {
      expect(findEventDiscardSelfViolations(undefined, { abilities: [{ cost: { discardSelf: true } }] })).toBeNull();
      expect(findEventDiscardSelfViolations('event', undefined)).toBeNull();
      expect(findEventDiscardSelfViolations('event', { abilities: [] })).toBeNull();
    });
  });

  it('enforces that no event card in any supplemental pack declares cost.discardSelf', () => {
    const packFiles = supplementalFileNames();
    const violations: string[] = [];

    for (const file of packFiles) {
      const filePath = supplementalPath(file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!content.cards) continue;

      for (const [code, supp] of Object.entries<any>(content.cards)) {
        const upstream = cardCatalog.getCard(code);
        const cardTypeCode = (upstream as any)?.type_code || upstream?.type;
        const violation = findEventDiscardSelfViolations(cardTypeCode, supp);
        if (violation) {
          violations.push(
            `${file} event card ${code} (${upstream?.name || code}) declares illegal cost.discardSelf: ${violation}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('rejects an ability in zone HAND declaring cost.discardSelf via CardAbilitySchema', () => {
    const invalidHandAbility = {
      id: 'test_hand_ability',
      timing: 'INTERRUPT',
      trigger: 'DAMAGE_WOULD_BE_TAKEN',
      zone: 'HAND',
      cost: {
        discardSelf: true,
      },
      steps: [
        {
          effect: 'PREVENT_DAMAGE',
          effectParams: { amount: 1 },
        },
      ],
    };

    const res = CardAbilitySchema.safeParse(invalidHandAbility);
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path.includes('discardSelf'));
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("Abilities in zone 'HAND' cannot declare 'cost.discardSelf'");
    }
  });

  it('rejects saving an event card with cost.discardSelf in prepareSave', () => {
    // 01003 is Backflip (type_code: event)
    const res = prepareSave(getLoadedContent(), '01003', {
      supplemental: {
        abilities: [
          {
            id: 'backflip',
            timing: 'INTERRUPT',
            trigger: 'DAMAGE_WOULD_BE_TAKEN',
            zone: 'HAND',
            cost: {
              discardSelf: true,
            },
            steps: [{ effect: 'PREVENT_DAMAGE' }],
          },
        ],
      },
    });

    expect(res.ok).toBe(false);
    expect(!res.ok && res.error).toContain("Event cards cannot declare 'cost.discardSelf'");
  });

  it('rejects validating an event card with cost.discardSelf via validateCardInput', () => {
    const payload = JSON.stringify({
      abilities: [
        {
          id: 'test_event',
          timing: 'ACTION',
          cost: {
            discardSelf: true,
          },
          steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 2 } }],
        },
      ],
    });

    const res = validateCardInput(payload, 'event');
    expect(res.valid).toBe(false);
    expect(res.errors?.some((e) => e.message.includes("Event cards cannot declare 'cost.discardSelf'"))).toBe(true);
  });

  it('resolves the card type from a supp_<code> file name and rejects event discardSelf', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-validate-'));
    try {
      const file = path.join(dir, 'supp_01003.json');
      fs.writeFileSync(
        file,
        JSON.stringify({
          abilities: [
            {
              id: 'backflip',
              timing: 'INTERRUPT',
              trigger: 'DAMAGE_WOULD_BE_TAKEN',
              cost: { discardSelf: true },
              steps: [{ effect: 'PREVENT_DAMAGE' }],
            },
          ],
        }),
      );
      const res = validateCardInput(file);
      expect(res.valid).toBe(false);
      expect(res.errors?.some((e) => e.path === 'cost.discardSelf')).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails instead of silently passing when the card type cannot be resolved', () => {
    const res = validateCardInput(JSON.stringify({ abilities: [] }));
    expect(res.valid).toBe(false);
    expect(res.errors?.some((e) => e.path === 'type' && e.message.includes('Card type unresolved'))).toBe(true);
  });
});
