import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComicSpeechBalloon } from '../../src/ui/components/board/ComicSpeechBalloon';
import { GamePhase } from '../../src/engine/models';
import type { FormattedComicDialogue } from '../../src/ui/utils/comic-log-formatter';

const dialogue: FormattedComicDialogue = {
  id: 'log-1',
  type: 'hero_speech',
  speakerName: 'Spider-Man',
  speakerRole: 'hero',
  narrativeAction: 'Spider-Man takes a mulligan: discards 0, hand of 6.',
  onomatopoeia: 'MULLIGAN RESOLVED!',
  round: 1,
  phase: GamePhase.PLAYER_PHASE,
  timestamp: 1000,
  rawEntry: {} as FormattedComicDialogue['rawEntry'],
};

describe('ComicSpeechBalloon banner (Issue #327)', () => {
  it('keeps the speaker name whole and lets the badges drop to a second line', () => {
    render(<ComicSpeechBalloon dialogue={dialogue} index={2} />);

    const name = screen.getByText('Spider-Man', { selector: 'span' });
    expect(name.className).not.toContain('truncate');
    expect(name.className).toContain('whitespace-nowrap');

    const banner = name.closest('div')!.parentElement!;
    expect(banner.className).toContain('flex-wrap');
    expect(screen.getByText('MULLIGAN RESOLVED!')).toBeDefined();
  });
});
