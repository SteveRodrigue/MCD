import type { ContentDriver, ContentWriter } from '../types';

/** Shape of `<base>/index.json`, which the dev server builds from the content folder. */
export interface ContentIndex {
  files: string[];
}

/**
 * Reads a content root over HTTP (the Vite dev and preview server). Directory listings come from
 * the index file because HTTP cannot list a folder.
 */
export class FetchDriver implements ContentDriver, ContentWriter {
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

  async listDirs(dir: string): Promise<string[]> {
    const prefix = `${dir}/`;
    const names = new Set<string>();
    for (const file of await this.loadIndex()) {
      if (!file.startsWith(prefix)) continue;
      const [first, ...rest] = file.slice(prefix.length).split('/');
      if (rest.length > 0) names.add(first);
    }
    return [...names].sort();
  }

  async exists(path: string): Promise<boolean> {
    return (await this.loadIndex()).has(path);
  }

  async readJson(path: string): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}/${path}`);
    if (!res.ok) throw new Error(`Cannot read ${path} (HTTP ${res.status})`);
    return res.json();
  }

  /** Dev server only: the content endpoint refuses anything but supplemental files of writable packs. */
  async writeJson(path: string, data: unknown): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(detail.error ?? `Cannot write ${path} (HTTP ${res.status})`);
    }
  }
}
