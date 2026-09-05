import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPacksMetadata,
  fetchCards,
  fetchCardDetails,
  saveCardSupplemental,
} from '../../src/ui/services/supplemental-editor-service';

describe('supplemental-editor-service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchPacksMetadata invokes /api/supplemental/packs', async () => {
    const mockData = {
      packs: [{ code: 'core', name: 'Core Set' }],
      sets: [],
      factions: [],
      packFiles: ['core.json'],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPacksMetadata();
    expect(fetchMock).toHaveBeenCalledWith('/api/supplemental/packs');
    expect(result.packs).toHaveLength(1);
    expect(result.packs[0].code).toBe('core');
  });

  it('fetchCards builds query params correctly', async () => {
    const mockData = { total: 1, cards: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchCards({
      pack: 'core',
      set: 'rhino',
      faction: 'aggression',
      status: 'has_supplemental',
      search: 'spider',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/supplemental/cards?');
    expect(calledUrl).toContain('pack=core');
    expect(calledUrl).toContain('set=rhino');
    expect(calledUrl).toContain('faction=aggression');
    expect(calledUrl).toContain('status=has_supplemental');
    expect(calledUrl).toContain('search=spider');
  });

  it('fetchCardDetails invokes /api/supplemental/card/:code', async () => {
    const mockDetails = {
      code: '01001a',
      packCode: 'core',
      packFile: 'core.json',
      upstream: { code: '01001a', name: 'Spider-Man' },
      validation: { valid: true, errors: [] },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDetails,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCardDetails('01001a');
    expect(fetchMock).toHaveBeenCalledWith('/api/supplemental/card/01001a');
    expect(result.code).toBe('01001a');
    expect(result.upstream.name).toBe('Spider-Man');
  });

  it('saveCardSupplemental sends POST request with payload', async () => {
    const mockResult = {
      success: true,
      code: '01001a',
      updatedAt: '2026-09-05T18:00:00Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResult,
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      packFile: 'core.json',
      supplemental: {
        comment: 'Test enrichment',
      },
    };

    const result = await saveCardSupplemental('01001a', payload);
    expect(fetchMock).toHaveBeenCalledWith('/api/supplemental/card/01001a', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    expect(result.success).toBe(true);
    expect(result.code).toBe('01001a');
  });
});
