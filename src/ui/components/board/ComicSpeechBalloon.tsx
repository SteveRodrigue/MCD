import React from 'react';
import { FormattedComicDialogue } from '../../utils/comic-log-formatter';

interface ComicSpeechBalloonProps {
  dialogue: FormattedComicDialogue;
  index: number;
  fontClass?: string;
}

export const ComicSpeechBalloon: React.FC<ComicSpeechBalloonProps> = ({
  dialogue,
  index,
  fontClass = 'font-dialogue',
}) => {
  const {
    type,
    speakerName,
    speakerAvatar,
    dialogueQuote,
    narrativeAction,
    onomatopoeia,
    stats,
    round,
  } = dialogue;

  // =========================================================================
  // 1. 📜 NARRATOR CAPTION (Classic Stan Lee Golden-Yellow Box)
  // =========================================================================
  if (type === 'narrator_caption') {
    return (
      <div className="relative my-3 bg-amber-300 border-3 border-comic-black p-4 shadow-comic rounded-md transform -rotate-0.5 animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b-2 border-comic-black/40 pb-1.5 mb-2 text-xs font-comic font-black uppercase text-slate-900 tracking-wider">
          <div className="flex items-center gap-2">
            <span className="text-sm">📜</span>
            <span>NARRATOR DISPATCH</span>
            {round !== undefined && (
              <span className="bg-white px-2 py-0.5 rounded border border-comic-black text-[10px] font-black shadow-comic-sm">
                ROUND {round}
              </span>
            )}
          </div>
          <span className="text-slate-700 font-mono text-xs font-bold">#{index + 1}</span>
        </div>

        {onomatopoeia && (
          <div className="inline-block bg-comic-black text-amber-300 font-comic text-sm sm:text-base font-black px-3 py-1 rounded border border-comic-black transform -rotate-1 mb-2 shadow-comic-sm tracking-wide">
            {onomatopoeia}
          </div>
        )}

        <p
          className={`${fontClass} text-sm sm:text-base font-bold text-comic-black leading-relaxed tracking-wide`}
        >
          {narrativeAction}
        </p>
      </div>
    );
  }

  // =========================================================================
  // 2. 🦹 VILLAIN SHOUT (Menacing Jagged Spiky Burst Balloon)
  // =========================================================================
  if (type === 'villain_shout') {
    return (
      <div className="relative my-3 mr-4 ml-2 animate-in slide-in-from-left duration-200">
        <div className="bg-rose-950 text-white border-3 border-comic-red p-3.5 rounded-lg shadow-comic relative">
          {/* Header with Villain Name & Icon */}
          <div className="flex items-center justify-between border-b border-rose-800 pb-1.5 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{speakerAvatar || '🦹'}</span>
              <span className="font-comic font-black text-sm text-rose-300 uppercase tracking-wide">
                {speakerName || 'VILLAIN'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onomatopoeia && (
                <span className="bg-comic-red text-white font-comic text-xs font-black px-2 py-0.5 rounded border border-comic-black shadow-sm">
                  {onomatopoeia}
                </span>
              )}
              <span className="text-rose-400 font-mono text-xs">#{index + 1}</span>
            </div>
          </div>

          {/* Menacing Shouting Quote */}
          {dialogueQuote && (
            <div
              className={`bg-rose-900/90 border-l-4 border-comic-red p-2 rounded-r my-1.5 text-xs sm:text-sm ${fontClass} font-black text-rose-100 tracking-wide uppercase italic`}
            >
              "{dialogueQuote}"
            </div>
          )}

          {/* Action Narrative */}
          <p
            className={`${fontClass} text-xs sm:text-sm font-bold text-rose-100 leading-normal mt-1`}
          >
            {narrativeAction}
          </p>

          {/* Stat Pills */}
          {stats && (stats.damage || stats.threat) && (
            <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-rose-900">
              {stats.damage !== undefined && (
                <span className="bg-comic-red text-white text-xs font-comic font-black px-2.5 py-0.5 rounded border border-comic-black shadow-sm">
                  💥 {stats.damage} DMG
                </span>
              )}
              {stats.threat !== undefined && (
                <span className="bg-purple-900 text-purple-200 text-xs font-comic font-black px-2.5 py-0.5 rounded border border-purple-500 shadow-sm">
                  ⚠️ +{stats.threat} THREAT
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. 💭 HERO THOUGHT BUBBLE (Cloud Scalloped Alter-Ego Balloon)
  // =========================================================================
  if (type === 'hero_thought') {
    return (
      <div className="relative my-3 ml-4 mr-2 animate-in slide-in-from-right duration-200">
        <div className="bg-sky-50 border-3 border-dashed border-sky-600 p-3.5 rounded-2xl shadow-comic relative">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-sky-200 pb-1.5 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{speakerAvatar || '🧑'}</span>
              <span className="font-comic font-bold text-sm text-sky-900 uppercase">
                {speakerName || 'ALTER-EGO'}{' '}
                <span className="text-xs text-sky-600 font-normal">(THOUGHT)</span>
              </span>
            </div>
            <span className="text-sky-500 font-mono text-xs">#{index + 1}</span>
          </div>

          {/* Thought Quote */}
          {dialogueQuote && (
            <div
              className={`bg-white p-2.5 rounded-xl border border-sky-200 text-xs sm:text-sm ${fontClass} italic font-bold text-slate-800 my-1.5`}
            >
              💭 "{dialogueQuote}"
            </div>
          )}

          {/* Narrative Action */}
          <p
            className={`${fontClass} text-xs sm:text-sm text-slate-900 leading-normal font-bold mt-1`}
          >
            {narrativeAction}
          </p>

          {/* Recovery Pill */}
          {stats?.recovery !== undefined && (
            <div className="mt-2">
              <span className="bg-emerald-600 text-white text-xs font-comic font-black px-2.5 py-0.5 rounded border border-comic-black shadow-sm">
                ✨ +{stats.recovery} HP RECOVERED
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 4. 🦸 HERO SPEECH BALLOON (Classic Rounded White Balloon with Pointer)
  // =========================================================================
  return (
    <div className="relative my-3 ml-4 mr-2 animate-in slide-in-from-right duration-200">
      <div className="bg-white border-3 border-comic-black p-3.5 rounded-xl shadow-comic relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{speakerAvatar || '🦸'}</span>
            <span className="font-comic font-black text-sm text-sky-700 uppercase tracking-wide">
              {speakerName || 'HERO'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onomatopoeia && (
              <span className="bg-comic-red text-white font-comic text-xs font-black px-2 py-0.5 rounded border border-comic-black shadow-sm">
                {onomatopoeia}
              </span>
            )}
            <span className="text-slate-400 font-mono text-xs">#{index + 1}</span>
          </div>
        </div>

        {/* Hero Speech Quote */}
        {dialogueQuote && (
          <div
            className={`bg-sky-50 border-l-4 border-sky-500 p-2 rounded-r my-1.5 text-xs sm:text-sm ${fontClass} font-bold text-slate-900 tracking-wide`}
          >
            💬 "{dialogueQuote}"
          </div>
        )}

        {/* Action Narrative */}
        <p
          className={`${fontClass} text-xs sm:text-sm font-bold text-slate-900 leading-normal mt-1`}
        >
          {narrativeAction}
        </p>

        {/* Stat Badges */}
        {stats && (stats.damage || stats.threat || stats.cost) && (
          <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100">
            {stats.damage !== undefined && (
              <span className="bg-comic-red text-white text-xs font-comic font-black px-2.5 py-0.5 rounded border border-comic-black shadow-sm">
                💥 {stats.damage} DMG
              </span>
            )}
            {stats.threat !== undefined && (
              <span className="bg-emerald-600 text-white text-xs font-comic font-black px-2.5 py-0.5 rounded border border-comic-black shadow-sm">
                🛡️ -{stats.threat} THREAT
              </span>
            )}
            {stats.cost !== undefined && (
              <span className="bg-slate-200 text-slate-800 text-xs font-bold px-2 py-0.5 rounded border border-slate-300">
                ⚡ Cost: {stats.cost}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
