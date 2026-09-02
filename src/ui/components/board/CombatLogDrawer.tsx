import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, BookOpen, ChevronDown, ChevronRight, Globe, Type } from 'lucide-react';
import { GameLogEntry } from '../../../engine/models';
import { formatComicLogEntry } from '../../utils/comic-log-formatter';
import { ComicSpeechBalloon } from './ComicSpeechBalloon';
import { FONT_PRESETS } from './combat-log-presets';

interface CombatLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: GameLogEntry[];
  currentLocale?: 'en' | 'fr';
}

type FilterCategory = 'all' | 'heroes' | 'villains' | 'narrator';

export const CombatLogDrawer: React.FC<CombatLogDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  currentLocale = 'en',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [locale, setLocale] = useState<'en' | 'fr'>(currentLocale);
  const [showRawDebug, setShowRawDebug] = useState<boolean>(false);
  const [fontIndex, setFontIndex] = useState<number>(() => {
    const saved = localStorage.getItem('mcd_combat_log_font');
    const parsed = saved ? parseInt(saved, 10) : 0;
    return isNaN(parsed) || parsed < 0 || parsed >= FONT_PRESETS.length ? 0 : parsed;
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCycleFont = () => {
    setFontIndex((prev) => {
      const next = (prev + 1) % FONT_PRESETS.length;
      localStorage.setItem('mcd_combat_log_font', next.toString());
      return next;
    });
  };

  const currentFont = FONT_PRESETS[fontIndex] || FONT_PRESETS[0];

  // Sync locale prop if changed
  useEffect(() => {
    setLocale(currentLocale);
  }, [currentLocale]);

  // Format all log entries into comic dialogue
  const formattedLogs = useMemo(() => {
    return logs.map((entry) => formatComicLogEntry(entry, locale));
  }, [logs, locale]);

  // Filter logs by selected speaker category
  const filteredLogs = useMemo(() => {
    if (selectedCategory === 'all') return formattedLogs;
    if (selectedCategory === 'heroes') {
      return formattedLogs.filter((d) => d.type === 'hero_speech' || d.type === 'hero_thought');
    }
    if (selectedCategory === 'villains') {
      return formattedLogs.filter((d) => d.type === 'villain_shout');
    }
    if (selectedCategory === 'narrator') {
      return formattedLogs.filter((d) => d.type === 'narrator_caption');
    }
    return formattedLogs;
  }, [formattedLogs, selectedCategory]);

  // Auto-scroll to bottom on new log entry
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs.length, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-slate-100 border-l-4 border-comic-black shadow-comic-lg z-50 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
      {/* 1. Vintage Comic Issue Header Bar (Deep Navy Masthead) */}
      <div className="bg-slate-900 p-3 sm:p-4 border-b-4 border-comic-black shadow-comic-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-comic-yellow border-2 border-comic-black text-comic-black shadow-comic-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-comic text-xl text-comic-yellow leading-tight tracking-wide">
                ACTION CHRONICLE
              </h2>
              <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                DAILY BUGLE SPECIAL EDITION • ISSUE LOG
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Locale Toggle */}
            <button
              type="button"
              onClick={() => setLocale((prev) => (prev === 'en' ? 'fr' : 'en'))}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border-2 border-slate-600 font-comic text-xs font-bold text-white shadow-comic-sm hover:bg-slate-700 cursor-pointer"
              title="Toggle Language / Basculer la langue"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{locale.toUpperCase()}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 rounded border-2 border-comic-black bg-slate-800 hover:bg-rose-900 text-rose-400 shadow-comic-sm cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Filter Category Pills */}
        <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`py-1 text-center font-comic text-[11px] font-bold uppercase rounded border transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-white text-slate-950 border-white shadow-comic-sm scale-105'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            ALL ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('heroes')}
            className={`py-1 text-center font-comic text-[11px] font-bold uppercase rounded border transition-all cursor-pointer ${
              selectedCategory === 'heroes'
                ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-comic-sm scale-105'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            🦸 HEROES
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('villains')}
            className={`py-1 text-center font-comic text-[11px] font-bold uppercase rounded border transition-all cursor-pointer ${
              selectedCategory === 'villains'
                ? 'bg-rose-600 text-white border-rose-500 shadow-comic-sm scale-105'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            🦹 VILLAINS
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('narrator')}
            className={`py-1 text-center font-comic text-[11px] font-bold uppercase rounded border transition-all cursor-pointer ${
              selectedCategory === 'narrator'
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-comic-sm scale-105'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            📜 NARRATOR
          </button>
        </div>
      </div>

      {/* 3. Log Stream Container */}
      <div
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto space-y-1 bg-slate-900 bg-bendy-dots"
      >
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-white/10 rounded-xl border border-slate-700 my-4">
            <p className="font-comic text-sm text-slate-400">
              No actions recorded for this category yet.
            </p>
          </div>
        ) : (
          filteredLogs.map((dialogue, idx) => (
            <div key={dialogue.id || idx}>
              <ComicSpeechBalloon
                dialogue={dialogue}
                index={idx}
                fontClass={currentFont.className}
              />

              {/* Collapsed Raw Debug Inspector */}
              {showRawDebug && dialogue.rawEntry && (
                <div className="mx-4 my-1 p-2 rounded bg-slate-950/80 border border-slate-700 text-[10px] font-mono text-slate-400 space-y-1">
                  <div className="text-emerald-400 font-bold">KEY: {dialogue.rawEntry.key}</div>
                  {dialogue.rawEntry.params && (
                    <pre className="overflow-x-auto text-[9px] text-slate-300">
                      {JSON.stringify(dialogue.rawEntry.params, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 4. Footer & Debug Accordion */}
      <div className="p-2.5 bg-slate-900 border-t-2 border-comic-black flex items-center justify-between text-xs font-bold text-slate-300 gap-2 flex-wrap">
        <span>
          Showing {filteredLogs.length} of {logs.length} Events
        </span>

        <div className="flex items-center gap-2">
          {/* Cycle Font Button */}
          <button
            type="button"
            onClick={handleCycleFont}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer font-bold transition-all hover:scale-105 active:translate-y-0.5"
            title={`Current Font: ${currentFont.label}. Click to cycle fonts.`}
          >
            <Type className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Font: <span className="text-amber-300 font-normal">{currentFont.label}</span>
            </span>
          </button>

          {/* Collapsible Debug Inspector Button */}
          <button
            type="button"
            onClick={() => setShowRawDebug((prev) => !prev)}
            className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
          >
            {showRawDebug ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>{showRawDebug ? 'Hide Debug' : 'Show Debug'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CombatLogDrawer;
