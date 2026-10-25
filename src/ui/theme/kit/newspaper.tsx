import React from 'react';
import { X } from 'lucide-react';
import { CardArtThumbnail } from '../../components/cards/CardArtThumbnail';
import { CardRef, type CardReference, type TriggerCard } from '../CardRef';
import { useNewspaperProps } from '../useNewspaperProps';
import { useThemeExtras } from '../useThemeExtras';

/**
 * The Daily Bugle kit. Every theme draws its own era of newspaper (old print to holographic feed),
 * but the identity rules never change: a masthead with an edition line, a headline hierarchy, news
 * written as stories, and news furniture (ticker, flash, pull quotes). A plain modal is not a Bugle.
 *
 * The action sheet always keeps the game's three-column page, in every theme: column 1 is the front
 * page (identity directives and playable hand cards), column 2 the classifieds (in-play assets and
 * villain dispatches), column 3 the Call for Action! column (teammate tableau assets). Themes change
 * how the columns look, never how many there are or what they hold. See `NewspaperColumns`.
 */

export interface NewspaperSheetProps {
  /** "Round 3, Villain phase": the edition line. */
  edition: string;
  /** Right side of the edition line (date, price, issue). */
  issue?: string;
  ticker?: readonly string[];
  flash?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Adds a close button above the masthead. */
  onClose?: () => void;
  /** Buttons shown before the close button (a language toggle). */
  actions?: React.ReactNode;
  /** Stays under the masthead while the stories scroll (a filter bar). */
  toolbar?: React.ReactNode;
  /** The page keeps its masthead and footer in view and scrolls its stories; the caller bounds its height. */
  scrollable?: boolean;
  /** Reads the scrolling stories (to follow the latest entry). Needs `scrollable`. */
  scrollRef?: React.Ref<HTMLDivElement>;
  testId?: string;
}

export const NewspaperSheet: React.FC<NewspaperSheetProps> = ({
  edition,
  issue,
  ticker,
  flash,
  children,
  footer,
  className = '',
  onClose,
  actions,
  toolbar,
  scrollable = false,
  scrollRef,
  testId,
}) => {
  const { newspaper: np } = useThemeExtras();
  const newspaperProps = useNewspaperProps();
  return (
    <article
      aria-label={np.title}
      data-testid={testId}
      {...newspaperProps}
      className={`relative isolate overflow-hidden ${scrollable ? 'flex flex-col' : ''} ${np.sheet} ${className}`}
    >
      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none ${np.textureClass}`}
        style={np.texture}
      />
      <div className="relative flex flex-col min-h-0 flex-1">
        <div className="p-4 sm:p-5 pb-0 space-y-4 shrink-0">
          {(actions || onClose) && (
            <div className="flex items-center justify-end gap-2">
              {actions}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  title="Close Newspaper"
                  aria-label="Close Newspaper"
                  className={`cursor-pointer inline-flex items-center ${np.pill}`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <header className={np.mastheadWrap}>
            <h2 className={np.mastheadTitle}>{np.title}</h2>
            <div className={np.edition}>
              <span>{edition}</span>
              {issue && <span className="ml-3">{issue}</span>}
            </div>
            <p className={np.taglineClass}>{np.tagline}</p>
          </header>
          {flash && <ExtraFlash>{flash}</ExtraFlash>}
          {ticker && ticker.length > 0 && <NewsTicker items={ticker} />}
          {toolbar}
        </div>
        <div
          ref={scrollRef}
          className={`p-4 sm:p-5 space-y-3 ${scrollable ? 'overflow-y-auto min-h-0 flex-1' : ''}`}
        >
          {children}
        </div>
        {footer && (
          <footer className={`border-t px-4 sm:px-5 py-3 shrink-0 ${np.rule}`}>{footer}</footer>
        )}
      </div>
    </article>
  );
};

export interface NewsStoryProps {
  section?: string;
  headline: string;
  standfirst?: string;
  byline?: string;
  /** The card the story is about, shown as its "photo". */
  card?: CardReference;
  children?: React.ReactNode;
  className?: string;
}

export const NewsStory: React.FC<NewsStoryProps> = ({
  section,
  headline,
  standfirst,
  byline,
  card,
  children,
  className = '',
}) => {
  const { newspaper: np } = useThemeExtras();
  return (
    <section
      className={`break-inside-avoid mb-4 ${np.story} ${className}`}
      data-news-story={card?.code ?? ''}
    >
      {section && <div className={`${np.section} mb-1.5`}>{section}</div>}
      <h3 className={np.headline}>{headline}</h3>
      {standfirst && <p className={`${np.standfirst} mt-1`}>{standfirst}</p>}
      {byline && <p className={`${np.byline} mt-1`}>{byline}</p>}
      {card && (
        <div className="mt-2">
          <CardRef {...card} size="lg" stacked />
        </div>
      )}
      {children && <div className={`${np.body} mt-2`}>{children}</div>}
    </section>
  );
};

/** The scrolling strip of short bulletins. Static for readers who prefer reduced motion. */
export const NewsTicker: React.FC<{ items: readonly string[] }> = ({ items }) => {
  const { newspaper: np } = useThemeExtras();
  return (
    <div
      role="marquee"
      aria-label="Latest headlines"
      className={`overflow-hidden whitespace-nowrap ${np.ticker}`}
    >
      {items.join('  •  ')}
    </div>
  );
};

/** EXTRA! flash: the single loud element of a front page. */
export const ExtraFlash: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { newspaper: np } = useThemeExtras();
  return (
    <div className="flex">
      <span role="note" className={np.flash}>
        {np.flashWord}
        {children ? ` ${children}` : ''}
      </span>
    </div>
  );
};

export interface NewsPillProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

/** Classified-style filter or stat pill. */
export const NewsPill: React.FC<NewsPillProps> = ({ children, active = false, onClick }) => {
  const { newspaper: np } = useThemeExtras();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`cursor-pointer ${active ? np.pillActive : np.pill}`}
    >
      {children}
    </button>
  );
};

export type LogEntryKind = 'hero' | 'thought' | 'villain' | 'narrator';

export interface NewsLogEntryProps {
  kind: LogEntryKind;
  /** Speaker as card, so the dateline carries the thumbnail. */
  speaker?: CardReference;
  /** Hero palette colour of the speaker; the speaker banner is the only place it appears. */
  accent?: string;
  time?: string;
  children: React.ReactNode;
}

const KIND_LABEL: Record<LogEntryKind, string> = {
  hero: 'Hero statement',
  thought: 'Overheard thought',
  villain: 'Villain threat',
  narrator: 'Editor note',
};

/** One combat-log line, written as a wire dispatch: dateline first, then the quote. */
export const NewsLogEntry: React.FC<NewsLogEntryProps> = ({
  kind,
  speaker,
  accent,
  time,
  children,
}) => {
  const { newspaper: np } = useThemeExtras();
  return (
    <div data-log-kind={kind} className={`${np.story} !mb-2 flex gap-3`}>
      <div
        aria-hidden="true"
        className="w-1.5 shrink-0 self-stretch"
        style={accent ? { backgroundColor: accent } : undefined}
      />
      <div className="min-w-0 flex-1">
        <div className={`flex items-center justify-between gap-2 ${np.byline}`}>
          <span>{KIND_LABEL[kind]}</span>
          {time && <span>{time}</span>}
        </div>
        {speaker && (
          <div className="my-1">
            <CardRef {...speaker} size="xs" />
          </div>
        )}
        <p className={kind === 'narrator' ? np.body : `${np.quote} ${np.body}`}>
          {kind === 'thought' ? <em>{children}</em> : children}
        </p>
      </div>
    </div>
  );
};

/** Classes by column count, written out so Tailwind finds them (the game collapses to 2 or 1 when a column is empty). */
const COLUMN_GRID = { 1: '', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' } as const;

export interface NewspaperColumnsProps {
  /** One node per column, at most three: front page, classifieds, Call for Action!. */
  columns: readonly React.ReactNode[];
  className?: string;
}

/**
 * The Bugle's page grid: up to three columns on a wide screen, one stacked column on a narrow one,
 * with a rule between columns. The same grid in every theme.
 */
export const NewspaperColumns: React.FC<NewspaperColumnsProps> = ({ columns, className = '' }) => {
  const { newspaper: np } = useThemeExtras();
  const count = Math.min(columns.length, 3) as 1 | 2 | 3;
  return (
    <div
      data-testid="daily-bugle-grid"
      data-columns={count}
      className={`grid grid-cols-1 gap-6 ${COLUMN_GRID[count]} ${className}`}
    >
      {columns.slice(0, 3).map((column, index) => (
        <div
          key={index}
          className={`space-y-4 min-w-0 ${index > 0 ? `lg:border-l-2 lg:pl-6 ${np.rule}` : ''}`}
        >
          {column}
        </div>
      ))}
    </div>
  );
};

export interface NewsSectionProps {
  /** Section name, e.g. "Front page: identity directives". */
  title: string;
  /** Short tag on the right, e.g. "Form & basic moves". */
  tag?: string;
  children: React.ReactNode;
}

/** A titled block inside a column. */
export const NewsSection: React.FC<NewsSectionProps> = ({ title, tag, children }) => {
  const { newspaper: np } = useThemeExtras();
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className={np.section}>{title}</h3>
        {tag && <span className={np.byline}>{tag}</span>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
};

export interface NewsActionItemProps {
  /** The card the action is about; an identity action has none, and its icon is the thumbnail. */
  card: TriggerCard;
  /** Shown beside the headline and as the thumbnail when there is no card art. */
  icon?: React.ReactNode;
  headline: string;
  subtext: React.ReactNode;
  /** Small badge next to the headline ("1 / ROUND", "COST 2"). */
  badge?: string;
  /** What clicking does ("Execute", "Play card", "Ask teammate"). */
  cue: string;
  onSelect?: () => void;
}

/** One legal action, written as a dispatch: the card's photo, a headline, a line of text, a call to act. */
export const NewsActionItem: React.FC<NewsActionItemProps> = ({
  card,
  icon,
  headline,
  subtext,
  badge,
  cue,
  onSelect,
}) => {
  const { newspaper: np } = useThemeExtras();
  return (
    <button
      type="button"
      data-card-anchor={card.code}
      onClick={onSelect}
      className={`w-full text-left flex items-start gap-2.5 p-2 cursor-pointer ${np.story} !mb-0 !pb-2`}
    >
      <CardArtThumbnail cardCode={card.code} cardName={card.name} fallbackIcon={icon} size="sm" />
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-start justify-between gap-1">
          <span className={`${np.headline} !text-sm flex items-center gap-1`}>
            {icon}
            {headline}
          </span>
          {badge && <span className={`shrink-0 ${np.pillActive}`}>{badge}</span>}
        </span>
        <span className={`${np.body} !text-xs line-clamp-2 block`}>{subtext}</span>
        <span className={`${np.byline} text-right`}>{cue} ➔</span>
      </span>
    </button>
  );
};

export interface CallForActionProps {
  /** Teammate header, e.g. "IRON MAN (HERO SEAT 2)". */
  teammate: string;
  children: React.ReactNode;
  /** Number of actions, for the count in the header. */
  count: number;
}

/** A teammate's block in the Call for Action! column: a dark name bar, then their actions. */
export const CallForActionGroup: React.FC<CallForActionProps> = ({ teammate, count, children }) => {
  const { newspaper: np } = useThemeExtras();
  return (
    <div className={`overflow-hidden ${np.classified} !p-0`}>
      <div className={`flex items-center justify-between gap-2 ${np.ticker} !rounded-none`}>
        <span className="font-black">{teammate}</span>
        <span className="text-micro">
          {count} ACTION{count === 1 ? '' : 'S'}
        </span>
      </div>
      <div className="p-2 flex flex-col gap-2">{children}</div>
    </div>
  );
};
