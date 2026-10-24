import React, { useState } from 'react';
import { Crosshair, Footprints, Shield, Zap, Trash2, Settings } from 'lucide-react';
import {
  Badge,
  ThemedButton,
  ThemedSelect,
  ThemedSwitch,
  ThemedTextField,
} from '../../../theme/kit/controls';
import { Gauge, Ribbon, StatCounter } from '../../../theme/kit/meters';
import { ThemedMenu, ThemedSplash, ThemedToast, ThemedTable } from '../../../theme/kit/surfaces';
import { useModalStyle } from '../../../theme/useModalStyle';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const { style } = useModalStyle();
  return (
    <section className={`${style.panel} ${style.text}`}>
      <h3 className={`px-3 py-1.5 text-xs font-black uppercase ${style.panelHead}`}>{title}</h3>
      <div className="p-3 flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
};

/** Every small building block of the game in one place, so a theme can be judged element by element. */
export const ElementsKit: React.FC = () => {
  const { style } = useModalStyle();
  const [on, setOn] = useState(true);
  const [name, setName] = useState('Spidey');
  const [mode, setMode] = useState('random');

  return (
    <ThemedTable className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 pb-10 pt-6 space-y-4">
        <Section title="Buttons">
          <ThemedButton variant="primary" icon={<Zap className="w-4 h-4" />}>
            Confirm
          </ThemedButton>
          <ThemedButton variant="secondary">Pass</ThemedButton>
          <ThemedButton variant="danger" icon={<Trash2 className="w-4 h-4" />}>
            Discard
          </ThemedButton>
          <ThemedButton variant="ghost">Cancel</ThemedButton>
          <ThemedButton variant="icon" aria-label="Settings">
            <Settings className="w-4 h-4" />
          </ThemedButton>
          <ThemedButton variant="primary" disabled>
            Disabled
          </ThemedButton>
        </Section>

        <Section title="Badges, ribbons and counters">
          <Badge>Exhausted</Badge>
          <Badge>Stunned</Badge>
          <Badge tone="quiet">Round 3</Badge>
          <Ribbon>Hero phase</Ribbon>
          <Ribbon active>Villain phase</Ribbon>
          <StatCounter icon={<Crosshair className="w-4 h-4" />} label="Attack" value={3} />
          <StatCounter icon={<Footprints className="w-4 h-4" />} label="Thwart" value={2} />
          <StatCounter icon={<Shield className="w-4 h-4" />} label="Defense" value={1} />
        </Section>

        <Section title="Gauges">
          <Gauge kind="hp" label="Spider-Man" value={7} max={10} className="w-64" />
          <Gauge kind="threat" label="Main scheme" value={9} max={15} className="w-64" />
        </Section>

        <Section title="Form controls">
          <ThemedSwitch label="Card accents" checked={on} onChange={setOn} />
          <ThemedTextField
            label="Player name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <ThemedSelect
            label="Theme mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            options={[
              { value: 'random', label: 'Random each game' },
              { value: 'fixed', label: 'Always this theme' },
            ]}
          />
        </Section>

        <Section title="Menu, toast and splash">
          <ThemedMenu
            title="Black Widow"
            items={[
              { id: 'play', label: 'Play', icon: <Zap className="w-4 h-4" /> },
              { id: 'exhaust', label: 'Exhaust', icon: <Shield className="w-4 h-4" /> },
              {
                id: 'discard',
                label: 'Discard',
                icon: <Trash2 className="w-4 h-4" />,
                disabled: true,
              },
            ]}
          />
          <div className="space-y-2">
            <ThemedToast title="Hero phase" tone="info">
              Ready your hero.
            </ThemedToast>
            <ThemedToast title="Threat removed" tone="good">
              2 threat from the main scheme.
            </ThemedToast>
            <ThemedToast title="Rhino attacks" tone="bad">
              3 damage to Spider-Man.
            </ThemedToast>
          </div>
          <ThemedSplash kind="damage" amount={3} />
          <ThemedSplash kind="heal" amount={2} />
          <ThemedSplash kind="threat" amount={1} />
        </Section>

        <Section title="Type roles">
          <p className={`font-comic text-3xl font-black`}>Headlines: Spider-Man swings in</p>
          <p className={`font-body text-base`}>
            Body: Exhaust to take the hit and gain 2 resources.
          </p>
          <p className={`font-mono text-sm ${style.muted}`}>
            Numbers and codes: round 3 / phase villain / step 2
          </p>
        </Section>
      </div>
    </ThemedTable>
  );
};
