#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCardText } from '../../src/tools/card-text-parser';
import {
  CardEnrichment,
  SupplementalPackSchema,
  CardAuditRecord,
} from '../../src/data/supplemental/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

interface CliArgs {
  code?: string;
  pack?: string;
  text?: string;
  interactive?: boolean;
  json?: boolean;
  write?: boolean;
  force?: boolean;
}

function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--code' && args[i + 1]) {
      parsed.code = args[++i];
    } else if (arg === '--pack' && args[i + 1]) {
      parsed.pack = args[++i];
    } else if (arg === '--text' && args[i + 1]) {
      parsed.text = args[++i];
    } else if (arg === '--interactive') {
      parsed.interactive = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--write') {
      parsed.write = true;
    } else if (arg === '--force') {
      parsed.force = true;
    }
  }
  return parsed;
}

function loadUpstreamCard(cardCode: string, packCode = 'core'): { text?: string; name: string } | null {
  const packFile = path.join(ROOT_DIR, `data/upstream/pack/${packCode}.json`);
  if (!fs.existsSync(packFile)) return null;

  try {
    const cards = JSON.parse(fs.readFileSync(packFile, 'utf-8'));
    const card = cards.find((c: any) => c.code === cardCode);
    return card || null;
  } catch {
    return null;
  }
}

function loadSupplementalPack(packCode: string): any | null {
  const packFile = path.join(ROOT_DIR, `src/data/supplemental/pack/${packCode}.json`);
  if (!fs.existsSync(packFile)) return null;

  try {
    return JSON.parse(fs.readFileSync(packFile, 'utf-8'));
  } catch {
    return null;
  }
}

function getCurrentIsoTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = now.getUTCFullYear();
  const month = pad(now.getUTCMonth() + 1);
  const day = pad(now.getUTCDate());
  const hours = pad(now.getUTCHours());
  const minutes = pad(now.getUTCMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}:00Z`;
}

export function writeSupplementalCard(
  packCode: string,
  cardCode: string,
  enrichment: CardEnrichment,
  originalText: string,
  confidence: number
): { success: boolean; message: string } {
  const packFilePath = path.join(ROOT_DIR, `src/data/supplemental/pack/${packCode}.json`);
  let packData: any = loadSupplementalPack(packCode);

  if (!packData) {
    packData = {
      $schema: '../schema.json',
      cards: {},
    };
  }

  if (!packData.cards) {
    packData.cards = {};
  }

  const existingCard = packData.cards[cardCode] || {};
  const currentTimestamp = getCurrentIsoTimestamp();

  // Construct standard audit metadata
  const audit: CardAuditRecord = {
    createdAt: existingCard.audit?.createdAt || currentTimestamp,
    updatedAt: currentTimestamp,
    reviewedAt: currentTimestamp,
    reviewedBy: 'antigravity',
    rulesVersion: 'v1.8',
    confidence,
    originalText: originalText || existingCard.audit?.originalText || '',
    reconstructedText: existingCard.audit?.reconstructedText || undefined,
  };

  const updatedEntry: CardEnrichment = {
    ...existingCard,
    ...enrichment,
    audit,
  };

  packData.cards[cardCode] = updatedEntry;

  // Validate with SupplementalPackSchema
  try {
    SupplementalPackSchema.parse(packData);
  } catch (err: any) {
    return {
      success: false,
      message: `Validation failed for pack ${packCode}: ${err.message}`,
    };
  }

  // Atomic write back to disk with 2 spaces
  try {
    fs.writeFileSync(packFilePath, JSON.stringify(packData, null, 2) + '\n', 'utf-8');
    return {
      success: true,
      message: `Successfully wrote card ${cardCode} to ${packFilePath}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to write pack file: ${err.message}`,
    };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.code && !args.pack && !args.text) {
    console.log(`
Marvel Champions Digital — Card Text Parsing & Declarative Mapping Analyzer

Usage:
  npx tsx tools/audit/card-text-parser.ts [options]

Options:
  --code <id>         Card code to parse (e.g. 01001b)
  --pack <pack>       Pack to load card from (default: 'core')
  --text "<text>"     Raw card text to parse directly
  --interactive       Interactive verification step-by-step display
  --write             Safely write or update card in src/data/supplemental/pack/<pack>.json
  --force             Allow write even if confidence < 100% or warnings exist
  --json              Output pure parsed JSON to stdout
`);
    process.exit(0);
  }

  const packCode = args.pack || 'core';
  let rawText = args.text || '';
  let cardName = 'Direct Input';

  if (args.code) {
    const card = loadUpstreamCard(args.code, packCode);
    if (!card) {
      console.error(`Card ${args.code} not found in pack ${packCode}.`);
      process.exit(1);
    }
    rawText = card.text || '';
    cardName = card.name;
  }

  const result = parseCardText(rawText, args.code);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // CLI Visual Presentation
  console.log('\n======================================================');
  console.log(`🃏 Card: ${cardName} (${args.code || 'Custom'})`);
  console.log('======================================================');
  console.log('\n📝 Raw Upstream Text:');
  console.log(`  "${rawText}"`);
  console.log('\n✨ Normalized Text:');
  console.log(`  "${result.normalizedText}"`);

  console.log('\n🎯 Matched Tokens:');
  if (result.matchedSpans.length === 0) {
    console.log('  (No tokens matched)');
  } else {
    for (const span of result.matchedSpans) {
      console.log(`  ✓ [${span.category.toUpperCase()}] "${span.text}" ${span.detail ? `-> ${span.detail}` : ''}`);
    }
  }

  if (result.unmatchedFragments.length > 0) {
    console.log('\n⚠️ Unmatched Text Fragments:');
    for (const frag of result.unmatchedFragments) {
      console.log(`  • "${frag.text}"`);
    }
  } else {
    console.log('\n✅ 100% of text structure successfully parsed!');
  }

  console.log(`\n📊 Parser Confidence: ${result.confidence}%`);

  if (result.warnings.length > 0) {
    console.log('\n🚨 Warnings / Schema Violations:');
    for (const w of result.warnings) {
      console.log(`  ! ${w}`);
    }
  }

  console.log('\n📦 Generated Declarative Supplemental JSON:');
  console.log(JSON.stringify(result.enrichment, null, 2));

  // Existing Supplemental Data comparison
  if (args.code) {
    const pack = loadSupplementalPack(packCode);
    const existing = pack?.cards?.[args.code];
    if (existing) {
      console.log('\n🔍 Comparison with Existing Supplemental Data:');
      const existingAbilities = existing.abilities?.length || 0;
      const parsedAbilities = result.enrichment.abilities?.length || 0;
      console.log(`  Existing abilities: ${existingAbilities} | Parsed abilities: ${parsedAbilities}`);
      if (existing.uses || result.enrichment.uses) {
        console.log(`  Existing uses: ${JSON.stringify(existing.uses)} | Parsed uses: ${JSON.stringify(result.enrichment.uses)}`);
      }
    }
  }

  // Handle Optional --write
  if (args.write) {
    if (!args.code) {
      console.error('\n❌ Cannot write without specifying a valid card --code.');
      process.exit(1);
    }

    if ((result.confidence < 95 || result.warnings.length > 0) && !args.force) {
      console.error(
        `\n🚫 Write blocked: Confidence is ${result.confidence}% (< 95%) or warnings exist. Pass --force to override.`
      );
      process.exit(1);
    }

    console.log(`\n💾 Writing card ${args.code} to src/data/supplemental/pack/${packCode}.json...`);
    const writeResult = writeSupplementalCard(
      packCode,
      args.code,
      result.enrichment,
      rawText,
      result.confidence
    );

    if (writeResult.success) {
      console.log(`✅ ${writeResult.message}`);
    } else {
      console.error(`❌ ${writeResult.message}`);
      process.exit(1);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
