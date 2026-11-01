import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runLeakGuard, MAX_FILE_BYTES } from '../../tools/audit/leak-guard';

let root: string;
const write = (file: string, content: string | Buffer = 'x') => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content);
  return file;
};
const run = (files: string[], opts = {}) => runLeakGuard(root, { files, ...opts });

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'leak-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('leak guard', () => {
  it('passes a clean tree', () => {
    expect(
      run([
        write('src/a.ts'),
        write('content/packs/core/cards/a.json', '{"pack_code":"core","text":"t"}'),
      ]),
    ).toEqual([]);
  });
  it('flags a PDF', () => {
    expect(run([write('references/a.pdf')]).map((f) => f.check)).toEqual(['pdf']);
  });
  it('flags an image', () => {
    expect(run([write('x/a.PNG')]).map((f) => f.check)).toEqual(['image']);
  });
  it('flags cache folders', () => {
    expect(
      run([write('cache/a.json'), write('content/.cache/b.json')]).map((f) => f.check),
    ).toEqual(['cache', 'cache']);
  });
  it('flags a file over 5 MB', () => {
    expect(run([write('big.bin', Buffer.alloc(MAX_FILE_BYTES + 1))]).map((f) => f.check)).toEqual([
      'size',
    ]);
  });
  it('flags upstream card text outside packs, not inside', () => {
    const f = [
      write('a.json', '{"originalText":"t"}'),
      write('b.json', '{"pack_code":"c","text":"t"}'),
    ];
    expect(run(f).map((x) => x.check)).toEqual(['text', 'text']);
    expect(run([write('content/packs/x/a.json', '{"originalText":"t"}')])).toEqual([]);
  });
  it('honours an allowlist entry with a reason', () => {
    const f = [write('a.json', '{"originalText":"t"}')];
    expect(run(f, { allow: [{ check: 'text', value: 'a.json', reason: 'schema' }] })).toEqual([]);
  });
  it('turns an allowlist entry whose issue is closed, or without reason, into a finding', () => {
    const f = [write('a.json', '{"originalText":"t"}')];
    const closed = run(f, {
      allow: [{ check: 'text', value: 'a.json', reason: 'r', until: 7 }],
      closedIssues: [7],
    });
    expect(closed.map((x) => x.check)).toEqual(['allowlist']);
    expect(
      run([], { allow: [{ check: 'text', value: 'a.json', reason: '' }] }).map((x) => x.check),
    ).toEqual(['allowlist']);
  });
});
