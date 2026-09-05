import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { EventEmitter } from 'events';

describe('Card Art Cache Vite Middleware (Read-Through On-Demand)', () => {
  const testCacheDir = path.resolve(process.cwd(), 'cache', 'test-cards');

  beforeEach(() => {
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  // Reusable simulation of serveCardMiddleware logic
  async function simulateMiddleware(
    reqUrl: string,
    cacheDir: string,
  ): Promise<{ statusCode: number; headers: Record<string, string>; body: Buffer | string }> {
    const rawFileName = reqUrl.replace(/^\/(?:cache\/)?cards\//, '').split('?')[0];

    let statusCode = 200;
    const headers: Record<string, string> = {};
    let body: Buffer | string = '';

    const res: any = {
      set statusCode(val: number) {
        statusCode = val;
      },
      get statusCode() {
        return statusCode;
      },
      setHeader: (k: string, v: string) => {
        headers[k.toLowerCase()] = v;
      },
      end: (data: string) => {
        body = data;
      },
    };

    if (!/^[a-zA-Z0-9_-]+\.png$/i.test(rawFileName)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Invalid card image filename');
      return { statusCode, headers, body };
    }

    const fileName = rawFileName;

    const filePath = path.join(cacheDir, fileName);

    // 1. Check Cache
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      body = fs.readFileSync(filePath);
      return { statusCode, headers, body };
    }

    // 2. Download and Cache
    const downloaded = await new Promise<boolean>((resolve) => {
      const cdnUrl = `https://marvelcdb.com/bundles/cards/${fileName}`;
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      const fileStream = fs.createWriteStream(tempPath);

      https
        .get(cdnUrl, (response: any) => {
          if (response.statusCode === 200) {
            response.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close(() => {
                try {
                  fs.renameSync(tempPath, filePath);
                  resolve(true);
                } catch {
                  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                  resolve(false);
                }
              });
            });
          } else {
            fileStream.close(() => {
              if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
              resolve(false);
            });
          }
        })
        .on('error', () => {
          fileStream.close(() => {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            resolve(false);
          });
        });
    });

    // 3. Display from Cache
    if (downloaded && fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      body = fs.readFileSync(filePath);
      return { statusCode, headers, body };
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Card image not found');
    return { statusCode, headers, body };
  }

  it('rejects invalid filenames with 400 Bad Request to prevent path traversal', async () => {
    const result = await simulateMiddleware('/cards/../secret.png', testCacheDir);
    expect(result.statusCode).toBe(400);
    expect(result.body).toBe('Invalid card image filename');
  });

  it('serves image directly from cache when file exists on disk', async () => {
    const filePath = path.join(testCacheDir, '01001a.png');
    const dummyData = Buffer.from('png-dummy-data');
    fs.writeFileSync(filePath, dummyData);

    const result = await simulateMiddleware('/cards/01001a.png', testCacheDir);
    expect(result.statusCode).toBe(200);
    expect(result.headers['content-type']).toBe('image/png');
    expect(result.headers['cache-control']).toContain('immutable');
    expect(result.body).toEqual(dummyData);
  });

  it('downloads from MarvelCDB CDN, caches on disk, and serves when missing', async () => {
    const filePath = path.join(testCacheDir, '01006.png');
    expect(fs.existsSync(filePath)).toBe(false);

    // Mock https.get to simulate successful download
    const mockResponse: any = new EventEmitter();
    mockResponse.statusCode = 200;
    mockResponse.pipe = (destStream: any) => {
      destStream.write(Buffer.from('downloaded-card-content'));
      destStream.end();
      return destStream;
    };

    const mockRequest: any = new EventEmitter();
    vi.spyOn(https, 'get').mockImplementation((_url: any, cb: any) => {
      cb(mockResponse);
      return mockRequest;
    });

    const result = await simulateMiddleware('/cards/01006.png', testCacheDir);

    expect(result.statusCode).toBe(200);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath).toString()).toBe('downloaded-card-content');
    expect(result.headers['content-type']).toBe('image/png');
  });

  it('returns 404 and does not corrupt cache when CDN returns 404', async () => {
    const filePath = path.join(testCacheDir, '99999.png');

    const mockResponse: any = new EventEmitter();
    mockResponse.statusCode = 404;

    const mockRequest: any = new EventEmitter();
    vi.spyOn(https, 'get').mockImplementation((_url: any, cb: any) => {
      cb(mockResponse);
      return mockRequest;
    });

    const result = await simulateMiddleware('/cards/99999.png', testCacheDir);

    expect(result.statusCode).toBe(404);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(result.body).toBe('Card image not found');
  });
});
