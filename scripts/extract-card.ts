#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');

const UPSTREAM_DIR = path.join(ROOT_DIR, 'data/upstream/pack');
const SUPPLEMENTAL_DIR = path.join(ROOT_DIR, 'src/data/supplemental/pack');

export interface ExtractedCard {
  code: string;
  name: string;
  subname?: string;
  type_code: string;
  faction_code?: string;
  traits?: string;
  cost?: number;
  text?: string;
  pack_code: string;
  is_unique?: boolean;
  attack?: number;
  thwart?: number;
  defense?: number;
  health?: number;
  hand_size?: number;
  resources?: {
    physical?: number;
    energy?: number;
    mental?: number;
    wild?: number;
  };
  existing_supplemental: Record<string, unknown> | null;
}

export function extractCard(cardCode: string, packHint?: string): ExtractedCard | null {
  const codeLower = cardCode.trim().toLowerCase();
  const packHintLower = packHint?.trim().toLowerCase();

  if (!fs.existsSync(UPSTREAM_DIR)) {
    throw new Error(`Upstream directory not found: ${UPSTREAM_DIR}`);
  }

  const files = fs.readdirSync(UPSTREAM_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const packCode = path.basename(file, '.json').toLowerCase();
    if (packHintLower && packCode !== packHintLower) {
      continue;
    }

    const filePath = path.join(UPSTREAM_DIR, file);
    let cards: Array<Record<string, unknown>>;
    try {
      cards = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      continue;
    }

    const match = cards.find((c) => String(c.code || '').toLowerCase() === codeLower);
    if (!match) continue;

    // Check for existing supplemental data
    let existingSupp: Record<string, unknown> | null = null;
    const suppPath = path.join(SUPPLEMENTAL_DIR, file);
    if (fs.existsSync(suppPath)) {
      try {
        const suppContent = JSON.parse(fs.readFileSync(suppPath, 'utf8'));
        if (suppContent?.cards && suppContent.cards[match.code as string]) {
          existingSupp = suppContent.cards[match.code as string];
        }
      } catch {
        // If supplemental file is malformed or unreadable, treat as null
        existingSupp = null;
      }
    }

    // Collect resources
    const resources: Record<string, number> = {};
    if (typeof match.resource_physical === 'number' && match.resource_physical > 0) {
      resources.physical = match.resource_physical;
    }
    if (typeof match.resource_energy === 'number' && match.resource_energy > 0) {
      resources.energy = match.resource_energy;
    }
    if (typeof match.resource_mental === 'number' && match.resource_mental > 0) {
      resources.mental = match.resource_mental;
    }
    if (typeof match.resource_wild === 'number' && match.resource_wild > 0) {
      resources.wild = match.resource_wild;
    }

    const result: ExtractedCard = {
      code: String(match.code),
      name: String(match.name),
      ...(match.subname ? { subname: String(match.subname) } : {}),
      type_code: String(match.type_code || 'unknown'),
      ...(match.faction_code ? { faction_code: String(match.faction_code) } : {}),
      ...(match.traits ? { traits: String(match.traits) } : {}),
      ...(typeof match.cost === 'number' ? { cost: match.cost } : {}),
      ...(match.text ? { text: String(match.text) } : {}),
      pack_code: packCode,
      ...(match.is_unique !== undefined ? { is_unique: Boolean(match.is_unique) } : {}),
      ...(typeof match.attack === 'number' ? { attack: match.attack } : {}),
      ...(typeof match.thwart === 'number' ? { thwart: match.thwart } : {}),
      ...(typeof match.defense === 'number' ? { defense: match.defense } : {}),
      ...(typeof match.health === 'number' ? { health: match.health } : {}),
      ...(typeof match.hand_size === 'number' ? { hand_size: match.hand_size } : {}),
      ...(Object.keys(resources).length > 0 ? { resources } : {}),
      existing_supplemental: existingSupp,
    };

    return result;
  }

  return null;
}

// CLI execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const cardCode = process.argv[2];
  const packHint = process.argv[3];

  if (!cardCode) {
    console.error('Usage: npm run card:extract -- <card_code> [pack_code]');
    process.exit(1);
  }

  const result = extractCard(cardCode, packHint);
  if (!result) {
    console.error(`Card not found in upstream packs: ${cardCode}`);
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}
