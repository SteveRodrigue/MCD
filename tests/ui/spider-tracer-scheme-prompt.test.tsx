import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { DecisionPromptModal } from '../../src/ui/components/board/DecisionPromptModal';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import type { AlterEgoCard, GameState, HeroCard, SideSchemeState } from '@engine/models';

/**
 * The scheme prompt Spider-Tracer raises (Issue #249): the engine builds it, the modal renders it,
 * the clicked option id goes back to the engine. Each hop must keep the scheme the player picked.
 */
describe('Spider-Tracer scheme prompt, engine to modal to engine (Issue #249)', () => {
  const buildPromptState = (): GameState => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const peter = cardCatalog.getCard('01001b') as AlterEgoCard;
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderMan,
          alterEgo: peter,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      skipMulligan: true,
      skipScenarioPlugin: true,
    } as any);
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    state.mainScheme.threat = 5;

    const minion = createCardInstance(cardCatalog.getCard('01101')!);
    const tracer = createCardInstance(cardCatalog.getCard('01007')!);
    (tracer as any).ownerId = 'p1';
    minion.attachments = [tracer];
    minion.tokens = { damage: 2 };
    state.players[0].engagedMinions = [minion];

    const bombScare: SideSchemeState = {
      instanceId: 'side_bomb_scare',
      card: cardCatalog.getCard('01109') as any,
      threat: 4,
    };
    const breakin: SideSchemeState = {
      instanceId: 'side_breakin',
      card: cardCatalog.getCard('01107') as any,
      threat: 3,
    };
    state.sideSchemes = [bombScare, breakin];

    return dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: minion.instanceId,
    }).state;
  };

  const renderModal = async (
    prompt: NonNullable<ReturnType<typeof peekDecisionPrompt>>,
    onSelectOption: (id: string) => void,
  ) => {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<DecisionPromptModal prompt={prompt} onSelectOption={onSelectOption} />);
    });
    return view;
  };

  it('renders one button per scheme and sends the clicked scheme id back unchanged', async () => {
    const afterAttack = buildPromptState();
    const prompt = peekDecisionPrompt(afterAttack)!;
    expect(prompt.options).toHaveLength(3);

    const onSelectOption = vi.fn();
    await renderModal(prompt, onSelectOption);

    const buttons = screen.getAllByRole('button');
    for (const [index, option] of prompt.options.entries()) {
      onSelectOption.mockClear();
      fireEvent.click(buttons[index]);
      expect(onSelectOption).toHaveBeenCalledTimes(1);
      expect(onSelectOption).toHaveBeenCalledWith(option.id);
    }
  });

  it('each scheme the player clicks is the scheme that loses 3 threat', async () => {
    const afterAttack = buildPromptState();
    const prompt = peekDecisionPrompt(afterAttack)!;
    const expected: Record<string, { main: number; bomb: number; breakin: number }> = {
      side_bomb_scare: { main: 5, bomb: 1, breakin: 3 },
      side_breakin: { main: 5, bomb: 4, breakin: 0 },
      [afterAttack.mainScheme.instanceId!]: { main: 2, bomb: 4, breakin: 3 },
    };

    for (const [index, option] of prompt.options.entries()) {
      let chosen: string | undefined;
      const { unmount } = await renderModal(prompt, (id) => (chosen = id));
      fireEvent.click(screen.getAllByRole('button')[index]);
      unmount();

      const resolved = dispatchAction(structuredClone(afterAttack), {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: chosen!,
      }).state;
      const want = expected[option.id];
      expect(resolved.mainScheme.threat).toBe(want.main);
      expect(resolved.sideSchemes.find((s) => s.instanceId === 'side_bomb_scare')?.threat).toBe(
        want.bomb,
      );
      // Breakin' at 3 threat is defeated and leaves play when 3 is removed
      expect(resolved.sideSchemes.find((s) => s.instanceId === 'side_breakin')?.threat ?? 0).toBe(
        want.breakin,
      );
    }
  });

  it('labels every option with the threat the scheme has now', () => {
    const prompt = peekDecisionPrompt(buildPromptState())!;
    const byId = Object.fromEntries(prompt.options.map((o) => [o.id, o.label]));

    expect(byId['side_bomb_scare']).toMatch(/4/);
    expect(byId['side_breakin']).toMatch(/3/);
  });
});
