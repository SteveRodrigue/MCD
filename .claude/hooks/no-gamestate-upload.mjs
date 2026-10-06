// H8: GameState JSON stays local; never send it to GitHub in an issue/PR body or comment.
import fs from 'node:fs';
import path from 'node:path';
import { block, projectDir, readInput } from './lib.mjs';

const input = readInput();
const command = input.tool_input?.command ?? '';
if (!/\bgh\s+(?:issue|pr)\s+(?:create|comment|edit)\b|\bgh\s+api\b/.test(command)) process.exit(0);

let text = command;
const base = input.cwd || projectDir();
for (const m of command.matchAll(/(?:--body-file|-F)\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g)) {
  const file = m[1].replace(/^["']|["']$/g, '');
  try {
    text += `\n${fs.readFileSync(path.resolve(base, file), 'utf8')}`;
  } catch {
    // unreadable body file: nothing to inspect
  }
}

if (/\bgameState\\?"\s*:|\broundNumber\\?"\s*:|\bactivePlayerIndex\\?"\s*:/.test(text)) {
  block(
    'Blocked: this GitHub call contains GameState JSON. GameState snapshots stay local under ' +
      'logs/gamestates/ (they are gitignored). Reference the local path and the local-only notice instead.',
  );
}
