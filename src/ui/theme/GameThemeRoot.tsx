import React from 'react';
import type { CSSProperties } from 'react';
import { themeFontVars } from './modal-styles';
import { useModalStyle } from './useModalStyle';
import { useThemeExtras } from './useThemeExtras';

export interface GameThemeRootProps {
  /** True on the game screens; false keeps the comic paper and the default font roles (the card editor). */
  active: boolean;
  className?: string;
  children: React.ReactNode;
}

interface Surface {
  bg: string;
  text: string;
  texture?: CSSProperties;
  textureClass: string;
}

/** The comic paper and its halftone dots: the surface of the card editor, which never follows a theme. */
const EDITOR_SURFACE: Surface = { bg: 'bg-comic-paper', text: '', textureClass: 'bg-bendy-dots' };

/**
 * The element the game screens sit in. When active it is the theme's table: its background, texture and
 * text colour, and it sets the theme's font variables and size changes (as `ModalScaffold` does for a modal),
 * so everything inside follows Headlines, Body, Numbers & codes and the text sizes, and unlabelled text is the
 * theme's Body font. When inactive (the card editor) it keeps the comic paper, the system sans (the editor
 * names `font-sans` itself) and the default font roles, and its `font-mono` stays the system monospace.
 */
export const GameThemeRoot: React.FC<GameThemeRootProps> = ({
  active,
  className = '',
  children,
}) => {
  const { style } = useModalStyle();
  const { table } = useThemeExtras();
  const surface: Surface = active ? table : EDITOR_SURFACE;
  return (
    <div
      className={`${className} ${surface.bg} ${surface.text}${active ? ' font-body' : ''}`}
      style={active ? themeFontVars(style) : undefined}
    >
      <div
        aria-hidden="true"
        data-testid="table-texture"
        className={`fixed inset-0 pointer-events-none z-table ${surface.textureClass}`}
        style={surface.texture}
      />
      {children}
    </div>
  );
};
