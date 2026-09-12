import {
  CardInstance,
  GameState,
  Keyword,
  SideSchemeCard,
  hasKeyword,
} from '../../../engine/models';
import { canAllyThwart, canBasicThwart } from '../../../engine/pipeline/legality-checker';

export interface SchemeTarget {
  id: string;
  name: string;
  type: 'main_scheme' | 'side_scheme';
  instanceId?: string;
  threat: number;
  targetThreat?: number;
  hasCrisis: boolean;
  hasHazard: boolean;
  hasAcceleration: boolean;
  allowed: boolean;
  disabledReason?: string;
  cardInstance?: CardInstance;
}

export function getValidThwartTargets(
  state: GameState,
  playerId: string,
  thwarterType: 'hero' | 'ally',
  allyInstanceId?: string,
): SchemeTarget[] {
  const targets: SchemeTarget[] = [];
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return targets;

  // 1. Main Scheme
  if (state.mainScheme) {
    const check =
      thwarterType === 'hero'
        ? canBasicThwart(state, playerId, 'main_scheme')
        : allyInstanceId
          ? canAllyThwart(state, playerId, allyInstanceId, 'main_scheme')
          : { allowed: false, reason: 'Ally not specified' };

    targets.push({
      id: 'main_scheme',
      name: state.mainScheme.card?.name || 'Main Scheme',
      type: 'main_scheme',
      threat: state.mainScheme.threat,
      targetThreat: state.mainScheme.targetThreat,
      hasCrisis: false,
      hasHazard: false,
      hasAcceleration: (state.accelerationTokens || 0) > 0,
      allowed: check.allowed,
      disabledReason: check.allowed ? undefined : check.reason,
    });
  }

  // 2. Side Schemes
  for (const sideScheme of state.sideSchemes || []) {
    const check =
      thwarterType === 'hero'
        ? canBasicThwart(state, playerId, 'side_scheme', sideScheme.instanceId)
        : allyInstanceId
          ? canAllyThwart(state, playerId, allyInstanceId, 'side_scheme', sideScheme.instanceId)
          : { allowed: false, reason: 'Ally not specified' };

    const sideCard = sideScheme.card as SideSchemeCard;
    const hasCrisis = !!(sideCard?.hasCrisis || hasKeyword(sideScheme.card, Keyword.CRISIS));
    const hasHazard = !!(sideCard?.hasHazard || hasKeyword(sideScheme.card, Keyword.HAZARD));
    const hasAcceleration = !!(
      sideCard?.hasAcceleration || hasKeyword(sideScheme.card, Keyword.ACCELERATION)
    );

    targets.push({
      id: sideScheme.instanceId,
      name: sideScheme.card.name,
      type: 'side_scheme',
      instanceId: sideScheme.instanceId,
      threat: sideScheme.threat,
      hasCrisis,
      hasHazard,
      hasAcceleration,
      allowed: check.allowed,
      disabledReason: check.allowed ? undefined : check.reason,
      cardInstance: {
        instanceId: sideScheme.instanceId,
        card: sideScheme.card,
      },
    });
  }

  return targets;
}
