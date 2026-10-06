// H5: agents never add or change audit.comment in supplemental pack JSON (ADR-0067).
// Bypass: the user creates temp/.allow-audit-comment when they explicitly ask for a comment.
import { addedLines, afterText, beforeText, block, exists, readInput, relPath } from './lib.mjs';

const input = readInput();
const rel = relPath(input.tool_input?.file_path);

if (/^src\/data\/supplemental\/pack\/[^/]+\.json$/.test(rel) && !exists('temp/.allow-audit-comment')) {
  const added = addedLines(beforeText(input), afterText(input)).filter((line) => /^"comment"\s*:/.test(line));
  if (added.length > 0) {
    block(
      `Blocked: "${rel}" would add or change audit.comment (${added[0].slice(0, 60)}...). ` +
        'audit.comment is reserved for human notes (ADR-0067). Log ambiguities in docs/ambiguities/ instead. ' +
        'If the user explicitly asked for this comment, create temp/.allow-audit-comment and retry.',
    );
  }
}
