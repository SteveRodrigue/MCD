import React from 'react';
import { themeFontVars } from './modal-styles';
import { useModalStyle } from './useModalStyle';

export interface GameThemeRootProps {
  /** True on the game screens; false adds nothing, so the screen keeps the page's system sans and the default font roles. */
  active: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The element the game screens sit in. When active it sets the theme's font variables and size changes
 * (as `ModalScaffold` does for a modal), so everything inside follows Headlines, Body, Numbers & codes and
 * the text sizes, and unlabelled text is the theme's Body font. When inactive (the card editor) nothing
 * is set: the editor (which names `font-sans` itself) keeps the system sans, and its `font-mono` stays the system monospace.
 */
export const GameThemeRoot: React.FC<GameThemeRootProps> = ({
  active,
  className = '',
  children,
}) => {
  const { style } = useModalStyle();
  return (
    <div
      className={active ? `${className} font-body` : className}
      style={active ? themeFontVars(style) : undefined}
    >
      {children}
    </div>
  );
};
