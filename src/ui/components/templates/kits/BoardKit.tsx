import React from 'react';
import { Crosshair, Footprints, Shield, Layers, Zap, RotateCw } from 'lucide-react';
import { cardCatalog } from '../../../../data/importer/card-loader';
import { CardView } from '../../cards/CardView';
import { Badge, ThemedButton } from '../../../theme/kit/controls';
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
 * The play area as one mock-up: top bar, villain zone, threat, hero zone, hand tray, plus a card
 * context menu, a toast and a damage splash. The hero colour is an accent on the zone, never its base.
 */
export const BoardKit: React.FC = () => {
  return (
    <ThemedTable className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 pb-10 pt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ribbon>Round 3</Ribbon>
            <Ribbon active>Hero phase</Ribbon>
          </div>
          <div className="flex items-center gap-2">
            <ThemedButton variant="secondary" icon={<Layers className="w-4 h-4" />}>
              Piles
            </ThemedButton>
            <ThemedButton variant="primary" icon={<RotateCw className="w-4 h-4" />}>
              End turn
            </ThemedButton>
          </div>
        </div>

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
                  <StatCounter icon={<Crosshair className="w-4 h-4" />} label="Attack" value={2} />
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
                  <StatCounter icon={<Crosshair className="w-4 h-4" />} label="Attack" value={2} />
                  <StatCounter icon={<Footprints className="w-4 h-4" />} label="Thwart" value={2} />
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
    </ThemedTable>
  );
};
