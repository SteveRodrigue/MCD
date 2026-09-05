import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  CardSupplementalService,
  createCardSupplementalMiddleware,
} from '../../src/tools/editor/api-middleware';

describe('CardSupplementalService & Editor API Middleware', () => {
  let service: CardSupplementalService;

  beforeEach(() => {
    service = new CardSupplementalService(process.cwd());
  });

  describe('Metadata Discovery', () => {
    it('returns packs, sets, factions, and packFiles', () => {
      const meta = service.getPacksMetadata();
      expect(meta.packs.length).toBeGreaterThan(0);
      expect(meta.sets.length).toBeGreaterThan(0);
      expect(meta.factions.length).toBeGreaterThan(0);
      expect(meta.packFiles).toContain('core.json');
      expect(meta.packFiles).toContain('core_encounter.json');

      const corePack = meta.packs.find((p) => p.code === 'core');
      expect(corePack).toBeDefined();
      expect(corePack?.name).toBe('Core Set');

      const rhinoSet = meta.sets.find((s) => s.code === 'rhino');
      expect(rhinoSet).toBeDefined();

      const aggression = meta.factions.find((f) => f.code === 'aggression');
      expect(aggression).toBeDefined();
    });
  });

  describe('Card Filtering & Indexing', () => {
    it('retrieves and filters cards by pack', () => {
      const result = service.getCards({ pack: 'core' });
      expect(result.total).toBeGreaterThan(0);
      for (const card of result.cards) {
        expect(card.packCode).toBe('core');
      }
    });

    it('retrieves and filters cards by set', () => {
      const result = service.getCards({ set: 'rhino' });
      expect(result.total).toBeGreaterThan(0);
      for (const card of result.cards) {
        expect(card.setCode).toBe('rhino');
      }
    });

    it('retrieves and filters cards by faction', () => {
      const result = service.getCards({ faction: 'hero' });
      expect(result.total).toBeGreaterThan(0);
      for (const card of result.cards) {
        expect(card.factionCode).toBe('hero');
      }
    });

    it('retrieves and filters cards by status', () => {
      const resultHas = service.getCards({ pack: 'core', status: 'has_supplemental' });
      expect(resultHas.total).toBeGreaterThan(0);
      for (const card of resultHas.cards) {
        expect(card.hasSupplemental).toBe(true);
      }
    });

    it('retrieves and filters cards by search query', () => {
      const result = service.getCards({ search: 'Spider-Man' });
      expect(result.total).toBeGreaterThan(0);
      const spidey = result.cards.find((c) => c.code === '01001a');
      expect(spidey).toBeDefined();
      expect(spidey?.name).toBe('Spider-Man');
    });
  });

  describe('Card Details Inspection', () => {
    it('fetches card details for Spider-Man (01001a) with upstream and supplemental data', () => {
      const details = service.getCardDetails('01001a');
      expect(details).not.toBeNull();
      expect(details?.code).toBe('01001a');
      expect(details?.packCode).toBe('core');
      expect(details?.packFile).toBe('core.json');
      expect(details?.upstream.name).toBe('Spider-Man');
      expect(details?.supplemental).toBeDefined();
      expect(details?.supplemental.abilities.length).toBeGreaterThan(0);
      expect(details?.validation.valid).toBe(true);
      expect(details?.validation.errors.length).toBe(0);
    });

    it('fetches card details for Rhino I (01094)', () => {
      const details = service.getCardDetails('01094');
      expect(details).not.toBeNull();
      expect(details?.code).toBe('01094');
      expect(details?.packFile).toBe('core_encounter.json');
      expect(details?.upstream.name).toBe('Rhino');
      expect(details?.validation.valid).toBe(true);
    });

    it('returns null for an unknown card code', () => {
      const details = service.getCardDetails('99999999_invalid');
      expect(details).toBeNull();
    });
  });

  describe('Schema Validation & Persistence', () => {
    let tempDir: string;
    let isolatedService: CardSupplementalService;

    beforeEach(() => {
      // Create isolated temporary sandbox mirroring repo structure
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-editor-test-'));
      const upstreamPackDir = path.join(tempDir, 'data', 'upstream', 'pack');
      const supplementalPackDir = path.join(tempDir, 'src', 'data', 'supplemental', 'pack');
      fs.mkdirSync(upstreamPackDir, { recursive: true });
      fs.mkdirSync(supplementalPackDir, { recursive: true });

      // Copy sample card to upstream
      const sampleCards = [
        {
          code: '01001a',
          name: 'Spider-Man',
          pack_code: 'core',
          faction_code: 'hero',
          type_code: 'hero',
        },
      ];
      fs.writeFileSync(
        path.join(upstreamPackDir, 'core.json'),
        JSON.stringify(sampleCards, null, 2),
        'utf8',
      );

      isolatedService = new CardSupplementalService(tempDir);
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('rejects invalid supplemental data with schema errors', () => {
      const invalidPayload = {
        supplemental: {
          abilities: [
            {
              id: 'test_invalid',
              timing: 'INVALID_TIMING', // Invalid timing enum
            },
          ],
        },
      };

      const result = isolatedService.saveCardSupplemental('01001a', invalidPayload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not conform to CardEnrichmentSchema');
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('persists valid supplemental data and auto-stamps audit metadata', () => {
      const validPayload = {
        supplemental: {
          comment: 'Test card enrichment',
          abilities: [
            {
              id: 'hero_draw',
              timing: 'INTERRUPT',
              trigger: 'VILLAIN_INITIATES_ATTACK',
              steps: [
                {
                  effect: 'DRAW_CARDS',
                  params: { amount: 1 },
                },
              ],
            },
          ],
          audit: {
            reviewedBy: 'test_reviewer',
            confidence: 95,
          },
        },
      };

      const result = isolatedService.saveCardSupplemental('01001a', validPayload);
      expect(result.success).toBe(true);
      expect(result.code).toBe('01001a');
      expect(result.packFile).toBe('core.json');
      expect(result.updatedAt).toBeDefined();

      // Read back from disk
      const savedPackPath = path.join(tempDir, 'src', 'data', 'supplemental', 'pack', 'core.json');
      expect(fs.existsSync(savedPackPath)).toBe(true);

      const savedPack = JSON.parse(fs.readFileSync(savedPackPath, 'utf8'));
      expect(savedPack.cards['01001a']).toBeDefined();
      expect(savedPack.cards['01001a'].comment).toBe('Test card enrichment');
      expect(savedPack.cards['01001a'].audit.reviewedBy).toBe('test_reviewer');
      expect(savedPack.cards['01001a'].audit.confidence).toBe(95);
      expect(savedPack.cards['01001a'].audit.updatedAt).toBe(result.updatedAt);
    });
  });

  describe('Connect Middleware Request Handling', () => {
    it('dispatches GET /api/supplemental/packs', async () => {
      const middleware = createCardSupplementalMiddleware(service);

      const req: any = {
        url: '/api/supplemental/packs',
        method: 'GET',
      };

      let status = 0;
      let bodyData = '';
      const res: any = {
        setHeader: () => {},
        end: (data: string) => {
          bodyData = data;
        },
      };
      Object.defineProperty(res, 'statusCode', {
        set: (code: number) => {
          status = code;
        },
        get: () => status,
      });

      await middleware(req, res, () => {});
      expect(status).toBe(200);
      const parsed = JSON.parse(bodyData);
      expect(parsed.packs).toBeDefined();
    });

    it('dispatches GET /api/supplemental/card/:code', async () => {
      const middleware = createCardSupplementalMiddleware(service);

      const req: any = {
        url: '/api/supplemental/card/01001a',
        method: 'GET',
      };

      let status = 0;
      let bodyData = '';
      const res: any = {
        setHeader: () => {},
        end: (data: string) => {
          bodyData = data;
        },
      };
      Object.defineProperty(res, 'statusCode', {
        set: (code: number) => {
          status = code;
        },
        get: () => status,
      });

      await middleware(req, res, () => {});
      expect(status).toBe(200);
      const parsed = JSON.parse(bodyData);
      expect(parsed.code).toBe('01001a');
      expect(parsed.upstream.name).toBe('Spider-Man');
    });

    it('dispatches 404 for unknown card in GET /api/supplemental/card/:code', async () => {
      const middleware = createCardSupplementalMiddleware(service);

      const req: any = {
        url: '/api/supplemental/card/non_existent_99999',
        method: 'GET',
      };

      let status = 0;
      let bodyData = '';
      const res: any = {
        setHeader: () => {},
        end: (data: string) => {
          bodyData = data;
        },
      };
      Object.defineProperty(res, 'statusCode', {
        set: (code: number) => {
          status = code;
        },
        get: () => status,
      });

      await middleware(req, res, () => {});
      expect(status).toBe(404);
      const parsed = JSON.parse(bodyData);
      expect(parsed.error).toContain('not found');
    });
  });
});
