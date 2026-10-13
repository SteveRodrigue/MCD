import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardAbilitySchema } from '../../src/data/supplemental/schema';
import { CardSupplementalService } from '../../src/tools/editor/api-middleware';

describe('Event Discard Invariant (Issue #271 / RR v1.8 Event)', () => {
  it('enforces that no event card in any supplemental pack declares cost.discardSelf', () => {
    const packDir = path.resolve('src/data/supplemental/pack');
    const packFiles = fs.readdirSync(packDir).filter((f) => f.endsWith('.json'));
    const violations: string[] = [];

    for (const file of packFiles) {
      const filePath = path.join(packDir, file);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!content.cards) continue;

      for (const [code, supp] of Object.entries<any>(content.cards)) {
        const upstream = cardCatalog.getCard(code);
        if (upstream?.type === 'event' || (upstream as any)?.type_code === 'event') {
          for (const ability of supp.abilities || []) {
            if (ability.cost?.discardSelf) {
              violations.push(
                `${file} event card ${code} (${upstream?.name || code}) declares illegal cost.discardSelf in ability '${ability.id}'`,
              );
            }
          }
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

  it('rejects saving an event card with cost.discardSelf in CardSupplementalService.saveCardSupplemental', () => {
    const service = new CardSupplementalService();
    // 01003 is Backflip (type_code: event)
    const res = service.saveCardSupplemental('01003', {
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

    expect(res.success).toBe(false);
    expect(res.error).toContain("Event cards cannot declare 'cost.discardSelf'");
  });
});

