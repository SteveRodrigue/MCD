import React from 'react';
import { ArrowRight, HelpCircle, ShieldAlert, Zap } from 'lucide-react';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import { CardRef, type CardReference } from './CardRef';
import { AccentStripe } from './AccentStripe';
import { ModalScaffold } from './ModalScaffold';
import { Narration, SpeechBubble } from './ComicSpeech';
import { useActionBurst } from './useActionBurst';
import { useModalStyle } from './useModalStyle';
import type { VerbColor } from './modal-styles';
import { ATTACKER, BLACK_WIDOW, HULK, SANDMAN, SPIDER_MAN } from './template-data';

interface DecisionOption {
  id: string;
  card: CardReference;
  label: React.ReactNode;
  description: React.ReactNode;
  isRecommended?: boolean;
}

const OPTIONS: readonly DecisionOption[] = [
  {
    id: 'defend-spider-man',
    card: SPIDER_MAN,
    label: 'Exhaust to defend',
    description: (
      <>
        Declare <CardRef {...SPIDER_MAN} /> as the defender against <CardRef {...ATTACKER} />
        &rsquo;s attack (DEF: 3).
      </>
    ),
    isRecommended: true,
  },
  {
    id: 'block-black-widow',
    card: BLACK_WIDOW,
    label: 'Block with ally',
    description: (
      <>
        Exhaust <CardRef {...BLACK_WIDOW} /> to intercept all incoming damage from{' '}
        <CardRef {...ATTACKER} />.
      </>
    ),
  },
  {
    id: 'smash-hulk',
    card: HULK,
    label: 'Strike first',
    description: (
      <>
        Exhaust <CardRef {...HULK} /> to smash <CardRef {...ATTACKER} /> before the attack lands.
      </>
    ),
  },
  {
    id: 'take-damage',
    card: ATTACKER,
    label: 'Take undefended damage',
    description: (
      <>
        <CardRef {...ATTACKER} /> deals its damage directly to your hero.
      </>
    ),
  },
];

export interface DecisionTemplateProps {
  /** Forced interrupts cannot be declined; the header turns red. */
  forced?: boolean;
  /** Overrides the header verb colour (the lab's verb switch). */
  verb?: VerbColor;
  onAction?: (message: string) => void;
}

/**
 * Archetype 1: Decision / action prompt. Trigger card in the header, the threatening card in a
 * showcase panel, then one option row per choice (each option carries its card thumbnail).
 */
export const DecisionTemplate: React.FC<DecisionTemplateProps> = ({
  forced = false,
  verb,
  onAction,
}) => {
  const { style } = useModalStyle();
  const { burst, fire } = useActionBurst();
  const resolvedVerb: VerbColor = verb ?? (forced ? 'red' : 'yellow');

  return (
    <ModalScaffold
      title={forced ? 'Forced interrupt: enemy attack' : 'Choose defense action'}
      kicker={forced ? 'Forced resolution' : 'Decision point'}
      verb={resolvedVerb}
      trigger={ATTACKER}
      icon={
        forced ? <ShieldAlert className="w-5 h-5 animate-pulse" /> : <Zap className="w-5 h-5" />
      }
      headerRight={
        <span className={`text-xs font-black uppercase px-2.5 py-1 ${style.chip}`}>
          {forced ? 'Forced' : 'Optional'}
        </span>
      }
      maxWidthClass="max-w-xl"
      burst={burst}
      testId="template-decision"
    >
      <Narration>
        {forced ? (
          'Meanwhile... there is no time to think!'
        ) : (
          <>
            Meanwhile, at the docks... <CardRef {...SANDMAN} /> lurks nearby.
          </>
        )}
      </Narration>

      <div className={`relative flex items-center gap-3 p-2.5 pl-4 ${style.panel}`}>
        <AccentStripe code={ATTACKER.code} />
        <CardArtThumbnail cardCode={ATTACKER.code} cardName={ATTACKER.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] font-black uppercase ${style.muted}`}>Attacking enemy</div>
          <div className="text-sm font-black">
            <CardRef {...ATTACKER} size="xs" /> <span className={style.muted}>(ATK 2 + boost)</span>
          </div>
        </div>
        <div className={`text-xs font-black px-2 py-0.5 ${style.inset} ${style.emphasis}`}>
          INCOMING: 2+ DMG
        </div>
      </div>

      <SpeechBubble speaker={ATTACKER}>
        {forced ? 'No dodging this one, hero! RAAAGH!' : 'Out of my way, little hero! RAAAGH!'}
      </SpeechBubble>

      <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
        <HelpCircle className="w-5 h-5 shrink-0" />
        <span>How would you like to resolve this attack?</span>
      </h3>

      <div className="space-y-2.5">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              fire();
              onAction?.(`Chose: ${opt.id}`);
            }}
            className={`group relative w-full text-left p-3 pl-4 transition-all flex items-center justify-between gap-3 cursor-pointer ${style.option}`}
          >
            <AccentStripe code={opt.card.code} />
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <CardArtThumbnail
                cardCode={opt.card.code}
                cardName={opt.card.name}
                size="sm"
                className="group-hover:scale-105 transition-transform"
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`font-black text-sm uppercase flex items-center gap-2 transition-colors ${style.optionTitleHover}`}
                >
                  <span className="truncate">{opt.label}</span>
                  {opt.isRecommended && (
                    <span className={`text-[10px] px-1.5 shrink-0 ${style.chip}`}>RECOMMENDED</span>
                  )}
                </div>
                <div className={`text-xs mt-0.5 ${style.muted}`}>{opt.description}</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform shrink-0" />
          </button>
        ))}
      </div>
    </ModalScaffold>
  );
};
