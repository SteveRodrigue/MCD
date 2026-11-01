import { describe, it, expect, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { bootContent, resetContent } from '../../src/data/content/apply';
import { contentDriver } from '../helpers/content';

// The engine and UI must start with no content (ADR-0092): the welcome screen explains it (M7).
afterAll(async () => {
  await bootContent(contentDriver);
});

describe('zero-pack boot', () => {
  it('shows the welcome screen with the fan-project notice and the disabled actions', async () => {
    resetContent();
    render(<App />);
    expect(await screen.findByText('NO CONTENT YET', {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByText(/unofficial fan project/)).toBeTruthy();
    expect(screen.getByText('npm run content:sync')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Add content folder' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Import pack (zip)' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('opens the Content screen from the welcome screen', async () => {
    resetContent();
    render(<App />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'See the packs on disk' }, { timeout: 10000 }),
    );
    expect(await screen.findByText('CONTENT')).toBeTruthy();
    expect(screen.getByText(/No pack folders found/)).toBeTruthy();
  });
});
