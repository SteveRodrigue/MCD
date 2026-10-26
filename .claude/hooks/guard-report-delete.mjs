// H7: a problem report is deleted only after its pinned GameState snapshot exists and parses.
// (The GitHub filing/merge confirmation cannot be checked here; the skill still owns that step.)
import fs from 'node:fs';
import path from 'node:path';
import { block, projectDir, readInput } from './lib.mjs';

const command = readInput().tool_input?.command ?? '';
const isDelete = /\b(?:rm|Remove-Item|del|erase|unlink)\b/.test(command);
if (!isDelete || !/logs[\\/]reports/.test(command)) process.exit(0);

const reportsDir = path.join(projectDir(), 'logs', 'reports');
const gamestatesDir = path.join(projectDir(), 'logs', 'gamestates', 'pinned');
const existing = fs.existsSync(reportsDir)
  ? fs.readdirSync(reportsDir).filter((f) => /^report_\d+_\w+\.json$/.test(f))
  : [];

// Specific files named in the command; a wildcard or bare directory means every pending report.
const named = [...command.matchAll(/report_\d+_\w+\.json/g)].map((m) => m[0]);
const targets = named.length > 0 && !/logs[\\/]reports[\\/]?\s*(?:$|[;&|])|\*/.test(command) ? named : existing;

const missing = [];
for (const file of targets) {
  if (!/^report_\d+_\w+\.json$/.test(file)) continue;
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf8')).gameStateFile;
  } catch {
    continue; // unreadable or already gone: nothing to protect
  }
  if (!snapshot) continue; // submitted with no game open
  try {
    JSON.parse(fs.readFileSync(path.join(gamestatesDir, path.basename(snapshot)), 'utf8'));
  } catch {
    missing.push(`${file} (expected logs/gamestates/pinned/${snapshot})`);
  }
}

if (missing.length > 0) {
  block(
    `Blocked: deleting a report before its GameState snapshot is saved and valid loses the player's data:\n- ${missing.join('\n- ')}\n` +
      'Restore the pinned snapshot (and confirm the GitHub issue or merge comment) first.',
  );
}
