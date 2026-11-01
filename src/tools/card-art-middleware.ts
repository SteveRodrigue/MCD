/**
 * Marvel Champions Digital (MCD) - Card art endpoint for the Vite dev and preview servers.
 *
 *   GET /card-art/<packId>/<file>.png   a pack's shipped art, its cached art, or (official packs) a
 *                                       fresh download from MarvelCDB (see `image-cache.ts`)
 *   GET /card-art/_backs/<type>.png     the three generic card backs
 */

import * as fs from 'fs';
import type { Plugin } from 'vite';
import { CARD_ART_FILE_PATTERN, CARD_ART_ROUTE } from '../data/content/card-art.ts';
import { resolveCardImage, type ImageCacheOptions } from './image-cache.ts';

const ROUTE_PATTERN = new RegExp(`^${CARD_ART_ROUTE}/([^/?]+)/([^/?]+)(?:\\?.*)?$`);

export interface CardArtResponse {
  status: 200 | 400 | 404;
  /** Set for a 200. */
  filePath?: string;
  /** Plain-text body of an error. */
  message?: string;
}

/** The answer for a request URL, or `null` when the URL is not a card art URL. */
export async function handleCardArtRequest(
  url: string,
  options?: ImageCacheOptions,
): Promise<CardArtResponse | null> {
  const match = ROUTE_PATTERN.exec(url);
  if (!match) return null;

  const [, packId, fileName] = match;
  if (!CARD_ART_FILE_PATTERN.test(fileName)) {
    return { status: 400, message: 'Invalid card image filename' };
  }
  const filePath = await resolveCardImage(packId, fileName, options);
  return filePath ? { status: 200, filePath } : { status: 404, message: 'Card image not found' };
}

export function cardArtPlugin(): Plugin {
  const middleware = async (req: any, res: any, next: any) => {
    const answer = req.url ? await handleCardArtRequest(req.url) : null;
    if (!answer) return next();

    if (answer.status === 200 && answer.filePath) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return fs.createReadStream(answer.filePath).pipe(res);
    }
    res.statusCode = answer.status;
    res.setHeader('Content-Type', 'text/plain');
    res.end(answer.message);
  };

  return {
    name: 'mcd-card-art-plugin',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
