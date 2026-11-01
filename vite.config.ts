import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import { contentPlugin } from './src/tools/content-middleware.ts';
import { cardArtPlugin } from './src/tools/card-art-middleware.ts';
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
    cardArtPlugin(),
    cardStatsPlugin(),
    gameStateSnapshotPlugin(),
    problemReportPlugin(),
    labFontChoicesPlugin(),
    contentPlugin(),
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
      ignored: ['**/logs/**', '**/cache/**', '**/.cache/**', '**/stats/**'],
    },
  },
}));
