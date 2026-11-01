/**
 * Marvel Champions Digital (MCD) - Content endpoint for the Vite dev and preview servers.
 *
 * Serves the repository's content folder read-only so the browser can load packs at runtime:
 *   GET /__content/index.json     { files: [...] } every servable file, relative to the content root
 *   GET /__content/<relative>     one file from that list
 *
 * Only files that appear in the index are served, which keeps requests inside the content folder
 * (no `..`, no absolute paths, no `.cache`, no translations, no non-JSON files).
 */

import * as fs from 'fs';
import * as path from 'path';
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

type Next = () => void;
interface Req {
  url?: string;
  method?: string;
}
interface Res {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

export function contentMiddleware(base?: string) {
  return (req: Req, res: Res, next: Next): void => {
    if (req.method !== 'GET' || !req.url) return next();
    const response = handleContentRequest(req.url.split('?')[0], base);
    if (!response) return next();
    res.statusCode = response.status;
    res.setHeader('Content-Type', response.contentType);
    res.setHeader('Cache-Control', 'no-cache');
    res.end(response.body);
  };
}

/** Vite plugin serving the content folder in dev and preview. Nothing is copied into `dist`. */
export function contentPlugin() {
  const middleware = contentMiddleware();
  return {
    name: 'mcd-content-plugin',
    configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: { middlewares: { use: (fn: unknown) => void } }) {
      server.middlewares.use(middleware);
    },
  };
}
