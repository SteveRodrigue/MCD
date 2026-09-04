#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCardText } from '../../src/tools/card-text-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');

interface CliArgs {
  code?: string;
  pack?: string;
  text?: string;
  interactive?: boolean;
  json?: boolean;
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

function loadSupplementalCard(cardCode: string, packCode = 'core'): any | null {
  const packFile = path.join(ROOT_DIR, `src/data/supplemental/pack/${packCode}.json`);
  if (!fs.existsSync(packFile)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(packFile, 'utf-8'));
    return data.cards?.[cardCode] || null;
  } catch {
    return null;
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

  // Compare with existing supplemental if available
  if (args.code) {
    const existing = loadSupplementalCard(args.code, packCode);
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
