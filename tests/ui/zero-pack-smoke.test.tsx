import { describe, it, expect, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { bootContent, resetContent } from '../../src/data/content/apply';
import { contentDriver } from '../helpers/content';

// The engine and UI must start with no content (ADR-0092). The polished empty state is M7; here
// the app only has to render the scenario screen without throwing.
afterAll(async () => {
  await bootContent(contentDriver);
});

describe('zero-pack boot', () => {
  it('renders the scenario screen with an empty catalog', async () => {
    resetContent();
    render(<App />);
    expect(await screen.findByText(/SCENARIO SELECTION/, {}, { timeout: 10000 })).toBeTruthy();
  });
});
