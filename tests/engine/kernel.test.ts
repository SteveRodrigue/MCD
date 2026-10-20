import { describe, it, expect, afterEach } from 'vitest';
import { kernel, bindKernel, resetKernel, KERNEL_ENTRIES } from '../../src/engine/kernel';
import { spyKernel } from '../helpers/kernel-spy';

describe('engine kernel (ADR-0088)', () => {
  it('has every entry bound once the engine is booted', () => {
    for (const name of KERNEL_ENTRIES) {
      expect(() => (kernel[name] as () => unknown).call(undefined)).not.toThrow(/not bound/);
    }
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
    const calls: unknown[] = [];

    it('wraps one entry for a single test', () => {
      spyKernel('hasPendingSequence', (original) => (state) => {
        calls.push(state);
        return original(state);
      });
      const state = {} as never;
      kernel.hasPendingSequence(state);
      expect(calls).toEqual([state]);
    });

    it('is restored after the test', () => {
      kernel.hasPendingSequence({} as never);
      expect(calls).toHaveLength(1);
    });
  });
});
