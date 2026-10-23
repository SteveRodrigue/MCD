import React from 'react';
import { RefreshCw, Heart, Zap, Swords, Target, Sparkles } from 'lucide-react';
import { PlayerState, HeroCard, AlterEgoCard, CardInstance } from '../../../engine/models';
import {
  LegalActionItem,
  formatTimingBadge,
} from '../../../engine/pipeline/legal-actions-generator';
import {
  getEffectiveMaxHealth,
  getEffectiveHeroStats,
  getEffectivePlayerTraitsDetails,
} from '../../../engine/pipeline/stat-calculator';
import {
  canChangeForm,
  canBasicRecover,
  canThwart,
  canInitiateAbility,
  HERO_ACTOR,
} from '../../../engine/pipeline/legality-checker';
import { getIdentityAttackState } from './identity-action-utils';
import { useGameSession } from '../../context/GameStateContext';
import { useModalStyle } from '../../theme/useModalStyle';
import { ActionRow } from './ActionRow';
import { CardActionModal, InfoStrip } from './CardActionModal';

interface IdentityActionModalProps {
  isOpen: boolean;
  player: PlayerState;
  onClose: () => void;
  onInitiateAction?: (item: LegalActionItem) => void;
  onInitiateHeroAttack?: () => void;
  onInitiateHeroThwart?: () => void;
}

export const IdentityActionModal: React.FC<IdentityActionModalProps> = ({
  isOpen,
  player,
  onClose,
  onInitiateAction,
  onInitiateHeroAttack,
  onInitiateHeroThwart,
}) => {
  const { state: gameState, dispatch: onDispatchAction } = useGameSession();
  const { style } = useModalStyle();
  if (!isOpen) return null;

  const isHero = player.currentForm === 'hero';
  const effectiveMaxHealth = getEffectiveMaxHealth(player, gameState);
  const effectiveStats = getEffectiveHeroStats(gameState, player);
  const traitsDetails = getEffectivePlayerTraitsDetails(player);
  const isPlayerPhase = gameState.phase === 'PLAYER_PHASE';
  const isPlayerTurn =
    gameState.phase === 'PLAYER_PHASE' &&
    gameState.players[gameState.activePlayerIndex]?.id === player.id;

  // 1. Change Form Check
  const flipCheck = canChangeForm(gameState, player.id);
  const canFlip = isPlayerTurn && flipCheck.allowed;

  // 2. Recover Check
  const recoverCheck = canBasicRecover(gameState, player.id);
  const canRecover =
    !isHero && isPlayerTurn && recoverCheck.allowed && player.health < effectiveMaxHealth;

  // 3. Attack Check
  const attackState = getIdentityAttackState(player, gameState, effectiveStats.attack);
  const { canAttack, canAttackVillain, eligibleMinion } = attackState;

  // 4. Thwart Check
  const canThwartMain = canThwart(gameState, player.id, HERO_ACTOR, 'main_scheme').allowed;
  const eligibleSideScheme = gameState.sideSchemes.find(
    (s) => canThwart(gameState, player.id, HERO_ACTOR, 'side_scheme', s.instanceId).allowed,
  );
  const canThwartScheme = isHero && isPlayerTurn && (canThwartMain || !!eligibleSideScheme);

  // 5. Identity Abilities
  const idAbilities = player.activeFormCard.enrichment?.abilities || [];
  const actionableAbilities = idAbilities.filter(
    (ab) =>
      ab.timing === 'ACTION' ||
      (isHero && ab.timing === 'HERO_ACTION') ||
      (!isHero && ab.timing === 'ALTER_EGO_ACTION'),
  );

  const detail = (text: string) => (
    <span className={`text-[10px] block ${style.muted}`}>{text}</span>
  );
  const rowTitle = (text: string) => (
    <span className="font-comic font-black text-xs block">{text}</span>
  );

  return (
    <CardActionModal
      card={{ name: player.activeFormCard.name, code: player.activeFormCard.code }}
      kicker={isHero ? 'HERO IDENTITY' : 'ALTER-EGO IDENTITY'}
      verb={isHero ? 'red' : 'yellow'}
      icon={<Zap className="w-5 h-5" />}
      exhausted={player.exhausted}
      onClose={onClose}
      testId="identity-action-modal"
      strips={
        <>
          <InfoStrip className="flex items-center justify-between font-bold">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-comic-red" />
              <span>
                Health: {player.health} / {effectiveMaxHealth} HP
              </span>
            </div>
            <span className={`font-mono text-[10px] px-2 py-0.5 ${style.chip}`}>
              HAND SIZE:{' '}
              {(player.activeFormCard as unknown as HeroCard | AlterEgoCard).handSize ??
                (isHero ? 5 : 6)}
            </span>
          </InfoStrip>

          <InfoStrip
            testId="identity-active-traits-strip"
            className="flex flex-wrap items-center gap-1.5 font-bold"
          >
            <span className={`text-[10px] uppercase font-black tracking-wider ${style.muted}`}>
              Traits:
            </span>
            {traitsDetails.printedTraits.map((trait, idx) => (
              <span
                key={`printed-${idx}`}
                className={`font-comic text-[10px] px-2 py-0.5 font-bold ${style.chip}`}
              >
                {trait}
              </span>
            ))}
            {traitsDetails.dynamicTraits.map((trait, idx) => (
              <span
                key={`dynamic-${idx}`}
                data-testid={`identity-dynamic-trait-${trait.toLowerCase()}`}
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
      {/* Alter-Ego Recover Action */}
      {!isHero && (
        <ActionRow
          icon={<Heart className="w-4 h-4 fill-current" />}
          tone="warn"
          disabled={!canRecover}
          actionLabel={`REC: ${effectiveStats.recovery}`}
          onClick={() => {
            onDispatchAction({ type: 'BASIC_RECOVER', playerId: player.id });
            onClose();
          }}
        >
          {rowTitle(`Recover (+${effectiveStats.recovery} HP)`)}
          {detail(
            player.health >= effectiveMaxHealth
              ? `Already at maximum health (${player.health} / ${effectiveMaxHealth} HP)`
              : player.exhausted
                ? 'Identity is exhausted'
                : `Exhaust ${player.activeFormCard.name} to heal from ${player.health} to ${Math.min(effectiveMaxHealth, player.health + effectiveStats.recovery)} HP`,
          )}
        </ActionRow>
      )}

      {/* Identity Special Abilities */}
      {actionableAbilities.map((ab) => {
        const abilityKey = ab.id;
        const alreadyUsed = (player.usedAbilitiesThisRound?.[abilityKey] || 0) >= 1;
        const costCheck = canInitiateAbility(gameState, player.id, ab, undefined, {});
        const canTrigger = isPlayerPhase && !alreadyUsed && costCheck.allowed;
        const actionLabel = !isPlayerTurn
          ? `Ask ${player.name}: ${ab.id.replace(/_/g, ' ').toUpperCase()}`
          : ab.id.replace(/_/g, ' ').toUpperCase();

        return (
          <ActionRow
            key={ab.id}
            icon={<Zap className="w-4 h-4" />}
            tone={isPlayerTurn ? 'warn' : 'info'}
            disabled={!canTrigger}
            actionLabel={!isPlayerTurn ? 'CALL FOR ACTION' : 'ACTION'}
            onClick={() => {
              const hasPaymentCost =
                ab.cost?.resourceCost ||
                (ab.cost?.discardCard && ab.cost.discardCard.from === 'HAND');

              if (hasPaymentCost && onInitiateAction) {
                onInitiateAction({
                  id: isPlayerTurn
                    ? `action_id_ability_${ab.id}`
                    : `action_call_id_${player.id}_${ab.id}`,
                  category: isPlayerTurn ? 'identity' : 'call_for_action',
                  headline: isPlayerTurn
                    ? `Action: ${ab.id.replace(/_/g, ' ').toUpperCase()}`
                    : `Ask ${player.name}: ${player.activeFormCard.name} (${formatTimingBadge(ab.timing)})`,
                  subtext: `Trigger ${player.activeFormCard.name}'s special ability`,
                  action: {
                    type: 'USE_CARD_ABILITY',
                    playerId: player.id,
                    cardInstanceId: player.activeFormCard.code,
                    abilityId: ab.id,
                  },
                  requiresModal: 'payment',
                  targetCardInstance: {
                    instanceId: player.activeFormCard.code,
                    card: player.activeFormCard,
                    exhausted: player.exhausted,
                  } as CardInstance,
                  cardCode: player.activeFormCard.code,
                  ownerName: isPlayerTurn ? undefined : player.name,
                });
              } else {
                onDispatchAction({
                  type: 'USE_CARD_ABILITY',
                  playerId: player.id,
                  cardInstanceId: player.activeFormCard.code,
                  abilityId: ab.id,
                });
              }
              onClose();
            }}
          >
            {rowTitle(actionLabel)}
            {detail(
              alreadyUsed
                ? 'Already used this round (Limit: once per round)'
                : ab.steps?.[0]?.effectParams?.description
                  ? String(ab.steps[0].effectParams.description)
                  : ab.id === 'futurist'
                    ? 'Look at top 3 cards of deck, add 1 Tech card to hand, discard rest.'
                    : `Trigger ${player.activeFormCard.name}'s special ability`,
            )}
          </ActionRow>
        );
      })}

      {/* Hero Basic Attack & Thwart */}
      {isHero && (
        <>
          <ActionRow
            icon={<Swords className="w-4 h-4" />}
            tone="danger"
            disabled={!canAttack}
            actionLabel={`${effectiveStats.attack} ATK`}
            onClick={() => {
              onClose();
              if (onInitiateHeroAttack) {
                onInitiateHeroAttack();
              } else if (canAttackVillain) {
                onDispatchAction({
                  type: 'BASIC_ATTACK',
                  playerId: player.id,
                  targetType: 'villain',
                });
              } else if (eligibleMinion?.instanceId) {
                onDispatchAction({
                  type: 'BASIC_ATTACK',
                  playerId: player.id,
                  targetType: 'minion',
                  targetInstanceId: eligibleMinion.instanceId,
                });
              }
            }}
          >
            {rowTitle(`Attack (${effectiveStats.attack} DMG)`)}
            {detail(attackState.subtext)}
          </ActionRow>

          <ActionRow
            icon={<Target className="w-4 h-4" />}
            tone="info"
            disabled={!canThwartScheme}
            actionLabel={`${effectiveStats.thwart} THW`}
            onClick={() => {
              onClose();
              if (onInitiateHeroThwart) {
                onInitiateHeroThwart();
              } else if (canThwartMain) {
                onDispatchAction({
                  type: 'BASIC_THWART',
                  playerId: player.id,
                  targetType: 'main_scheme',
                });
              } else if (eligibleSideScheme) {
                onDispatchAction({
                  type: 'BASIC_THWART',
                  playerId: player.id,
                  targetType: 'side_scheme',
                  targetInstanceId: eligibleSideScheme.instanceId,
                });
              }
            }}
          >
            {rowTitle(`Thwart (${effectiveStats.thwart} THW)`)}
            {detail(
              player.exhausted
                ? 'Hero is exhausted'
                : !canThwartScheme
                  ? 'No threat on schemes (Target not valid)'
                  : canThwartMain
                    ? `Exhaust to remove ${effectiveStats.thwart} threat from main scheme`
                    : `Exhaust to remove ${effectiveStats.thwart} threat from ${eligibleSideScheme?.card.name}`,
            )}
          </ActionRow>
        </>
      )}

      {/* Change Form / Flip */}
      <ActionRow
        icon={<RefreshCw className="w-4 h-4" />}
        tone={isHero ? 'warn' : 'danger'}
        disabled={!canFlip}
        actionLabel="1 / ROUND"
        onClick={() => {
          onDispatchAction({ type: 'CHANGE_FORM', playerId: player.id });
          onClose();
        }}
      >
        {rowTitle(isHero ? 'Flip to Alter-Ego' : 'Suit Up (Hero Form)')}
        {detail(
          !flipCheck.allowed
            ? 'Already changed form this round (Limit: once per round)'
            : 'Change identity form',
        )}
      </ActionRow>
    </CardActionModal>
  );
};

export default IdentityActionModal;
