import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  cardFile,
  codeOfStem,
  listCardFiles,
  listPackCodes,
  metaFile,
  supplementalFile,
  translationFile,
} from '../../src/tools/content-paths';
import {
  readCardSchema,
  readOfficialPackCodes,
  validatePackSet,
} from '../../scripts/pack-validate';

const REPO_ROOT = path.resolve(__dirname, '../..');
const rel = (file: string) => path.relative(REPO_ROOT, file).split(path.sep).join('/');

describe('content path helper', () => {
  it('maps upstream file stems to pack codes', () => {
    expect(codeOfStem('core')).toBe('core');
    expect(codeOfStem('core_encounter')).toBe('core');
    expect(codeOfStem('mut_gen')).toBe('mut_gen');
    expect(codeOfStem('mut_gen_encounter')).toBe('mut_gen');
  });

  it('spells the on-disk layout in one place', () => {
    expect(rel(cardFile('core_encounter', REPO_ROOT))).toBe(
      'content/packs/core/cards/core_encounter.json',
    );
    expect(rel(supplementalFile('mts', REPO_ROOT))).toBe('content/packs/mts/supplemental/mts.json');
    expect(rel(translationFile('fr', 'core', REPO_ROOT))).toBe(
      'content/packs/core/translations/fr/core.json',
    );
    expect(rel(metaFile('packs', REPO_ROOT))).toBe('content/meta/packs.json');
  });
});

describe('the real content tree', () => {
  it('has one folder per upstream pack, each with a pack.json', () => {
    const upstream = readOfficialPackCodes(REPO_ROOT);
    expect(listPackCodes(REPO_ROOT)).toEqual([...upstream].sort());
    for (const code of upstream) {
      expect(fs.existsSync(path.join(REPO_ROOT, 'content', 'packs', code, 'pack.json'))).toBe(true);
    }
  });

  it('places every card file in the pack its stem names', () => {
    for (const { code, stem } of listCardFiles(REPO_ROOT)) {
      expect(codeOfStem(stem)).toBe(code);
    }
  });

  it('passes pack:validate for the whole tree', () => {
    const findings = validatePackSet(path.join(REPO_ROOT, 'content', 'packs'), {
      officialPackCodes: readOfficialPackCodes(REPO_ROOT),
      cardSchema: readCardSchema(REPO_ROOT),
    });
    expect(findings.map((f) => `${f.file} [${f.check}] ${f.message}`).slice(0, 10)).toEqual([]);
  });
});
