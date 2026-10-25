import React, { useMemo, useState } from 'react';
import { Archive } from 'lucide-react';
import { cardCatalog } from '../../../data/importer/card-loader';
import type {
  AllTimeStats,
  CombatResolutionSummary,
  GameAction,
  PendingDecisionPrompt,
  TargetAllocationItem,
} from '../../../engine/models';
import { getActiveMainScheme } from '../../../engine/models';
import type { TriggerCallNode } from '../../../engine/errors/infinite-loop-error';
import { GameSessionProvider } from '../../context/GameStateContext';
import {
  DEFAULT_SETTINGS,
  GameSettingsContext,
  type GameSettings,
  type GameSettingsContextType,
} from '../../context/game-settings-context';
import { AllyActionModal } from '../board/AllyActionModal';
import { AttackTargetModal } from '../board/AttackTargetModal';
import { CardPaymentModal } from '../board/CardPaymentModal';
import { CombatBoostModal } from '../board/CombatBoostModal';
import { DistributeAmountModal } from '../board/DistributeAmountModal';
import { GameOverScreen } from '../board/GameOverScreen';
import { IdentityActionModal } from '../board/IdentityActionModal';
import { InfiniteLoopModal } from '../board/InfiniteLoopModal';
import { OptionsMenu } from '../board/OptionsMenu';
import { PileCardTile, PileGrid, PileViewerModal } from '../board/PileViewerModal';
import { ReportProblemModal } from '../board/ReportProblemModal';
import { SimultaneousAbilitiesModal } from '../board/SimultaneousAbilitiesModal';
import { TableauActionModal } from '../board/TableauActionModal';
import { ThwartTargetModal } from '../board/ThwartTargetModal';
import { CardStatsModal } from '../cards/CardStatsModal';
import { ResetCardStatsConfirmModal } from '../cards/ResetCardStatsConfirmModal';
import { buildLabGame, labEnemyTargets, labInstance, labSchemeTargets } from './lab-state';
import type { ArchetypeId } from './template-routes';

export interface ModalPreviewProps {
  item: ArchetypeId;
  onAction: (message: string) => void;
}

/**
 * Settings the Options preview can change without touching the player's saved settings: the real
 * provider writes to localStorage, this one lives and dies with the preview.
 */
const LabSettings: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const value = useMemo<GameSettingsContextType>(() => {
    const update = (partial: Partial<GameSettings>) => setSettings((s) => ({ ...s, ...partial }));
    return {
      settings,
      devMode: settings.devMode,
      autoResolveUnambiguous: settings.autoResolveUnambiguous,
      edgeScrollSpeed: settings.edgeScrollSpeed,
      cardZoomLevel: settings.cardZoomLevel,
      villainPhasePacing: settings.villainPhasePacing,
      defaultDifficulty: settings.defaultDifficulty,
      defaultHeroicLevel: settings.defaultHeroicLevel,
      setDevMode: (devMode) => update({ devMode }),
      toggleDevMode: () => setSettings((s) => ({ ...s, devMode: !s.devMode })),
      setAutoResolveUnambiguous: (autoResolveUnambiguous) => update({ autoResolveUnambiguous }),
      toggleAutoResolveUnambiguous: () =>
        setSettings((s) => ({ ...s, autoResolveUnambiguous: !s.autoResolveUnambiguous })),
      setEdgeScrollSpeed: (edgeScrollSpeed) => update({ edgeScrollSpeed }),
      setCardZoomLevel: (cardZoomLevel) => update({ cardZoomLevel }),
      setVillainPhasePacing: (villainPhasePacing) => update({ villainPhasePacing }),
      setDefaultDifficulty: (defaultDifficulty) => update({ defaultDifficulty }),
      setDefaultHeroicLevel: (defaultHeroicLevel) => update({ defaultHeroicLevel }),
      updateSettings: update,
    };
  }, [settings]);
  return <GameSettingsContext.Provider value={value}>{children}</GameSettingsContext.Provider>;
};

const BOOST_CARDS = [labInstance('01102'), labInstance('01094'), labInstance('01102')];
const BOOST_ICONS = BOOST_CARDS.reduce((sum, c) => sum + (c.card.boostIcons ?? 0), 0);

const COMBAT_OUTCOME: CombatResolutionSummary = {
  id: 'lab_combat',
  attackerName: 'Rhino',
  attackerCode: '01094',
  attackerType: 'VILLAIN',
  targetPlayerId: 'p1',
  targetHeroName: 'Spider-Man',
  targetHeroCode: '01001a',
  defenderType: 'HERO',
  defenderName: 'Spider-Man',
  defenderCode: '01001a',
  baseAttack: 2,
  boostCards: BOOST_CARDS,
  totalBoostIcons: BOOST_ICONS,
  defenseValue: 1,
  finalDamage: 2 + BOOST_ICONS - 1,
};

const target = (
  instanceId: string,
  name: string,
  cardCode: string,
  cardType: TargetAllocationItem['cardType'],
  extra: Partial<TargetAllocationItem> = {},
): TargetAllocationItem => ({ instanceId, name, cardCode, cardType, isEligible: true, ...extra });

const DISTRIBUTE_PROMPT: PendingDecisionPrompt = {
  promptId: 'lab_distribute',
  playerId: 'p1',
  title: 'Distribute damage',
  description: 'Spread 3 damage among enemies.',
  sourceCardName: 'Spider-Man',
  sourceCardCode: '01001a',
  isVoluntary: false,
  options: [],
  distributionConfig: {
    totalBudget: 3,
    effectiveBudget: 3,
    budgetLabel: 'Damage to distribute',
    unitSingular: 'damage',
    unitPlural: 'damage',
    exactMatchRequired: true,
    canCancel: true,
    allocationDomain: 'DAMAGE',
    targets: [
      target('rhino', 'Rhino', '01094', 'villain', { currentValue: 14, maxValue: 18 }),
      target('sandman', 'Sandman', '01102', 'minion', {
        currentValue: 3,
        maxValue: 5,
        hasTough: true,
        allocationCap: 3,
      }),
    ],
  },
};

const SIMULTANEOUS_PROMPT: PendingDecisionPrompt = {
  promptId: 'lab_simultaneous',
  playerId: 'p1',
  title: 'Order the abilities',
  description: 'Several abilities trigger at once. Choose the order they resolve in.',
  sourceCardName: 'Rhino',
  isVoluntary: false,
  options: [
    {
      id: 'a1',
      label: 'Spider-Tracer',
      cardName: 'Spider-Tracer',
      cardCode: '01007',
      description: 'Place 1 tracer counter on the minion.',
      effect: 'ORDER',
      params: { triggerType: 'INTERRUPT', playerName: 'Spider-Man' },
    },
    {
      id: 'a2',
      label: 'Sandman',
      cardName: 'Sandman',
      cardCode: '01102',
      description: 'Forced Response: Sandman attacks again.',
      effect: 'ORDER',
      params: { triggerType: 'CHARACTER_DEFEATED', playerName: 'Rhino' },
    },
    {
      id: 'a3',
      label: 'Hulk',
      cardName: 'Hulk',
      cardCode: '01050',
      description: 'Response: Hulk smashes.',
      effect: 'ORDER',
      params: { triggerType: 'RESPONSE', playerName: 'Spider-Man' },
    },
  ],
};

/** Sandman and Rhino keep triggering each other; Sandman fires twice, so the cycle closes. */
const LOOP_CYCLE: TriggerCallNode[] = [
  {
    trigger: 'CHARACTER_DEFEATED',
    abilityId: 'sandman_reform',
    sourceInstanceId: 'lab_sandman',
    cardCode: '01102',
    cardName: 'Sandman',
  },
  {
    trigger: 'ENEMY_INITIATES_ATTACK',
    abilityId: 'rhino_charge',
    sourceInstanceId: 'lab_rhino',
    cardCode: '01094',
    cardName: 'Rhino',
  },
  {
    trigger: 'CHARACTER_DEFEATED',
    abilityId: 'sandman_reform',
    sourceInstanceId: 'lab_sandman',
    cardCode: '01102',
    cardName: 'Sandman',
  },
];

const ALL_TIME_STATS: AllTimeStats = {
  gamesPlayed: 12,
  cards: {
    '01001a': {
      played: 12,
      abilitiesUsed: {},
      basicActions: { attack: 30, thwart: 22, defense: 9 },
    },
    '01094': { played: 8, abilitiesUsed: {} },
  },
  basicActions: {
    heroAttack: 30,
    heroThwart: 22,
    heroDefense: 9,
    alterEgoRecover: 7,
    changeForm: 14,
    allyAttack: 11,
    allyThwart: 4,
    villainAttack: 18,
    villainScheme: 12,
    minionAttack: 6,
    minionScheme: 3,
  },
};

/**
 * The remaining real game modals, one per `item`, fed with sample data. Everything that reads the
 * game session gets a real Rhino game; callbacks report what was chosen to the lab's status chip
 * and never change a game.
 */
export const ModalPreview: React.FC<ModalPreviewProps> = ({ item, onAction }) => {
  const game = useMemo(() => buildLabGame(), []);
  const { state, player, ally, upgrade, costly } = game;
  const close = () => onAction('Closed');
  const noop = (action: GameAction) => onAction(`Dispatched: ${action.type}`);

  const body = (() => {
    switch (item) {
      case 'attack-target':
        return (
          <AttackTargetModal
            isOpen
            attackerName="Spider-Man"
            attackerCode="01001a"
            attackerType="hero"
            attackDamage={2}
            targets={labEnemyTargets()}
            onSelectTarget={(t) => onAction(`Attack: ${t.name}`)}
            onClose={close}
          />
        );
      case 'thwart-target':
        return (
          <ThwartTargetModal
            isOpen
            thwarterName="Spider-Man"
            thwarterCode="01001a"
            thwarterType="hero"
            thwartValue={2}
            consequentialDamage={1}
            targets={labSchemeTargets(getActiveMainScheme(state).card.code)}
            onSelectTarget={(t) => onAction(`Thwart: ${t.name}`)}
            onClose={close}
          />
        );
      case 'ally-menu':
        return (
          <AllyActionModal
            isOpen
            ally={ally}
            player={player}
            onClose={close}
            onInitiateAllyAttack={() => onAction('Ally attack')}
            onInitiateAllyThwart={() => onAction('Ally thwart')}
          />
        );
      case 'tableau-menu':
        return (
          <TableauActionModal
            isOpen
            cardInstance={upgrade}
            player={player}
            onClose={close}
            onSelectAbility={(ability) => onAction(`Ability: ${ability.id}`)}
          />
        );
      case 'identity-menu':
        return (
          <IdentityActionModal
            isOpen
            player={player}
            onClose={close}
            onInitiateAction={() => onAction('Action')}
            onInitiateHeroAttack={() => onAction('Hero attack')}
            onInitiateHeroThwart={() => onAction('Hero thwart')}
          />
        );
      case 'combat-boost':
        return (
          <CombatBoostModal
            isOpen
            outcome={COMBAT_OUTCOME}
            onContinue={() => onAction('Continue')}
          />
        );
      case 'distribute':
        return (
          <DistributeAmountModal
            prompt={DISTRIBUTE_PROMPT}
            onConfirm={(a) => onAction(`Distributed: ${JSON.stringify(a)}`)}
            onCancel={close}
          />
        );
      case 'simultaneous':
        return (
          <SimultaneousAbilitiesModal
            prompt={SIMULTANEOUS_PROMPT}
            onConfirmOrder={(order) => onAction(`Order: ${order.join(', ')}`)}
          />
        );
      case 'payment':
        return (
          <CardPaymentModal
            isOpen
            cardToPlay={costly}
            player={player}
            onClose={close}
            onConfirmPlay={(hand, gens) =>
              onAction(`Pay: ${hand.length} cards, ${gens.length} generators`)
            }
          />
        );
      case 'pile-viewer':
        return (
          <PileViewerModal
            title="Removed from Game (4 Cards)"
            description="Cards removed from the game are out of play. #1 is the most recently removed."
            icon={<Archive className="w-5 h-5" />}
            verb="red"
            closeLabel="Close"
            onClose={close}
          >
            <PileGrid>
              {player.hand.map((c, i) => (
                <PileCardTile key={c.instanceId} instance={c} rank={i + 1} label={c.card.name} />
              ))}
            </PileGrid>
          </PileViewerModal>
        );
      case 'options':
        return (
          <LabSettings>
            <OptionsMenu isOpen onClose={close} />
          </LabSettings>
        );
      case 'report':
        return (
          <ReportProblemModal
            isOpen
            onClose={close}
            initialDescription="The villain skipped a step."
          />
        );
      case 'card-stats':
        return (
          <CardStatsModal
            isOpen
            onClose={close}
            card={cardCatalog.getCard('01001a')!}
            gameState={state}
            allTimeStats={ALL_TIME_STATS}
            devMode
            onStatsReset={() => onAction('Stats reset')}
          />
        );
      case 'reset-stats':
        return (
          <ResetCardStatsConfirmModal
            isOpen
            onClose={close}
            card={cardCatalog.getCard('01001a')!}
            onConfirm={() => onAction('Confirmed reset')}
          />
        );
      case 'game-over':
        return <GameOverScreen onReset={() => onAction('New game')} />;
      case 'infinite-loop':
        return (
          <InfiniteLoopModal
            message="Circular trigger cycle detected between forced abilities."
            cycle={LOOP_CYCLE}
            onDismiss={close}
            onReset={() => onAction('Reset game')}
          />
        );
      default:
        return null;
    }
  })();

  const session = useMemo(
    () => (item === 'game-over' ? { ...state, winner: 'HEROES' as const } : state),
    [item, state],
  );

  return (
    <GameSessionProvider state={session} dispatch={noop}>
      {body}
    </GameSessionProvider>
  );
};
