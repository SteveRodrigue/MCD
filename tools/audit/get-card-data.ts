#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

const UPSTREAM_DIR = path.join(ROOT_DIR, 'data/upstream/pack');
const SUPPLEMENTAL_DIR = path.join(ROOT_DIR, 'src/data/supplemental/pack');

function main() {
  const query = process.argv[2]?.trim();
  if (!query) {
    console.error('Usage: npm run card:get -- <card_code_or_name>');
    process.exit(1);
  }

  const queryLower = query.toLowerCase();

  // Load all upstream cards
  const upstreamFiles = fs.readdirSync(UPSTREAM_DIR).filter((f) => f.endsWith('.json'));
  const matches: Array<{
    pack: string;
    upstream: Record<string, unknown>;
    supplemental: Record<string, unknown> | null;
  }> = [];

  // Cache supplemental data by pack
  const supplementalCache: Record<string, Record<string, unknown>> = {};

  for (const file of upstreamFiles) {
    const packCode = path.basename(file, '.json');
    const upstreamPath = path.join(UPSTREAM_DIR, file);
    const cards: Array<Record<string, unknown>> = JSON.parse(fs.readFileSync(upstreamPath, 'utf8'));

    for (const card of cards) {
      const code = String(card.code || '').toLowerCase();
      const name = String(card.name || '').toLowerCase();

      if (code === queryLower || name === queryLower || name.includes(queryLower)) {
        // Load supplemental if not cached
        if (!supplementalCache[packCode]) {
          const suppPath = path.join(SUPPLEMENTAL_DIR, file);
          if (fs.existsSync(suppPath)) {
            const suppData = JSON.parse(fs.readFileSync(suppPath, 'utf8'));
            supplementalCache[packCode] = suppData.cards || {};
          } else {
            supplementalCache[packCode] = {};
          }
        }

        const suppCard =
          (supplementalCache[packCode][card.code as string] as Record<string, unknown>) || null;

        matches.push({
          pack: packCode,
          upstream: {
            code: card.code,
            name: card.name,
            subname: card.subname,
            type_code: card.type_code,
            faction_code: card.faction_code,
            cost: card.cost,
            text: card.text,
            traits: card.traits,
            attack: card.attack,
            thwart: card.thwart,
            defense: card.defense,
            health: card.health,
            hand_size: card.hand_size,
            is_unique: card.is_unique,
          },
          supplemental: suppCard,
        });
      }
    }
  }

  if (matches.length === 0) {
    console.error(`No card matching "${query}" found.`);
    process.exit(1);
  }

  if (matches.length === 1) {
    console.log(JSON.stringify(matches[0], null, 2));
  } else {
    console.log(
      JSON.stringify(
        {
          totalMatches: matches.length,
          matches: matches.map((m) => ({
            code: m.upstream.code,
            name: m.upstream.name,
            pack: m.pack,
            type: m.upstream.type_code,
            hasSupplemental: !!m.supplemental,
          })),
        },
        null,
        2,
      ),
    );
  }
}

main();
