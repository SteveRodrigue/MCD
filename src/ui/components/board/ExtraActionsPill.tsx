import React from 'react';
import { Newspaper } from 'lucide-react';
import { Beacon } from '../../theme/kit/controls';
import { useModalStyle } from '../../theme/useModalStyle';
import { useNewspaperProps } from '../../theme/useNewspaperProps';
import { useThemeExtras } from '../../theme/useThemeExtras';

interface ExtraActionsPillProps {
  /** Teammate actions waiting (multi-hero only: 0 in solo play). */
  teamActionCount: number;
  villainActionCount: number;
  /** The ring stops once the Daily Bugle is open: the player has seen it. */
  isNewspaperOpen: boolean;
  onOpen: () => void;
}

/**
 * EXTRA!: the floating pill that says Call for Action or Villain actions are waiting. Those actions
 * are not always available and are easy to miss, so the pill carries a Beacon ring.
 */
export const ExtraActionsPill: React.FC<ExtraActionsPillProps> = ({
  teamActionCount,
  villainActionCount,
  isNewspaperOpen,
  onOpen,
}) => {
  const { style } = useModalStyle();
  const newspaperProps = useNewspaperProps();
  const { newspaper } = useThemeExtras();
  const plural = (count: number) => (count > 1 ? 's' : '');
  const summary = [
    teamActionCount > 0 ? `${teamActionCount} Call for Action` : '',
    villainActionCount > 0 ? `${villainActionCount} Villain Actions` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="fixed top-4 left-4 z-content">
      <Beacon active={!isNewspaperOpen}>
        <button
          onClick={onOpen}
          {...newspaperProps}
          className={`font-news-headline font-black flex items-center gap-2 px-4 py-2 cursor-pointer transition-all hover:scale-105 active:translate-y-0.5 ${newspaper.pill}`}
          title={`EXTRA! Daily Bugle Action Bulletin (${summary})`}
        >
          <div className="flex items-center gap-1.5">
            <Newspaper className="w-5 h-5 text-comic-red" />
            <span className="font-news-headline font-black tracking-tight text-sm uppercase">
              EXTRA!
            </span>
          </div>
          <div className="flex items-center gap-1">
            {teamActionCount > 0 && (
              <span
                data-testid="extra-call-count"
                className={`text-micro px-1.5 py-0.2 font-mono font-bold bg-comic-yellow text-comic-black ${style.badge}`}
                title={`${teamActionCount} Teammate Action${plural(teamActionCount)}`}
              >
                {teamActionCount} TEAM
              </span>
            )}
            {villainActionCount > 0 && (
              <span
                data-testid="extra-villain-count"
                className={`text-micro px-1.5 py-0.2 font-mono font-bold bg-comic-red text-white ${style.badge}`}
                title={`${villainActionCount} Villain/Scheme Action${plural(villainActionCount)}`}
              >
                {villainActionCount} VILLAIN
              </span>
            )}
          </div>
        </button>
      </Beacon>
    </div>
  );
};

export default ExtraActionsPill;
