import React, { useState } from 'react';
import { Newspaper } from 'lucide-react';
import {
  CallForActionGroup,
  ExtraFlash,
  NewsActionItem,
  NewsLogEntry,
  NewsPill,
  NewsSection,
  NewsStory,
  NewspaperColumns,
  NewspaperSheet,
  type LogEntryKind,
} from '../../../theme/kit/newspaper';
import { ThemedButton } from '../../../theme/kit/controls';
import { ThemedTable } from '../../../theme/kit/surfaces';
import { useModalStyle } from '../../../theme/useModalStyle';
import { useThemeExtras } from '../../../theme/useThemeExtras';
import {
  KIT_ALLY,
  KIT_EVENT,
  KIT_HERO,
  KIT_HERO_COLOR,
  KIT_MINION,
  KIT_TEAM_ALLY,
  KIT_TEAM_ALLY_2,
  KIT_TICKER,
  KIT_UPGRADE,
  KIT_VILLAIN,
} from './kit-data';

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { style } = useModalStyle();
  return (
    <h2 className={`text-xs font-black uppercase tracking-widest ${style.text} opacity-80`}>
      {children}
    </h2>
  );
};

const LOG: readonly { kind: LogEntryKind; text: string; who?: typeof KIT_HERO }[] = [
  { kind: 'narrator', text: 'Round 3 begins. The docks are quiet. Too quiet.' },
  { kind: 'hero', who: KIT_HERO, text: 'Time to swing into action!' },
  { kind: 'thought', who: KIT_HERO, text: 'I hope Aunt May did not see that on TV...' },
  { kind: 'villain', who: KIT_VILLAIN, text: 'RHINO SMASH! You cannot stop me, wall-crawler!' },
];

/**
 * The Daily Bugle surfaces in this theme's era: the action sheet, the end-turn broadsheet, the
 * combat log as a wire, and the EXTRA! shortcut. The era changes with the theme, the newspaper identity does not.
 */
export const NewspaperKit: React.FC = () => {
  const { newspaper: np } = useThemeExtras();
  const [filter, setFilter] = useState<'all' | LogEntryKind>('all');
  const visible = LOG.filter((e) => filter === 'all' || e.kind === filter);

  return (
    <ThemedTable className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 pb-10 pt-6 space-y-6">
        <p className="text-sm font-bold">
          Era: <strong>{np.era}</strong>. The action sheet keeps the game&apos;s three columns in
          every theme.
        </p>

        <div className="space-y-2">
          <Heading>Action sheet (three columns, with Call for Action!)</Heading>
          <NewspaperSheet
            className="max-w-6xl mx-auto"
            edition="Special action edition: Spider-Man"
            issue="9 legal plays available"
            ticker={KIT_TICKER}
            footer={
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className={`${np.byline} block`}>Turn flow management</span>
                  <span className={np.standfirst}>End your turn and start the villain phase.</span>
                </div>
                <ThemedButton variant="primary" icon={<Newspaper className="w-4 h-4" />}>
                  End turn
                </ThemedButton>
              </div>
            }
          >
            <NewspaperColumns
              columns={[
                <>
                  <NewsSection title="Front page: identity directives" tag="Form & basic moves">
                    <NewsActionItem
                      card={KIT_HERO}
                      headline="Flip to Alter-Ego"
                      subtext="Change identity form."
                      badge="1 / ROUND"
                      cue="Execute"
                    />
                    <NewsActionItem
                      card={KIT_HERO}
                      headline="Attack (2 DMG)"
                      subtext="Exhaust to attack villain."
                      cue="Execute"
                    />
                  </NewsSection>
                  <NewsSection title="Latest dispatches: playable hand cards" tag="Ready from hand">
                    <NewsActionItem
                      card={KIT_ALLY}
                      headline="Play Hulk"
                      subtext="Pay 4 resources to put Hulk into play."
                      badge="COST 4"
                      cue="Play card"
                    />
                    <NewsActionItem
                      card={KIT_EVENT}
                      headline="Play Backflip"
                      subtext="Avoid the next attack."
                      cue="Play card"
                    />
                  </NewsSection>
                </>,
                <>
                  <NewsSection
                    title="The classifieds: in-play assets & allies"
                    tag="Tableau & allies"
                  >
                    <NewsActionItem
                      card={KIT_UPGRADE}
                      headline="Spider-Tracer attach"
                      subtext="Attach a tracer to an enemy."
                      cue="Activate"
                    />
                    <NewsActionItem
                      card={KIT_ALLY}
                      headline="Hulk: attack"
                      subtext="Exhaust Hulk to attack an enemy."
                      cue="Activate"
                    />
                  </NewsSection>
                  <NewsSection
                    title="Villain dispatches: encounter & scheme actions"
                    tag="Encounter & schemes"
                  >
                    <NewsActionItem
                      card={KIT_MINION}
                      headline="Sandman: pay to stay"
                      subtext="Discard a card to hold Sandman off."
                      cue="Discard / pay"
                    />
                  </NewsSection>
                </>,
                <div data-testid="daily-bugle-call-for-action-column" className="space-y-4">
                  <NewsSection title="Call for action: team tableau assets" tag="Teammate tableau">
                    <CallForActionGroup teammate="IRON MAN (HERO SEAT 2)" count={2}>
                      <NewsActionItem
                        card={KIT_TEAM_ALLY}
                        headline="Black Widow: strike"
                        subtext="Ask your teammate to use Black Widow."
                        cue="Ask teammate"
                      />
                      <NewsActionItem
                        card={KIT_TEAM_ALLY_2}
                        headline="Jessica Jones: investigate"
                        subtext="Ask your teammate to use Jessica Jones."
                        cue="Ask teammate"
                      />
                    </CallForActionGroup>
                  </NewsSection>
                </div>,
              ]}
            />
          </NewspaperSheet>
        </div>

        <div className="space-y-2">
          <Heading>End-turn broadsheet</Heading>
          <NewspaperSheet
            className="max-w-md mx-auto"
            edition="Round 3 · End of turn"
            issue="Final edition"
            flash="Villain phase ahead"
          >
            <NewsStory
              section="Front page"
              headline="The Rhino readies a rampage"
              standfirst="Cards still ready: Hulk. Resources unspent: 2."
              card={KIT_VILLAIN}
            >
              The editors ask: end your turn now?
            </NewsStory>
            <NewsStory
              section="Obituaries"
              headline="Sandman waits in the wings"
              card={KIT_MINION}
            />
            <div className="flex gap-2 pt-1">
              <ThemedButton variant="primary">Print it</ThemedButton>
              <ThemedButton variant="ghost">Hold the presses</ThemedButton>
            </div>
          </NewspaperSheet>
        </div>

        <div className="space-y-2">
          <Heading>Combat log drawer</Heading>
          <NewspaperSheet edition="The wire" issue="Live" className="max-w-xl">
            <div role="group" aria-label="Log filter" className="flex flex-wrap gap-1.5 pb-2">
              {(['all', 'hero', 'thought', 'villain', 'narrator'] as const).map((k) => (
                <NewsPill key={k} active={filter === k} onClick={() => setFilter(k)}>
                  {k}
                </NewsPill>
              ))}
            </div>
            {visible.map((e) => (
              <NewsLogEntry
                key={e.text}
                kind={e.kind}
                speaker={e.who}
                accent={e.kind === 'hero' || e.kind === 'thought' ? KIT_HERO_COLOR : undefined}
                time="3:42"
              >
                {e.text}
              </NewsLogEntry>
            ))}
          </NewspaperSheet>
        </div>

        <div className="space-y-2">
          <Heading>EXTRA! shortcut</Heading>
          <div className="flex items-center gap-4">
            <ThemedButton variant="primary" icon={<Newspaper className="w-4 h-4" />}>
              {np.flashWord}
            </ThemedButton>
            <ExtraFlash />
          </div>
        </div>
      </div>
    </ThemedTable>
  );
};
