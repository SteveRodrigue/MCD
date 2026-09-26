import { vi } from 'vitest';

// Mock card art URL service to resolve synchronously in test environment,
// preventing un-wrapped asynchronous state updates in CardView
vi.mock('../../src/ui/services/card-cache-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/services/card-cache-service')>();
  return {
    ...actual,
    getCardArtUrl: vi.fn().mockResolvedValue(null),
  };
});

// Suppress repetitive React act() console warnings in unit tests
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('was not wrapped in act(...)')) {
    return;
  }
  originalConsoleError(...args);
};
