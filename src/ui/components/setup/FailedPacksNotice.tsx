import React from 'react';
import { getLoadedContent } from '../../../data/content/store';
import { useModalStyle } from '../../theme/useModalStyle';

/** One line per enabled pack that did not load, with the loader's reason. */
export const FailedPacksNotice: React.FC = () => {
  const { style } = useModalStyle();
  const failed = getLoadedContent().descriptions.filter(
    (pack) => pack.enabled && (pack.state === 'failed' || pack.state === 'needs-pack'),
  );
  if (failed.length === 0) return null;
  return (
    <div role="alert" className={`p-3 text-sm ${style.panel} ${style.text}`}>
      {failed.map((pack) => (
        <p key={pack.id}>
          <strong>{pack.name}</strong> was not loaded: {pack.reason}
        </p>
      ))}
    </div>
  );
};
