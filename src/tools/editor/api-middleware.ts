import path from 'path';
import fs from 'fs';
import { CardEnrichmentSchema } from '../../data/supplemental/schema';

export interface CardSummary {
  code: string;
  name: string;
  packCode: string;
  packFile: string;
  setCode?: string;
  factionCode: string;
  typeCode: string;
  stage?: string;
  traits?: string;
  hasSupplemental: boolean;
  noSupplementalNeeded?: boolean;
  isValid: boolean;
  confidence?: number;
  errorCount?: number;
}

export interface PackMetadataResponse {
  packs: Array<{ code: string; name: string; pack_type_code?: string; size?: number }>;
  sets: Array<{ code: string; name: string; card_set_type_code?: string }>;
  factions: Array<{ code: string; name: string; is_primary?: boolean }>;
  packFiles: string[];
}

export interface CardDetailsResponse {
  code: string;
  packCode: string;
  packFile: string;
  upstream: any;
  supplemental?: any;
  validation: {
    valid: boolean;
    errors: any[];
  };
}

/**
 * Service to manage reading and writing card supplemental and upstream data for the editor.
 */
export class CardSupplementalService {
  private upstreamDir: string;
  private supplementalPackDir: string;
  private cachedUpstreamCards: Map<string, { card: any; packFile: string }> | null = null;

  constructor(baseDir: string = process.cwd()) {
    this.upstreamDir = path.resolve(baseDir, 'data', 'upstream');
    this.supplementalPackDir = path.resolve(baseDir, 'src', 'data', 'supplemental', 'pack');
  }

  public getPacksMetadata(): PackMetadataResponse {
    const packsPath = path.join(this.upstreamDir, 'packs.json');
    const setsPath = path.join(this.upstreamDir, 'sets.json');
    const factionsPath = path.join(this.upstreamDir, 'factions.json');
    const upstreamPackDir = path.join(this.upstreamDir, 'pack');

    const packs = fs.existsSync(packsPath) ? JSON.parse(fs.readFileSync(packsPath, 'utf8')) : [];
    const sets = fs.existsSync(setsPath) ? JSON.parse(fs.readFileSync(setsPath, 'utf8')) : [];
    const factions = fs.existsSync(factionsPath)
      ? JSON.parse(fs.readFileSync(factionsPath, 'utf8'))
      : [];

    const packFiles = fs.existsSync(upstreamPackDir)
      ? fs.readdirSync(upstreamPackDir).filter((f) => f.endsWith('.json'))
      : [];

    return { packs, sets, factions, packFiles };
  }

  private loadAllUpstreamCards(): Map<string, { card: any; packFile: string }> {
    if (this.cachedUpstreamCards) {
      return this.cachedUpstreamCards;
    }

    const cardsMap = new Map<string, { card: any; packFile: string }>();
    const upstreamPackDir = path.join(this.upstreamDir, 'pack');

    if (fs.existsSync(upstreamPackDir)) {
      const files = fs.readdirSync(upstreamPackDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(upstreamPackDir, file), 'utf8');
          const list = JSON.parse(content);
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.code) {
                cardsMap.set(item.code, { card: item, packFile: file });
              }
            }
          }
        } catch {
          // ignore corrupted files
        }
      }
    }

    this.cachedUpstreamCards = cardsMap;
    return cardsMap;
  }

  public readSupplementalPack(packFile: string): Record<string, any> | null {
    const filePath = path.join(this.supplementalPackDir, packFile);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return parsed && typeof parsed.cards === 'object' ? parsed.cards : null;
    } catch {
      return null;
    }
  }

  public getCards(filters: {
    pack?: string;
    packFile?: string;
    set?: string;
    faction?: string;
    hero?: string;
    status?: string;
    search?: string;
  }): { total: number; cards: CardSummary[] } {
    const allUpstream = this.loadAllUpstreamCards();
    const supplementalCache = new Map<string, Record<string, any> | null>();

    const getSupplementalForFile = (pFile: string) => {
      if (!supplementalCache.has(pFile)) {
        supplementalCache.set(pFile, this.readSupplementalPack(pFile));
      }
      return supplementalCache.get(pFile);
    };

    const results: CardSummary[] = [];

    for (const [code, { card, packFile }] of allUpstream.entries()) {
      // 1. Filter by pack / packFile
      if (filters.packFile && packFile !== filters.packFile) {
        continue;
      }
      if (filters.pack && card.pack_code !== filters.pack) {
        continue;
      }

      // 2. Filter by set
      if (filters.set && card.set_code !== filters.set) {
        continue;
      }

      // 3. Filter by faction / affinity
      if (filters.faction && card.faction_code !== filters.faction) {
        continue;
      }

      // 4. Filter by hero (matches set_code or hero identity)
      if (filters.hero) {
        const matchesHero =
          card.set_code === filters.hero ||
          (card.name && card.name.toLowerCase().includes(filters.hero.toLowerCase()));
        if (!matchesHero) {
          continue;
        }
      }

      // 5. Search query (code, name, traits)
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const codeMatch = code.toLowerCase().includes(q);
        const nameMatch = card.name && card.name.toLowerCase().includes(q);
        const traitsMatch = card.traits && card.traits.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !traitsMatch) {
          continue;
        }
      }

      // Check supplemental data
      const packCards = getSupplementalForFile(packFile);
      const supplemental = packCards ? packCards[code] : undefined;
      const hasSupplemental = supplemental !== undefined;

      let isValid = true;
      let errorCount = 0;
      let confidence = supplemental?.audit?.confidence;

      if (hasSupplemental) {
        const validation = CardEnrichmentSchema.safeParse(supplemental);
        if (!validation.success) {
          isValid = false;
          errorCount = (validation.error.issues || (validation.error as any).errors || []).length;
        }
      }

      const noSupplementalNeeded = Boolean(supplemental?.noSupplementalNeeded);

      // 6. Filter by status
      if (filters.status) {
        if (filters.status === 'has_supplemental' && !hasSupplemental) continue;
        if (filters.status === 'missing_supplemental' && hasSupplemental) continue;
        if (filters.status === 'invalid_supplemental' && (!hasSupplemental || isValid)) continue;
        if (filters.status === 'valid_supplemental' && (!hasSupplemental || !isValid)) continue;
        if (
          filters.status === 'vanilla_supplemental' &&
          (!hasSupplemental || !noSupplementalNeeded)
        )
          continue;
      }

      results.push({
        code,
        name: card.name || 'Unknown',
        packCode: card.pack_code || '',
        packFile,
        setCode: card.set_code,
        factionCode: card.faction_code || 'basic',
        typeCode: card.type_code || '',
        stage: card.stage,
        traits: card.traits,
        hasSupplemental,
        noSupplementalNeeded,
        isValid,
        confidence,
        errorCount,
      });
    }

    // Sort by packFile, then position/code
    results.sort((a, b) => {
      if (a.packFile !== b.packFile) {
        return a.packFile.localeCompare(b.packFile);
      }
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });

    return { total: results.length, cards: results };
  }

  public getCardDetails(code: string): CardDetailsResponse | null {
    const allUpstream = this.loadAllUpstreamCards();
    const entry = allUpstream.get(code);
    if (!entry) {
      return null;
    }

    const { card, packFile } = entry;
    const packCards = this.readSupplementalPack(packFile);
    const supplemental = packCards ? packCards[code] : undefined;

    let valid = true;
    let errors: any[] = [];

    if (supplemental !== undefined) {
      const validation = CardEnrichmentSchema.safeParse(supplemental);
      if (!validation.success) {
        valid = false;
        errors = validation.error.issues || (validation.error as any).errors || [];
      }
    }

    return {
      code,
      packCode: card.pack_code || '',
      packFile,
      upstream: card,
      supplemental,
      validation: {
        valid,
        errors,
      },
    };
  }

  public saveCardSupplemental(
    code: string,
    payload: {
      packFile?: string;
      packCode?: string;
      supplemental: any;
    },
  ): {
    success: boolean;
    code?: string;
    packFile?: string;
    updatedAt?: string;
    errors?: any[];
    error?: string;
  } {
    const allUpstream = this.loadAllUpstreamCards();
    const entry = allUpstream.get(code);

    let targetPackFile = payload.packFile;
    if (!targetPackFile && entry) {
      targetPackFile = entry.packFile;
    }
    if (!targetPackFile && payload.packCode) {
      targetPackFile = `${payload.packCode}.json`;
    }
    if (!targetPackFile) {
      return { success: false, error: `Cannot resolve target pack file for card ${code}` };
    }

    // Ensure supplemental object
    const supplemental = payload.supplemental || {};

    // Validate using authoritative Zod schema
    const validation = CardEnrichmentSchema.safeParse(supplemental);
    if (!validation.success) {
      return {
        success: false,
        error: 'Supplemental data does not conform to CardEnrichmentSchema',
        errors: validation.error.issues || (validation.error as any).errors || [],
      };
    }

    const validatedData = validation.data;

    // ISO timestamp with seconds (YYYY-MM-DDTHH:MM:SSZ)
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    const audit = validatedData.audit || {};
    audit.updatedAt = nowIso;
    audit.reviewedAt = nowIso;
    audit.reviewedBy = audit.reviewedBy || 'developer';
    audit.rulesVersion = audit.rulesVersion || 'v1.8';
    if (audit.confidence === undefined) {
      audit.confidence = 100;
    }
    validatedData.audit = audit;

    // Ensure directory exists
    if (!fs.existsSync(this.supplementalPackDir)) {
      fs.mkdirSync(this.supplementalPackDir, { recursive: true });
    }

    const targetPath = path.join(this.supplementalPackDir, targetPackFile);
    let packJson: { $schema?: string; cards: Record<string, any> } = {
      $schema: '../schema.json',
      cards: {},
    };

    if (fs.existsSync(targetPath)) {
      try {
        packJson = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
        if (!packJson.cards) {
          packJson.cards = {};
        }
      } catch (err: any) {
        return { success: false, error: `Failed to read existing pack file: ${err.message}` };
      }
    }

    packJson.cards[code] = validatedData;

    try {
      fs.writeFileSync(targetPath, JSON.stringify(packJson, null, 2) + '\n', 'utf8');
      return {
        success: true,
        code,
        packFile: targetPackFile,
        updatedAt: nowIso,
      };
    } catch (err: any) {
      return { success: false, error: `Failed to write pack file: ${err.message}` };
    }
  }
}

/**
 * Connect/Vite dev middleware for supplemental editor API
 */
export function createCardSupplementalMiddleware(
  service: CardSupplementalService = new CardSupplementalService(),
) {
  return async (req: any, res: any, next: any) => {
    const rawUrl = req.url || '';
    const [pathname, queryString] = rawUrl.split('?');

    if (!pathname.startsWith('/api/supplemental')) {
      return next();
    }

    res.setHeader('Content-Type', 'application/json');

    // 1. GET /api/supplemental/packs
    if (pathname === '/api/supplemental/packs' && req.method === 'GET') {
      try {
        const data = service.getPacksMetadata();
        res.statusCode = 200;
        return res.end(JSON.stringify(data));
      } catch (err: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // 2. GET /api/supplemental/cards
    if (pathname === '/api/supplemental/cards' && req.method === 'GET') {
      try {
        const searchParams = new URLSearchParams(queryString || '');
        const filters = {
          pack: searchParams.get('pack') || undefined,
          packFile: searchParams.get('packFile') || undefined,
          set: searchParams.get('set') || undefined,
          faction: searchParams.get('faction') || undefined,
          hero: searchParams.get('hero') || undefined,
          status: searchParams.get('status') || undefined,
          search: searchParams.get('search') || undefined,
        };
        const data = service.getCards(filters);
        res.statusCode = 200;
        return res.end(JSON.stringify(data));
      } catch (err: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // 3. GET /api/supplemental/card/:code
    const cardMatch = pathname.match(/^\/api\/supplemental\/card\/([a-zA-Z0-9_-]+)$/);
    if (cardMatch && req.method === 'GET') {
      const code = cardMatch[1];
      try {
        const data = service.getCardDetails(code);
        if (!data) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: `Card ${code} not found in catalog` }));
        }
        res.statusCode = 200;
        return res.end(JSON.stringify(data));
      } catch (err: any) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // 4. POST /api/supplemental/card/:code
    if (cardMatch && req.method === 'POST') {
      const code = cardMatch[1];
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const result = service.saveCardSupplemental(code, payload);
          if (!result.success) {
            res.statusCode = 400;
            return res.end(JSON.stringify(result));
          }
          res.statusCode = 200;
          return res.end(JSON.stringify(result));
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    next();
  };
}

/**
 * Vite plugin exporting the card supplemental editor middleware
 */
export function cardSupplementalEditorPlugin() {
  const service = new CardSupplementalService();
  const middleware = createCardSupplementalMiddleware(service);

  return {
    name: 'mcd-card-supplemental-editor-plugin',
    configureServer(server: any) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(middleware);
    },
  };
}
