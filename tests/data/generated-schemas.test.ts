import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SCHEMAS, generateSchema } from '../../tools/generate-supplemental-schema';

describe('generated JSON schemas', () => {
  it.each(SCHEMAS.map((entry) => [entry.outputPath, entry] as const))(
    '%s exists and matches its Zod schema',
    (outputPath, entry) => {
      const file = path.resolve(outputPath);
      expect(fs.existsSync(file), `${outputPath} should exist (run schema:generate)`).toBe(true);
      expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual(generateSchema(entry));
    },
  );
});
