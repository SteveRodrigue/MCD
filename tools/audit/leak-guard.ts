/**
 * leak:check - fails when forbidden official material is tracked by git.
 *
 * Path rules: pdf, image, cache, size. Text rule: upstream card JSON outside content/packs.
 * Spec: docs/backlog/content_coupling_audit.md section 6. Allowlist: tools/audit/leak-guard.allow.json.
 * Exported `runLeakGuard` is used by the CLI below and by tests/tools/leak-guard.test.ts.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

export interface Finding {
  file: string;
  line: number;
  check: string;
  message: string;
}

export interface AllowEntry {
  check: string;
  value: string;
  reason: string;
  /** GitHub issue that will remove the need for this entry; a closed issue turns the entry into a finding. */
  until?: number;
}

export interface LeakGuardOptions {
  allow?: AllowEntry[];
  /** Tracked files, relative to root. Defaults to `git ls-files`. */
  files?: string[];
  /** Closed issue numbers, used for allowlist `until` (tests inject it; the CLI leaves it empty). */
  closedIssues?: number[];
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|tiff)$/i;
const CACHE = /^(cache|content\/\.cache)\//;
/** Upstream card data is allowed inside packs only. */
const PACK_AREA = /^content\/packs\//;

export function listTrackedFiles(root: string): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 28 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

export function runLeakGuard(root: string, options: LeakGuardOptions = {}): Finding[] {
  const allow = options.allow ?? [];
  const files = options.files ?? listTrackedFiles(root);
  const findings: Finding[] = [];
  const add = (file: string, check: string, message: string) => {
    if (!allow.some((a) => a.check === check && a.value === file))
      findings.push({ file, line: 1, check, message });
  };

  for (const file of files) {
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) continue;
    if (file.toLowerCase().endsWith('.pdf')) add(file, 'pdf', 'PDFs must not be tracked');
    else if (IMAGE.test(file)) add(file, 'image', 'images must not be tracked');
    if (CACHE.test(file)) add(file, 'cache', 'cache folders must not be tracked');
    const size = fs.statSync(abs).size;
    if (size > MAX_FILE_BYTES && !file.toLowerCase().endsWith('.pdf'))
      add(file, 'size', `${(size / 1048576).toFixed(1)} MB is over the 5 MB limit`);
    if (file.endsWith('.json') && !PACK_AREA.test(file)) {
      const text = fs.readFileSync(abs, 'utf8');
      if (text.includes('"originalText"'))
        add(file, 'text', 'contains "originalText" outside content/packs/');
      else if (text.includes('"pack_code"') && text.includes('"text"'))
        add(file, 'text', 'looks like upstream card data outside content/packs/');
    }
  }

  for (const a of allow) {
    if (!a.reason)
      findings.push({
        file: 'tools/audit/leak-guard.allow.json',
        line: 1,
        check: 'allowlist',
        message: `"${a.value}" has no reason`,
      });
    else if (a.until && options.closedIssues?.includes(a.until))
      findings.push({
        file: 'tools/audit/leak-guard.allow.json',
        line: 1,
        check: 'allowlist',
        message: `"${a.value}" waits for #${a.until}, which is closed: remove the entry`,
      });
  }
  return findings.sort((a, b) => a.file.localeCompare(b.file));
}

function main(): void {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const allowPath = path.join(root, 'tools/audit/leak-guard.allow.json');
  const allow: AllowEntry[] = fs.existsSync(allowPath)
    ? JSON.parse(fs.readFileSync(allowPath, 'utf8'))
    : [];
  const findings = runLeakGuard(root, { allow });
  for (const f of findings) console.log(`${f.file}:${f.line} [${f.check}] ${f.message}`);
  console.log(findings.length ? `\n${findings.length} leak finding(s).` : 'leak:check passed.');
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
