import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { cardSupplementalEditorPlugin } from './src/tools/editor/api-middleware';

function cardCachePlugin(): Plugin {
  const cacheDir = path.resolve(__dirname, 'cache', 'cards');
  const inFlightDownloads = new Map<string, Promise<boolean>>();

  function downloadToCache(fileName: string, filePath: string): Promise<boolean> {
    const existingPromise = inFlightDownloads.get(fileName);
    if (existingPromise) {
      return existingPromise;
    }

    const downloadPromise = new Promise<boolean>((resolve) => {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const cdnUrl = `https://marvelcdb.com/bundles/cards/${fileName}`;
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      const fileStream = fs.createWriteStream(tempPath);

      https
        .get(cdnUrl, (response) => {
          if (response.statusCode === 200) {
            response.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close(() => {
                try {
                  fs.renameSync(tempPath, filePath);
                  resolve(true);
                } catch {
                  if (fs.existsSync(tempPath)) {
                    try {
                      fs.unlinkSync(tempPath);
                    } catch {
                      // ignore cleanup error
                    }
                  }
                  resolve(false);
                }
              });
            });
          } else {
            fileStream.close(() => {
              if (fs.existsSync(tempPath)) {
                try {
                  fs.unlinkSync(tempPath);
                } catch {
                  // ignore cleanup error
                }
              }
              resolve(false);
            });
          }
        })
        .on('error', () => {
          fileStream.close(() => {
            if (fs.existsSync(tempPath)) {
              try {
                fs.unlinkSync(tempPath);
              } catch {
                // ignore cleanup error
              }
            }
            resolve(false);
          });
        });
    }).finally(() => {
      inFlightDownloads.delete(fileName);
    });

    inFlightDownloads.set(fileName, downloadPromise);
    return downloadPromise;
  }

  const serveCardMiddleware = async (req: any, res: any, next: any) => {
    if (req.url && (req.url.startsWith('/cards/') || req.url.startsWith('/cache/cards/'))) {
      const rawFileName = req.url.replace(/^\/(?:cache\/)?cards\//, '').split('?')[0];

      // Validate filename to prevent directory traversal
      if (!/^[a-zA-Z0-9_-]+\.png$/i.test(rawFileName)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Invalid card image filename');
        return;
      }

      const fileName = rawFileName;

      const filePath = path.join(cacheDir, fileName);

      // 1. Check if the image is in cache
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return fs.createReadStream(filePath).pipe(res);
      }

      // 2. If not, download the image from MarvelCDB and put it in the cache
      const downloaded = await downloadToCache(fileName, filePath);
      if (downloaded && fs.existsSync(filePath)) {
        // 3. Display / serve the image from the cache
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return fs.createReadStream(filePath).pipe(res);
      }

      // If remote download failed (e.g. 404 on CDN), return 404
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Card image not found');
      return;
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
          const files = fs
            .readdirSync(snapshotsDir)
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

function problemReportPlugin(): Plugin {
  const reportsDir = path.resolve(__dirname, 'logs', 'reports');

  const reportMiddleware = (req: any, res: any, next: any) => {
    if (req.url === '/api/logs/report' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
          }

          const timestamp = payload.timestamp || Date.now();
          const type = payload.type || 'bug';

          const reportFileName = `report_${timestamp}_${type}.json`;
          const reportPath = path.join(reportsDir, reportFileName);
          fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2), 'utf8');

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, file: reportFileName }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    next();
  };

  return {
    name: 'mcd-problem-report-plugin',
    configureServer(server) {
      server.middlewares.use(reportMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(reportMiddleware);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    cardCachePlugin(),
    gameStateSnapshotPlugin(),
    problemReportPlugin(),
    cardSupplementalEditorPlugin(),
  ],
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
    strictPort: true,
    open: false,
  },
});
