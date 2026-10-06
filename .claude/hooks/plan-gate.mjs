// H1: no source/test/data edits while a plan awaits approval.
// Skills create temp/.plan-pending when they post the plan and delete it on approval.
import { block, exists, readInput, relPath } from './lib.mjs';

const MARKER = 'temp/.plan-pending';
const GUARDED = ['src/', 'tests/', 'data/', 'tools/', 'scripts/'];

const rel = relPath(readInput().tool_input?.file_path);
if (exists(MARKER) && GUARDED.some((dir) => rel.startsWith(dir))) {
  block(
    `Blocked: "${rel}" is guarded while a plan awaits approval (${MARKER} exists). ` +
      `Wait for the user to approve the plan, then delete ${MARKER} and continue.`,
  );
}
