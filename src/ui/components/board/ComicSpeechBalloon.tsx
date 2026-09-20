import React from 'react';
import { FormattedComicDialogue } from '../../utils/comic-log-formatter';

interface ComicSpeechBalloonProps {
  dialogue: FormattedComicDialogue;
  index: number;
  fontClass?: string;
}

/**
 * Daily Bugle Classifieds & Flash News Bulletin entry for Combat Log.
 * Renders state-driven comic actions with character color banners,
 * narrative headlines, dialogue quotes, and comic stat pills.
 */
export const ComicSpeechBalloon: React.FC<ComicSpeechBalloonProps> = ({
  dialogue,
  index,
  fontClass = 'font-dialogue',
}) => {
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
    <div className="relative my-2.5 bg-[#fdfbf7] border-2 border-comic-black rounded-md shadow-comic-sm overflow-hidden transition-all hover:border-comic-black animate-in fade-in duration-150">
      {/* 1. Top Classification Strip / Banner */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b-2 font-comic font-black text-xs uppercase tracking-wider"
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
              className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider border shrink-0 opacity-90"
              style={{
                borderColor: bannerText,
                color: bannerText,
              }}
            >
              {speakerRole.replace('_', ' ')}
            </span>
          )}
          {round !== undefined && type === 'narrator_caption' && (
            <span className="bg-white text-slate-900 px-1.5 py-0.2 rounded border border-comic-black text-[9px] font-black shrink-0 shadow-comic-sm">
              R{round}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {onomatopoeia && (
            <span className="bg-comic-yellow text-comic-black font-comic text-[10px] font-black px-1.5 py-0.5 rounded border border-comic-black shadow-comic-sm transform -rotate-1">
              {onomatopoeia}
            </span>
          )}
          <span className="font-mono text-[10px] opacity-75 font-bold">#{index + 1}</span>
        </div>
      </div>

      {/* 2. Newsprint Bulletin Body */}
      <div className="p-3">
        {/* In-character dialogue quote box */}
        {dialogueQuote && (
          <div
            className={`p-2 rounded border-l-4 my-1 text-xs sm:text-sm ${fontClass} italic font-bold tracking-wide`}
            style={{
              backgroundColor: '#f4ede2',
              borderLeftColor: bannerBg,
              color: '#1e293b',
            }}
          >
            {type === 'hero_thought' ? '💭 ' : '💬 '}&ldquo;{dialogueQuote}&rdquo;
          </div>
        )}

        {/* Prominent Bold Narrative Headline */}
        <p className={`${fontClass} text-xs sm:text-sm font-bold text-slate-900 leading-snug mt-1`}>
          {narrativeAction}
        </p>

        {/* Comic Stat Badges */}
        {stats &&
          (stats.damage !== undefined ||
            stats.threat !== undefined ||
            stats.recovery !== undefined ||
            stats.cost !== undefined) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200">
              {stats.damage !== undefined && (
                <span className="bg-comic-red text-white text-[11px] font-comic font-black px-2 py-0.5 rounded border border-comic-black shadow-comic-sm">
                  💥 {stats.damage} DMG
                </span>
              )}
              {stats.threat !== undefined && (
                <span className="bg-purple-800 text-purple-100 text-[11px] font-comic font-black px-2 py-0.5 rounded border border-purple-950 shadow-comic-sm">
                  ⚠️ {stats.threat > 0 ? `+${stats.threat}` : stats.threat} THREAT
                </span>
              )}
              {stats.recovery !== undefined && (
                <span className="bg-emerald-600 text-white text-[11px] font-comic font-black px-2 py-0.5 rounded border border-emerald-950 shadow-comic-sm">
                  ✨ +{stats.recovery} RECOVER
                </span>
              )}
              {stats.cost !== undefined && (
                <span className="bg-amber-400 text-slate-950 text-[11px] font-comic font-black px-2 py-0.5 rounded border border-comic-black shadow-comic-sm">
                  ⚡ {stats.cost} COST
                </span>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
