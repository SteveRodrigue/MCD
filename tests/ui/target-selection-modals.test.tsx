import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';
import { AttackTargetModal } from '../../src/ui/components/board/AttackTargetModal';
import { ThwartTargetModal } from '../../src/ui/components/board/ThwartTargetModal';
import type { EnemyTarget } from '../../src/ui/components/board/attack-target-utils';
import type { SchemeTarget } from '../../src/ui/components/board/thwart-target-utils';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { MODAL_STYLES } from '../../src/ui/theme/modal-styles';
import { cardNamesWithoutThumbnail } from '../support/card-anchoring';

const instance = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

const villain: EnemyTarget = {
  id: 'villain_1',
  name: 'Rhino',
  type: 'villain',
  instanceId: 'villain_1',
  health: 14,
  maxHealth: 14,
  damage: 2,
  traits: [],
  hasGuard: false,
  hasTough: true,
  cardInstance: instance('01094'),
};
const minion: EnemyTarget = {
  id: 'minion_1',
  name: 'Sandman',
  type: 'minion',
  instanceId: 'minion_1',
  health: 5,
  maxHealth: 5,
  damage: 0,
  traits: [],
  hasGuard: true,
  hasTough: false,
  cardInstance: instance('01102'),
};

const mainScheme: SchemeTarget = {
  id: 'main_1',
  name: 'The Break-In!',
  type: 'main_scheme',
  instanceId: 'main_1',
  threat: 3,
  targetThreat: 10,
  hasCrisis: true,
  hasHazard: false,
  hasAcceleration: true,
  allowed: true,
  cardInstance: instance('01097b'),
};
const blockedSide: SchemeTarget = {
  id: 'side_1',
  name: 'Bomb Scare',
  type: 'side_scheme',
  instanceId: 'side_1',
  threat: 2,
  hasCrisis: false,
  hasHazard: true,
  hasAcceleration: false,
  allowed: false,
  disabledReason: 'Crisis on the table',
};

const renderAttack = (overrides: Partial<React.ComponentProps<typeof AttackTargetModal>> = {}) => {
  const props = {
    isOpen: true,
    attackerName: 'Spider-Man',
    attackerCode: '01001a',
    attackerType: 'hero' as const,
    attackDamage: 3,
    targets: [villain, minion],
    onSelectTarget: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<AttackTargetModal {...props} />);
  return props;
};

const renderThwart = (overrides: Partial<React.ComponentProps<typeof ThwartTargetModal>> = {}) => {
  const props = {
    isOpen: true,
    thwarterName: 'Spider-Man',
    thwarterCode: '01001a',
    thwarterType: 'hero' as const,
    thwartValue: 2,
    consequentialDamage: 1,
    targets: [mainScheme, blockedSide],
    onSelectTarget: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ThwartTargetModal {...props} />);
  return props;
};

describe('AttackTargetModal', () => {
  it('renders nothing when closed or without targets', () => {
    renderAttack({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists every target with its kind and status badges', () => {
    renderAttack();
    expect(screen.getByRole('dialog', { name: 'Choose an enemy to attack' })).toBeTruthy();
    expect(screen.getByText('Hero strike')).toBeTruthy();
    expect(screen.getByText('VILLAIN')).toBeTruthy();
    expect(screen.getByText('MINION')).toBeTruthy();
    expect(screen.getByText('GUARD')).toBeTruthy();
    expect(screen.getByText('TOUGH')).toBeTruthy();
    expect(screen.queryByText('(2 dmg)')).toBeNull();
    expect(screen.queryByText(/STRIKE/)).toBeNull();
    expect(screen.getAllByText('3 ATK')).toHaveLength(1);
    expect(screen.queryByText(/is ready to/)).toBeNull();
  });

  it('strikes the chosen target and closes', () => {
    const props = renderAttack();
    fireEvent.click(screen.getByText('Sandman').closest('button')!);
    expect(props.onSelectTarget).toHaveBeenCalledWith(minion);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('cancels from the footer, the close button and Escape', () => {
    const props = renderAttack();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Strike' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(3);
    expect(props.onSelectTarget).not.toHaveBeenCalled();
  });

  it('shows an ally strike in the header', () => {
    renderAttack({ attackerType: 'ally', attackerName: 'Black Widow', attackerCode: '01075' });
    expect(screen.getByText('Ally strike')).toBeTruthy();
  });
});

describe('ThwartTargetModal', () => {
  it('lists schemes with their threat, badges and the consequential damage', () => {
    renderThwart();
    expect(screen.getByRole('dialog', { name: 'Choose a scheme to thwart' })).toBeTruthy();
    expect(screen.getByText('Hero thwart')).toBeTruthy();
    expect(screen.getByText('Takes 1 DMG')).toBeTruthy();
    expect(screen.getByText('MAIN SCHEME')).toBeTruthy();
    expect(screen.getByText('CRISIS')).toBeTruthy();
    expect(screen.getByText('ACCEL')).toBeTruthy();
    expect(screen.getByText('HAZARD')).toBeTruthy();
    expect(screen.getByText('(Crisis on the table)')).toBeTruthy();
  });

  it('foils an allowed scheme and closes', () => {
    const props = renderThwart();
    fireEvent.click(screen.getByText('The Break-In!').closest('button')!);
    expect(props.onSelectTarget).toHaveBeenCalledWith(mainScheme);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks a scheme that cannot be thwarted', () => {
    const props = renderThwart();
    const blocked = screen.getByText('Bomb Scare').closest('button') as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);
    expect(screen.getByText('BLOCKED')).toBeTruthy();
    fireEvent.click(blocked);
    expect(props.onSelectTarget).not.toHaveBeenCalled();
  });

  it('omits the consequential damage chip when there is none', () => {
    renderThwart({ consequentialDamage: undefined });
    expect(screen.queryByText(/Takes/)).toBeNull();
  });
});

describe.each(MODAL_STYLES.map((s) => [s.label, s] as const))(
  'target modals in %s',
  (_l, style) => {
    const cards = [
      { code: '01001a', name: 'Spider-Man' },
      { code: '01094', name: 'Rhino' },
      { code: '01102', name: 'Sandman' },
      { code: '01097b', name: 'The Break-In!' },
    ];

    it('name every card with its thumbnail', () => {
      render(
        <ModalStyleProvider style={style} cardAccents>
          <AttackTargetModal
            isOpen
            attackerName="Spider-Man"
            attackerCode="01001a"
            attackerType="hero"
            attackDamage={3}
            targets={[villain, minion]}
            onSelectTarget={vi.fn()}
            onClose={vi.fn()}
          />
        </ModalStyleProvider>,
      );
      expect(cardNamesWithoutThumbnail(cards)).toEqual([]);
      expect(
        document.querySelectorAll('[data-card-anchor] span[aria-hidden][data-accent]').length,
      ).toBe(2);
    });

    it('name every scheme with its thumbnail', () => {
      render(
        <ModalStyleProvider style={style}>
          <ThwartTargetModal
            isOpen
            thwarterName="Spider-Man"
            thwarterCode="01001a"
            thwarterType="hero"
            thwartValue={2}
            targets={[mainScheme]}
            onSelectTarget={vi.fn()}
            onClose={vi.fn()}
          />
        </ModalStyleProvider>,
      );
      expect(cardNamesWithoutThumbnail(cards)).toEqual([]);
    });
  },
);
