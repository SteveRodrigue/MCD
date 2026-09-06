import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SupplementalPackSchema,
  CardEnrichmentSchema,
  CardAbilitySchema,
  AbilityCostSchema,
  CardUsesSchema,
  CardAuditRecordSchema,
  EffectTypeSchema,
  AbilityStepSchema,
} from '../../src/data/supplemental/schema';
import { detectDuplicateJsonKeys } from '../../src/data/supplemental/duplicate-key-detector';
import { generateSupplementalSchema } from '../../tools/generate-supplemental-schema';

describe('Supplemental Data Schema Validation (CI/CD Quality Gate)', () => {
  const packDir = path.resolve('src/data/supplemental/pack');
  const packFiles = fs.readdirSync(packDir).filter((f) => f.endsWith('.json'));

  it('Discovers supplemental pack files in src/data/supplemental/pack/', () => {
    expect(packFiles.length).toBeGreaterThan(0);
  });

  for (const file of packFiles) {
    it(`Validates ${file} against SupplementalPackSchema and enforces zero duplicate JSON keys`, () => {
      const filePath = path.join(packDir, file);
      const rawContent = fs.readFileSync(filePath, 'utf8');

      // 1. Raw JSON duplicate key check
      const duplicateKeys = detectDuplicateJsonKeys(rawContent);
      if (duplicateKeys.length > 0) {
        console.error(`Duplicate keys found in ${file}:`, duplicateKeys);
      }
      expect(
        duplicateKeys,
        `Found duplicate keys in ${file}: ${JSON.stringify(duplicateKeys)}`,
      ).toEqual([]);

      // 2. Schema parse & validation
      const json = JSON.parse(rawContent);
      const result = SupplementalPackSchema.safeParse(json);
      if (!result.success) {
        console.error(`Validation failure in ${file}:`, JSON.stringify(result.error.issues, null, 2));
      }
      expect(result.success).toBe(true);
    });
  }

  describe('Negative & Boundary Validation Tests', () => {
    it('Rejects invalid ISO timestamp in audit', () => {
      const invalidAudit = {
        createdAt: 'invalid-date',
        updatedAt: '2026-08-30T15:00',
        reviewedAt: '2026-08-30T15:00',
        reviewedBy: 'antigravity',
        rulesVersion: 'v1.8',
        confidence: 98,
        reconstructedText: 'test',
      };
      const res = CardAuditRecordSchema.safeParse(invalidAudit);
      expect(res.success).toBe(false);
    });

    it('Rejects confidence rating outside 0-100', () => {
      const invalidAudit = {
        createdAt: '2026-08-30T15:00',
        updatedAt: '2026-08-30T15:00',
        reviewedAt: '2026-08-30T15:00',
        reviewedBy: 'antigravity',
        rulesVersion: 'v1.8',
        confidence: 150,
        reconstructedText: 'test',
      };
      const res = CardAuditRecordSchema.safeParse(invalidAudit);
      expect(res.success).toBe(false);
    });

    it('Rejects card ability with illegal timing', () => {
      const invalidCard = {
        comment: 'Test card',
        abilities: [
          {
            id: 'bad_ability',
            timing: 'ILLEGAL_TIMING_KEY',
            steps: [{ effect: 'DEAL_DAMAGE' }],
          },
        ],
      };
      const res = CardEnrichmentSchema.safeParse(invalidCard);
      expect(res.success).toBe(false);
    });

    it('Rejects card ability missing steps or having empty steps array', () => {
      const missingSteps = {
        comment: 'Test card missing steps',
        abilities: [
          {
            id: 'missing_steps_ability',
            timing: 'ACTION',
          },
        ],
      };
      const emptySteps = {
        comment: 'Test card empty steps',
        abilities: [
          {
            id: 'empty_steps_ability',
            timing: 'ACTION',
            steps: [],
          },
        ],
      };
      expect(CardEnrichmentSchema.safeParse(missingSteps).success).toBe(false);
      expect(CardEnrichmentSchema.safeParse(emptySteps).success).toBe(false);
    });

    it('Accepts valid card ability with steps array', () => {
      const validCard = {
        comment: 'Valid card with steps',
        abilities: [
          {
            id: 'valid_ability',
            timing: 'ACTION',
            steps: [
              {
                id: 'step_1',
                effect: 'DEAL_DAMAGE',
                params: { amount: 3 },
                gate: 'ALWAYS',
              },
            ],
          },
        ],
      };
      expect(CardEnrichmentSchema.safeParse(validCard).success).toBe(true);
    });

    it('Enforces that no card marked noSupplementalNeeded has active rules text in upstream data', () => {
      const upstreamDir = path.resolve('data/upstream/pack');
      const upstreamCards = new Map<string, any>();
      if (fs.existsSync(upstreamDir)) {
        for (const file of fs.readdirSync(upstreamDir).filter((f) => f.endsWith('.json'))) {
          const list = JSON.parse(fs.readFileSync(path.join(upstreamDir, file), 'utf8'));
          if (Array.isArray(list)) {
            for (const c of list) {
              if (c && c.code) upstreamCards.set(c.code, c);
            }
          }
        }
      }

      for (const file of packFiles) {
        const filePath = path.join(packDir, file);
        const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cards = json.cards || json;

        for (const [code, entry] of Object.entries(cards) as [string, any][]) {
          if (entry.noSupplementalNeeded) {
            const upstream = upstreamCards.get(code);
            if (upstream && upstream.text) {
              const stripped = upstream.text
                .replace(/<i>.*?<\/i>/gis, '')
                .replace(/<b>Contents<\/b>:.*?Setup:.*$/gis, '')
                .replace(/<b>If this stage is completed, the players lose the game\.<\/b>/gis, '')
                .replace(/Hazard icon/gis, '')
                .replace(/Acceleration icon/gis, '')
                .replace(/Crisis icon/gis, '')
                .replace(/Boost icon/gis, '')
                .trim();

              const hasActiveTrigger = [
                /\bWhen Revealed\b/i,
                /\bWhen Defeated\b/i,
                /\bAction\b/i,
                /\bInterrupt\b/i,
                /\bResponse\b/i,
                /\bSpecial\b/i,
                /\bBoost\b/i,
                /\[star\]/i,
                /\bForced\b/i,
              ].some((p) => p.test(stripped));

              expect(
                hasActiveTrigger,
                `Card ${code} (${upstream.name}) has active rules text but is marked noSupplementalNeeded: true`,
              ).toBe(false);
            }
          }
        }
      }
    });

    it('Correctly identifies duplicate keys in raw JSON with line numbers', () => {
      const sampleWithDuplicates = `{\n  "cards": {\n    "001": { "name": "Card 1" },\n    "001": { "name": "Duplicate 1" }\n  }\n}`;
      const dups = detectDuplicateJsonKeys(sampleWithDuplicates);
      expect(dups.length).toBe(1);
      expect(dups[0].key).toBe('001');
      expect(dups[0].firstSeenLine).toBe(3);
      expect(dups[0].line).toBe(4);
    });

    it('Accepts valid CardAuditRecord with originalText and reconstructedText', () => {
      const validAudit = {
        createdAt: '2026-08-30T15:00',
        updatedAt: '2026-08-30T15:00',
        reviewedAt: '2026-08-30T15:00',
        reviewedBy: 'antigravity',
        rulesVersion: 'v1.8',
        confidence: 98,
        originalText: 'Spider-Sense — Interrupt: When the villain initiates an attack against you, draw 1 card.',
        reconstructedText: 'INTERRUPT (ATTACK) -> DRAW_CARDS (count: 1)',
      };
      const res = CardAuditRecordSchema.safeParse(validAudit);
      expect(res.success).toBe(true);
    });

    it('Verifies that all audited cards across supplemental pack files include originalText', () => {
      for (const file of packFiles) {
        const filePath = path.join(packDir, file);
        const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cards = json.cards || json;

        for (const [code, card] of Object.entries(cards) as [string, any][]) {
          if (card.audit && card.audit.confidence >= 95) {
            expect(
              card.audit.originalText !== undefined,
              `Card ${code} in ${file} is missing originalText in audit metadata`,
            ).toBe(true);
          }
        }
      }
    });

    it('Rejects speculative or unhandled effect names in AbilityStepSchema', () => {
      const invalidStep = {
        effect: 'UNIMPLEMENTED_SPECULATIVE_EFFECT',
        params: {},
      };
      const result = AbilityStepSchema.safeParse(invalidStep);
      expect(result.success).toBe(false);
    });

    it('Accepts valid codebase-grounded effect names in AbilityStepSchema', () => {
      const validStep = {
        effect: 'DEAL_DAMAGE',
        params: { amount: 3, target: 'VILLAIN' },
      };
      const result = AbilityStepSchema.safeParse(validStep);
      expect(result.success).toBe(true);
    });

    it('Rejects obsolete fragmented discard primitives in AbilityStepSchema', () => {
      const obsoleteEffects = [
        'DISCARD_ATTACHMENT',
        'DISCARD_CARDS_FROM_HAND_AT_RANDOM',
        'DISCARD_CARDS_UNDER_HOST',
        'DISCARD_ENCOUNTER_DECK',
        'DISCARD_RANDOM_HAND',
        'DISCARD_SELF',
        'DISCARD_TOP_DECK_FILTER',
        'DISCARD_UPGRADE_OR_SUPPORT',
        'DISCARD_UPGRADE_OR_SUPPORT_OR_SURGE',
      ];

      for (const effect of obsoleteEffects) {
        expect(
          AbilityStepSchema.safeParse({ effect, params: {} }).success,
          `Expected ${effect} to be rejected by AbilityStepSchema`,
        ).toBe(false);
      }
    });

    it('Rejects obsolete SCRY_AND_SELECT_TRAIT and RESOLVE_SCRY_SELECTION in AbilityStepSchema (Issue #78)', () => {
      const obsoleteEffects = ['SCRY_AND_SELECT_TRAIT', 'RESOLVE_SCRY_SELECTION'];

      for (const effect of obsoleteEffects) {
        expect(
          AbilityStepSchema.safeParse({ effect, params: {} }).success,
          `Expected ${effect} to be rejected by AbilityStepSchema`,
        ).toBe(false);
      }
    });

    it('Accepts canonical SEARCH_AND_SELECT primitive in AbilityStepSchema', () => {
      expect(
        AbilityStepSchema.safeParse({
          effect: 'SEARCH_AND_SELECT',
          params: {
            source: 'PLAYER_DECK',
            lookCount: 3,
            takeCount: 1,
            filter: { trait: 'Tech' },
            selectedDestination: 'HAND',
            unselectedDestination: 'DISCARD',
          },
        }).success,
      ).toBe(true);
    });

    it('Accepts canonical DISCARD primitive in AbilityStepSchema', () => {
      expect(
        AbilityStepSchema.safeParse({
          effect: 'DISCARD',
          params: {
            source: 'TABLEAU',
            filter: { cardTypes: ['upgrade', 'support'] },
            fallback: 'SURGE',
          },
        }).success,
      ).toBe(true);

      expect(
        AbilityStepSchema.safeParse({
          effect: 'DISCARD',
          params: {
            source: 'HAND',
            mode: 'RANDOM',
            count: 2,
          },
        }).success,
      ).toBe(true);
    });

    it('Verifies that schema.json exists and is synchronized with SupplementalPackSchema', () => {
      const schemaJsonPath = path.resolve('src/data/supplemental/schema.json');
      expect(fs.existsSync(schemaJsonPath), 'schema.json should exist').toBe(true);

      const diskSchema = JSON.parse(fs.readFileSync(schemaJsonPath, 'utf8'));
      const generatedSchema = generateSupplementalSchema();

      expect(diskSchema).toEqual(generatedSchema);
    });

    it('Verifies that all declared effects in supplemental pack files belong to EffectTypeSchema', () => {
      const allowedEffects = new Set(EffectTypeSchema.options);

      for (const file of packFiles) {
        const filePath = path.join(packDir, file);
        const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cards = json.cards || json;

        for (const [code, card] of Object.entries(cards) as [string, any][]) {
          for (const ability of card.abilities || []) {
            for (const step of ability.steps || []) {
              expect(
                allowedEffects.has(step.effect),
                `Card ${code} in ${file} uses ungrounded effect primitive '${step.effect}'`,
              ).toBe(true);
            }
          }
        }
      }
    });

    it('Accepts valid card uses declaration in CardEnrichmentSchema', () => {
      const cardWithUses = {
        comment: 'Web-Shooter',
        uses: {
          count: 3,
          type: 'web',
          discardOnEmpty: true,
        },
        abilities: [
          {
            id: 'web_shooter_resource',
            timing: 'RESOURCE',
            steps: [{ effect: 'GENERATE_RESOURCE', params: { resource: 'wild', amount: 1 } }],
          },
        ],
      };
      const res = CardEnrichmentSchema.safeParse(cardWithUses);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.uses?.count).toBe(3);
        expect(res.data.uses?.type).toBe('web');
        expect(res.data.uses?.discardOnEmpty).toBe(true);
      }
    });

    it('Rejects invalid card uses with negative or non-integer count', () => {
      const invalidUses = {
        count: -1,
        type: 'web',
      };
      const res = CardUsesSchema.safeParse(invalidUses);
      expect(res.success).toBe(false);
    });

    it('Rejects unknown/undeclared properties in CardEnrichmentSchema (.strict() enforcement)', () => {
      const cardWithUnknownKey = {
        comment: 'Invalid key card',
        unknownCustomKey: 'some_value',
      };
      const res = CardEnrichmentSchema.safeParse(cardWithUnknownKey);
      expect(res.success).toBe(false);
    });

    it('Rejects unknown/undeclared properties in CardAbilitySchema (.strict() enforcement)', () => {
      const abilityWithUnknownKey = {
        id: 'test_ability',
        timing: 'ACTION',
        steps: [{ effect: 'DEAL_DAMAGE', params: { amount: 1 } }],
        unsupportedTag: true,
      };
      const res = CardAbilitySchema.safeParse(abilityWithUnknownKey);
      expect(res.success).toBe(false);
    });

    it('Accepts valid zone in CardAbilitySchema', () => {
      const validHandAbility = {
        id: 'backflip',
        timing: 'INTERRUPT',
        trigger: 'TAKE_ATTACK_DAMAGE',
        zone: 'HAND',
        steps: [{ effect: 'PREVENT_DAMAGE', params: { amount: 'ALL' } }],
      };
      const res = CardAbilitySchema.safeParse(validHandAbility);
      expect(res.success).toBe(true);
    });

    it('Accepts valid attackCost, thwartCost, and isLandscape in CardEnrichmentSchema', () => {
      const allyEnrichment = {
        comment: 'Black Cat takes 0 consequential damage',
        attackCost: 0,
        thwartCost: 1,
        isLandscape: false,
      };
      const res = CardEnrichmentSchema.safeParse(allyEnrichment);
      expect(res.success).toBe(true);
    });

    it('Rejects unknown/undeclared properties in AbilityCostSchema (.strict() enforcement)', () => {
      const costWithUnknownKey = {
        exhaustSelf: true,
        takeDamage: 1,
      };
      const res = AbilityCostSchema.safeParse(costWithUnknownKey);
      expect(res.success).toBe(false);
    });

    it('Accepts valid damageHero, discardCard, and spendCounters in AbilityCostSchema', () => {
      const validCost = {
        exhaustSelf: true,
        damageHero: 1,
        discardCard: {
          from: 'HAND' as const,
          count: 1,
        },
      };
      const res = AbilityCostSchema.safeParse(validCost);
      expect(res.success).toBe(true);
    });

    it('Verifies that no unrecognized properties exist across any supplemental pack file', () => {
      const schemaJsonPath = path.resolve('src/data/supplemental/schema.json');
      const schemaJson = JSON.parse(fs.readFileSync(schemaJsonPath, 'utf8'));

      const cardProps = new Set(
        Object.keys(schemaJson.properties.cards.additionalProperties.properties || {}),
      );
      const abilityProps = new Set(
        Object.keys(
          schemaJson.properties.cards.additionalProperties.properties.abilities.items.properties ||
            {},
        ),
      );
      const costProps = new Set(
        Object.keys(
          schemaJson.properties.cards.additionalProperties.properties.abilities.items.properties.cost
            .properties || {},
        ),
      );
      const auditProps = new Set(
        Object.keys(schemaJson.properties.cards.additionalProperties.properties.audit.properties || {}),
      );
      const usesProps = new Set(
        Object.keys(schemaJson.properties.cards.additionalProperties.properties.uses.properties || {}),
      );
      const stepProps = new Set(
        Object.keys(
          schemaJson.properties.cards.additionalProperties.properties.abilities.items.properties
            .steps.items.properties || {},
        ),
      );

      const undeclared = [];

      for (const file of packFiles) {
        const filePath = path.join(packDir, file);
        const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cards = json.cards || json;

        for (const [code, card] of Object.entries(cards) as [string, any][]) {
          if (!card || typeof card !== 'object') continue;

          for (const key of Object.keys(card)) {
            if (key.startsWith('$')) continue;
            if (!cardProps.has(key)) {
              undeclared.push(`${file}:${code} (CardEnrichment) -> '${key}'`);
            }
          }

          if (card.uses && typeof card.uses === 'object') {
            for (const key of Object.keys(card.uses)) {
              if (!usesProps.has(key)) {
                undeclared.push(`${file}:${code} (CardUses) -> '${key}'`);
              }
            }
          }

          if (card.audit && typeof card.audit === 'object') {
            for (const key of Object.keys(card.audit)) {
              if (!auditProps.has(key)) {
                undeclared.push(`${file}:${code} (CardAuditRecord) -> '${key}'`);
              }
            }
          }

          if (Array.isArray(card.abilities)) {
            card.abilities.forEach((ab: any, abIdx: number) => {
              for (const key of Object.keys(ab)) {
                if (!abilityProps.has(key)) {
                  undeclared.push(`${file}:${code} (CardAbility ${ab.id || abIdx}) -> '${key}'`);
                }
              }

              if (ab.cost && typeof ab.cost === 'object') {
                for (const key of Object.keys(ab.cost)) {
                  if (!costProps.has(key)) {
                    undeclared.push(
                      `${file}:${code} (AbilityCost ${ab.id || abIdx}) -> '${key}'`,
                    );
                  }
                }
              }

              if (Array.isArray(ab.steps)) {
                ab.steps.forEach((st: any, stIdx: number) => {
                  for (const key of Object.keys(st)) {
                    if (!stepProps.has(key)) {
                      undeclared.push(
                        `${file}:${code} (AbilityStep ${ab.id || abIdx}:${stIdx}) -> '${key}'`,
                      );
                    }
                  }
                });
              }
            });
          }
        }
      }

      expect(
        undeclared,
        `Found undeclared properties in supplemental pack files:\n${undeclared.join('\n')}`,
      ).toEqual([]);
    });

    it('Rejects obsolete counter and token cost fields in AbilityCostSchema', () => {
      // Rejects spendTokens
      expect(AbilityCostSchema.safeParse({ spendTokens: { type: 'counter', count: 1 } }).success).toBe(false);
      // Rejects removeCounter
      expect(AbilityCostSchema.safeParse({ removeCounter: 1 }).success).toBe(false);
      // Rejects spendCounter
      expect(AbilityCostSchema.safeParse({ spendCounter: 1 }).success).toBe(false);
    });

    it('Accepts canonical spendCounters in AbilityCostSchema', () => {
      expect(
        AbilityCostSchema.safeParse({
          spendCounters: {
            counterType: 'web',
            amount: 1,
            target: 'SELF',
          },
        }).success,
      ).toBe(true);

      expect(
        AbilityCostSchema.safeParse({
          spendCounters: {
            amount: 2,
          },
        }).success,
      ).toBe(true);
    });

    it('Correctly passes on JSON with non-duplicate nested keys', () => {
      const sampleValid = `{\n  "card1": { "id": "1", "name": "A" },\n  "card2": { "id": "2", "name": "B" }\n}`;
      const dups = detectDuplicateJsonKeys(sampleValid);
      expect(dups).toEqual([]);
    });
  });
});
