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
        {target.damage > 0 && (
          <span className="text-comic-red font-bold">({target.damage} dmg)</span>
        )}
      </>
    ),
    actionLabel: 'STRIKE ➔',
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
      title="TARGET SELECTION"
      verb="red"
      headerIcon={<Crosshair className="w-6 h-6 animate-pulse" />}
      kicker={`${attackerType === 'hero' ? 'Hero Strike' : 'Ally Strike'} • ${attackDamage} DMG`}
      actor={{ name: attackerName, code: attackerCode }}
      actorLine="is ready to strike!"
      actorChip={`${attackDamage} ATK`}
      prompt="Choose an enemy target to attack:"
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
