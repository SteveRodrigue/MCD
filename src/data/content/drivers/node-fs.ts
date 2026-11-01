import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ContentDriver, ContentWriter } from '../types';

/** Reads and writes a content root on disk. Node only: tests, scripts and tools, never browser code. */
export class NodeFsDriver implements ContentDriver, ContentWriter {
  constructor(private readonly root: string) {}

  private resolve(rel: string): string {
    return path.join(this.root, ...rel.split('/'));
  }

  async listFiles(dir: string): Promise<string[]> {
    try {
      return (await readdir(this.resolve(dir))).sort();
    } catch {
      return [];
    }
  }

  async listDirs(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(this.resolve(dir), { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
    } catch {
      return [];
    }
  }

  async exists(rel: string): Promise<boolean> {
    try {
      await stat(this.resolve(rel));
      return true;
    } catch {
      return false;
    }
  }

  async readJson(rel: string): Promise<unknown> {
    return JSON.parse(await readFile(this.resolve(rel), 'utf-8'));
  }

  /** Writes through a temp file and a rename, so a reader never sees half a file. */
  async writeJson(rel: string, data: unknown): Promise<void> {
    const target = this.resolve(rel);
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    await rename(temp, target);
  }
}
