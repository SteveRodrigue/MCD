import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('DualCardInspector Resolution Steps Nice JSON Formatting (Issue #79)', () => {
  const inspectorPath = path.resolve('src/ui/components/editor/DualCardInspector.tsx');
  const fileContent = fs.readFileSync(inspectorPath, 'utf-8');

  it('DualCardInspector renders resolution steps parameters using formatted nice JSON', () => {
    // Must use 2-space indented JSON stringify to avoid single-line unformatted blob
    expect(fileContent).toContain('JSON.stringify(st.params, null, 2)');
  });

  it('DualCardInspector prevents overflow with pre-wrap and break-words styling', () => {
    // Must contain whitespace-pre-wrap and break-words for line wrapping
    expect(fileContent).toContain('whitespace-pre-wrap');
    expect(fileContent).toContain('break-words');
  });

  it('DualCardInspector eliminates raw single-line unformatted step parameter strings', () => {
    // Must NOT contain the old unformatted single-line stringify in resolution steps
    expect(fileContent).not.toContain('{JSON.stringify(st.params)}');
  });
});
