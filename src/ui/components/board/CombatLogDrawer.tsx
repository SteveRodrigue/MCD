import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ModalLayer } from '../layout/ModalLayer';
import { ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { GameLogEntry } from '../../../engine/models';
import { formatComicLogEntry } from '../../utils/comic-log-formatter';
import { ComicSpeechBalloon } from './ComicSpeechBalloon';
import { useGameSession } from '../../context/GameStateContext';
import { NewsPill, NewspaperSheet } from '../../theme/kit/newspaper';
import { useThemeExtras } from '../../theme/useThemeExtras';

interface CombatLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: GameLogEntry[];
  currentLocale?: 'en' | 'fr';
  /** Engine step errors (`engine.stepError`) are listed in Dev Mode only (#225). */
  devMode?: boolean;
}

type FilterCategory = 'all' | 'heroes' | 'villains' | 'narrator';

export const CombatLogDrawer: React.FC<CombatLogDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  currentLocale = 'en',
  devMode = false,
}) => {
  const { state: gameState } = useGameSession();
  const { newspaper: np } = useThemeExtras();
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [locale, setLocale] = useState<'en' | 'fr'>(currentLocale);
  const [showRawDebug, setShowRawDebug] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync locale prop if changed
  useEffect(() => {
    setLocale(currentLocale);
  }, [currentLocale]);

  // Format all log entries into comic dialogue
  const formattedLogs = useMemo(() => {
    return logs
      .filter((entry) => devMode || entry.key !== 'engine.stepError')
      .map((entry) => formatComicLogEntry(entry, locale, gameState));
  }, [logs, locale, gameState, devMode]);

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

  const filters: Array<{ category: FilterCategory; label: string }> = [
    { category: 'all', label: `ALL (${logs.length})` },
    { category: 'heroes', label: '🦸 HEROES' },
    { category: 'villains', label: '🦹 VILLAINS' },
    { category: 'narrator', label: '📜 NARRATOR' },
  ];

  return (
    <ModalLayer
      layer="drawer"
      className="inset-y-0 right-0 w-full sm:w-[420px] lg:w-[420px] p-2 animate-in slide-in-from-right duration-200"
    >
      <NewspaperSheet
        scrollable
        scrollRef={scrollRef}
        onClose={onClose}
        className="h-full"
        edition="Flash news & action chronicle"
        issue="Issue log"
        actions={
          <button
            type="button"
            onClick={() => setLocale((prev) => (prev === 'en' ? 'fr' : 'en'))}
            className={`cursor-pointer inline-flex items-center gap-1 ${np.pill}`}
            title="Toggle Language / Basculer la langue"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{locale.toUpperCase()}</span>
          </button>
        }
        toolbar={
          <div role="group" aria-label="Log filter" className="flex flex-wrap gap-1.5">
            {filters.map(({ category, label }) => (
              <NewsPill
                key={category}
                active={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
              >
                {label}
              </NewsPill>
            ))}
          </div>
        }
        footer={
          <div className={`flex items-center justify-between gap-2 flex-wrap ${np.byline}`}>
            <span>
              Showing {filteredLogs.length} of {logs.length} Events
            </span>
            <button
              type="button"
              onClick={() => setShowRawDebug((prev) => !prev)}
              className={`cursor-pointer inline-flex items-center gap-1 ${np.pill}`}
            >
              {showRawDebug ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
              <span>{showRawDebug ? 'Hide Debug' : 'Show Debug'}</span>
            </button>
          </div>
        }
      >
        {filteredLogs.length === 0 ? (
          <div className={`${np.classified} !p-8 text-center my-4`}>
            <p className={np.body}>No actions recorded for this category yet.</p>
          </div>
        ) : (
          filteredLogs.map((dialogue, idx) => (
            <div key={dialogue.id || idx}>
              <ComicSpeechBalloon dialogue={dialogue} index={idx} />

              {/* Collapsed Raw Debug Inspector */}
              {showRawDebug && dialogue.rawEntry && (
                <div className={`${np.classified} mx-4 my-1 space-y-1 font-mono`}>
                  <div className="font-bold">KEY: {dialogue.rawEntry.key}</div>
                  {dialogue.rawEntry.params && (
                    <pre className="overflow-x-auto text-nano">
                      {JSON.stringify(dialogue.rawEntry.params, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </NewspaperSheet>
    </ModalLayer>
  );
};

export default CombatLogDrawer;
