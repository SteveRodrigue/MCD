// H12: tests must pass or fail; never add skipped, todo or focused tests under tests/.
import { addedLines, afterText, beforeText, block, readInput, relPath } from './lib.mjs';

const input = readInput();
const rel = relPath(input.tool_input?.file_path);

if (rel.startsWith('tests/')) {
  const pattern = /\b(?:it|test|describe)\.(?:skip|todo|only)\b|\b(?:xit|xdescribe|xtest|fit|fdescribe)\s*\(/;
  const added = addedLines(beforeText(input), afterText(input)).filter((line) => pattern.test(line));
  if (added.length > 0) {
    block(
      `Blocked: "${rel}" adds a skipped/todo/focused test (${added[0].slice(0, 70)}). ` +
        'Zero Skipped Tests Invariant: make the test pass or fail instead of hiding unfinished work.',
    );
  }
}
