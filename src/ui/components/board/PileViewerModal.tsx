import React from 'react';
import { CardInstance } from '../../../engine/models';
import { ModalScaffold } from '../../theme/ModalScaffold';
import type { VerbColor } from '../../theme/modal-styles';
import { useModalStyle } from '../../theme/useModalStyle';
import { CardView } from '../cards/CardView';

export interface PileViewerModalProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  verb?: VerbColor;
  /** Marks developer-only inspectors (deck contents, dealt encounter cards). */
  devBadge?: boolean;
  closeLabel: string;
  onClose: () => void;
  /** Also close when the backdrop is clicked. */
  closeOnBackdrop?: boolean;
  maxWidthClass?: string;
  testId?: string;
  /** Sorting or filter controls above the cards. */
  controls?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shell of the card pile viewers (deck inspector, discard pile, removed from game, set aside):
 * header with the count and a description, optional controls, the cards, and a close button.
 */
export const PileViewerModal: React.FC<PileViewerModalProps> = ({
  title,
  description,
  icon,
  verb = 'blue',
  devBadge = false,
  closeLabel,
  onClose,
  closeOnBackdrop = false,
  maxWidthClass = 'max-w-5xl',
  testId,
  controls,
  children,
}) => {
  const { style } = useModalStyle();

  return (
    <ModalScaffold
      title={title}
      kicker={devBadge ? 'DEV MODE' : undefined}
      verb={verb}
      trigger={null}
      icon={icon}
      onClose={onClose}
      closeOnBackdrop={closeOnBackdrop}
      maxWidthClass={maxWidthClass}
      testId={testId}
      footer={
        <button
          type="button"
          onClick={onClose}
          className={`mx-auto px-6 py-2 text-sm cursor-pointer ${style.btnGo}`}
        >
          {closeLabel}
        </button>
      }
    >
      {description && <p className={`text-xs ${style.muted}`}>{description}</p>}
      {controls}
      {children}
    </ModalScaffold>
  );
};

/** Sorting / ordering bar of a viewer. */
export const PileToolbar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { style } = useModalStyle();
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 p-3 text-xs ${style.inset}`}>
      {children}
    </div>
  );
};

/** One sorting or ordering choice in a `PileToolbar`. */
export const PileChoice: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active = false, onClick, children }) => {
  const { style } = useModalStyle();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`px-2.5 py-1 text-xs cursor-pointer ${
        active ? `${style.btnMove} font-bold opacity-100!` : style.tile
      }`}
    >
      {children}
    </button>
  );
};

/** A titled group of cards. */
export const PileGroup: React.FC<{
  title: string;
  testId?: string;
  children: React.ReactNode;
}> = ({ title, testId, children }) => {
  const { style } = useModalStyle();
  return (
    <div data-testid={testId} className={`p-3 space-y-2 ${style.panel}`}>
      <div className={`pb-1 ${style.panelHead}`}>
        <span className="text-sm uppercase font-bold tracking-wider">{title}</span>
      </div>
      <div className="flex flex-wrap items-center justify-start gap-4 pt-1">{children}</div>
    </div>
  );
};

/** The cards of an ungrouped viewer. */
export const PileGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-wrap items-center justify-center gap-4 py-2">{children}</div>
);

export interface PileCardTileProps {
  instance: CardInstance;
  /** Position in the pile (`#1` = top). */
  rank?: number;
  /** Text under the card: its set, type or name. */
  label?: string;
  size?: 'sm' | 'md';
  testId?: string;
  /** Extra controls under the label (a dev "add to hand" button). */
  children?: React.ReactNode;
}

/** A card with its pile position and an optional label. */
export const PileCardTile: React.FC<PileCardTileProps> = ({
  instance,
  rank,
  label,
  size = 'sm',
  testId,
  children,
}) => {
  const { style } = useModalStyle();

  return (
    <div
      data-testid={testId}
      data-card-code={instance.card.code}
      data-card-anchor={instance.card.code}
      className="relative flex flex-col items-center gap-1"
    >
      <div className="relative">
        <CardView card={instance.card} instance={instance} size={size} enableHoverZoom={true} />
        {rank !== undefined && (
          <span className={`absolute -top-2 -right-2 text-micro px-1.5 py-0.5 ${style.chip}`}>
            #{rank}
          </span>
        )}
      </div>
      {label && (
        <span
          className={`font-sans text-xs font-semibold px-2 py-0.5 truncate max-w-[120px] text-center ${style.inset}`}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  );
};
