import React from 'react';
import { useModalStyle } from '../../theme/useModalStyle';

export const FAN_PROJECT_NOTICE =
  'Marvel Champions Digital is an unofficial fan project. It is not affiliated with, endorsed by or sponsored by Fantasy Flight Games or Marvel. It ships no official card text or art.';

export const FanProjectNotice: React.FC = () => {
  const { style } = useModalStyle();
  return <p className={`text-xs leading-snug ${style.muted}`}>{FAN_PROJECT_NOTICE}</p>;
};
