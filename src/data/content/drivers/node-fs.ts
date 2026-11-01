import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ContentDriver } from '../types';

/** Reads a content root from disk. Node only: tests, scripts and tools, never browser code. */
export class NodeFsDriver implements ContentDriver {
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
}
