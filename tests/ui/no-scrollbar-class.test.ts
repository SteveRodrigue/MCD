import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `no-scrollbar` is not a Tailwind utility: the project defines it (Issue #384). A class that is
 * used but defined nowhere does nothing, and the browser's own scrollbar shows.
 */
describe('no-scrollbar utility', () => {
  const root = join(__dirname, '..', '..');
  const css = readFileSync(join(root, 'src', 'ui', 'styles', 'index.css'), 'utf8');

  it('hides the scrollbar in Firefox and in WebKit/Blink browsers', () => {
    expect(css).toMatch(/\.no-scrollbar\s*\{[^}]*scrollbar-width:\s*none/);
    expect(css).toMatch(/\.no-scrollbar::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
  });
});
