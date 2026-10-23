import React from 'react';
import { Swords, Target, Zap, Shield, Skull } from 'lucide-react';
import { CardInstance, PlayerState, AllyCard, hasDashPower } from '../../../engine/models';
import {
  getEffectiveAllyStats,
  getEffectiveCardTraitsDetails,
} from '../../../engine/pipeline/stat-calculator';
import { getValidAttackTargets } from './attack-target-utils';
import { getValidThwartTargets } from './thwart-target-utils';
import { canPayAbilityCost } from '../../../engine/pipeline/cost-engine';
import { useGameSession } from '../../context/GameStateContext';
import { useModalStyle } from '../../theme/useModalStyle';
import { ActionRow } from './ActionRow';
import { CardActionModal, InfoStrip } from './CardActionModal';

interface AllyActionModalProps {
  isOpen: boolean;
  ally: CardInstance;
  player: PlayerState;
  onClose: () => void;
  onInitiateAllyAttack: (allyInstanceId: string) => void;
  onInitiateAllyThwart: (allyInstanceId: string) => void;
}

export const AllyActionModal: React.FC<AllyActionModalProps> = ({
  isOpen,
  ally,
  player,
  onClose,
  onInitiateAllyAttack,
  onInitiateAllyThwart,
}) => {
  const { state: gameState, dispatch: onDispatchAction } = useGameSession();
  const { style } = useModalStyle();
  if (!isOpen || !ally) return null;

  const allyCard = ally.card as AllyCard;
  const allyStats = getEffectiveAllyStats(gameState, ally);

  const isPlayerTurn =
    gameState.phase === 'PLAYER_PHASE' &&
    gameState.players[gameState.activePlayerIndex]?.id === player.id;

  const baseAtk = (allyCard as any).attack ?? 0;
  const baseThw = (allyCard as any).thwart ?? 0;
  const atkDash = hasDashPower(allyCard, 'attack');
  const thwDash = hasDashPower(allyCard, 'thwart');
  const atkBonus = atkDash ? 0 : allyStats.attack - baseAtk;
  const thwBonus = thwDash ? 0 : allyStats.thwart - baseThw;
  const atkDisplay = atkDash ? '–' : allyStats.attack;
  const thwDisplay = thwDash ? '–' : allyStats.thwart;
  const allyTraitsDetails = getEffectiveCardTraitsDetails(ally.card, ally);

  const currentDamage = ally.tokens?.damage || 0;
  const maxHealth = allyCard.health || 2;
  const currentHealth = Math.max(0, maxHealth - currentDamage);

  const attackTargets = getValidAttackTargets(gameState, player.id, 'ally', ally.instanceId);
  const canAttack = isPlayerTurn && !ally.exhausted && attackTargets.length > 0;

  const thwartTargets = getValidThwartTargets(gameState, player.id, 'ally', ally.instanceId);
  const canThwart = isPlayerTurn && !ally.exhausted && thwartTargets.some((t) => t.allowed);

  const consequentialAtk =
    (allyCard as any).attackCost ?? (allyCard as any).consequentialDamage?.attack ?? 1;
  const consequentialThw =
    (allyCard as any).thwartCost ?? (allyCard as any).consequentialDamage?.thwart ?? 1;

  // Activated abilities on the ally card
  const abilities = ally.card.enrichment?.abilities || [];
  const actionableAbilities = abilities.filter(
    (ab) => ab.timing === 'ACTION' || ab.timing === 'HERO_ACTION',
  );

  const consequence = (amount: number) => (
    <span className="text-[10px] text-comic-red font-bold flex items-center gap-0.5">
      <Skull className="w-3 h-3" /> -{amount} HP
    </span>
  );

  return (
    <CardActionModal
      card={{ name: ally.card.name, code: ally.card.code }}
      kicker="ALLY ACTIONS"
      icon={<Shield className="w-5 h-5" />}
      exhausted={ally.exhausted}
      prompt="Choose an action for this ally:"
      onClose={onClose}
      testId="ally-action-modal"
      strips={
        <>
          <InfoStrip className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold">
                HP: <strong className="font-black">{currentHealth}</strong> / {maxHealth}
              </span>
              {currentDamage > 0 && (
                <span className="text-comic-red font-bold text-[11px]">({currentDamage} dmg)</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
              <span
                className={`text-white px-1.5 py-0.5 rounded border border-comic-black flex items-center gap-0.5 ${
                  atkBonus > 0 ? 'bg-comic-red ring-2 ring-rose-400 font-black' : 'bg-comic-red'
                }`}
              >
                <span>{atkDisplay} ATK</span>
                {atkBonus > 0 && (
                  <span className="text-yellow-300 ml-0.5 text-[9px] font-black">
                    (+{atkBonus})
                  </span>
                )}
              </span>
              <span
                className={`text-white px-1.5 py-0.5 rounded border border-comic-black flex items-center gap-0.5 ${
                  thwBonus > 0 ? 'bg-sky-500 ring-2 ring-sky-300 font-black' : 'bg-sky-500'
                }`}
              >
                <span>{thwDisplay} THW</span>
                {thwBonus > 0 && (
                  <span className="text-yellow-300 ml-0.5 text-[9px] font-black">
                    (+{thwBonus})
                  </span>
                )}
              </span>
            </div>
          </InfoStrip>

          <InfoStrip
            testId="ally-active-traits-strip"
            className="flex flex-wrap items-center gap-1.5 font-bold"
          >
            <span className={`text-[10px] uppercase font-black tracking-wider ${style.muted}`}>
              Traits:
            </span>
            {allyTraitsDetails.printedTraits.map((trait, idx) => (
              <span
                key={`printed-${idx}`}
                className={`font-comic text-[10px] px-2 py-0.5 font-bold ${style.chip}`}
              >
                {trait}
              </span>
            ))}
            {allyTraitsDetails.dynamicTraits.map((trait, idx) => (
              <span
                key={`dynamic-${idx}`}
                data-testid={`ally-dynamic-trait-${trait.toLowerCase()}`}
                className="bg-cyan-300 text-slate-950 font-comic text-[10px] px-2 py-0.5 rounded-full border-2 border-comic-black shadow-comic-xs font-black uppercase tracking-wider flex items-center gap-0.5"
              >
                <span>✨</span>
                <span>{trait}</span>
              </span>
            ))}
          </InfoStrip>
        </>
      }
    >
      <ActionRow
        icon={<Swords className="w-5 h-5" />}
        tone="danger"
        disabled={!canAttack}
        actionLabel="STRIKE ➔"
        accessory={consequence(consequentialAtk)}
        onClick={() => {
          onClose();
          onInitiateAllyAttack(ally.instanceId);
        }}
      >
        <span className="font-black text-sm">Attack ({atkDisplay} DMG)</span>
        <span className={`text-xs block mt-0.5 ${style.muted}`}>
          {ally.exhausted
            ? 'Ally is exhausted'
            : !isPlayerTurn
              ? 'Not your turn'
              : attackTargets.length === 0
                ? 'No valid attack targets'
                : `Exhaust to attack an enemy (takes ${consequentialAtk} consequential damage)`}
        </span>
      </ActionRow>

      <ActionRow
        icon={<Target className="w-5 h-5" />}
        tone="info"
        disabled={!canThwart}
        actionLabel="FOIL ➔"
        accessory={consequence(consequentialThw)}
        onClick={() => {
          onClose();
          onInitiateAllyThwart(ally.instanceId);
        }}
      >
        <span className="font-black text-sm">Thwart ({thwDisplay} THW)</span>
        <span className={`text-xs block mt-0.5 ${style.muted}`}>
          {ally.exhausted
            ? 'Ally is exhausted'
            : thwDash
              ? 'THW is – and cannot be used'
              : !isPlayerTurn
                ? 'Not your turn'
                : !thwartTargets.some((t) => t.allowed)
                  ? 'No schemes can be thwarted'
                  : `Exhaust to remove threat from a scheme (takes ${consequentialThw} consequential damage)`}
        </span>
      </ActionRow>

      {actionableAbilities.map((ab) => {
        const alreadyUsed = (player.usedAbilitiesThisRound?.[ab.id] || 0) >= 1;
        const costCheck = canPayAbilityCost(gameState, player, ab, ally, {});
        const canTrigger = isPlayerTurn && !alreadyUsed && costCheck.allowed;

        return (
          <ActionRow
            key={ab.id}
            icon={<Zap className="w-5 h-5" />}
            tone="warn"
            disabled={!canTrigger}
            actionLabel="TRIGGER ➔"
            onClick={() => {
              onDispatchAction?.({
                type: 'USE_CARD_ABILITY',
                playerId: player.id,
                cardInstanceId: ally.instanceId,
                abilityId: ab.id,
              });
              onClose();
            }}
          >
            <span className="font-black text-sm block">
              {ab.id.replace(/_/g, ' ').toUpperCase()}
            </span>
            <span className={`text-xs block mt-0.5 ${style.muted}`}>
              {alreadyUsed
                ? 'Already used this round'
                : ab.steps?.[0]?.effectParams?.description
                  ? String(ab.steps[0].effectParams.description)
                  : `Trigger ${ally.card.name}'s special ability`}
            </span>
          </ActionRow>
        );
      })}
    </CardActionModal>
  );
};

export default AllyActionModal;
