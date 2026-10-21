import { describe, it, expect, vi, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runDeclarationsAudit } from '../../tools/audit/supplemental-declarations-analyzer';

const REPO_ROOT = path.resolve(__dirname, '../..');
const REPORT_DIRS = ['docs/reports/supplemental_data'];
const REPORT_FILES = ['docs/reports/supplemental_declarations_usage_report.md'];
const STALE_HINT =
  'Run `npm run report:declarations` and commit the regenerated reports (the pre-commit hook does it when src/ is staged).';

function listFiles(root: string, rel: string): string[] {
  const dir = path.join(root, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true }).flatMap((entry) => {
    if (!entry.isFile()) return [];
    const parent = path.relative(root, entry.parentPath);
    return [path.join(parent, entry.name).replace(/\\/g, '/')];
  });
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

describe('generated declaration reports', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-reports-'));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  runDeclarationsAudit({ outDir });

  afterAll(() => {
    vi.restoreAllMocks();
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  const generated = [...REPORT_DIRS.flatMap((d) => listFiles(outDir, d)), ...REPORT_FILES].sort();
  const committed = [
    ...REPORT_DIRS.flatMap((d) => listFiles(REPO_ROOT, d)),
    ...REPORT_FILES,
  ].sort();

  it('commits exactly the files the analyzer generates', () => {
    expect(committed, STALE_HINT).toEqual(generated);
  });

  it.each(generated)('%s is up to date', (file) => {
    expect(read(path.join(REPO_ROOT, file)), `${file} is stale. ${STALE_HINT}`).toBe(
      read(path.join(outDir, file)),
    );
  });
});
