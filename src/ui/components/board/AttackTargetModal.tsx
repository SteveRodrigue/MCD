import React from 'react';
import { Crosshair, ShieldAlert, Skull } from 'lucide-react';
import { EnemyTarget } from './attack-target-utils';
import { TargetSelectionModal, type TargetRow } from './TargetSelectionModal';

interface AttackTargetModalProps {
  isOpen: boolean;
  attackerName: string;
  /** Card code of the attacking hero form or ally, for its thumbnail. */
  attackerCode?: string;
  attackerType: 'hero' | 'ally';
  attackDamage: number;
  targets: EnemyTarget[];
  onSelectTarget: (target: EnemyTarget) => void;
  onClose: () => void;
}

const toRow = (target: EnemyTarget): TargetRow => {
  const isVillain = target.type === 'villain';
  return {
    id: target.id,
    name: target.name,
    code: target.cardInstance?.card.code,
    icon: isVillain ? <Skull className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />,
    strong: isVillain,
    kindLabel: isVillain ? 'VILLAIN' : 'MINION',
    badges: [
      ...(target.hasGuard ? [{ label: 'GUARD', tone: 'danger' as const, pulse: true }] : []),
      ...(target.hasTough ? [{ label: 'TOUGH', tone: 'info' as const }] : []),
    ],
    details: (
      <>
        <span>
          HP: <strong className="font-black">{target.health}</strong> / {target.maxHealth}
        </span>
      </>
    ),
  };
};

export const AttackTargetModal: React.FC<AttackTargetModalProps> = ({
  isOpen,
  attackerName,
  attackerCode,
  attackerType,
  attackDamage,
  targets,
  onSelectTarget,
  onClose,
}) => {
  if (!isOpen || targets.length === 0) return null;

  return (
    <TargetSelectionModal
      title="Choose an enemy to attack"
      verb="red"
      headerIcon={<Crosshair className="w-6 h-6 animate-pulse" />}
      kicker={attackerType === 'hero' ? 'Hero strike' : 'Ally strike'}
      actor={{ name: attackerName, code: attackerCode }}
      actorChip={`${attackDamage} ATK`}
      rows={targets.map(toRow)}
      cancelLabel="Cancel Strike"
      onPick={(id) => {
        const target = targets.find((t) => t.id === id);
        if (!target) return;
        onSelectTarget(target);
        onClose();
      }}
      onClose={onClose}
      testId="attack-target-modal"
    />
  );
};

export default AttackTargetModal;
