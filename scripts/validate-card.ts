#!/usr/bin/env node
import fs from 'fs';
import { CardEnrichmentSchema } from '../src/data/supplemental/schema.js';

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{ path: string; message: string }>;
  data?: unknown;
}

export function validateCardInput(input: string): ValidationResult {
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

  const result = CardEnrichmentSchema.safeParse(parsed);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'root',
        message: issue.message,
      })),
      data: parsed,
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}

// CLI entry point
if (process.argv[2]) {
  const target = process.argv[2];
  const res = validateCardInput(target);

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
  console.error('Usage: npm run card:validate -- <file.md | file.json | "{\\"abilities\\":...}">');
  process.exit(1);
}
