import React from 'react';
import {
  Crosshair,
  Footprints,
  Shield,
  Zap,
  RotateCw,
  Newspaper,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import { cardCatalog } from '../../../../data/importer/card-loader';
import { CardView } from '../../cards/CardView';
import { Badge, Beacon, ThemedButton } from '../../../theme/kit/controls';
import { Gauge, Ribbon, StatCounter } from '../../../theme/kit/meters';
import {
  ThemedMenu,
  ThemedSplash,
  ThemedTable,
  ThemedToast,
  ZonePanel,
} from '../../../theme/kit/surfaces';
import {
  KIT_ALLY,
  KIT_HAND,
  KIT_HERO,
  KIT_HERO_COLOR,
  KIT_MINION,
  KIT_UPGRADE,
  KIT_VILLAIN,
} from './kit-data';

/**
 * The play area as one mock-up: the side dock (quick-menu rail above the combat log), villain zone, threat, hero zone, hand tray, plus a card
 * context menu, a toast and a damage splash. The hero colour is an accent on the zone, never its base.
 */
export const BoardKit: React.FC = () => {
  return (
    <ThemedTable className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pb-10 pt-6 flex flex-col lg:flex-row gap-4 items-start">
        <aside
          aria-label="Side dock"
          className="order-first lg:order-last w-full lg:w-80 shrink-0 space-y-2"
        >
          <div role="toolbar" aria-label="Quick menu" className="flex items-center gap-1.5">
            <Ribbon>R3</Ribbon>
            <span className="flex-1 min-w-0">
              <Ribbon active>Player phase</Ribbon>
            </span>
            <Beacon active>
              <ThemedButton
                variant="icon"
                aria-label="Daily Bugle"
                icon={<Newspaper className="w-4 h-4" />}
              />
            </Beacon>
            <ThemedButton
              variant="icon"
              aria-label="Options"
              icon={<Settings className="w-4 h-4" />}
            />
            <ThemedButton
              variant="icon"
              aria-label="More"
              icon={<MoreHorizontal className="w-4 h-4" />}
            />
          </div>
          <ZonePanel title="Combat log">
            <div className="space-y-2">
              <ThemedToast title="Rhino attacks" tone="bad">
                3 damage to Spider-Man.
              </ThemedToast>
              <ThemedToast title="Spider-Man thwarts" tone="good">
                2 threat removed.
              </ThemedToast>
            </div>
          </ZonePanel>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="grid lg:grid-cols-[2fr_1fr] gap-4">
            <ZonePanel title="Villain: Rhino" right={<Badge>Stage 1</Badge>}>
              <div className="flex flex-wrap gap-4">
                <CardView
                  card={cardCatalog.getCard(KIT_VILLAIN.code)!}
                  size="lg"
                  enableContextMenu={false}
                />
                <div className="flex-1 min-w-48 space-y-3">
                  <Gauge kind="hp" label="Rhino" value={14} max={18} />
                  <div className="flex flex-wrap gap-2">
                    <StatCounter
                      icon={<Crosshair className="w-4 h-4" />}
                      label="Attack"
                      value={2}
                    />
                    <StatCounter icon={<Shield className="w-4 h-4" />} label="Scheme" value={1} />
                  </div>
                  <div className="flex items-center gap-3">
                    <CardView
                      card={cardCatalog.getCard(KIT_MINION.code)!}
                      size="sm"
                      enableContextMenu={false}
                    />
                    <span className={`text-sm font-black`}>Sandman, engaged</span>
                  </div>
                </div>
              </div>
            </ZonePanel>
            <ZonePanel title="Main scheme">
              <div className="space-y-3">
                <Gauge kind="threat" label="The Break-In!" value={9} max={15} />
                <div className="flex gap-2">
                  <Badge>+1 per round</Badge>
                  <Badge tone="quiet">Acceleration 1</Badge>
                </div>
              </div>
            </ZonePanel>
          </div>

          <div className="relative">
            <ZonePanel title="Spider-Man" right={<Badge>Hero form</Badge>}>
              <div
                aria-hidden="true"
                className="absolute left-0 top-0 bottom-0 w-2.5"
                style={{ backgroundColor: KIT_HERO_COLOR }}
              />
              <div className="flex flex-wrap gap-4">
                <CardView
                  card={cardCatalog.getCard(KIT_HERO.code)!}
                  size="lg"
                  enableContextMenu={false}
                />
                <div className="flex-1 min-w-56 space-y-3">
                  <Gauge kind="hp" label="Spider-Man" value={7} max={10} />
                  <div className="flex flex-wrap gap-2">
                    <StatCounter
                      icon={<Crosshair className="w-4 h-4" />}
                      label="Attack"
                      value={2}
                    />
                    <StatCounter
                      icon={<Footprints className="w-4 h-4" />}
                      label="Thwart"
                      value={2}
                    />
                    <StatCounter icon={<Shield className="w-4 h-4" />} label="Defense" value={3} />
                    <StatCounter icon={<Zap className="w-4 h-4" />} label="Resources" value={4} />
                  </div>
                </div>
                <div className="flex gap-2 items-start">
                  <CardView
                    card={cardCatalog.getCard(KIT_ALLY.code)!}
                    size="md"
                    enableContextMenu={false}
                  />
                  <CardView
                    card={cardCatalog.getCard(KIT_UPGRADE.code)!}
                    size="md"
                    enableContextMenu={false}
                  />
                </div>
              </div>
            </ZonePanel>
          </div>

          <ZonePanel title="Hand" right={<Badge>5 cards</Badge>}>
            <div className="flex flex-wrap gap-2">
              {KIT_HAND.map((card) => (
                <CardView
                  key={card.code}
                  card={cardCatalog.getCard(card.code)!}
                  size="hand"
                  enableContextMenu={false}
                />
              ))}
            </div>
          </ZonePanel>

          <div className="flex flex-wrap items-start gap-4">
            <ThemedMenu
              title="Hulk"
              items={[
                { id: 'attack', label: 'Attack', icon: <Crosshair className="w-4 h-4" /> },
                { id: 'thwart', label: 'Thwart', icon: <Footprints className="w-4 h-4" /> },
                {
                  id: 'ready',
                  label: 'Ready',
                  icon: <RotateCw className="w-4 h-4" />,
                  disabled: true,
                },
              ]}
            />
            <ThemedToast title="Rhino attacks" tone="bad">
              3 damage to Spider-Man.
            </ThemedToast>
            <ThemedSplash kind="damage" amount={3} />
          </div>
        </div>
      </div>
    </ThemedTable>
  );
};
