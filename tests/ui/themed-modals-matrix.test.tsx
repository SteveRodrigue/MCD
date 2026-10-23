import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';
import type {
  CombatResolutionSummary,
  GameState,
  PendingDecisionPrompt,
} from '../../src/engine/models';
import { AllyActionModal } from '../../src/ui/components/board/AllyActionModal';
import { CardPaymentModal } from '../../src/ui/components/board/CardPaymentModal';
import { CombatBoostModal } from '../../src/ui/components/board/CombatBoostModal';
import { DistributeAmountModal } from '../../src/ui/components/board/DistributeAmountModal';
import { IdentityActionModal } from '../../src/ui/components/board/IdentityActionModal';
import { SimultaneousAbilitiesModal } from '../../src/ui/components/board/SimultaneousAbilitiesModal';
import { TableauActionModal } from '../../src/ui/components/board/TableauActionModal';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { MODAL_STYLES, type ModalStyle } from '../../src/ui/theme/modal-styles';
import { newRhinoGame } from '../support/game-fixtures';
import { TestSession } from '../support/render-with-session';
import { cardNamesWithoutThumbnail } from '../support/card-anchoring';

/**
 * Every migrated game modal renders under every theme and names its cards with their thumbnails.
 * (The target-picker and decision modals have their own matrices.)
 */
const instance = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

const buildState = (): GameState => {
  const state = newRhinoGame({
    players: [{ form: 'hero', hand: ['01003'], tableau: ['01007'] }],
  });
  state.players[0].allies = [instance('01050')];
  return state;
};

const named = (...codes: string[]) =>
  codes.map((code) => ({ code, name: cardCatalog.getCard(code)!.name }));

interface Case {
  label: string;
  cards: { code: string; name: string }[];
  render: (state: GameState) => React.ReactElement;
}

const CASES: Case[] = [
  {
    label: 'AllyActionModal',
    cards: named('01050'),
    render: (state) => (
      <AllyActionModal
        isOpen
        ally={state.players[0].allies[0]}
        player={state.players[0]}
        onClose={vi.fn()}
        onInitiateAllyAttack={vi.fn()}
        onInitiateAllyThwart={vi.fn()}
      />
    ),
  },
  {
    label: 'IdentityActionModal',
    cards: named('01001a'),
    render: (state) => <IdentityActionModal isOpen player={state.players[0]} onClose={vi.fn()} />,
  },
  {
    label: 'TableauActionModal',
    cards: named('01007'),
    render: (state) => (
      <TableauActionModal
        isOpen
        cardInstance={state.players[0].tableau[0]}
        player={state.players[0]}
        onClose={vi.fn()}
        onSelectAbility={vi.fn()}
      />
    ),
  },
  {
    label: 'CardPaymentModal',
    cards: named('01003'),
    render: (state) => (
      <CardPaymentModal
        isOpen
        onClose={vi.fn()}
        cardToPlay={state.players[0].hand[0]}
        player={state.players[0]}
        onConfirmPlay={vi.fn()}
      />
    ),
  },
  {
    label: 'DistributeAmountModal',
    cards: named('01001a', '01002'),
    render: () => (
      <DistributeAmountModal
        prompt={
          {
            promptId: 'p',
            playerId: 'p1',
            title: 'Assign damage',
            description: '',
            sourceCardName: 'Backflip',
            sourceCardCode: '01003',
            kind: 'DISTRIBUTE_POINTS',
            options: [],
            distributionConfig: {
              totalBudget: 2,
              effectiveBudget: 2,
              budgetLabel: 'DAMAGE',
              unitSingular: 'DMG',
              unitPlural: 'DMG',
              exactMatchRequired: true,
              canCancel: true,
              allocationDomain: 'DAMAGE',
              targets: [
                {
                  instanceId: 'a',
                  name: 'Spider-Man',
                  cardCode: '01001a',
                  cardType: 'hero',
                  currentValue: 10,
                  maxValue: 10,
                  allocationCap: 10,
                  isEligible: true,
                },
                {
                  instanceId: 'b',
                  name: 'Black Cat',
                  cardCode: '01002',
                  cardType: 'ally',
                  currentValue: 2,
                  maxValue: 2,
                  allocationCap: 2,
                  isEligible: true,
                },
              ],
            },
          } as PendingDecisionPrompt
        }
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    ),
  },
  {
    label: 'SimultaneousAbilitiesModal',
    cards: named('01004'),
    render: () => (
      <SimultaneousAbilitiesModal
        prompt={
          {
            promptId: 'p',
            playerId: 'p1',
            title: 'Order',
            description: 'Choose the order.',
            sourceCardName: 'x',
            options: [
              { id: 'o1', label: 'Enhanced Spider-Sense', cardCode: '01004', effect: 'X' },
              { id: 'o2', label: 'Backflip', cardCode: '01003', effect: 'X' },
            ],
          } as PendingDecisionPrompt
        }
        onConfirmOrder={vi.fn()}
      />
    ),
  },
  {
    label: 'CombatBoostModal',
    cards: named('01094', '01099'),
    render: () => (
      <CombatBoostModal
        isOpen
        onContinue={vi.fn()}
        outcome={
          {
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
            boostCards: [instance('01099')],
            totalBoostIcons: 1,
            defenseValue: 3,
            finalDamage: 0,
          } as CombatResolutionSummary
        }
      />
    ),
  },
];

const mount = (style: ModalStyle, c: Case) => {
  const state = buildState();
  return render(
    <ModalStyleProvider style={style} cardAccents>
      <TestSession state={state}>{c.render(state)}</TestSession>
    </ModalStyleProvider>,
  );
};

describe.each(CASES.map((c) => [c.label, c] as const))('%s under every theme', (_l, c) => {
  it.each(MODAL_STYLES.map((s) => [s.label, s] as const))('renders in %s', (_label, style) => {
    mount(style, c);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.querySelector('[data-card-ref],[data-card-anchor]')).toBeTruthy();
  });

  it('names every card with its thumbnail', () => {
    mount(MODAL_STYLES[0], c);
    expect(cardNamesWithoutThumbnail(c.cards)).toEqual([]);
  });
});
