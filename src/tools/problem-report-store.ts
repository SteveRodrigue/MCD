import fs from 'node:fs';
import path from 'node:path';

/** Pinned snapshots live below `logs/gamestates/`, where the rolling pruner never looks. */
export const PINNED_GAMESTATE_SUBDIR = 'pinned';

export interface SavedProblemReport {
  file: string;
  gameStateFile?: string;
}

/** Writes `data` to `filePath` through a temporary sibling so a reader never sees half a file. */
function writeJsonAtomic(filePath: string, data: unknown): void {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

/** First `<stem>.json` / `<stem>_2.json` / ... not yet present in `dir`. */
function freeFileName(dir: string, stem: string): string {
  let name = `${stem}.json`;
  for (let n = 2; fs.existsSync(path.join(dir, name)); n++) name = `${stem}_${n}.json`;
  return name;
}

/**
 * Saves a problem report under `<root>/logs/reports/` and its GameState under
 * `<root>/logs/gamestates/pinned/` (ADR-0042). The report holds `gameStateFile`, not the state.
 */
export function saveProblemReport(root: string, payload: Record<string, any>): SavedProblemReport {
  const reportsDir = path.join(root, 'logs', 'reports');
  const pinnedDir = path.join(root, 'logs', 'gamestates', PINNED_GAMESTATE_SUBDIR);
  fs.mkdirSync(reportsDir, { recursive: true });

  const { gameState, ...report } = payload;
  const stem = `${payload.timestamp || Date.now()}_${payload.type || 'bug'}`;

  let gameStateFile: string | undefined;
  if (gameState) {
    fs.mkdirSync(pinnedDir, { recursive: true });
    gameStateFile = freeFileName(pinnedDir, `gamestate_${stem}`);
    writeJsonAtomic(path.join(pinnedDir, gameStateFile), gameState);
  }

  const file = freeFileName(reportsDir, `report_${stem}`);
  writeJsonAtomic(path.join(reportsDir, file), { ...report, gameStateFile });
  return { file, gameStateFile };
}
