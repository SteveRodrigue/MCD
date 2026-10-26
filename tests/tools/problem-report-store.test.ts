import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { saveProblemReport } from '../../src/tools/problem-report-store';

describe('saveProblemReport', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-report-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const read = (...parts: string[]) =>
    JSON.parse(fs.readFileSync(path.join(root, ...parts), 'utf8'));

  it('pins the GameState outside the rolling folder and references it from the report', () => {
    const state = { roundNumber: 3, phase: 'PLAYER' };
    const saved = saveProblemReport(root, {
      type: 'bug',
      timestamp: 111,
      title: 't',
      gameState: state,
    });

    expect(saved).toEqual({ file: 'report_111_bug.json', gameStateFile: 'gamestate_111_bug.json' });
    expect(read('logs', 'gamestates', 'pinned', 'gamestate_111_bug.json')).toEqual(state);
    const report = read('logs', 'reports', 'report_111_bug.json');
    expect(report.gameState).toBeUndefined();
    expect(report.gameStateFile).toBe('gamestate_111_bug.json');
    expect(report.title).toBe('t');
  });

  it('writes no snapshot when no game was open', () => {
    const saved = saveProblemReport(root, { type: 'feature', timestamp: 5 });

    expect(saved.gameStateFile).toBeUndefined();
    expect(fs.existsSync(path.join(root, 'logs', 'gamestates'))).toBe(false);
  });

  it('never overwrites a pinned snapshot with the same timestamp', () => {
    const first = saveProblemReport(root, { type: 'bug', timestamp: 9, gameState: { n: 1 } });
    const second = saveProblemReport(root, { type: 'bug', timestamp: 9, gameState: { n: 2 } });

    expect(second.gameStateFile).toBe('gamestate_9_bug_2.json');
    expect(read('logs', 'gamestates', 'pinned', first.gameStateFile!)).toEqual({ n: 1 });
    expect(second.file).toBe('report_9_bug_2.json');
  });
});
