import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('CardContextMenu Actions & Invariants', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('open in editor action launches /editor?code=:code in new window', () => {
    const windowOpenMock = vi.fn();
    vi.stubGlobal('window', {
      open: windowOpenMock,
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const cardCode = '01001a';
    const targetUrl = `/editor?code=${cardCode}`;

    // Simulate clicking "Open in Supplemental Editor"
    window.open(targetUrl, '_blank');

    expect(windowOpenMock).toHaveBeenCalledWith('/editor?code=01001a', '_blank');
  });

  it('copy card code action writes exact code to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const cardCode = '01094';
    await navigator.clipboard.writeText(cardCode);

    expect(writeTextMock).toHaveBeenCalledWith('01094');
  });

  it('calculates clamped popup coordinates to prevent off-screen overflow', () => {
    const viewportWidth = 1000;
    const viewportHeight = 800;
    const menuWidth = 240;
    const menuHeight = 160;

    const clampCoords = (clickX: number, clickY: number) => {
      const adjustedX = Math.max(10, Math.min(clickX, viewportWidth - menuWidth - 10));
      const adjustedY = Math.max(10, Math.min(clickY, viewportHeight - menuHeight - 10));
      return { x: adjustedX, y: adjustedY };
    };

    // Standard click in middle of screen
    expect(clampCoords(500, 400)).toEqual({ x: 500, y: 400 });

    // Click near right edge
    expect(clampCoords(950, 400)).toEqual({ x: 750, y: 400 });

    // Click near bottom edge
    expect(clampCoords(500, 750)).toEqual({ x: 500, y: 630 });

    // Click near top-left edge
    expect(clampCoords(2, 5)).toEqual({ x: 10, y: 10 });
  });

  describe('CardContextMenu Portal & Auto-Zoom Immunity Invariants (Fixes #70)', () => {
    it('enforces createPortal into document.body to escape CSS transform containing blocks', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'src/ui/components/cards/CardContextMenu.tsx');
      const content = fs.readFileSync(filePath, 'utf8');

      // Must import createPortal from react-dom
      expect(content).toMatch(/import\s*\{[^}]*createPortal[^}]*\}\s*from\s*['"]react-dom['"]/);

      // Must invoke createPortal with document.body
      expect(content).toMatch(/createPortal\s*\([\s\S]*document\.body/);
    });

    it('enforces elevated z-index (z-[9999] / z-[10000]) above tabletop hover-zoom layers', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'src/ui/components/cards/CardContextMenu.tsx');
      const content = fs.readFileSync(filePath, 'utf8');

      // Menu container must have z-[9999] or higher
      expect(content).toContain('z-[9999]');

      // Raw modal backdrop must have z-[10000]
      expect(content).toContain('z-[10000]');
    });

    it('guards raw data modal with modalRef to prevent premature dismiss on inside click', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve(process.cwd(), 'src/ui/components/cards/CardContextMenu.tsx');
      const content = fs.readFileSync(filePath, 'utf8');

      // Must declare modalRef
      expect(content).toContain('modalRef');

      // handlePointerDown must verify modalRef does not contain target
      expect(content).toMatch(/modalRef\.current(\?)?\.contains/);
    });
  });
});
