/**
 * Marvel Champions Digital (MCD) - Content endpoint for the Vite dev and preview servers.
 *
 * Serves the repository's content folder so the browser can load packs at runtime (read-only, plus one guarded PUT for the editor on the dev server):
 *   GET /__content/index.json     { files: [...] } every servable file, relative to the content root
 *   GET /__content/<relative>     one file from that list
 *
 * Only files that appear in the index are served, which keeps requests inside the content folder
 * (no `..`, no absolute paths, no `.cache`, no translations, no non-JSON files).
 */

import * as fs from 'fs';
import * as path from 'path';
import { SupplementalPackSchema } from '../data/supplemental/schema.ts';
import { contentRoot } from './content-paths.ts';

const URL_PREFIX = '/__content/';
/** Folders the browser never needs. */
const EXCLUDED_DIRS = new Set(['.cache', 'translations']);

function collect(dir: string, relDir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) collect(path.join(dir, entry.name), rel, out);
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(rel);
  }
}

/** Every file the endpoint may serve, as forward-slash paths relative to the content root. */
export function buildContentIndex(base?: string): string[] {
  const root = contentRoot(base);
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  collect(root, '', files);
  return files.sort();
}

export interface ContentResponse {
  status: number;
  contentType: string;
  body: string;
}

/** Resolves one request path (without query string) to a response; `null` when it is not ours. */
export function handleContentRequest(requestPath: string, base?: string): ContentResponse | null {
  if (!requestPath.startsWith(URL_PREFIX)) return null;
  const json = (status: number, body: unknown): ContentResponse => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

  let relative: string;
  try {
    relative = decodeURIComponent(requestPath.slice(URL_PREFIX.length));
  } catch {
    return json(400, { error: 'Bad request path' });
  }
  const files = buildContentIndex(base);
  if (relative === 'index.json') return json(200, { files });
  if (!files.includes(relative)) return json(404, { error: 'Not found' });
  return {
    status: 200,
    contentType: 'application/json',
    body: fs.readFileSync(path.join(contentRoot(base), ...relative.split('/')), 'utf-8'),
  };
}

/** The only files the endpoint writes: a pack's supplemental data (M9, Q24 as amended by Q57). */
const WRITABLE_PATH = /^packs\/([a-z0-9_-]+)\/supplemental\/([a-z0-9_-]+)\.json$/i;
/** Packs this checkout owns. `official-sync` packs are re-downloaded, so edits to them would be lost. */
const WRITABLE_ORIGINS = new Set(['user', 'official-bundled']);

/**
 * Writes one supplemental file for the editor. Refuses every other path, a pack that is not
 * writable (by the origin in its `pack.json`) and a body that is not valid supplemental data.
 */
export function handleContentWrite(
  requestPath: string,
  body: string,
  base?: string,
): ContentResponse | null {
  if (!requestPath.startsWith(URL_PREFIX)) return null;
  const json = (status: number, payload: unknown): ContentResponse => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });

  let relative: string;
  try {
    relative = decodeURIComponent(requestPath.slice(URL_PREFIX.length));
  } catch {
    return json(400, { error: 'Bad request path' });
  }
  const match = WRITABLE_PATH.exec(relative);
  if (!match)
    return json(403, { error: 'Only packs/<id>/supplemental/<file>.json can be written' });

  const root = contentRoot(base);
  let origin: unknown;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(root, 'packs', match[1], 'pack.json'), 'utf-8'),
    );
    origin = manifest.origin;
  } catch {
    return json(403, { error: `Pack "${match[1]}" has no readable pack.json` });
  }
  if (typeof origin !== 'string' || !WRITABLE_ORIGINS.has(origin)) {
    return json(403, { error: `Pack "${match[1]}" is read-only (origin: ${String(origin)})` });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return json(400, { error: 'Body is not valid JSON' });
  }
  const valid = SupplementalPackSchema.safeParse(parsed);
  if (!valid.success) return json(400, { error: valid.error.message });

  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
  fs.renameSync(temp, target);
  return json(200, { success: true });
}

type Next = () => void;
interface Req {
  url?: string;
  method?: string;
  on?: (event: string, cb: (chunk?: unknown) => void) => void;
}
interface Res {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

export function contentMiddleware(base?: string, options: { allowWrite?: boolean } = {}) {
  const send = (res: Res, response: ContentResponse) => {
    res.statusCode = response.status;
    res.setHeader('Content-Type', response.contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(response.body);
  };
  return (req: Req, res: Res, next: Next): void => {
    if (!req.url) return next();
    const requestPath = req.url.split('?')[0];
    if (req.method === 'PUT' && options.allowWrite && req.on) {
      if (!requestPath.startsWith(URL_PREFIX)) return next();
      let body = '';
      req.on('data', (chunk) => {
        body += String(chunk);
      });
      req.on('end', () => send(res, handleContentWrite(requestPath, body, base)!));
      return;
    }
    if (req.method !== 'GET') return next();
    const response = handleContentRequest(requestPath, base);
    if (!response) return next();
    send(res, response);
  };
}

/** Vite plugin serving the content folder in dev and preview. Nothing is copied into `dist`. */
export function contentPlugin() {
  return {
    name: 'mcd-content-plugin',
    // Writes (the editor's Save) exist on the dev server only: `vite preview` serves a build.
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(contentMiddleware(undefined, { allowWrite: true }));
    },
    configurePreviewServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(contentMiddleware());
    },
  };
}
