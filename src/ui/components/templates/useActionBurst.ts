import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalStyle } from './useModalStyle';

export interface BurstState {
  word: string;
  /** Changes on every fire so the animation restarts even for the same word. */
  n: number;
}

export const BURST_MS = 1000;

/** Fires the active style's sound-effect burst (POW!, KA-POW!, APPROVED...) on player actions. */
export const useActionBurst = (): { burst: BurstState | null; fire: () => void } => {
  const { style } = useModalStyle();
  const [burst, setBurst] = useState<BurstState | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const fire = useCallback(() => {
    const { words } = style.fx;
    counter.current += 1;
    setBurst({ word: words[counter.current % words.length], n: counter.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBurst(null), BURST_MS);
  }, [style]);

  return { burst, fire };
};
