import React from 'react';
import { Zap, Layers } from 'lucide-react';
import { CardInstance, PlayerState, CardAbility } from '../../../engine/models';
import { canInitiateAbility } from '../../../engine/pipeline/legality-checker';
import { evaluateTableauCardLegality } from './tableau-card-legality';
import { useGameSession } from '../../context/GameStateContext';
import { useModalStyle } from '../../theme/useModalStyle';
import { ActionRow } from './ActionRow';
import { CardActionModal, InfoStrip } from './CardActionModal';

interface TableauActionModalProps {
  isOpen: boolean;
  cardInstance: CardInstance | null;
  player: PlayerState;
  onClose: () => void;
  onSelectAbility: (ability: CardAbility, cardInstance: CardInstance) => void;
}

export const TableauActionModal: React.FC<TableauActionModalProps> = ({
  isOpen,
  cardInstance,
  player,
  onClose,
  onSelectAbility,
}) => {
  const { state: gameState } = useGameSession();
  const { style } = useModalStyle();
  if (!isOpen || !cardInstance) return null;

  const isHero = player.currentForm === 'hero';
  const isPlayerTurn =
    gameState.phase === 'PLAYER_PHASE' &&
    gameState.players[gameState.activePlayerIndex]?.id === player.id;

  const legality = evaluateTableauCardLegality(cardInstance, player.currentForm, {
    gameState,
    playerId: player.id,
  });

  const abilities = cardInstance.card.enrichment?.abilities || [];
  const actionableAbilities = abilities.filter(
    (ab) =>
      ab.timing === 'ACTION' ||
      (isHero && ab.timing === 'HERO_ACTION') ||
      (!isHero && ab.timing === 'ALTER_EGO_ACTION') ||
      ab.timing === 'RESOURCE' ||
      (isHero && ab.timing === 'HERO_RESOURCE') ||
      (!isHero && ab.timing === 'ALTER_EGO_RESOURCE'),
  );

  const cardType = (cardInstance.card.type || 'UPGRADE').toUpperCase();
  const tokens = cardInstance.tokens || {};
  const tokenEntries = Object.entries(tokens).filter(([_, count]) => (count as number) > 0);

  return (
    <CardActionModal
      card={{ name: cardInstance.card.name, code: cardInstance.card.code }}
      kicker={`${cardType} CARD ACTIONS`}
      exhausted={cardInstance.exhausted}
      prompt="Select an ability to activate:"
      onClose={onClose}
      testId="tableau-action-modal"
      strips={
        <InfoStrip className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span className="font-bold uppercase text-mini">
              {cardInstance.card.traits?.join(' • ') || cardType}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {tokenEntries.map(([type, count]) => (
              <span
                key={type}
                className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded border border-comic-black font-black text-micro uppercase shadow-comic-xs"
              >
                {type}: {count}
              </span>
            ))}
            {tokenEntries.length === 0 && (
              <span className={`text-mini italic ${style.muted}`}>No counters</span>
            )}
          </div>
        </InfoStrip>
      }
    >
      {actionableAbilities.map((ab) => {
        const alreadyUsed = (player.usedAbilitiesThisRound?.[ab.id] || 0) >= 1;
        const abilityCheck = canInitiateAbility(gameState, player.id, ab, cardInstance, {});
        const canTrigger = isPlayerTurn && !alreadyUsed && abilityCheck.allowed;

        const description =
          ab.steps?.[0]?.effectParams?.description || `Trigger ${ab.id.replace(/_/g, ' ')}`;

        return (
          <ActionRow
            key={ab.id}
            icon={<Zap className="w-5 h-5" />}
            tone="warn"
            disabled={!canTrigger}
            onClick={() => {
              onClose();
              onSelectAbility(ab, cardInstance);
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm">{ab.id.replace(/_/g, ' ').toUpperCase()}</span>
              <span className={`text-nano font-black uppercase px-1.5 py-0.5 ${style.chip}`}>
                {ab.timing.replace(/_/g, ' ')}
              </span>
            </div>
            <span className={`text-xs block mt-0.5 ${style.muted}`}>
              {canTrigger
                ? String(description)
                : alreadyUsed
                  ? 'Already used this round'
                  : abilityCheck.reason || 'Cannot trigger ability'}
            </span>
          </ActionRow>
        );
      })}

      {actionableAbilities.length === 0 && (
        <div className={`p-4 border-dashed text-center text-xs space-y-1 ${style.inset}`}>
          <div className="font-bold">
            {legality.isUsable
              ? 'This card has no activated abilities that can be triggered right now.'
              : `⚠️ ${legality.reason || 'Cannot be triggered in this form'}`}
          </div>
          {!legality.isUsable && (
            <div className={`text-micro ${style.muted}`}>
              Flip your identity card to {isHero ? 'Alter-Ego' : 'Hero'} form to use this card.
            </div>
          )}
        </div>
      )}
    </CardActionModal>
  );
};

export default TableauActionModal;
