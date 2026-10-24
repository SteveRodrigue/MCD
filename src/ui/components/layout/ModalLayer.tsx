import React from 'react';
import { createPortal } from 'react-dom';
import { Z_CLASS } from '../../styles/z-layers';
import { themeFontVars } from '../../theme/modal-styles';
import { useModalStyle } from '../../theme/useModalStyle';

interface ModalLayerProps extends React.HTMLAttributes<HTMLDivElement> {
  layer?: 'drawer' | 'modal' | 'banner' | 'critical';
  /** False for the lab's own chrome, which never follows a theme. */
  themed?: boolean;
}

// Every full-screen modal, drawer and banner renders through this portal, so no zone,
// transform or hover context can trap it (ADR-0082 findings F2, F5, F6). The portal sits outside the
// game root, so the layer sets the theme's font roles and text sizes itself (`themeFontVars`): whatever
// it holds, modal, drawer or newspaper, follows the theme and its text is the theme's Body font.
export const ModalLayer: React.FC<ModalLayerProps> = ({
  layer = 'modal',
  themed = true,
  className = '',
  style,
  children,
  ...rest
}) => {
  const { style: themeStyle } = useModalStyle();
  return createPortal(
    <div
      className={`fixed ${Z_CLASS[layer]} ${themed ? 'font-body ' : ''}${className}`}
      style={themed ? { ...themeFontVars(themeStyle), ...style } : style}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
};
