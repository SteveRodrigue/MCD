import React from 'react';
import { BUILD_LABEL } from '../build-info';
import { Z_CLASS } from '../styles/z-layers';

/** The build label, fixed at the bottom right of every screen; it never intercepts a click. */
export const BuildVersionBadge: React.FC = () => (
  <div
    aria-label="Build version"
    className={`fixed bottom-1 right-2 ${Z_CLASS.raised} pointer-events-none select-text font-mono text-[10px] opacity-60`}
  >
    {BUILD_LABEL}
  </div>
);
