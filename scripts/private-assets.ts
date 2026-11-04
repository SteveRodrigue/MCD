/**
 * Marvel Champions Digital (MCD) - Private assets synchronization CLI.
 *
 * Usage:
 *   npm run assets:pull [-- [--copy] [--dir <centralDir>]]
 *   npm run assets:push [-- [--message <commitMsg>] [--dir <centralDir>]]
 *   npm run assets:status [-- [--dir <centralDir>]]
 *
 * Manages copyrighted official reference PDFs and art packs stored in the
 * private repository SteveRodrigue/mcd-private-content.
 *
 * In public MCD worktrees, this tool establishes zero-copy directory junctions
 * so all worktrees share reference documents and art packs without duplicating ~450 MB.
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  contentRoot,
  defaultPrivateAssetsDir,
  referencesDir,
  rulesheetsDir,
} from '../src/tools/content-paths';

export const PRIVATE_REPO_URL = 'https://github.com/SteveRodrigue/mcd-private-content.git';

export interface CommandRunner {
  (command: string, args: string[], options?: childProcess.ExecFileSyncOptions): string;
}

export const defaultRunner: CommandRunner = (cmd, args, opts) => {
  return childProcess
    .execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    })
    .toString();
};

export interface AssetStatus {
  centralDir: string;
  centralExists: boolean;
  centralClean?: boolean;
  centralCommit?: string;
  rulesheets: {
    exists: boolean;
    isLinked: boolean;
    linkTarget?: string;
    fileCount: number;
  };
  rulesReferencePdf: {
    exists: boolean;
    sizeBytes: number;
  };
  artPacks: {
    exists: boolean;
    isLinked: boolean;
    linkTarget?: string;
    packCount: number;
  };
}

export interface PullOptions {
  centralDir?: string;
  workspaceDir?: string;
  copy?: boolean;
  runner?: CommandRunner;
}

export interface PushOptions {
  centralDir?: string;
  workspaceDir?: string;
  message?: string;
  runner?: CommandRunner;
}

export function isSymlinkOrJunction(targetPath: string): boolean {
  try {
    const stat = fs.lstatSync(targetPath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function getLinkTarget(targetPath: string): string | undefined {
  try {
    return fs.readlinkSync(targetPath);
  } catch {
    return undefined;
  }
}

export function linkOrCopyDirectory(
  sourceDir: string,
  destinationDir: string,
  copy: boolean = false,
): 'linked' | 'copied' | 'already-linked' {
  if (!fs.existsSync(sourceDir)) {
    return 'copied';
  }

  if (isSymlinkOrJunction(destinationDir)) {
    const existingTarget = getLinkTarget(destinationDir);
    const resolvedTarget = existingTarget
      ? path.resolve(path.dirname(destinationDir), existingTarget)
      : '';
    const resolvedSource = path.resolve(sourceDir);
    if (resolvedTarget.toLowerCase() === resolvedSource.toLowerCase()) {
      return 'already-linked';
    }
    fs.unlinkSync(destinationDir);
  }

  if (copy) {
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
    fs.cpSync(sourceDir, destinationDir, { recursive: true, force: true });
    return 'copied';
  }

  // Ensure parent directory exists
  const parent = path.dirname(destinationDir);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }

  // Remove existing directory if empty or replace with junction
  if (fs.existsSync(destinationDir)) {
    const contents = fs.readdirSync(destinationDir);
    if (contents.length === 0) {
      fs.rmdirSync(destinationDir);
    } else {
      // Destination has files: copy missing files into source first, then replace with junction
      fs.cpSync(destinationDir, sourceDir, { recursive: true, force: false });
      fs.rmSync(destinationDir, { recursive: true, force: true });
    }
  }

  try {
    const linkType = os.platform() === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(path.resolve(sourceDir), destinationDir, linkType);
    return 'linked';
  } catch {
    // Fallback to copy if symlink/junction fails (e.g. sandbox or unsupported filesystem)
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
    fs.cpSync(sourceDir, destinationDir, { recursive: true, force: true });
    return 'copied';
  }
}

export function linkOrCopyFile(
  sourceFile: string,
  destinationFile: string,
  copy: boolean = false,
): 'linked' | 'copied' | 'skipped' {
  if (!fs.existsSync(sourceFile)) {
    return 'skipped';
  }

  const parent = path.dirname(destinationFile);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }

  if (fs.existsSync(destinationFile)) {
    const statSource = fs.statSync(sourceFile);
    const statDest = fs.statSync(destinationFile);
    if (statSource.size === statDest.size && statSource.ino === statDest.ino) {
      return 'linked';
    }
  }

  if (!copy) {
    try {
      if (fs.existsSync(destinationFile)) {
        fs.unlinkSync(destinationFile);
      }
      fs.linkSync(sourceFile, destinationFile);
      return 'linked';
    } catch {
      // Fallback to copy if hard link fails (e.g. across drives)
    }
  }

  fs.copyFileSync(sourceFile, destinationFile);
  return 'copied';
}

export function ensureCentralRepo(
  centralDir: string,
  runner: CommandRunner = defaultRunner,
): { updated: boolean; error?: string } {
  if (!fs.existsSync(centralDir)) {
    try {
      const parent = path.dirname(centralDir);
      if (!fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
      }
      runner('git', ['clone', PRIVATE_REPO_URL, centralDir]);
      return { updated: true };
    } catch (err) {
      return {
        updated: false,
        error: `Could not clone private repository from ${PRIVATE_REPO_URL}: ${String(err)}`,
      };
    }
  }

  // Central directory exists: update it
  try {
    runner('git', ['-C', centralDir, 'pull', '--ff-only']);
    return { updated: true };
  } catch (err) {
    return {
      updated: false,
      error: `Could not pull latest changes in ${centralDir}: ${String(err)}`,
    };
  }
}

export function pullAssets(options: PullOptions = {}): { success: boolean; message: string } {
  const runner = options.runner ?? defaultRunner;
  const centralDir = options.centralDir ?? defaultPrivateAssetsDir();
  const workspaceDir = options.workspaceDir ?? process.cwd();

  const repoCheck = ensureCentralRepo(centralDir, runner);
  if (!repoCheck.updated && !fs.existsSync(centralDir)) {
    return {
      success: false,
      message:
        repoCheck.error ??
        'Private repository is not accessible. (Open-source contributors without access can proceed without official PDFs).',
    };
  }

  const centralRulesheets = path.join(centralDir, 'references', 'rulesheets');
  const workspaceRulesheets = rulesheetsDir(workspaceDir);
  const rulesheetsResult = linkOrCopyDirectory(
    centralRulesheets,
    workspaceRulesheets,
    options.copy,
  );

  const centralPdf = path.join(centralDir, 'references', 'mc_rulesreference_v18_compressed.pdf');
  const workspacePdf = path.join(
    referencesDir(workspaceDir),
    'mc_rulesreference_v18_compressed.pdf',
  );
  const pdfResult = linkOrCopyFile(centralPdf, workspacePdf, options.copy);

  const centralArtPacks = path.join(centralDir, 'content', 'art-packs');
  const workspaceArtPacks = path.join(contentRoot(workspaceDir), 'art-packs');
  const artPacksResult = linkOrCopyDirectory(centralArtPacks, workspaceArtPacks, options.copy);

  return {
    success: true,
    message: `Assets synchronized from ${centralDir}:\n  - rulesheets: ${rulesheetsResult}\n  - Rules Reference PDF: ${pdfResult}\n  - art-packs: ${artPacksResult}`,
  };
}

export function pushAssets(options: PushOptions = {}): { success: boolean; message: string } {
  const runner = options.runner ?? defaultRunner;
  const centralDir = options.centralDir ?? defaultPrivateAssetsDir();
  const workspaceDir = options.workspaceDir ?? process.cwd();

  if (!fs.existsSync(centralDir)) {
    return {
      success: false,
      message: `Central repository directory does not exist at ${centralDir}. Run "npm run assets:pull" first.`,
    };
  }

  // If workspace folders are not junctions, sync modifications into central repo first
  const workspaceRulesheets = rulesheetsDir(workspaceDir);
  const centralRulesheets = path.join(centralDir, 'references', 'rulesheets');
  if (fs.existsSync(workspaceRulesheets) && !isSymlinkOrJunction(workspaceRulesheets)) {
    fs.cpSync(workspaceRulesheets, centralRulesheets, { recursive: true, force: false });
  }

  const workspacePdf = path.join(
    referencesDir(workspaceDir),
    'mc_rulesreference_v18_compressed.pdf',
  );
  const centralPdf = path.join(centralDir, 'references', 'mc_rulesreference_v18_compressed.pdf');
  if (fs.existsSync(workspacePdf) && !fs.existsSync(centralPdf)) {
    fs.copyFileSync(workspacePdf, centralPdf);
  }

  const workspaceArtPacks = path.join(contentRoot(workspaceDir), 'art-packs');
  const centralArtPacks = path.join(centralDir, 'content', 'art-packs');
  if (fs.existsSync(workspaceArtPacks) && !isSymlinkOrJunction(workspaceArtPacks)) {
    fs.cpSync(workspaceArtPacks, centralArtPacks, { recursive: true, force: false });
  }

  // Check git status in central directory
  try {
    const statusOutput = runner('git', ['-C', centralDir, 'status', '--porcelain']).trim();
    if (!statusOutput) {
      return {
        success: true,
        message: 'No changes to push in private assets repository.',
      };
    }

    const commitMsg = options.message ?? 'chore: update private assets and reference documentation';
    runner('git', ['-C', centralDir, 'add', '.']);
    runner('git', ['-C', centralDir, 'commit', '-m', commitMsg]);
    runner('git', ['-C', centralDir, 'push', 'origin', 'main']);

    return {
      success: true,
      message: `Pushed changes to ${PRIVATE_REPO_URL}:\n${statusOutput}`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to push private assets: ${String(err)}`,
    };
  }
}

export function getAssetStatus(
  centralDir: string = defaultPrivateAssetsDir(),
  workspaceDir: string = process.cwd(),
  runner: CommandRunner = defaultRunner,
): AssetStatus {
  const centralExists = fs.existsSync(centralDir);
  let centralClean: boolean | undefined;
  let centralCommit: string | undefined;

  if (centralExists) {
    try {
      const status = runner('git', ['-C', centralDir, 'status', '--porcelain']).trim();
      centralClean = status.length === 0;
      centralCommit = runner('git', ['-C', centralDir, 'rev-parse', '--short', 'HEAD']).trim();
    } catch {
      // Git command failed or central is not a git repo
    }
  }

  const wsRulesheets = rulesheetsDir(workspaceDir);
  const rulesheetsLinked = isSymlinkOrJunction(wsRulesheets);
  let rulesheetsCount = 0;
  if (fs.existsSync(wsRulesheets)) {
    try {
      rulesheetsCount = fs.readdirSync(wsRulesheets).filter((f) => f.endsWith('.pdf')).length;
    } catch {
      // Directory read error
    }
  }

  const wsPdf = path.join(referencesDir(workspaceDir), 'mc_rulesreference_v18_compressed.pdf');
  let pdfSize = 0;
  if (fs.existsSync(wsPdf)) {
    try {
      pdfSize = fs.statSync(wsPdf).size;
    } catch {
      // stat error
    }
  }

  const wsArtPacks = path.join(contentRoot(workspaceDir), 'art-packs');
  const artPacksLinked = isSymlinkOrJunction(wsArtPacks);
  let artPacksCount = 0;
  if (fs.existsSync(wsArtPacks)) {
    try {
      artPacksCount = fs
        .readdirSync(wsArtPacks, { withFileTypes: true })
        .filter((d) => d.isDirectory()).length;
    } catch {
      // Directory read error
    }
  }

  return {
    centralDir,
    centralExists,
    centralClean,
    centralCommit,
    rulesheets: {
      exists: fs.existsSync(wsRulesheets),
      isLinked: rulesheetsLinked,
      linkTarget: rulesheetsLinked ? getLinkTarget(wsRulesheets) : undefined,
      fileCount: rulesheetsCount,
    },
    rulesReferencePdf: {
      exists: fs.existsSync(wsPdf),
      sizeBytes: pdfSize,
    },
    artPacks: {
      exists: fs.existsSync(wsArtPacks),
      isLinked: artPacksLinked,
      linkTarget: artPacksLinked ? getLinkTarget(wsArtPacks) : undefined,
      packCount: artPacksCount,
    },
  };
}

function parseCliArgs(args: string[]): {
  command: 'pull' | 'push' | 'status' | 'help';
  copy?: boolean;
  dir?: string;
  message?: string;
} {
  const command = (args[0] as 'pull' | 'push' | 'status' | 'help') || 'status';
  let copy = false;
  let dir: string | undefined;
  let message: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--copy') {
      copy = true;
    } else if (arg === '--dir' && i + 1 < args.length) {
      dir = args[++i];
    } else if ((arg === '--message' || arg === '-m') && i + 1 < args.length) {
      message = args[++i];
    }
  }

  return { command, copy, dir, message };
}

export function main(args: string[] = process.argv.slice(2)): void {
  const { command, copy, dir, message } = parseCliArgs(args);

  if (command === 'help') {
    console.log(`
Marvel Champions Digital - Private Assets Manager

Commands:
  pull     Pull private repo and link assets via directory junctions into current worktree
           Options: [--copy] [--dir <centralDir>]
  push     Push any local asset additions or modifications to the private repo
           Options: [--message <msg>] [--dir <centralDir>]
  status   Show status of central clone and workspace links
           Options: [--dir <centralDir>]
`);
    return;
  }

  if (command === 'pull') {
    const result = pullAssets({ centralDir: dir, copy });
    console.log(result.message);
    if (!result.success) {
      process.exit(1);
    }
    return;
  }

  if (command === 'push') {
    const result = pushAssets({ centralDir: dir, message });
    console.log(result.message);
    if (!result.success) {
      process.exit(1);
    }
    return;
  }

  if (command === 'status') {
    const status = getAssetStatus(dir);
    console.log('=== Marvel Champions Digital - Private Assets Status ===');
    console.log(`Central Repository: ${status.centralDir}`);
    console.log(`  Exists: ${status.centralExists ? 'Yes' : 'No'}`);
    if (status.centralExists) {
      console.log(`  Commit: ${status.centralCommit ?? 'unknown'}`);
      console.log(`  Clean:  ${status.centralClean ? 'Yes' : 'Uncommitted changes'}`);
    }
    console.log('Workspace Links:');
    console.log(
      `  Rulesheets: ${status.rulesheets.exists ? 'Found' : 'Missing'} (${status.rulesheets.fileCount} PDFs)` +
        (status.rulesheets.isLinked ? ` [Junction -> ${status.rulesheets.linkTarget}]` : ''),
    );
    console.log(
      `  Rules Reference PDF: ${status.rulesReferencePdf.exists ? 'Found' : 'Missing'} (${(status.rulesReferencePdf.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`,
    );
    console.log(
      `  Art Packs: ${status.artPacks.exists ? 'Found' : 'Missing'} (${status.artPacks.packCount} packs)` +
        (status.artPacks.isLinked ? ` [Junction -> ${status.artPacks.linkTarget}]` : ''),
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
