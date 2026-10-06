/**
 * Effect params read check (Issue #230).
 *
 * For each allowed `effectParams` key in src/data/supplemental/effect-params.ts, reports
 * whether the key name is read in src/engine/ (property access, optional chaining,
 * bracket access or destructuring). This is a textual check, not a gate: it prints
 * a report and always exits 0. Keys flagged "NOT READ" deserve a manual look.
 *
 * Usage: npx tsx tools/audit/effect-params-read-check.ts
 */
import fs from 'fs';
import path from 'path';
import { EFFECT_PARAM_KEYS } from '../../src/data/supplemental/effect-params';

const ENGINE_DIR = path.resolve(process.cwd(), 'src/engine');

function listTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const sources = listTsFiles(ENGINE_DIR).map((file) => ({
  file: path.relative(process.cwd(), file),
  text: fs.readFileSync(file, 'utf8'),
}));

function isRead(key: string): string[] {
  const patterns = [
    new RegExp(String.raw`\.${key}`),
    new RegExp(String.raw`\[\s*['"]${key}['"]\s*\]`),
    new RegExp(String.raw`[{,]\s*${key}\s*[,}:=]`),
  ];
  return sources.filter((s) => patterns.some((p) => p.test(s.text))).map((s) => s.file);
}

let unread = 0;
let total = 0;
for (const [effect, keys] of Object.entries(EFFECT_PARAM_KEYS)) {
  for (const key of keys) {
    total++;
    const files = isRead(key);
    if (files.length === 0) {
      unread++;
      console.log(`NOT READ  ${effect}.${key}`);
    }
  }
}
console.log(
  `\n${total} allowed (effect, key) pairs checked, ${unread} key name(s) not read in src/engine/.`,
);
