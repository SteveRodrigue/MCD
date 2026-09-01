import fs from 'fs';
import path from 'path';
import https from 'https';
import corePack from '../data/upstream/pack/core.json';
import coreEncounterPack from '../data/upstream/pack/core_encounter.json';

import { getCardArtFileName } from '../src/ui/services/card-cache-service';

const CACHE_DIR = path.resolve(process.cwd(), 'cache', 'cards');
const MARVELCDB_CDN_BASE = 'https://marvelcdb.com/bundles/cards';

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function downloadImage(fileName: string): Promise<boolean> {
  return new Promise((resolve) => {
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
  const uniqueFileNames = new Set<string>();

  for (const card of allCards) {
    if (card.code) {
      const fileName = getCardArtFileName({
        code: card.code,
        type: (card as any).type_code,
        stage: (card as any).stage,
      });
      if (fileName) uniqueFileNames.add(fileName);
    }
    if ((card as any).back_link) {
      uniqueFileNames.add(`${(card as any).back_link}.png`);
    }
  }

  const fileNames = Array.from(uniqueFileNames);
  console.log(`🔍 Found ${fileNames.length} unique card image files to cache.\n`);

  let downloadedCount = 0;
  let cachedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i];
    const filePath = path.join(CACHE_DIR, fileName);
    const alreadyExists = fs.existsSync(filePath);

    const success = await downloadImage(fileName);
    if (success) {
      if (alreadyExists) {
        cachedCount++;
      } else {
        downloadedCount++;
        console.log(`  [${i + 1}/${fileNames.length}] ✅ Downloaded & Cached: ${fileName}`);
      }
    } else {
      failedCount++;
      console.warn(`  [${i + 1}/${fileNames.length}] ⚠️ Failed to download: ${fileName}`);
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
