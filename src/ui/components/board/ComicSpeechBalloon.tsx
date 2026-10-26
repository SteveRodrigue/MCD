import React from 'react';
import { FormattedComicDialogue } from '../../utils/comic-log-formatter';
import { useModalStyle } from '../../theme/useModalStyle';
import { useThemeExtras } from '../../theme/useThemeExtras';

interface ComicSpeechBalloonProps {
  dialogue: FormattedComicDialogue;
  index: number;
}

/**
 * Daily Bugle Classifieds & Flash News Bulletin entry for Combat Log.
 * Renders state-driven comic actions with character color banners,
 * narrative headlines, dialogue quotes, and comic stat pills.
 */
export const ComicSpeechBalloon: React.FC<ComicSpeechBalloonProps> = ({ dialogue, index }) => {
  const { style } = useModalStyle();
  const { newspaper: np } = useThemeExtras();
  const {
    type,
    speakerName,
    speakerRole,
    speakerAvatar,
    speakerColor,
    speakerContrastColor,
    speakerBorderColor,
    dialogueQuote,
    narrativeAction,
    onomatopoeia,
    sourceCard,
    stats,
    round,
  } = dialogue;

  // Banner color theme with fallbacks
  const bannerBg =
    speakerColor ||
    (type === 'narrator_caption' ? '#d97706' : type === 'villain_shout' ? '#701a75' : '#1d4ed8');

  const bannerText = speakerContrastColor || (type === 'narrator_caption' ? '#0f172a' : '#ffffff');

  const bannerBorder =
    speakerBorderColor ||
    (type === 'narrator_caption' ? '#b45309' : type === 'villain_shout' ? '#d97706' : '#d97706');

  const defaultTitle =
    type === 'narrator_caption'
      ? 'DAILY BUGLE DISPATCH'
      : type === 'villain_shout'
        ? 'VILLAIN ACTION'
        : type === 'hero_thought'
          ? 'ALTER-EGO MEMO'
          : 'HERO BULLETIN';

  return (
    <div
      className={`relative my-2.5 overflow-hidden p-0! ${np.classified} animate-in fade-in duration-150`}
    >
      {/* 1. Top Classification Strip / Banner */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b-2 font-black text-xs uppercase tracking-wider"
        style={{
          backgroundColor: bannerBg,
          color: bannerText,
          borderColor: bannerBorder,
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-sm shrink-0">
            {speakerAvatar || (type === 'narrator_caption' ? '📜' : '💬')}
          </span>
          <span className="truncate font-bold">{speakerName || defaultTitle}</span>
          {speakerRole && (
            <span
              className={`px-1.5 py-0.2 text-nano font-black uppercase tracking-wider shrink-0 opacity-90 ${style.badge}`}
              style={{
                borderColor: bannerText,
                color: bannerText,
              }}
            >
              {speakerRole.replace('_', ' ')}
            </span>
          )}
          {sourceCard && (
            <span
              className={`px-1.5 py-0.2 text-nano font-black uppercase tracking-wider shrink-0 text-white ${style.badge}`}
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                borderColor: 'rgba(255,255,255,0.4)',
              }}
            >
              🃏 {sourceCard}
            </span>
          )}
          {round !== undefined && type === 'narrator_caption' && (
            <span className={`px-1.5 py-0.2 text-nano font-black shrink-0 ${style.chip}`}>
              R{round}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {onomatopoeia && (
            <span className={`text-micro font-black px-1.5 py-0.5 -rotate-1 ${style.chip}`}>
              {onomatopoeia}
            </span>
          )}
          <span className="font-mono text-micro opacity-75 font-bold">#{index + 1}</span>
        </div>
      </div>

      {/* 2. Newsprint Bulletin Body */}
      <div className="p-3">
        {/* In-character dialogue quote box */}
        {dialogueQuote && (
          <div
            className={`py-1 my-1 text-xs sm:text-sm font-bold tracking-wide ${np.quote} ${np.body}`}
            style={{ borderLeftColor: bannerBg }}
          >
            {type === 'hero_thought' ? '💭 ' : '💬 '}&ldquo;{dialogueQuote}&rdquo;
          </div>
        )}

        {/* Prominent Bold Narrative Headline */}
        <p className={`${np.body} text-xs sm:text-sm font-bold mt-1`}>{narrativeAction}</p>

        {/* Comic Stat Badges */}
        {stats &&
          (stats.damage !== undefined ||
            stats.threat !== undefined ||
            stats.recovery !== undefined ||
            stats.cost !== undefined) && (
            <div className={`flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t ${np.rule}`}>
              {stats.damage !== undefined && (
                <span
                  className={`bg-comic-red text-white text-mini font-black px-2 py-0.5 ${style.badge}`}
                >
                  💥 {stats.damage} DMG
                </span>
              )}
              {stats.threat !== undefined && (
                <span
                  className={`bg-purple-800 text-purple-100 text-mini font-black px-2 py-0.5 ${style.badge}`}
                >
                  ⚠️ {stats.threat > 0 ? `+${stats.threat}` : stats.threat} THREAT
                </span>
              )}
              {stats.recovery !== undefined && (
                <span
                  className={`bg-emerald-600 text-white text-mini font-black px-2 py-0.5 ${style.badge}`}
                >
                  ✨ +{stats.recovery} RECOVER
                </span>
              )}
              {stats.cost !== undefined && (
                <span
                  className={`bg-amber-400 text-slate-950 text-mini font-black px-2 py-0.5 ${style.badge}`}
                >
                  ⚡ {stats.cost} COST
                </span>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
