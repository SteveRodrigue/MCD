/**
 * Marvel Champions Digital (MCD) - Card image cache (Node only, ADR-0092 decision 8).
 *
 * The one place that finds a card image on disk or fetches it: a file the pack ships itself,
 * then the disposable cache under `content/.cache/images/<pack>/`, then (official packs only) the
 * MarvelCDB CDN, written through a temporary file. Used by the dev and preview servers and by
 * `npm run cache:cards`. Official art is never written anywhere else.
 */

import * as fs from 'fs';
import * as path from 'path';
import http from 'http';
import https from 'https';
import {
  CARD_ART_FILE_PATTERN,
  CARD_BACKS_DIR,
  marvelCdbImageUrl,
} from '../data/content/card-art.ts';
import { PACK_ID_PATTERN, PackManifestSchema } from '../data/packs/pack-manifest.ts';
import { imageCacheDir, packAssetDir, packDir } from './content-paths.ts';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MCD/1.0';

const CARD_BACK_REMOTE_URLS: Record<string, string> = {
  'player.png': 'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-player-back.png',
  'encounter.png':
    'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-encounter-back.png',
  'villain.png': 'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-villain-back.png',
};

export interface ImageCacheOptions {
  /** Content base folder (defaults to the current working directory, like `content-paths`). */
  base?: string;
  /** Where an official pack's file is fetched from; defaults to MarvelCDB. */
  remoteUrl?: (packId: string, fileName: string) => string | undefined;
}

function removeQuietly(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore cleanup error
  }
}

const inFlightDownloads = new Map<string, Promise<boolean>>();

/**
 * Downloads `url` to `filePath` through a temporary file, following up to 5 redirects; one
 * download per target file at a time.
 */
function downloadFile(url: string, filePath: string): Promise<boolean> {
  const existing = inFlightDownloads.get(filePath);
  if (existing) return existing;

  const download = new Promise<boolean>((resolve) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
    const fileStream = fs.createWriteStream(tempPath);
    const fail = () =>
      fileStream.close(() => {
        removeQuietly(tempPath);
        resolve(false);
      });

    const get = (targetUrl: string, redirectsLeft: number) => {
      const client = targetUrl.startsWith('http:') ? http : https;
      client
        .get(targetUrl, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
          const { statusCode, headers } = response;
          if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
            response.resume();
            if (redirectsLeft <= 0) return fail();
            return get(new URL(headers.location, targetUrl).toString(), redirectsLeft - 1);
          }
          if (statusCode !== 200) {
            response.resume();
            return fail();
          }
          response.pipe(fileStream);
          fileStream.on('finish', () =>
            fileStream.close(() => {
              try {
                fs.renameSync(tempPath, filePath);
                resolve(true);
              } catch {
                removeQuietly(tempPath);
                resolve(false);
              }
            }),
          );
        })
        .on('error', fail);
    };
    get(url, 5);
  }).finally(() => inFlightDownloads.delete(filePath));

  inFlightDownloads.set(filePath, download);
  return download;
}

/** Origin of a pack on disk, or `undefined` when the id is invalid, the pack is absent or its manifest is bad. */
function packOrigin(packId: string, base?: string): string | undefined {
  if (!PACK_ID_PATTERN.test(packId)) return undefined;
  try {
    const raw = fs.readFileSync(path.join(packDir(packId, base), 'pack.json'), 'utf8');
    const manifest = PackManifestSchema.safeParse(JSON.parse(raw));
    return manifest.success ? manifest.data.origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Absolute path of a card image, fetching it into the cache when an official pack does not have it
 * yet. `null` when the pack, the file name or the image does not exist.
 */
export async function resolveCardImage(
  packId: string,
  fileName: string,
  options: ImageCacheOptions = {},
): Promise<string | null> {
  if (!CARD_ART_FILE_PATTERN.test(fileName)) return null;
  const { base } = options;

  if (packId === CARD_BACKS_DIR) {
    const filePath = path.join(imageCacheDir(CARD_BACKS_DIR, base), fileName);
    const remote = CARD_BACK_REMOTE_URLS[fileName];
    if (fs.existsSync(filePath)) return filePath;
    return remote && (await downloadFile(remote, filePath)) ? filePath : null;
  }

  const origin = packOrigin(packId, base);
  if (!origin) return null;

  const assetPath = path.join(packAssetDir(packId, base), fileName);
  if (fs.existsSync(assetPath)) return assetPath;

  const cachePath = path.join(imageCacheDir(packId, base), fileName);
  if (fs.existsSync(cachePath)) return cachePath;

  if (origin === 'user') return null;
  const remote = (options.remoteUrl ?? ((_pack, file) => marvelCdbImageUrl(file)))(
    packId,
    fileName,
  );
  return remote && (await downloadFile(remote, cachePath)) ? cachePath : null;
}

/** Whether the image is already on disk (shipped by the pack or cached), without fetching. */
export function hasCardImage(packId: string, fileName: string, base?: string): boolean {
  return (
    fs.existsSync(path.join(packAssetDir(packId, base), fileName)) ||
    fs.existsSync(path.join(imageCacheDir(packId, base), fileName))
  );
}
