import React, { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, ArrowRight, Zap, ShieldAlert, Swords, Shield } from 'lucide-react';
import { PendingDecisionPrompt, PlayerState } from '../../../engine/models';
import { cardCatalog } from '../../../data/importer/card-loader';
import { CardView } from '../cards/CardView';
import { PromptCardPanel } from './PromptCardPanel';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import { FormattedCardText } from '../cards/FormattedCardText';
import { WakandaForeverModal } from './WakandaForeverModal';
import { DistributeAmountModal } from './DistributeAmountModal';
import { SelectCardsModal } from './SelectCardsModal';
import { SimultaneousAbilitiesModal } from './SimultaneousAbilitiesModal';
import { optionRequiresPayment } from '../../utils/option-requires-payment';
import { AccentStripe } from '../../theme/AccentStripe';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
import { useOptionalGameSession } from '../../context/GameStateContext';
import { getHeroColorPalette, getContrastTextColor } from '../../utils/hero-theme';
import { resolvePlayerSeatInfo } from '../../utils/player-seat';

interface DecisionPromptModalProps {
  prompt?: PendingDecisionPrompt;
  onSelectOption: (optionId: string, payload?: any) => void;
  players?: PlayerState[];
}

export const DecisionPromptModal: React.FC<DecisionPromptModalProps> = ({
  prompt,
  onSelectOption,
  players: propsPlayers,
}) => {
  const { style } = useModalStyle();
  const gameSession = useOptionalGameSession();
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hoveredOptionCardId, setHoveredOptionCardId] = useState<string | null>(null);

  const effectivePlayers = propsPlayers ?? gameSession?.state.players;
  const seatInfo = resolvePlayerSeatInfo(effectivePlayers, prompt?.playerId);
  const { player: promptPlayer, seatNumber, isMultiHero, label: playerSeatLabel } = seatInfo;
  const playerPalette = useMemo(() => getHeroColorPalette(promptPlayer), [promptPlayer]);

  if (!prompt) return null;

  // Delegate Wakanda Forever sequence resolution to specialized modal (ADR-0038)
  if (prompt.sourceCardName === 'Wakanda Forever!' || prompt.title?.includes('Wakanda Forever')) {
    return (
      <WakandaForeverModal
        key={prompt.promptId}
        prompt={prompt}
        onExecuteSequence={(sequenceOrder) => {
          onSelectOption(sequenceOrder[0] || 'wf_execute', { sequenceOrder });
        }}
      />
    );
  }

  // Delegate interactive point distribution to specialized modal (ADR-0064)
  if (prompt.kind === 'DISTRIBUTE_POINTS' || prompt.distributionConfig) {
    return (
      <DistributeAmountModal
        key={prompt.promptId}
        prompt={prompt}
        onConfirm={(assignments) => onSelectOption('confirm_distribution', { assignments })}
        onCancel={prompt.distributionConfig?.canCancel ? () => onSelectOption('cancel') : undefined}
      />
    );
  }

  // Delegate simultaneous optional abilities ordering to specialized modal (Issue #287)
  if (prompt.kind === 'ORDER_SIMULTANEOUS_ABILITIES') {
    return (
      <SimultaneousAbilitiesModal
        key={prompt.promptId}
        prompt={prompt}
        onConfirmOrder={(sequenceOrder) => onSelectOption('confirm_order', { sequenceOrder })}
      />
    );
  }

  // Delegate a pick of several cards (SEARCH takeCount / minimumTake) to the multi-select modal
  if (prompt.selection) {
    return (
      <SelectCardsModal
        key={prompt.promptId}
        prompt={prompt}
        players={effectivePlayers}
        onConfirm={(selectedOptionIds) =>
          onSelectOption('confirm_selection', { selectedOptionIds })
        }
      />
    );
  }

  const isForced = !prompt.isVoluntary;

  const triggerCard =
    prompt.triggerSourceCard ||
    (prompt.triggerSourceCode ? cardCatalog.getCard(prompt.triggerSourceCode) : undefined) ||
    prompt.revealedCards?.[0]?.card;

  // Cards the attack matchup already shows; no other panel repeats them.
  const showMatchup =
    prompt.incomingDamage !== undefined ||
    /Incoming Damage:\s*\d+/i.test(`${prompt.description ?? ''} ${prompt.title ?? ''}`) ||
    prompt.promptId.startsWith('prompt_defend') ||
    Boolean(prompt.attackerName);
  const matchupCodes = new Set(
    showMatchup
      ? [prompt.attackerCardCode, prompt.defenderCardCode, prompt.targetCardCode].filter(Boolean)
      : [],
  );

  const showTriggerCardShowcase =
    Boolean(triggerCard) &&
    !matchupCodes.has(triggerCard!.code) &&
    (triggerCard!.code !== prompt.sourceCardCode || Boolean(prompt.triggerSourceCode)) &&
    (!prompt.revealedCards ||
      prompt.revealedCards.length <= 1 ||
      Boolean(prompt.triggerSourceCard || prompt.triggerSourceCode));

  const isEncounterCard =
    triggerCard &&
    (triggerCard.type === 'treachery' ||
      triggerCard.type === 'minion' ||
      triggerCard.type === 'attachment' ||
      triggerCard.type === 'side_scheme' ||
      triggerCard.type === 'main_scheme' ||
      triggerCard.type === 'villain' ||
      triggerCard.type === 'environment' ||
      triggerCard.type === 'obligation');

  const hostCard =
    prompt.isVoluntary && prompt.sourceCardCode
      ? cardCatalog.getCard(prompt.sourceCardCode)
      : undefined;
  const abilityCard =
    hostCard &&
    !matchupCodes.has(hostCard.code) &&
    !(showTriggerCardShowcase && triggerCard?.code === hostCard.code)
      ? hostCard
      : undefined;

  const headerBadgeLabel = isEncounterCard ? 'TRIGGERING ENCOUNTER CARD' : 'TRIGGERING CARD';

  const incomingDamage =
    prompt.incomingDamage ??
    (() => {
      const match =
        prompt.description?.match(/Incoming Damage:\s*(\d+)/i) ||
        prompt.title?.match(/Incoming Damage:\s*(\d+)/i);
      return match ? parseInt(match[1], 10) : undefined;
    })();

  const headerTrigger = triggerCard
    ? { code: triggerCard.code, name: triggerCard.name }
    : prompt.sourceCardName
      ? { code: prompt.sourceCardCode, name: prompt.sourceCardName }
      : null;
  // The header shows the trigger card only when the body does not already show it.
  const bodyShowsTrigger =
    showTriggerCardShowcase || Boolean(headerTrigger?.code && matchupCodes.has(headerTrigger.code));

  const kickerText = isForced ? 'FORCED RESOLUTION' : 'OPTIONAL DECISION';
  const modalKicker = isMultiHero && seatNumber ? `SEAT ${seatNumber} • ${kickerText}` : kickerText;

  return (
    <ModalScaffold
      title={prompt.title}
      kicker={modalKicker}
      verb={isForced ? 'red' : 'yellow'}
      trigger={bodyShowsTrigger ? null : headerTrigger}
      icon={
        isForced ? <ShieldAlert className="w-5 h-5 animate-pulse" /> : <Zap className="w-5 h-5" />
      }
      headerRight={
        <div className="flex items-center gap-2">
          {promptPlayer && (
            <span
              data-testid="decision-prompt-player-badge"
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
          {prompt.totalQueued && prompt.totalQueued > 1 ? (
            <span className={`text-micro font-black px-1.5 py-0.5 ${style.chip}`}>
              QUEUE: {prompt.queuePosition ?? 1} OF {prompt.totalQueued}
            </span>
          ) : undefined}
        </div>
      }
      maxWidthClass="max-w-xl"
      testId="decision-prompt-modal"
    >
      {/* 2. Modal Body */}
      <div className="space-y-4">
        {/* Deciding Player Ribbon in Multiplayer */}
        {promptPlayer && isMultiHero && (
          <div
            data-testid="decision-prompt-player-banner"
            className="flex items-center justify-between px-3 py-1.5 rounded-sm border border-comic-black shadow-comic-xs font-black text-xs uppercase tracking-wider"
            style={{
              backgroundColor: playerPalette.primary,
              color: playerPalette.contrastText.primary,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{playerSeatLabel}</span>
            </div>
            <span
              className="text-nano font-black px-1.5 py-0.2 rounded-sm border border-comic-black shadow-comic-xs shrink-0"
              style={{
                backgroundColor: playerPalette.accent || playerPalette.secondary,
                color: getContrastTextColor(playerPalette.accent || playerPalette.secondary),
              }}
            >
              DECIDING PLAYER
            </span>
          </div>
        )}

        {/* Question Title & Description */}
        <div className="space-y-1">
          {showMatchup && (
            <div
              className={`p-3 space-y-2.5 ${style.panel}`}
              style={{ borderLeftColor: '#ED1D24', borderLeftWidth: 6 }}
            >
              <div
                className={`flex items-center justify-between pb-1.5 flex-wrap gap-2 ${style.panelHead}`}
              >
                <div className="flex items-center gap-2 text-comic-red">
                  <ShieldAlert className="w-4 h-4 shrink-0 animate-pulse" />
                  <span className="font-black uppercase text-xs tracking-wider">
                    {incomingDamage !== undefined
                      ? 'Incoming Attack Damage:'
                      : 'Enemy Attack Declaration:'}
                  </span>
                </div>
                {prompt.preventAmount !== undefined && (
                  <span className="font-mono font-black text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-sm border border-comic-black shadow-comic-xs">
                    Prevents:{' '}
                    {prompt.preventAmount === 'ALL' ? 'ALL DMG' : `${prompt.preventAmount} DMG`}
                  </span>
                )}
              </div>

              {/* Combat Matchup Panel */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                {/* Attacker box */}
                <div
                  data-card-anchor={prompt.attackerCardCode ?? ''}
                  className={`relative flex items-center gap-2 min-w-0 flex-1 p-1.5 pl-3 ${style.inset}`}
                >
                  <AccentStripe code={prompt.attackerCardCode ?? ''} />
                  <CardArtThumbnail
                    cardCode={prompt.attackerCardCode}
                    cardName={prompt.attackerName}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-micro font-black uppercase tracking-wider ${style.muted}`}
                    >
                      ATTACKER
                    </div>
                    <div className="font-black text-xs truncate">
                      {prompt.attackerName || 'Enemy'}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                      {prompt.hasOverkill && (
                        <span className="bg-comic-red text-white text-nano font-black uppercase px-1 py-0.2 rounded-sm border border-comic-black shadow-comic-xs">
                          OVERKILL
                        </span>
                      )}
                      {prompt.hasPiercing && (
                        <span className="bg-purple-600 text-white text-nano font-black uppercase px-1 py-0.2 rounded-sm border border-comic-black shadow-comic-xs">
                          PIERCING
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle: Direction arrow + incoming damage */}
                <div className="flex flex-col items-center justify-center shrink-0 px-1">
                  {incomingDamage !== undefined && (
                    <div className="text-micro font-mono font-black text-comic-red">
                      {incomingDamage} DMG
                    </div>
                  )}
                  <ArrowRight className="w-4 h-4 text-comic-red" />
                </div>

                {/* Target / Defender box */}
                <div
                  data-card-anchor={prompt.defenderCardCode || prompt.targetCardCode || ''}
                  className={`relative flex items-center gap-2 min-w-0 flex-1 p-1.5 pl-3 ${style.inset}`}
                >
                  <AccentStripe code={prompt.defenderCardCode || prompt.targetCardCode || ''} />
                  <CardArtThumbnail
                    cardCode={prompt.defenderCardCode || prompt.targetCardCode}
                    cardName={prompt.defenderName || prompt.targetName}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-micro font-black uppercase tracking-wider ${style.muted}`}
                    >
                      {prompt.defenderType === 'ALLY'
                        ? 'DEFENDER (ALLY)'
                        : prompt.defenderType === 'HERO'
                          ? 'DEFENDER (HERO)'
                          : 'TARGET'}
                    </div>
                    <div className="font-black text-xs truncate">
                      {prompt.defenderName || prompt.targetName || prompt.targetHeroName || 'Hero'}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-0.5">
                      {prompt.targetHasTough && (
                        <span className="bg-amber-400 text-slate-950 text-nano font-black uppercase px-1 py-0.2 rounded-sm border border-comic-black shadow-comic-xs">
                          TOUGH
                        </span>
                      )}
                      {prompt.targetRetaliate !== undefined && prompt.targetRetaliate > 0 && (
                        <span className="bg-orange-500 text-white text-nano font-black uppercase px-1 py-0.2 rounded-sm border border-comic-black shadow-comic-xs">
                          RETALIATE {prompt.targetRetaliate}
                        </span>
                      )}
                      {prompt.targetCurrentHp !== undefined && (
                        <span className={`text-micro font-mono font-bold ${style.muted}`}>
                          {prompt.targetMaxHp !== undefined
                            ? `${prompt.targetCurrentHp} / ${prompt.targetMaxHp} HP`
                            : `${prompt.targetCurrentHp} HP`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Projected HP */}
              {incomingDamage !== undefined && prompt.targetCurrentHp !== undefined && (
                <div
                  className={`flex items-center justify-between text-mini font-bold px-2 py-1 ${style.inset}`}
                >
                  <span>Projected HP After Attack:</span>
                  <span className="font-mono font-black">
                    {(() => {
                      const prevented =
                        prompt.preventAmount === 'ALL'
                          ? incomingDamage
                          : typeof prompt.preventAmount === 'number'
                            ? prompt.preventAmount
                            : 0;
                      const unmitigated = Math.max(0, incomingDamage - prevented);
                      const hpWithoutCard = Math.max(0, prompt.targetCurrentHp - incomingDamage);
                      const hpWithCard = Math.max(0, prompt.targetCurrentHp - unmitigated);
                      return prompt.preventAmount !== undefined
                        ? `${hpWithCard} HP (vs ${hpWithoutCard} HP without prevention)`
                        : `${hpWithoutCard} HP`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}
          {prompt.description && (
            <div className={`text-xs sm:text-sm font-bold p-2.5 ${style.inset}`}>
              <FormattedCardText text={prompt.description} />
            </div>
          )}
        </div>

        {/* Triggering card, then the card that hosts the ability */}
        {showTriggerCardShowcase && triggerCard && (
          <PromptCardPanel label={headerBadgeLabel} card={triggerCard} />
        )}
        {abilityCard && <PromptCardPanel label="ABILITY CARD" card={abilityCard} />}

        {/* Visual Scryed/Revealed Cards Gallery */}
        {prompt.revealedCards && prompt.revealedCards.length > 0 && (
          <div className={`p-3 overflow-visible ${style.panel}`}>
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-mini font-black uppercase tracking-wider">
                Revealed Cards ({prompt.revealedCards.length})
              </span>
              <span className={`text-micro font-bold italic ${style.muted}`}>
                (Click matching card or select option below)
              </span>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-3 pt-1 overflow-visible">
              {prompt.revealedCards.map((rc) => {
                const isHovered = hoveredCardId === rc.instanceId;
                return (
                  <div
                    key={rc.instanceId}
                    onMouseEnter={() => setHoveredCardId(rc.instanceId)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    onClick={() => {
                      if (rc.isSelectable && rc.selectableOptionId) {
                        onSelectOption(rc.selectableOptionId);
                      }
                    }}
                    className={`flex flex-col items-center gap-1.5 transition-all relative ${
                      isHovered ? 'z-zoom' : 'z-content'
                    } ${
                      rc.isSelectable
                        ? 'cursor-pointer hover:scale-105 filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] ring-2 ring-emerald-500 rounded-xl p-0.5'
                        : 'filter grayscale brightness-90 contrast-95 ring-2 ring-slate-400/80 rounded-xl p-0.5 cursor-default'
                    }`}
                  >
                    <CardView card={rc.card} size="sm" enableHoverZoom={true} zoomOrigin="center" />
                    <span
                      className={`text-nano px-2 py-0.5 rounded border border-comic-black font-black uppercase shadow-2xs ${
                        rc.isSelectable
                          ? 'bg-emerald-400 text-slate-950 animate-pulse'
                          : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {rc.isSelectable ? '✨ SELECTABLE TECH' : rc.dimmedReason || 'NON-MATCHING'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Option Selection List */}
        <div className="flex flex-col gap-2.5 pt-1">
          {prompt.options.map((option, index) => {
            const isDeclineOption =
              option.id.includes('none') || option.id.includes('decline') || option.id === 'pass';
            const isDisabled = Boolean(option.disabled);

            const optParams = option.params as Record<string, any> | undefined;
            const requiresPayment = optionRequiresPayment(option);

            const costAmount =
              optParams?.resourceCost?.amount ??
              (option as any).resourceCost?.amount ??
              (typeof optParams?.ability?.cost?.resourceCost === 'number'
                ? optParams.ability.cost.resourceCost
                : typeof optParams?.ability?.cost?.resourceCost === 'object' &&
                    optParams?.ability?.cost?.resourceCost !== null
                  ? Object.values(optParams.ability.cost.resourceCost)[0]
                  : 1);

            const optionCardCode = option.cardCode || (optParams?.cardCode as string | undefined);
            const optionCard = optionCardCode ? cardCatalog.getCard(optionCardCode) : undefined;

            return (
              <button
                key={option.id}
                disabled={isDisabled}
                data-card-anchor={optionCardCode ?? ''}
                onClick={() => {
                  if (!isDisabled) {
                    onSelectOption(option.id);
                  }
                }}
                className={`group relative flex flex-col items-start text-left p-3 sm:p-3.5 pl-4 transition-all ${style.option} ${
                  isDisabled
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : isDeclineOption
                      ? 'cursor-pointer border-dashed'
                      : 'cursor-pointer'
                }`}
              >
                <AccentStripe code={optionCardCode ?? ''} />
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-black text-sm sm:text-base uppercase tracking-wide flex items-center gap-2 flex-wrap transition-colors ${style.optionTitleHover}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full border-2 border-comic-black flex items-center justify-center text-xs font-black ${
                        isDisabled
                          ? 'bg-slate-300 text-slate-600'
                          : isDeclineOption
                            ? 'bg-rose-300 text-slate-950'
                            : 'bg-comic-yellow text-comic-black'
                      }`}
                    >
                      {index + 1}
                    </span>
                    {optionCardCode ? (
                      <div
                        data-testid={`option-card-thumbnail-${option.id}`}
                        className="relative shrink-0 group/thumb"
                        onMouseEnter={() => setHoveredOptionCardId(option.id)}
                        onMouseLeave={() => setHoveredOptionCardId(null)}
                      >
                        <CardArtThumbnail
                          cardCode={optionCardCode}
                          cardName={option.label}
                          size="sm"
                        />
                        {optionCard && hoveredOptionCardId === option.id && (
                          <div
                            data-testid={`card-hover-preview-${optionCard.code}`}
                            className="absolute left-12 top-1/2 -translate-y-1/2 z-raised drop-shadow-2xl animate-in fade-in duration-150 pointer-events-none"
                          >
                            <CardView card={optionCard} size="sm" enableHoverZoom={true} />
                          </div>
                        )}
                      </div>
                    ) : option.icon === 'punch' || option.id === 'undefended' ? (
                      <div className="p-1 bg-comic-red text-white rounded-sm border border-comic-black shadow-comic-xs flex items-center justify-center">
                        <Swords className="w-4 h-4 text-white" />
                      </div>
                    ) : null}
                    <span className="font-comic">{option.label}</span>
                    {option.statusBadges?.isTough && (
                      <span className="bg-amber-400 text-slate-950 text-nano font-black uppercase px-1.5 py-0.2 rounded-sm border border-comic-black shadow-comic-xs">
                        TOUGH
                      </span>
                    )}
                    {option.statusBadges?.retaliate !== undefined &&
                      option.statusBadges.retaliate > 0 && (
                        <span className="bg-orange-500 text-white text-nano font-black uppercase px-1.5 py-0.2 rounded-sm border border-comic-black shadow-comic-xs">
                          RETALIATE {option.statusBadges.retaliate}
                        </span>
                      )}
                    {requiresPayment && costAmount !== undefined && costAmount > 0 && (
                      <span className="inline-flex items-center gap-1 text-micro font-black uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-300 border border-comic-black text-slate-950 shadow-2xs">
                        ⚡ COST: {costAmount} {costAmount === 1 ? 'RESOURCE' : 'RESOURCES'}
                      </span>
                    )}
                    {!requiresPayment &&
                      !option.label.toLowerCase().includes('cost') &&
                      optionCard?.cost !== undefined && (
                        <span className="inline-flex items-center gap-1 text-micro font-black uppercase tracking-wider px-1.5 py-0.2 rounded-sm bg-amber-200 border border-comic-black text-slate-950 shadow-2xs">
                          Cost: {optionCard.cost}
                        </span>
                      )}
                  </span>
                  {isDisabled ? (
                    <XCircle className="w-5 h-5 text-slate-400" />
                  ) : isDeclineOption ? (
                    <XCircle className="w-5 h-5 text-comic-red transition-colors" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 transition-colors" />
                  )}
                </div>
                {option.disabledReason && (
                  <div className="mt-1 pl-8">
                    <span className="inline-flex items-center gap-1 text-micro font-black uppercase tracking-wider px-2 py-0.5 rounded-sm bg-amber-200 border border-comic-black text-amber-950">
                      ⚠️ {option.disabledReason}
                    </span>
                  </div>
                )}
                {option.description && (
                  <div className={`mt-0.5 text-xs font-bold pl-8 ${style.muted}`}>
                    <FormattedCardText text={option.description} />
                  </div>
                )}
              </button>
            );
          })}

          {prompt.isVoluntary &&
            !prompt.options.some((o) => o.id === 'pass' || o.id.includes('decline')) && (
              <button
                onClick={() => onSelectOption('pass')}
                className={`group relative flex items-center justify-between p-3 border-dashed transition-all cursor-pointer font-black text-sm uppercase tracking-wide ${style.option}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full border-2 border-comic-black flex items-center justify-center text-xs font-black bg-slate-300 text-slate-900">
                    ✕
                  </span>
                  <span>Pass / Do Nothing</span>
                </div>
                <XCircle className="w-5 h-5 text-comic-red transition-colors" />
              </button>
            )}
        </div>
      </div>
    </ModalScaffold>
  );
};

export default DecisionPromptModal;
