import { describe, it, expect } from 'vitest';

describe('UI test environment dev API isolation (#324)', () => {
  it('never reaches a running dev server: /api requests answer 503 offline', async () => {
    const res = await fetch('/api/stats');

    expect(res.status).toBe(503);
    expect(location.origin).not.toBe('http://localhost:3000');
  });
});
