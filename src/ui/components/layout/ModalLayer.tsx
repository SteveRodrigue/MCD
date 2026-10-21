import React from 'react';
import { createPortal } from 'react-dom';
import { Z_CLASS } from '../../styles/z-layers';

interface ModalLayerProps extends React.HTMLAttributes<HTMLDivElement> {
  layer?: 'drawer' | 'modal' | 'banner' | 'critical';
}

// Every full-screen modal, drawer and banner renders through this portal, so no zone,
// transform or hover context can trap it (ADR-0082 findings F2, F5, F6).
export const ModalLayer: React.FC<ModalLayerProps> = ({
  layer = 'modal',
  className = '',
  children,
  ...rest
}) =>
  createPortal(
    <div className={`fixed ${Z_CLASS[layer]} ${className}`} {...rest}>
      {children}
    </div>,
    document.body,
  );
