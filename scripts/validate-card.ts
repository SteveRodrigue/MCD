#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CardEnrichmentSchema,
  findEventDiscardSelfViolations,
} from '../src/data/supplemental/schema.js';
import { extractCard } from './extract-card.js';

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{ path: string; message: string }>;
  data?: unknown;
}

export function validateCardInput(input: string, upstreamTypeCode?: string): ValidationResult {
  let jsonString = input.trim();

  // If input is a file path
  const fileExists = fs.existsSync(input);
  if (fileExists) {
    const fileContent = fs.readFileSync(input, 'utf8');
    // If markdown, extract JSON block
    if (input.endsWith('.md') || fileContent.includes('```json')) {
      const match = fileContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (!match) {
        return {
          valid: false,
          errors: [{ path: 'root', message: 'No ```json ... ``` block found in markdown file.' }],
        };
      }
      jsonString = match[1];
    } else {
      jsonString = fileContent;
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return {
      valid: false,
      errors: [{ path: 'json', message: `Invalid JSON syntax: ${err.message}` }],
    };
  }

  let resolvedTypeCode = upstreamTypeCode;
  const errors: Array<{ path: string; message: string }> = [];

  if (!resolvedTypeCode) {
    // Only trust the card code from a file name (supp_<id>.*), never from inline JSON text.
    const cardCode = fileExists
      ? path.basename(input).match(/^(?:supp_)?(\d{5})\b/)?.[1]
      : undefined;
    let lookupError = '';
    if (cardCode) {
      try {
        resolvedTypeCode = extractCard(cardCode)?.type_code;
      } catch (err: any) {
        lookupError = ` (lookup of ${cardCode} failed: ${err.message})`;
      }
    }
    if (!resolvedTypeCode) {
      errors.push({
        path: 'type',
        message: `Card type unresolved${lookupError}; name the file supp_<id>.* or pass the upstream type as the 2nd argument.`,
      });
    }
  }

  const result = CardEnrichmentSchema.safeParse(parsed);
  const eventViolation = findEventDiscardSelfViolations(
    resolvedTypeCode,
    parsed as { abilities?: unknown },
  );

  if (!result.success) {
    errors.push(
      ...result.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'root',
        message: issue.message,
      })),
    );
  }

  if (eventViolation) {
    errors.push({
      path: 'cost.discardSelf',
      message: eventViolation,
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      data: parsed,
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}

// CLI entry point
const isDirectExecution =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  if (process.argv[2]) {
    const target = process.argv[2];
    const upstreamType = process.argv[3];
    const res = validateCardInput(target, upstreamType);

    if (res.valid) {
      console.log(`✅ Schema validation passed for: ${target}`);
      process.exit(0);
    } else {
      console.error(`❌ Schema validation FAILED for: ${target}`);
      for (const err of res.errors || []) {
        console.error(`  - [${err.path}]: ${err.message}`);
      }
      process.exit(1);
    }
  } else {
    console.error(
      'Usage: npm run card:validate -- <file.md | file.json | "{\\"abilities\\":...}"> [upstream_type]',
    );
    process.exit(1);
  }
}
