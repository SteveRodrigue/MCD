import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ensureCentralRepo,
  getAssetStatus,
  isSymlinkOrJunction,
  linkOrCopyDirectory,
  linkOrCopyFile,
  pullAssets,
  pushAssets,
} from '../../scripts/private-assets';

let tempDir: string;
let centralDir: string;
let workspaceDir: string;

function write(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-assets-test-'));
  centralDir = path.join(tempDir, 'central');
  workspaceDir = path.join(tempDir, 'workspace');

  fs.mkdirSync(centralDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });

  // Mock files in central repository
  write(path.join(centralDir, 'references', 'mc_rulesreference_v18_compressed.pdf'), 'PDF-CONTENT');
  write(path.join(centralDir, 'references', 'rulesheets', 'sheet1.pdf'), 'SHEET1');
  write(path.join(centralDir, 'references', 'rulesheets', 'sheet2.pdf'), 'SHEET2');
  write(path.join(centralDir, 'content', 'art-packs', 'pack1', 'art-pack.json'), '{"id":"pack1"}');
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('linkOrCopyDirectory', () => {
  it('creates directory junction or symlink when destination does not exist', () => {
    const src = path.join(centralDir, 'references', 'rulesheets');
    const dst = path.join(workspaceDir, 'references', 'rulesheets');

    const result = linkOrCopyDirectory(src, dst, false);
    expect(['linked', 'copied']).toContain(result);
    expect(fs.existsSync(path.join(dst, 'sheet1.pdf'))).toBe(true);
  });

  it('detects already-linked directory without re-creating', () => {
    const src = path.join(centralDir, 'references', 'rulesheets');
    const dst = path.join(workspaceDir, 'references', 'rulesheets');

    const firstResult = linkOrCopyDirectory(src, dst, false);
    if (firstResult === 'linked') {
      const secondResult = linkOrCopyDirectory(src, dst, false);
      expect(secondResult).toBe('already-linked');
    }
  });

  it('copies directory when copy option is true', () => {
    const src = path.join(centralDir, 'references', 'rulesheets');
    const dst = path.join(workspaceDir, 'references', 'rulesheets');

    const result = linkOrCopyDirectory(src, dst, true);
    expect(result).toBe('copied');
    expect(isSymlinkOrJunction(dst)).toBe(false);
    expect(fs.existsSync(path.join(dst, 'sheet2.pdf'))).toBe(true);
  });
});

describe('linkOrCopyFile', () => {
  it('links or copies file to destination', () => {
    const src = path.join(centralDir, 'references', 'mc_rulesreference_v18_compressed.pdf');
    const dst = path.join(workspaceDir, 'references', 'mc_rulesreference_v18_compressed.pdf');

    const result = linkOrCopyFile(src, dst, false);
    expect(['linked', 'copied']).toContain(result);
    expect(fs.existsSync(dst)).toBe(true);
    expect(fs.readFileSync(dst, 'utf8')).toBe('PDF-CONTENT');
  });

  it('returns skipped when source file does not exist', () => {
    const src = path.join(centralDir, 'nonexistent.pdf');
    const dst = path.join(workspaceDir, 'nonexistent.pdf');

    expect(linkOrCopyFile(src, dst)).toBe('skipped');
  });
});

describe('ensureCentralRepo', () => {
  it('calls git clone when central directory is missing', () => {
    const commands: string[][] = [];
    const mockRunner = (cmd: string, args: string[]) => {
      commands.push([cmd, ...args]);
      return '';
    };

    const missingDir = path.join(tempDir, 'missing-central');
    ensureCentralRepo(missingDir, mockRunner);

    expect(commands.length).toBe(1);
    expect(commands[0][0]).toBe('git');
    expect(commands[0][1]).toBe('clone');
    expect(commands[0][3]).toBe(missingDir);
  });

  it('calls git pull when central directory exists', () => {
    const commands: string[][] = [];
    const mockRunner = (cmd: string, args: string[]) => {
      commands.push([cmd, ...args]);
      return '';
    };

    ensureCentralRepo(centralDir, mockRunner);
    expect(commands.length).toBe(1);
    expect(commands[0][0]).toBe('git');
    expect(commands[0][3]).toBe('pull');
  });
});

describe('pullAssets and getAssetStatus', () => {
  it('synchronizes assets and reflects in status report', () => {
    const mockRunner = () => '';

    const pullResult = pullAssets({
      centralDir,
      workspaceDir,
      runner: mockRunner,
    });

    expect(pullResult.success).toBe(true);

    const status = getAssetStatus(centralDir, workspaceDir, () => '');
    expect(status.rulesheets.exists).toBe(true);
    expect(status.rulesheets.fileCount).toBe(2);
    expect(status.rulesReferencePdf.exists).toBe(true);
    expect(status.artPacks.exists).toBe(true);
    expect(status.artPacks.packCount).toBe(1);
  });
});

describe('pushAssets', () => {
  it('reports no changes when central repo is clean', () => {
    const mockRunner = (_cmd: string, args: string[]) => {
      if (args.includes('status')) return '';
      return '';
    };

    const pushResult = pushAssets({
      centralDir,
      workspaceDir,
      runner: mockRunner,
    });

    expect(pushResult.success).toBe(true);
    expect(pushResult.message).toContain('No changes to push');
  });

  it('stages, commits, and pushes when central repo has changes', () => {
    const executed: string[][] = [];
    const mockRunner = (cmd: string, args: string[]) => {
      executed.push([cmd, ...args]);
      if (args.includes('status')) return ' M references/rulesheets/sheet1.pdf';
      return '';
    };

    const pushResult = pushAssets({
      centralDir,
      workspaceDir,
      message: 'test commit',
      runner: mockRunner,
    });

    expect(pushResult.success).toBe(true);
    expect(executed.some((e) => e.includes('add'))).toBe(true);
    expect(executed.some((e) => e.includes('commit') && e.includes('test commit'))).toBe(true);
    expect(executed.some((e) => e.includes('push'))).toBe(true);
  });
});
