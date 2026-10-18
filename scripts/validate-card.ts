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
  if (fs.existsSync(input)) {
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

  if (!resolvedTypeCode && parsed && typeof parsed === 'object') {
    if (typeof (parsed as any).type_code === 'string') {
      resolvedTypeCode = (parsed as any).type_code;
    } else if (typeof (parsed as any).type === 'string') {
      resolvedTypeCode = (parsed as any).type;
    }
  }

  if (!resolvedTypeCode) {
    let cardCode: string | undefined;
    if (parsed && typeof parsed === 'object') {
      if (typeof (parsed as any).code === 'string') {
        cardCode = (parsed as any).code;
      } else if (typeof (parsed as any).card_code === 'string') {
        cardCode = (parsed as any).card_code;
      } else if (typeof (parsed as any).cardCode === 'string') {
        cardCode = (parsed as any).cardCode;
      }
    }

    if (!cardCode) {
      const filenameMatch = input.match(/(?:supp_)?(\d{5})/);
      if (filenameMatch) {
        cardCode = filenameMatch[1];
      }
    }

    if (cardCode) {
      try {
        const card = extractCard(cardCode);
        if (card?.type_code) {
          resolvedTypeCode = card.type_code;
        }
      } catch {
        // Ignore lookup failure
      }
    }
  }

  const result = CardEnrichmentSchema.safeParse(parsed);
  const eventViolation = findEventDiscardSelfViolations(resolvedTypeCode, parsed as any);

  const errors: Array<{ path: string; message: string }> = [];

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
