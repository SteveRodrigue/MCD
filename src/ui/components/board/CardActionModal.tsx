import React from 'react';
import { ModalScaffold } from '../../theme/ModalScaffold';
import type { VerbColor } from '../../theme/modal-styles';
import { useModalStyle } from '../../theme/useModalStyle';

export interface CardActionModalProps {
  /** The card whose actions are listed: its name is the title and its thumbnail the trigger. */
  card: { name: string; code?: string };
  /** Header kicker, e.g. "ALLY ACTIONS". */
  kicker: string;
  verb?: VerbColor;
  icon: React.ReactNode;
  exhausted?: boolean;
  /** Strips under the header (stats, traits, tokens). */
  strips?: React.ReactNode;
  prompt?: string;
  onClose: () => void;
  testId?: string;
  /** The action rows. */
  children: React.ReactNode;
}

/**
 * Shell of the "choose what this card does" menus (ally, tableau and identity actions): header
 * with the card, optional info strips, a prompt, the action rows and a Cancel button.
 */
export const CardActionModal: React.FC<CardActionModalProps> = ({
  card,
  kicker,
  verb = 'yellow',
  icon,
  exhausted,
  strips,
  prompt,
  onClose,
  testId,
  children,
}) => {
  const { style } = useModalStyle();

  return (
    <ModalScaffold
      title={card.name}
      kicker={kicker}
      verb={verb}
      trigger={card}
      icon={icon}
      headerRight={
        exhausted ? (
          <span className={`text-[9px] font-black px-1.5 py-0.5 ${style.chip}`}>EXHAUSTED</span>
        ) : undefined
      }
      onClose={onClose}
      maxWidthClass="max-w-md"
      testId={testId}
      footer={
        <button
          type="button"
          onClick={onClose}
          className={`ml-auto font-comic text-xs font-black py-2 px-4 uppercase cursor-pointer ${style.btnMove}`}
        >
          Cancel
        </button>
      }
    >
      {strips && <div className="-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-0 space-y-px">{strips}</div>}
      {prompt && (
        <p className={`text-xs font-bold uppercase tracking-wider ${style.muted}`}>{prompt}</p>
      )}
      <div className="grid grid-cols-1 gap-2.5">{children}</div>
    </ModalScaffold>
  );
};

/** A full-width info strip for `CardActionModal`. */
export const InfoStrip: React.FC<{
  testId?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ testId, className = '', children }) => {
  const { style } = useModalStyle();
  return (
    <div
      data-testid={testId}
      className={`px-5 py-2 text-xs !rounded-none !border-x-0 ${style.inset} ${className}`}
    >
      {children}
    </div>
  );
};
