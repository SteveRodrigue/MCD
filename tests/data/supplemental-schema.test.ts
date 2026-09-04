import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SupplementalPackSchema,
  CardEnrichmentSchema,
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

    it('Correctly passes on JSON with non-duplicate nested keys', () => {
      const sampleValid = `{\n  "card1": { "id": "1", "name": "A" },\n  "card2": { "id": "2", "name": "B" }\n}`;
      const dups = detectDuplicateJsonKeys(sampleValid);
      expect(dups).toEqual([]);
    });
  });
});
