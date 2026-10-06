// H7: a problem report is deleted only after its local GameState snapshot exists and parses.
// (The GitHub filing/merge confirmation cannot be checked here; the skill still owns that step.)
import fs from 'node:fs';
import path from 'node:path';
import { block, projectDir, readInput } from './lib.mjs';

const command = readInput().tool_input?.command ?? '';
const isDelete = /\b(?:rm|Remove-Item|del|erase|unlink)\b/.test(command);
if (!isDelete || !/logs[\\/]reports/.test(command)) process.exit(0);

const reportsDir = path.join(projectDir(), 'logs', 'reports');
const gamestatesDir = path.join(projectDir(), 'logs', 'gamestates');
const existing = fs.existsSync(reportsDir)
  ? fs.readdirSync(reportsDir).filter((f) => /^report_\d+_\w+\.json$/.test(f))
  : [];

// Specific files named in the command; a wildcard or bare directory means every pending report.
const named = [...command.matchAll(/report_\d+_\w+\.json/g)].map((m) => m[0]);
const targets = named.length > 0 && !/logs[\\/]reports[\\/]?\s*(?:$|[;&|])|\*/.test(command) ? named : existing;

const missing = [];
for (const file of targets) {
  const match = /^report_(\d+)_(\w+)\.json$/.exec(file);
  if (!match) continue;
  const prefix = `gamestate_${match[1]}_${match[2]}`;
  const snapshots = fs.existsSync(gamestatesDir)
    ? fs.readdirSync(gamestatesDir).filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    : [];
  const valid = snapshots.some((f) => {
    try {
      JSON.parse(fs.readFileSync(path.join(gamestatesDir, f), 'utf8'));
      return true;
    } catch {
      return false;
    }
  });
  if (!valid) missing.push(`${file} (expected logs/gamestates/${prefix}*.json)`);
}

if (missing.length > 0) {
  block(
    `Blocked: deleting a report before its GameState snapshot is saved and valid loses the player's data:\n- ${missing.join('\n- ')}\n` +
      'Write and verify the snapshot (and confirm the GitHub issue or merge comment) first.',
  );
}
