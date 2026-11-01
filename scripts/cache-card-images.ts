import { bootContent } from '../src/data/content/apply';
import { NodeFsDriver } from '../src/data/content/drivers/node-fs';
import { getLoadedContent } from '../src/data/content/store';
import { artFileName } from '../src/data/content/card-art';
import { hasCardImage, resolveCardImage } from '../src/tools/image-cache';
import { contentRoot, imageCacheDir } from '../src/tools/content-paths';

/** `--pack <id>` limits the run to one pack; by default every enabled pack is cached. */
function requestedPack(argv: string[]): string | undefined {
  const at = argv.indexOf('--pack');
  return at >= 0 ? argv[at + 1] : undefined;
}

async function runCache(): Promise<void> {
  console.log('🃏 Starting Marvel Champions Local Card Image Cache...');

  await bootContent(new NodeFsDriver(contentRoot()));
  const only = requestedPack(process.argv.slice(2));
  const packs = getLoadedContent().packs.filter((pack) => !only || pack.id === only);
  if (only && packs.length === 0) {
    console.error(`Pack "${only}" is not loaded (see content/config.json).`);
    process.exitCode = 1;
    return;
  }

  let downloadedCount = 0;
  let cachedCount = 0;
  let failedCount = 0;

  for (const pack of packs) {
    const swap = pack.manifest.art?.swapMainSchemeSides;
    const fileNames = new Set<string>();
    for (const card of pack.cards) {
      const fileName = artFileName(
        { code: card.code, type: card.type_code, stage: card.stage },
        swap,
      );
      if (fileName) fileNames.add(fileName);
      if (card.back_link) fileNames.add(`${card.back_link}.png`);
    }
    console.log(`\n📁 ${pack.id}: ${fileNames.size} images -> ${imageCacheDir(pack.id)}`);

    for (const fileName of fileNames) {
      if (hasCardImage(pack.id, fileName)) {
        cachedCount++;
      } else if (await resolveCardImage(pack.id, fileName)) {
        downloadedCount++;
      } else {
        failedCount++;
        console.warn(`  ⚠️ Failed to download: ${pack.id}/${fileName}`);
      }
    }
  }

  console.log('\n========================================');
  console.log('🎉 Card Image Caching Complete!');
  console.log(`  ✅ Newly Downloaded: ${downloadedCount}`);
  console.log(`  📦 Already in Cache: ${cachedCount}`);
  console.log(`  ⚠️ Failed / Not Found: ${failedCount}`);
  console.log('========================================\n');
}

runCache().catch(console.error);
