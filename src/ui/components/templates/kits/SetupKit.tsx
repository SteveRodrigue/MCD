import React, { useState } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { cardCatalog } from '../../../../data/importer/card-loader';
import { CardView } from '../../cards/CardView';
import { CardSelectFrame } from '../../../theme/kit/cards';
import { Badge, ThemedButton, ThemedSelect, ThemedSwitch } from '../../../theme/kit/controls';
import { Ribbon } from '../../../theme/kit/meters';
import { ThemedTable, ZonePanel } from '../../../theme/kit/surfaces';
import { useModalStyle } from '../../../theme/useModalStyle';
import { KIT_HAND, KIT_HERO, KIT_VILLAIN } from './kit-data';

const DIFFICULTIES = ['Standard', 'Expert', 'Heroic'] as const;

/** Scenario spread and mulligan, the two screens a player sees before the first card is played. */
export const SetupKit: React.FC = () => {
  const { style } = useModalStyle();
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('Standard');
  const [accents, setAccents] = useState(true);
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set(KIT_HAND.map((c) => c.code)));

  const toggle = (code: string) =>
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <ThemedTable className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 pb-10 pt-6 space-y-6">
        <header className="text-center space-y-1">
          <h1 className={`font-comic text-4xl font-black uppercase`}>Marvel Champions</h1>
          <p className={`text-sm ${style.muted}`}>Choose a scenario and a hero.</p>
        </header>

        <ZonePanel title="Scenario" right={<Ribbon active>Rhino</Ribbon>}>
          <div className="flex flex-wrap gap-4">
            <CardView
              card={cardCatalog.getCard(KIT_VILLAIN.code)!}
              size="lg"
              enableContextMenu={false}
            />
            <div className="flex-1 min-w-56 space-y-3">
              <div role="group" aria-label="Difficulty" className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={difficulty === d}
                    onClick={() => setDifficulty(d)}
                    className={`px-3 py-1.5 text-xs font-black uppercase cursor-pointer ${
                      difficulty === d ? style.tileSelected : style.tile
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <ThemedSelect
                label="Modular set"
                options={[
                  { value: 'bomb_scare', label: 'Bomb Scare' },
                  { value: 'masters', label: 'Masters of Evil' },
                ]}
                defaultValue="bomb_scare"
              />
              <div className="flex items-center gap-3 text-sm font-bold">
                <ThemedSwitch label="Card accents" checked={accents} onChange={setAccents} />
                <span>Card accents</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CardView
                card={cardCatalog.getCard(KIT_HERO.code)!}
                size="lg"
                enableContextMenu={false}
              />
              <Badge>Protection deck</Badge>
            </div>
          </div>
          <div className="pt-4 flex justify-end">
            <ThemedButton variant="primary" icon={<Play className="w-4 h-4" />}>
              Start game
            </ThemedButton>
          </div>
        </ZonePanel>

        <ZonePanel title="Mulligan" right={<Badge>Keep {kept.size} of 5</Badge>}>
          <div className="flex flex-wrap gap-3">
            {KIT_HAND.map((card) => (
              <CardSelectFrame
                key={card.code}
                code={card.code}
                selection={kept.has(card.code) ? 'keep' : 'discard'}
              >
                <CardView
                  card={cardCatalog.getCard(card.code)!}
                  size="hand"
                  enableContextMenu={false}
                  enableHoverZoom={false}
                  onClick={() => toggle(card.code)}
                />
              </CardSelectFrame>
            ))}
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <ThemedButton variant="secondary" icon={<RefreshCw className="w-4 h-4" />}>
              Redraw
            </ThemedButton>
            <ThemedButton variant="primary">Keep this hand</ThemedButton>
          </div>
        </ZonePanel>
      </div>
    </ThemedTable>
  );
};
