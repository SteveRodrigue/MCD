import React from 'react';
import { AlertOctagon, Flame, ShieldAlert, Target } from 'lucide-react';
import { SchemeTarget } from './thwart-target-utils';
import { TargetSelectionModal, type TargetBadge, type TargetRow } from './TargetSelectionModal';
import { useModalStyle } from '../../theme/useModalStyle';

interface ThwartTargetModalProps {
  isOpen: boolean;
  thwarterName: string;
  /** Card code of the thwarting hero form or ally, for its thumbnail. */
  thwarterCode?: string;
  thwarterType: 'hero' | 'ally';
  thwartValue: number;
  consequentialDamage?: number;
  targets: SchemeTarget[];
  onSelectTarget: (target: SchemeTarget) => void;
  onClose: () => void;
}

const toRow = (target: SchemeTarget): TargetRow => {
  const isMain = target.type === 'main_scheme';
  const badges: TargetBadge[] = [
    ...(target.hasCrisis
      ? [{ label: 'CRISIS', tone: 'danger' as const, icon: <AlertOctagon className="w-3 h-3" /> }]
      : []),
    ...(target.hasHazard ? [{ label: 'HAZARD', tone: 'warn' as const }] : []),
    ...(target.hasAcceleration
      ? [{ label: 'ACCEL', tone: 'alert' as const, icon: <Flame className="w-3 h-3" /> }]
      : []),
  ];
  return {
    id: target.id,
    name: target.name,
    code: target.cardInstance?.card.code,
    icon: isMain ? <Target className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />,
    strong: isMain,
    kindLabel: isMain ? 'MAIN SCHEME' : 'SIDE SCHEME',
    badges,
    details: (
      <>
        <span>
          Threat: <strong className="font-black">{target.threat}</strong>
          {target.targetThreat !== undefined && ` / ${target.targetThreat}`}
        </span>
        {!target.allowed && target.disabledReason && (
          <span className="text-comic-red font-bold">({target.disabledReason})</span>
        )}
      </>
    ),
    disabled: !target.allowed,
    actionLabel: target.allowed ? 'FOIL ➔' : 'BLOCKED',
  };
};

export const ThwartTargetModal: React.FC<ThwartTargetModalProps> = ({
  isOpen,
  thwarterName,
  thwarterCode,
  thwarterType,
  thwartValue,
  consequentialDamage,
  targets,
  onSelectTarget,
  onClose,
}) => {
  const { style } = useModalStyle();
  if (!isOpen || targets.length === 0) return null;

  return (
    <TargetSelectionModal
      title="THWART TARGET SELECTION"
      verb="blue"
      headerIcon={<Target className="w-6 h-6 animate-pulse" />}
      kicker={`${thwarterType === 'hero' ? 'Hero Thwart' : 'Ally Thwart'} • ${thwartValue} THW`}
      headerRight={
        consequentialDamage !== undefined && consequentialDamage > 0 ? (
          <span className={`text-[10px] font-black px-1.5 py-0.5 ${style.chip}`}>
            Takes {consequentialDamage} DMG
          </span>
        ) : undefined
      }
      actor={{ name: thwarterName, code: thwarterCode }}
      actorLine="is ready to remove threat!"
      actorChip={`${thwartValue} THW`}
      prompt="Choose a scheme to remove threat from:"
      rows={targets.map(toRow)}
      cancelLabel="Cancel Thwart"
      onPick={(id) => {
        const target = targets.find((t) => t.id === id);
        if (!target?.allowed) return;
        onSelectTarget(target);
        onClose();
      }}
      onClose={onClose}
      testId="thwart-target-modal"
    />
  );
};

export default ThwartTargetModal;
