import React, { useState, useMemo } from 'react';
import { CheckCircle2, Layers, Shield } from 'lucide-react';
import { PendingDecisionPrompt, PlayerState } from '../../../engine/models';
import { AccentStripe } from '../../theme/AccentStripe';
import { CardRef } from '../../theme/CardRef';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
import { FormattedCardText } from '../cards/FormattedCardText';
import { useOptionalGameSession } from '../../context/GameStateContext';
import { getHeroColorPalette } from '../../utils/hero-theme';
import { resolvePlayerSeatInfo } from '../../utils/player-seat';

interface SelectCardsModalProps {
  prompt: PendingDecisionPrompt;
  onConfirm: (selectedOptionIds: string[]) => void;
  players?: PlayerState[];
}

interface CardOptionParams {
  cardName?: string;
  cardCode?: string;
}

/**
 * Multi-select card prompt (`prompt.selection`): the player picks between `min` and `max` cards,
 * never two cards with the same name when `distinctBy` is `NAME` (SEARCH `takeCount` /
 * `minimumTake` / `distinctBy`).
 */
export const SelectCardsModal: React.FC<SelectCardsModalProps> = ({
  prompt,
  onConfirm,
  players: propsPlayers,
}) => {
  const { style } = useModalStyle();
  const gameSession = useOptionalGameSession();
  const selection = prompt.selection!;
  const [chosen, setChosen] = useState<string[]>([]);

  const effectivePlayers = propsPlayers ?? gameSession?.state.players;
  const {
    player: promptPlayer,
    seatNumber,
    isMultiHero,
    label: playerSeatLabel,
  } = resolvePlayerSeatInfo(effectivePlayers, prompt.playerId);
  const playerPalette = useMemo(() => getHeroColorPalette(promptPlayer), [promptPlayer]);

  const infoOf = (optionId: string): CardOptionParams =>
    (prompt.options.find((o) => o.id === optionId)?.params as CardOptionParams) ?? {};
  const chosenNames = new Set(chosen.map((id) => infoOf(id).cardName));

  const isDisabled = (optionId: string): boolean => {
    if (chosen.includes(optionId)) return false;
    if (chosen.length >= selection.max) return true;
    return selection.distinctBy === 'NAME' && chosenNames.has(infoOf(optionId).cardName);
  };

  const toggle = (optionId: string) => {
    setChosen((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
    );
  };

  const canConfirm = chosen.length >= selection.min && chosen.length <= selection.max;
  // The clean-up discard answers "none" with the whole hand kept
  const isCleanup = prompt.kind === 'PLAYER_CLEANUP';
  const confirmLabel = !isCleanup
    ? 'Confirm'
    : chosen.length === 0
      ? 'Keep all cards'
      : `Discard ${chosen.length}`;
  const modalKicker =
    isMultiHero && seatNumber ? `SEAT ${seatNumber} • Card selection` : 'Card selection';

  return (
    <ModalScaffold
      title={prompt.title}
      kicker={modalKicker}
      verb="yellow"
      trigger={{ code: prompt.sourceCardCode, name: prompt.sourceCardName }}
      icon={<Layers className="w-5 h-5" />}
      maxWidthClass="max-w-2xl"
      headerRight={
        <div className="flex items-center gap-2">
          {promptPlayer && (
            <span
              data-testid="select-cards-player-badge"
              className="text-micro font-black px-2 py-0.5 border border-comic-black shadow-comic-xs rounded-sm truncate max-w-[200px] sm:max-w-[260px] uppercase tracking-wider flex items-center gap-1.5"
              style={{
                backgroundColor: playerPalette.primary,
                color: playerPalette.contrastText.primary,
              }}
            >
              <Shield className="w-3 h-3 shrink-0" />
              <span className="truncate">{playerSeatLabel}</span>
            </span>
          )}
          <span
            data-testid="select-cards-counter"
            className={`text-sm font-black px-2.5 py-1 ${style.chip}`}
          >
            {chosen.length} / {selection.max}
          </span>
        </div>
      }
      footer={
        <button
          type="button"
          data-testid="select-cards-confirm"
          disabled={!canConfirm}
          onClick={() => onConfirm(chosen)}
          className={`ml-auto px-5 py-2 font-black uppercase cursor-pointer disabled:cursor-not-allowed ${style.btnGo}`}
        >
          {confirmLabel}
        </button>
      }
    >
      <div className="text-sm font-bold">
        <FormattedCardText text={prompt.description} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {prompt.options.map((option) => {
          const info = option.params as CardOptionParams | undefined;
          const isChosen = chosen.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              data-testid={`select-card-${option.id}`}
              data-card-anchor={info?.cardCode ?? ''}
              aria-label={info?.cardName ?? option.label}
              disabled={isDisabled(option.id)}
              aria-pressed={isChosen}
              onClick={() => toggle(option.id)}
              className={`relative flex flex-col items-center gap-1.5 p-2 pl-3 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isChosen ? style.tileSelected : style.tile
              }`}
            >
              <AccentStripe code={info?.cardCode ?? ''} />
              <CardRef
                code={info?.cardCode}
                name={info?.cardName ?? option.label}
                size="lg"
                stacked
                className="text-xs uppercase"
              />
              {option.description && (
                <div className={`text-micro text-center line-clamp-3 ${style.muted}`}>
                  <FormattedCardText text={option.description} />
                </div>
              )}
              {isChosen && (
                <CheckCircle2
                  aria-hidden="true"
                  className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${style.emphasis}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </ModalScaffold>
  );
};
