import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

export const CARD_BACK_URLS = {
  player: 'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-player-back.png',
  encounter: 'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-encounter-back.png',
  villain: 'https://hallofheroeslcg.com/wp-content/uploads/2021/02/marvel-villain-back.png',
} as const;

export const CACHE_BACK_DIR = path.resolve(process.cwd(), 'cache', 'back');

export function downloadFile(url: string, destPath: string, redirectLimit = 5): Promise<boolean> {
  return new Promise((resolve) => {
    if (redirectLimit <= 0) {
      console.error(`Too many redirects for ${url}`);
      return resolve(false);
    }

    const options = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MCD/1.0',
      },
    };

    https
      .get(url, options, (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          const redirectUrl = new URL(response.headers.location, url).toString();
          return resolve(downloadFile(redirectUrl, destPath, redirectLimit - 1));
        }

        if (response.statusCode === 200) {
          const tempPath = `${destPath}.tmp.${Date.now()}`;
          const fileStream = fs.createWriteStream(tempPath);
          response.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close(() => {
              try {
                fs.renameSync(tempPath, destPath);
                resolve(true);
              } catch {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                resolve(false);
              }
            });
          });
          fileStream.on('error', () => {
            fileStream.close();
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            resolve(false);
          });
        } else {
          resolve(false);
        }
      })
      .on('error', (err) => {
        console.error(`Failed to download ${url}:`, err.message);
        resolve(false);
      });
  });
}

export async function cacheCardBacks(): Promise<void> {
  console.log('🎴 Caching Marvel Champions Card Backs...');
  console.log(`📁 Target Directory: ${CACHE_BACK_DIR}\n`);

  if (!fs.existsSync(CACHE_BACK_DIR)) {
    fs.mkdirSync(CACHE_BACK_DIR, { recursive: true });
  }

  for (const [key, url] of Object.entries(CARD_BACK_URLS)) {
    const destPath = path.join(CACHE_BACK_DIR, `${key}.png`);
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      console.log(`  📦 Already cached: ${key}.png`);
      continue;
    }

    console.log(`  ⬇️ Downloading ${key}.png from ${url}...`);
    const success = await downloadFile(url, destPath);
    if (success) {
      console.log(`  ✅ Successfully cached: ${key}.png`);
    } else {
      console.error(`  ❌ Failed to download: ${key}.png`);
    }
  }

  console.log('\nCard back caching finished.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  cacheCardBacks().catch((err) => {
    console.error('Error caching card backs:', err);
    process.exit(1);
  });
}
