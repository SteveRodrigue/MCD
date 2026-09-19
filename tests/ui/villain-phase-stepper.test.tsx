import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VillainPhaseStepper } from '../../src/ui/components/board/VillainPhaseStepper';
import { CombatBoostModal } from '../../src/ui/components/board/CombatBoostModal';
import { ComicDamageSplash } from '../../src/ui/components/board/ComicDamageSplash';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/card-instance';
import {
  GameState,
  GamePhase,
  VillainPhaseStep,
  CombatResolutionSummary,
} from '../../src/engine/models';

describe('Villain Phase UI Suite (ADR-0068 / Issue #140)', () => {
  describe('VillainPhaseStepper', () => {
    const mockState: Partial<GameState> = {
      phase: GamePhase.VILLAIN_PHASE,
      villainPhaseStep: VillainPhaseStep.MAIN_SCHEME_THREAT,
      villainPhaseStepEvent: {
        type: 'THREAT_PLACED',
        step: VillainPhaseStep.MAIN_SCHEME_THREAT,
        amount: 1,
        description: '1 threat placed on the main scheme.',
        onomatopoeia: 'SCHEME GROWS!',
      },
    };

    it('renders step category, description, and onomatopoeia when in VILLAIN_PHASE', () => {
      const onNextStep = vi.fn();
      const onToggleAutoPlay = vi.fn();

      render(
        <VillainPhaseStepper
          gameState={mockState as GameState}
          pacing="auto_normal"
          onNextStep={onNextStep}
          onToggleAutoPlay={onToggleAutoPlay}
          isAutoPlaying={true}
        />,
      );

      expect(screen.getByTestId('villain-phase-stepper')).toBeDefined();
      expect(screen.getByText('1. THREAT')).toBeDefined();
      expect(screen.getByText('1 threat placed on the main scheme.')).toBeDefined();
      expect(screen.getByText('SCHEME GROWS!')).toBeDefined();
    });

    it('triggers onNextStep when Next Step button is clicked', () => {
      const onNextStep = vi.fn();

      render(
        <VillainPhaseStepper
          gameState={mockState as GameState}
          pacing="manual"
          onNextStep={onNextStep}
        />,
      );

      const nextButton = screen.getByRole('button', { name: /next step/i });
      fireEvent.click(nextButton);

      expect(onNextStep).toHaveBeenCalledTimes(1);
    });

    it('disables Next Step button and displays alert banner when a decision prompt is pending', () => {
      const onNextStep = vi.fn();
      const stateWithPrompt: Partial<GameState> = {
        ...mockState,
        pendingDecisionPrompt: {
          promptId: 'prompt_1',
          playerId: 'p1',
          title: 'Defend?',
          description: 'Choose defender',
          sourceCardName: 'Rhino',
          options: [],
        },
      };

      render(
        <VillainPhaseStepper
          gameState={stateWithPrompt as GameState}
          pacing="auto_normal"
          onNextStep={onNextStep}
        />,
      );

      expect(screen.getByText(/Awaiting player decision prompt/i)).toBeDefined();
      const nextButton = screen.getByRole('button', { name: /next step/i });
      expect((nextButton as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(nextButton);
      expect(onNextStep).not.toHaveBeenCalled();
    });

    it('returns null when not in VILLAIN_PHASE', () => {
      const playerPhaseState: Partial<GameState> = {
        phase: GamePhase.PLAYER_PHASE,
      };

      const { container } = render(
        <VillainPhaseStepper
          gameState={playerPhaseState as GameState}
          pacing="auto_normal"
          onNextStep={vi.fn()}
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('CombatBoostModal', () => {
    it('renders base ATK, boost cards, formula, and final damage', () => {
      const boostCardDef = cardCatalog.getCard('01107')!;
      const boostCardInstance = createCardInstance({
        ...boostCardDef,
        boostIcons: 1,
      });

      const outcome: CombatResolutionSummary = {
        attackerName: 'Rhino',
        attackerType: 'VILLAIN',
        targetPlayerId: 'p1',
        targetHeroName: 'Spider-Man',
        baseAttack: 2,
        boostCards: [boostCardInstance],
        totalBoostIcons: 1,
        defenseValue: 0,
        defenderType: 'UNDEFENDED',
        finalDamage: 3,
        hasOverkill: false,
        hasPiercing: false,
      };

      const onContinue = vi.fn();

      render(<CombatBoostModal isOpen={true} outcome={outcome} onContinue={onContinue} />);

      expect(screen.getByTestId('combat-boost-modal')).toBeDefined();
      expect(screen.getAllByText('Rhino').length).toBeGreaterThan(0);
      expect(screen.getByText('Base ATK')).toBeDefined();
      expect(screen.getByText('Boost Icons')).toBeDefined();
      expect(screen.getByText('Total ATK')).toBeDefined();
      expect(screen.getByText(/3\s*HP/i)).toBeDefined();

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('triggers onContinue on Spacebar and Enter keydown events', () => {
      const outcome: CombatResolutionSummary = {
        attackerName: 'Rhino',
        attackerType: 'VILLAIN',
        targetPlayerId: 'p1',
        baseAttack: 2,
        boostCards: [],
        totalBoostIcons: 0,
        defenseValue: 2,
        defenderType: 'HERO',
        defenderName: 'Spider-Man',
        finalDamage: 0,
        hasOverkill: false,
        hasPiercing: false,
      };

      const onContinue = vi.fn();

      render(<CombatBoostModal isOpen={true} outcome={outcome} onContinue={onContinue} />);

      fireEvent.keyDown(window, { key: ' ' });
      expect(onContinue).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(onContinue).toHaveBeenCalledTimes(2);
    });

    it('returns null when isOpen is false', () => {
      const { container } = render(<CombatBoostModal isOpen={false} onContinue={vi.fn()} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('ComicDamageSplash', () => {
    it('renders explosive pop-art starburst and damage amount when amount > 0', () => {
      render(<ComicDamageSplash amount={3} onomatopoeia="KAPOW!" />);

      expect(screen.getByTestId('comic-damage-splash')).toBeDefined();
      expect(screen.getByText('KAPOW!')).toBeDefined();
      expect(screen.getByText('-3 HP')).toBeDefined();
      expect(screen.getByText('(3 dmg taken)')).toBeDefined();
    });

    it('returns null when amount is 0 or negative', () => {
      const { container } = render(<ComicDamageSplash amount={0} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
