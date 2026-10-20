import { beforeEach } from 'vitest';
import { kernel, type Kernel, type KernelEntry } from '../../src/engine/kernel';

const restorers: Array<() => void> = [];

/**
 * Wraps one kernel entry for the current test (ADR-0088). `wrap` receives the bound entry and
 * returns its replacement. `tests/setup/boot-kernel.ts` restores every spy after each test.
 */
export function spyKernel<K extends KernelEntry>(
  name: K,
  wrap: (original: Kernel[K]) => Kernel[K],
): void {
  const original = kernel[name];
  kernel[name] = wrap(original);
  restorers.push(() => {
    kernel[name] = original;
  });
}

export function restoreKernelSpies(): void {
  while (restorers.length > 0) restorers.pop()!();
}

export interface DispatchedTrigger {
  trigger: string;
  context: Record<string, unknown>;
}

/**
 * Records every `dispatchTrigger` call of each test in the returned array (cleared before each
 * test) and forwards it to the real dispatcher. Call it once, at the top of a test file.
 */
export function recordDispatchedTriggers(): DispatchedTrigger[] {
  const dispatched: DispatchedTrigger[] = [];
  beforeEach(() => {
    dispatched.length = 0;
    spyKernel('dispatchTrigger', (original) => (state, trigger, context) => {
      dispatched.push({ trigger, context: { ...context } });
      return original(state, trigger, context);
    });
  });
  return dispatched;
}
