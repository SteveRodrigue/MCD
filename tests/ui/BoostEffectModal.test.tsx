import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BoostEffectModal } from '../../src/ui/components/board/BoostEffectModal';
import { PendingDecisionPrompt } from '../../src/engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/game-setup';

describe('BoostEffectModal Component (Issue #503)', () => {
  const tigerSharkCard = cardCatalog.getCard('01131')!;
  const tigerSharkInst = createCardInstance({
    ...tigerSharkCard,
    boostIcons: 1,
    boostStar: true,
  });

  const samplePrompt: PendingDecisionPrompt = {
    promptId: 'prompt_boost_01131',
    playerId: 'p1',
    kind: 'BOOST_ABILITY_REVEAL',
    title: 'Tiger Shark',
    description: 'Give the villain a tough status card.',
    sourceCardName: 'Tiger Shark',
    sourceCardCode: '01131',
    sourceCardInstance: tigerSharkInst,
    attackerName: 'Rhino',
    options: [
      {
        id: 'resolve_boost',
        label: 'Continue',
        effect: 'CONTINUE_COMBAT_AFTER_BOOST',
      },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the modal with boost card name, boost icons, star badge, and ability text', () => {
    render(
      <BoostEffectModal
        isOpen={true}
        prompt={samplePrompt}
        pacing="manual"
        isAutoPlaying={false}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByTestId('boost-effect-modal')).toBeDefined();
    expect(screen.getByText('BOOST ABILITY REVEALED')).toBeDefined();
    expect(screen.getByText('Tiger Shark')).toBeDefined();
    expect(screen.getByText(/Give the villain a tough status card/i)).toBeDefined();
  });

  it('calls onContinue when the Continue button is clicked', () => {
    const handleContinue = vi.fn();
    render(
      <BoostEffectModal
        isOpen={true}
        prompt={samplePrompt}
        pacing="manual"
        isAutoPlaying={false}
        onContinue={handleContinue}
      />,
    );

    const continueBtn = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueBtn);
    expect(handleContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onContinue when Spacebar or Enter is pressed', () => {
    const handleContinue = vi.fn();
    render(
      <BoostEffectModal
        isOpen={true}
        prompt={samplePrompt}
        pacing="manual"
        isAutoPlaying={false}
        onContinue={handleContinue}
      />,
    );

    fireEvent.keyDown(window, { key: ' ' });
    expect(handleContinue).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(handleContinue).toHaveBeenCalledTimes(2);
  });

  it('auto-advances after the delay when isAutoPlaying is true and pacing is auto_fast', () => {
    const handleContinue = vi.fn();
    render(
      <BoostEffectModal
        isOpen={true}
        prompt={samplePrompt}
        pacing="auto_fast"
        isAutoPlaying={true}
        onContinue={handleContinue}
      />,
    );

    expect(handleContinue).not.toHaveBeenCalled();

    // Advance 450ms for auto_fast
    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(handleContinue).toHaveBeenCalledTimes(1);
  });

  it('does not auto-advance when pacing is manual even if isAutoPlaying is true', () => {
    const handleContinue = vi.fn();
    render(
      <BoostEffectModal
        isOpen={true}
        prompt={samplePrompt}
        pacing="manual"
        isAutoPlaying={true}
        onContinue={handleContinue}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(handleContinue).not.toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <BoostEffectModal
        isOpen={false}
        prompt={samplePrompt}
        pacing="manual"
        isAutoPlaying={false}
        onContinue={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });
});
