import { describe, it, expect, afterEach } from 'vitest';
import {
  kernel,
  bindKernel,
  resetKernel,
  isKernelBound,
  KERNEL_ENTRIES,
} from '../../src/engine/kernel';
import { spyKernel, restoreKernelSpies } from '../helpers/kernel-spy';

describe('engine kernel (ADR-0088)', () => {
  it('has every entry bound once the engine is booted', () => {
    const unbound = KERNEL_ENTRIES.filter((name) => !isKernelBound(name));
    expect(unbound).toEqual([]);
  });

  describe('unbound entry', () => {
    const original = kernel.hasPendingSequence;
    afterEach(() => bindKernel({ hasPendingSequence: original }));

    it('fails loudly, naming the entry', () => {
      resetKernel('hasPendingSequence');
      expect(() => kernel.hasPendingSequence({} as never)).toThrow(
        "kernel.hasPendingSequence is not bound: import '@engine/boot'",
      );
    });
  });

  describe('spy', () => {
    it('wraps one entry for a single test and restores it afterwards', () => {
      const original = kernel.hasPendingSequence;
      const calls: unknown[] = [];
      spyKernel('hasPendingSequence', (orig) => (state) => {
        calls.push(state);
        return orig(state);
      });
      const state = {} as never;
      kernel.hasPendingSequence(state);
      expect(calls).toEqual([state]);
      restoreKernelSpies();
      expect(kernel.hasPendingSequence).toBe(original);
      kernel.hasPendingSequence(state);
      expect(calls).toHaveLength(1);
    });
  });
});
