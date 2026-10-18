import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useTimeout } from '../../src/ui/hooks/useTimeout';

// Delayed state updates are cancelled with the component (AUD-20261017-232534 F020).
describe('useTimeout', () => {
  afterEach(() => vi.useRealTimers());

  const Probe = ({ onFire, delay }: { onFire: () => void; delay: number }) => {
    const later = useTimeout();
    later(onFire, delay);
    return null;
  };

  it('runs the callback after the delay while mounted', () => {
    vi.useFakeTimers();
    const onFire = vi.fn();
    render(<Probe onFire={onFire} delay={500} />);
    vi.advanceTimersByTime(500);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('drops a pending callback when the component unmounts', () => {
    vi.useFakeTimers();
    const onFire = vi.fn();
    const { unmount } = render(<Probe onFire={onFire} delay={500} />);
    unmount();
    vi.advanceTimersByTime(500);
    expect(onFire).not.toHaveBeenCalled();
  });
});
