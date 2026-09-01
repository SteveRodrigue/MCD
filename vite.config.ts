import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function cardCachePlugin(): Plugin {
  const cacheDir = path.resolve(__dirname, 'cache', 'cards');

  const serveCardMiddleware = (req: any, res: any, next: any) => {
    if (req.url && (req.url.startsWith('/cards/') || req.url.startsWith('/cache/cards/'))) {
      const fileName = req.url.replace(/^\/(?:cache\/)?cards\//, '').split('?')[0];
      const filePath = path.join(cacheDir, fileName);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return fs.createReadStream(filePath).pipe(res);
      }
    }
    next();
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
      // Copy local cached cards to dist/cards for production offline play
      const distCardsDir = path.resolve(__dirname, 'dist', 'cards');
      if (fs.existsSync(cacheDir)) {
        fs.mkdirSync(distCardsDir, { recursive: true });
        const files = fs.readdirSync(cacheDir);
        for (const file of files) {
          if (file.endsWith('.png')) {
            fs.copyFileSync(path.join(cacheDir, file), path.join(distCardsDir, file));
          }
        }
      }
    },
  };
}

function gameStateSnapshotPlugin(): Plugin {
  const snapshotsDir = path.resolve(__dirname, 'logs', 'gamestates');

  const snapshotMiddleware = (req: any, res: any, next: any) => {
    if (req.url === '/api/logs/gamestate' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (!fs.existsSync(snapshotsDir)) {
            fs.mkdirSync(snapshotsDir, { recursive: true });
          }

          const state = payload.state;
          const timestamp = payload.timestamp || Date.now();
          const round = state?.roundNumber || 1;
          const phase = state?.phase || 'SETUP';

          // 1. Write latest_gamestate.json
          const latestPath = path.join(snapshotsDir, 'latest_gamestate.json');
          fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2), 'utf8');

          // 2. Write rolling snapshot
          const snapshotFileName = `gamestate_${timestamp}_rnd${round}_${phase}.json`;
          const snapshotPath = path.join(snapshotsDir, snapshotFileName);
          fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2), 'utf8');

          // 3. Keep latest 25 rolling snapshots, prune older
          const files = fs.readdirSync(snapshotsDir)
            .filter((f) => f.startsWith('gamestate_') && f.endsWith('.json'))
            .map((f) => ({ name: f, time: fs.statSync(path.join(snapshotsDir, f)).mtimeMs }))
            .sort((a, b) => b.time - a.time);

          if (files.length > 25) {
            for (let i = 25; i < files.length; i++) {
              fs.unlinkSync(path.join(snapshotsDir, files[i].name));
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, file: snapshotFileName }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (req.url === '/api/logs/gamestate/latest' && req.method === 'GET') {
      const latestPath = path.join(snapshotsDir, 'latest_gamestate.json');
      if (fs.existsSync(latestPath)) {
        res.setHeader('Content-Type', 'application/json');
        return fs.createReadStream(latestPath).pipe(res);
      } else {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'No snapshots recorded yet' }));
        return;
      }
    }

    next();
  };

  return {
    name: 'mcd-gamestate-snapshot-plugin',
    configureServer(server) {
      server.middlewares.use(snapshotMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(snapshotMiddleware);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cardCachePlugin(), gameStateSnapshotPlugin()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, './src/engine'),
      '@data': path.resolve(__dirname, './src/data'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
