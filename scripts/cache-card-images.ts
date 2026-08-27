import fs from 'fs';
import path from 'path';
import https from 'https';
import corePack from '../data/upstream/pack/core.json';
import coreEncounterPack from '../data/upstream/pack/core_encounter.json';

const CACHE_DIR = path.resolve(process.cwd(), 'cache', 'cards');
const MARVELCDB_CDN_BASE = 'https://marvelcdb.com/bundles/cards';

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function downloadImage(code: string): Promise<boolean> {
  return new Promise((resolve) => {
    const fileName = `${code}.png`;
    const filePath = path.join(CACHE_DIR, fileName);

    // If already cached on disk, skip
    if (fs.existsSync(filePath)) {
      return resolve(true);
    }

    const url = `${MARVELCDB_CDN_BASE}/${fileName}`;
    const fileStream = fs.createWriteStream(filePath);

    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          response.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            resolve(true);
          });
        } else {
          fileStream.close();
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          resolve(false);
        }
      })
      .on('error', () => {
        fileStream.close();
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        resolve(false);
      });
  });
}

async function runCache(): Promise<void> {
  console.log('🃏 Starting Marvel Champions Local Card Image Cache...');
  console.log(`📁 Target Directory: ${CACHE_DIR}\n`);

  const allCards = [...corePack, ...coreEncounterPack];
  const uniqueCodes = new Set<string>();

  for (const card of allCards) {
    if (card.code) uniqueCodes.add(card.code);
    if ((card as any).back_link) uniqueCodes.add((card as any).back_link);
  }

  const codes = Array.from(uniqueCodes);
  console.log(`🔍 Found ${codes.length} unique card codes to cache.\n`);

  let downloadedCount = 0;
  let cachedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const filePath = path.join(CACHE_DIR, `${code}.png`);
    const alreadyExists = fs.existsSync(filePath);

    const success = await downloadImage(code);
    if (success) {
      if (alreadyExists) {
        cachedCount++;
      } else {
        downloadedCount++;
        console.log(`  [${i + 1}/${codes.length}] ✅ Downloaded & Cached: ${code}.png`);
      }
    } else {
      failedCount++;
      console.warn(`  [${i + 1}/${codes.length}] ⚠️ Failed to download: ${code}.png`);
    }
  }

  console.log('\n========================================');
  console.log('🎉 Card Image Caching Complete!');
  console.log(`  ✅ Newly Downloaded: ${downloadedCount}`);
  console.log(`  📦 Already in Cache: ${cachedCount}`);
  console.log(`  ⚠️ Failed / Not Found: ${failedCount}`);
  console.log(`  📂 Total in ${CACHE_DIR}: ${fs.readdirSync(CACHE_DIR).length} images`);
  console.log('========================================\n');
}

runCache().catch(console.error);
