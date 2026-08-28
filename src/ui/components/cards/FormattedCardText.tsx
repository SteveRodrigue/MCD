import React from 'react';

/**
 * Formats MarvelCDB card text strings containing HTML tags (<b>, <i>, <br>)
 * and bracket tokens ([energy], [physical], [mental], [wild], [per_hero], [hero], [alter_ego]).
 */
export function formatCardTextHtml(rawText?: string): string {
  if (!rawText) return '';

  return (
    rawText
      // Resource icons
      .replace(
        /\[energy\]/gi,
        '<span class="inline-flex items-center px-1 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-400 font-black text-[10px] mx-0.5 leading-none">⚡ Energy</span>',
      )
      .replace(
        /\[mental\]/gi,
        '<span class="inline-flex items-center px-1 py-0.5 rounded bg-sky-100 text-sky-950 border border-sky-400 font-black text-[10px] mx-0.5 leading-none">🧠 Mental</span>',
      )
      .replace(
        /\[physical\]/gi,
        '<span class="inline-flex items-center px-1 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-400 font-black text-[10px] mx-0.5 leading-none">✊ Physical</span>',
      )
      .replace(
        /\[wild\]/gi,
        '<span class="inline-flex items-center px-1 py-0.5 rounded bg-purple-100 text-purple-950 border border-purple-400 font-black text-[10px] mx-0.5 leading-none">⭐ Wild</span>',
      )
      // Identity & Game terms
      .replace(
        /\[hero\]/gi,
        '<span class="font-comic font-black text-comic-blue">HERO</span>',
      )
      .replace(
        /\[alter_ego\]/gi,
        '<span class="font-comic font-black text-comic-red">ALTER-EGO</span>',
      )
      .replace(
        /\[per_hero\]/gi,
        '<span class="font-bold text-slate-700 text-[10px] mx-0.5 font-sans">(per hero)</span>',
      )
      .replace(/\[boost\]/gi, '💥')
      .replace(/\[hazard\]/gi, '⚠️')
      .replace(/\[acceleration\]/gi, '⏩')
      .replace(/\[crisis\]/gi, '🔴')
      .replace(/\[amplify\]/gi, '🔊')
  );
}

interface FormattedCardTextProps {
  text?: string;
  className?: string;
}

export const FormattedCardText: React.FC<FormattedCardTextProps> = ({
  text,
  className = '',
}) => {
  if (!text) {
    return <span className={`italic text-slate-400 ${className}`}>No special text.</span>;
  }

  const html = formatCardTextHtml(text);

  return (
    <span
      className={`leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
