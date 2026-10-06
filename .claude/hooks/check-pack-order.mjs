// H4: supplemental pack JSON keeps cards in canonical ascending ID order (01001a -> 01001b -> 01002).
// Runs after an edit; exit 2 feeds the message back to Claude so it can re-sort.
import fs from 'node:fs';
import path from 'node:path';
import { block, projectDir, readInput, relPath } from './lib.mjs';

const rel = relPath(readInput().tool_input?.file_path);
if (!/^src\/data\/supplemental\/pack\/[^/]+\.json$/.test(rel)) process.exit(0);

let cards;
try {
  cards = JSON.parse(fs.readFileSync(path.resolve(projectDir(), rel), 'utf8')).cards;
} catch (error) {
  block(`${rel} is not valid JSON after the edit: ${error.message}`);
}

const keys = Object.keys(cards ?? {});
for (let i = 1; i < keys.length; i += 1) {
  if (keys[i - 1] > keys[i]) {
    block(
      `${rel}: card key "${keys[i]}" is out of order after "${keys[i - 1]}". ` +
        'Keep cards in ascending ID order; move the entry instead of appending at the bottom.',
    );
  }
}
