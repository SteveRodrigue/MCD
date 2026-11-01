import type { ContentDriver } from '../types';

/** Shape of `<base>/index.json`, which the dev server builds from the content folder. */
export interface ContentIndex {
  files: string[];
}

/**
 * Reads a content root over HTTP (the Vite dev and preview server). Directory listings come from
 * the index file because HTTP cannot list a folder.
 */
export class FetchDriver implements ContentDriver {
  private index: Promise<Set<string>> | undefined;

  constructor(
    private readonly baseUrl: string = '/__content',
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  private loadIndex(): Promise<Set<string>> {
    this.index ??= this.fetchImpl(`${this.baseUrl}/index.json`).then(async (res) => {
      if (!res.ok) throw new Error(`Content index unavailable (HTTP ${res.status})`);
      const body = (await res.json()) as ContentIndex;
      return new Set(body.files);
    });
    return this.index;
  }

  async listFiles(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    const names: string[] = [];
    for (const file of await this.loadIndex()) {
      if (file.startsWith(prefix) && !file.slice(prefix.length).includes('/')) {
        names.push(file.slice(prefix.length));
      }
    }
    return names.sort();
  }

  async exists(path: string): Promise<boolean> {
    return (await this.loadIndex()).has(path);
  }

  async readJson(path: string): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}/${path}`);
    if (!res.ok) throw new Error(`Cannot read ${path} (HTTP ${res.status})`);
    return res.json();
  }
}
