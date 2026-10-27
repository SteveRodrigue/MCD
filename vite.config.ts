import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { cardSupplementalEditorPlugin } from './src/tools/editor/api-middleware.ts';
import { buildDefines } from './src/tools/build-define.ts';
import { saveProblemReport } from './src/tools/problem-report-store.ts';
import {
  FONT_CHOICES_ENDPOINT,
  FONT_CHOICES_FILE,
  mergeFontChoices,
} from './src/ui/components/templates/font-save.ts';
import {
  AllTimeStats,
  applyStatsReset,
  createInitialAllTimeStats,
  mergeDeltaIntoAllTime,
} from './src/engine/models/stats.ts';

type Req = {
  url?: string;
  method?: string;
  on: (event: string, cb: (chunk?: any) => void) => void;
};
type Res = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
};

/** Reads a request body as JSON (an empty body is `{}`). */
function readJsonBody(req: Req): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function sendJson(res: Res, data: unknown, statusCode = 200): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/** Answers a JSON POST with `handle(payload)`, or a 500 with the error message. */
function handleJsonPost(req: Req, res: Res, handle: (payload: any) => unknown): void {
  readJsonBody(req)
    .then((payload) => sendJson(res, handle(payload)))
    .catch((err: Error) => sendJson(res, { success: false, error: err.message }, 500));
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
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    const fileStream = fs.createWriteStream(tempPath);
    const fail = () =>
      fileStream.close(() => {
        removeQuietly(tempPath);
        resolve(false);
      });

    const get = (targetUrl: string, redirectsLeft: number) => {
      https
        .get(targetUrl, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
          const { statusCode, headers } = response;
          if (statusCode && statusCode >= 300 && statusCode < 400 && headers.location) {
            if (redirectsLeft <= 0) return fail();
            return get(new URL(headers.location, targetUrl).toString(), redirectsLeft - 1);
          }
          if (statusCode !== 200) return fail();
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

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MCD/1.0';

/** A card image route: `/<prefix>/<file>.png`, served from a cache folder filled on demand. */
interface CachedImageRoute {
  pattern: RegExp;
  dir: string;
  remoteUrl: (fileName: string) => string | undefined;
  label: string;
}

function cardCachePlugin(): Plugin {
  const cacheDir = path.resolve(import.meta.dirname, 'cache', 'cards');
  const cacheBackDir = path.resolve(import.meta.dirname, 'cache', 'back');

  const cardBackRemoteUrls: Record<string, string> = {
    'player.png': 'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-player-back.png',
    'encounter.png':
      'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-encounter-back.png',
    'villain.png': 'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-villain-back.png',
  };

  const routes: CachedImageRoute[] = [
    {
      pattern: /^\/(?:cache\/)?back\//,
      dir: cacheBackDir,
      remoteUrl: (fileName) => cardBackRemoteUrls[fileName],
      label: 'Card back image',
    },
    {
      pattern: /^\/(?:cache\/)?cards\//,
      dir: cacheDir,
      remoteUrl: (fileName) => `https://marvelcdb.com/bundles/cards/${fileName}`,
      label: 'Card image',
    },
  ];

  const serveCardMiddleware = async (req: any, res: any, next: any) => {
    const route = req.url ? routes.find((r) => r.pattern.test(req.url)) : undefined;
    if (!route) return next();

    const fileName = req.url.replace(route.pattern, '').split('?')[0];
    // Validate filename to prevent directory traversal
    if (!/^[a-zA-Z0-9_-]+\.png$/i.test(fileName)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`Invalid ${route.label.toLowerCase()} filename`);
      return;
    }

    const filePath = path.join(route.dir, fileName);
    const remoteUrl = route.remoteUrl(fileName);
    if (fs.existsSync(filePath) || (remoteUrl && (await downloadFile(remoteUrl, filePath)))) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return fs.createReadStream(filePath).pipe(res);
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`${route.label} not found`);
  };

  return {
    name: 'mcd-card-cache-plugin',
    configureServer(server) {
      server.middlewares.use(serveCardMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveCardMiddleware);
    },
    closeBundle() {
      // Copy local cached cards and card backs to dist for production offline play
      for (const [from, to] of [
        [cacheDir, path.resolve(import.meta.dirname, 'dist', 'cards')],
        [cacheBackDir, path.resolve(import.meta.dirname, 'dist', 'back')],
      ]) {
        if (!fs.existsSync(from)) continue;
        fs.mkdirSync(to, { recursive: true });
        for (const file of fs.readdirSync(from)) {
          if (file.endsWith('.png')) fs.copyFileSync(path.join(from, file), path.join(to, file));
        }
      }
    },
  };
}

// The plugins below write to disk: they run on the dev server only, never on `vite preview`.

function gameStateSnapshotPlugin(): Plugin {
  const snapshotsDir = path.resolve(import.meta.dirname, 'logs', 'gamestates');

  const snapshotMiddleware = (req: any, res: any, next: any) => {
    if (req.url === '/api/logs/gamestate' && req.method === 'POST') {
      return handleJsonPost(req, res, (payload) => {
        fs.mkdirSync(snapshotsDir, { recursive: true });
        const state = payload.state;
        const timestamp = payload.timestamp || Date.now();
        const round = state?.roundNumber || 1;
        const phase = state?.phase || 'SETUP';
        const content = JSON.stringify(payload, null, 2);

        // 1. latest_gamestate.json, 2. rolling snapshot, 3. keep the 25 newest snapshots
        fs.writeFileSync(path.join(snapshotsDir, 'latest_gamestate.json'), content, 'utf8');
        const snapshotFileName = `gamestate_${timestamp}_rnd${round}_${phase}.json`;
        fs.writeFileSync(path.join(snapshotsDir, snapshotFileName), content, 'utf8');
        fs.readdirSync(snapshotsDir)
          .filter((f) => f.startsWith('gamestate_') && f.endsWith('.json'))
          .map((f) => ({ name: f, time: fs.statSync(path.join(snapshotsDir, f)).mtimeMs }))
          .sort((a, b) => b.time - a.time)
          .slice(25)
          .forEach((f) => fs.unlinkSync(path.join(snapshotsDir, f.name)));

        return { success: true, file: snapshotFileName };
      });
    }

    if (req.url === '/api/logs/gamestate/latest' && req.method === 'GET') {
      const latestPath = path.join(snapshotsDir, 'latest_gamestate.json');
      if (!fs.existsSync(latestPath)) {
        return sendJson(res, { error: 'No snapshots recorded yet' }, 404);
      }
      res.setHeader('Content-Type', 'application/json');
      return fs.createReadStream(latestPath).pipe(res);
    }

    next();
  };

  return {
    name: 'mcd-gamestate-snapshot-plugin',
    configureServer(server) {
      server.middlewares.use(snapshotMiddleware);
    },
  };
}

function problemReportPlugin(): Plugin {
  const reportMiddleware = (req: any, res: any, next: any) => {
    if (req.url === '/api/logs/report' && req.method === 'POST') {
      return handleJsonPost(req, res, (payload) => ({
        success: true,
        ...saveProblemReport(import.meta.dirname, payload),
      }));
    }
    next();
  };

  return {
    name: 'mcd-problem-report-plugin',
    configureServer(server) {
      server.middlewares.use(reportMiddleware);
    },
  };
}

function cardStatsPlugin(): Plugin {
  const statsDir = path.resolve(import.meta.dirname, 'stats');
  const statsFilePath = path.join(statsDir, 'card_play_stats.json');

  function writeStatsFile(stats: AllTimeStats): AllTimeStats {
    fs.mkdirSync(statsDir, { recursive: true });
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2), 'utf8');
    return stats;
  }

  function ensureStatsFile(): AllTimeStats {
    try {
      return JSON.parse(fs.readFileSync(statsFilePath, 'utf8'));
    } catch {
      return writeStatsFile(createInitialAllTimeStats());
    }
  }

  const statsMiddleware = (req: any, res: any, next: any) => {
    if (req.url === '/api/stats' && req.method === 'GET') {
      try {
        return sendJson(res, ensureStatsFile());
      } catch (err: any) {
        return sendJson(res, { error: err.message }, 500);
      }
    }
    if (req.url === '/api/stats' && req.method === 'POST') {
      return handleJsonPost(req, res, (delta) => ({
        success: true,
        stats: writeStatsFile(mergeDeltaIntoAllTime(ensureStatsFile(), delta)),
      }));
    }
    if (req.url === '/api/stats/reset' && req.method === 'POST') {
      return handleJsonPost(req, res, (reset) => ({
        success: true,
        stats: writeStatsFile(applyStatsReset(ensureStatsFile(), reset)),
      }));
    }
    next();
  };

  return {
    name: 'mcd-card-stats-plugin',
    configureServer(server) {
      server.middlewares.use(statsMiddleware);
    },
  };
}

/** The lab's "Save font choices" button writes the font test values of a theme to a git-ignored file. */
function labFontChoicesPlugin(): Plugin {
  const filePath = path.resolve(import.meta.dirname, FONT_CHOICES_FILE);

  const readExisting = (): unknown => {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  };

  const fontChoicesMiddleware = (req: any, res: any, next: any) => {
    if (req.url === FONT_CHOICES_ENDPOINT && req.method === 'POST') {
      return handleJsonPost(req, res, (entry) => {
        const merged = mergeFontChoices(readExisting(), entry);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');
        return { success: true, file: FONT_CHOICES_FILE };
      });
    }
    next();
  };

  return {
    name: 'mcd-lab-font-choices-plugin',
    configureServer(server) {
      server.middlewares.use(fontChoicesMiddleware);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  define: buildDefines(import.meta.dirname, command === 'serve'),
  plugins: [
    react(),
    tailwindcss(),
    cardCachePlugin(),
    cardStatsPlugin(),
    gameStateSnapshotPlugin(),
    problemReportPlugin(),
    labFontChoicesPlugin(),
    cardSupplementalEditorPlugin(),
  ],
  resolve: {
    alias: {
      '@engine': path.resolve(import.meta.dirname, './src/engine'),
      '@data': path.resolve(import.meta.dirname, './src/data'),
      '@ui': path.resolve(import.meta.dirname, './src/ui'),
      '@assets': path.resolve(import.meta.dirname, './src/assets'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    open: false,
    watch: {
      ignored: ['**/logs/**', '**/cache/**', '**/stats/**'],
    },
  },
}));
