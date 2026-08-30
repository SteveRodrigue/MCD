import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SupplementalPackSchema,
  CardEnrichmentSchema,
  CardAuditRecordSchema,
} from '../../src/data/supplemental/schema';

describe('Supplemental Data Schema Validation (CI/CD Quality Gate)', () => {
  const packDir = path.resolve('src/data/supplemental/pack');
  const packFiles = fs.readdirSync(packDir).filter((f) => f.endsWith('.json'));

  it('Discovers supplemental pack files in src/data/supplemental/pack/', () => {
    expect(packFiles.length).toBeGreaterThan(0);
  });

  for (const file of packFiles) {
    it(`Validates ${file} against SupplementalPackSchema`, () => {
      const filePath = path.join(packDir, file);
      const rawContent = fs.readFileSync(filePath, 'utf8');
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
          },
        ],
      };
      const res = CardEnrichmentSchema.safeParse(invalidCard);
      expect(res.success).toBe(false);
    });
  });
});
