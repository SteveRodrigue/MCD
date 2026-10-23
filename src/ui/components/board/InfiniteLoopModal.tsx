import React from 'react';
import { Flame } from 'lucide-react';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';

interface InfiniteLoopModalProps {
  /** The recursion cycle the engine halted, or its error message. */
  cycle: string;
  onDismiss: () => void;
  onReset: () => void;
}

/** Shown when the engine halts an infinite trigger recursion between forced abilities (ADR-0053, Issue #48). */
export const InfiniteLoopModal: React.FC<InfiniteLoopModalProps> = ({
  cycle,
  onDismiss,
  onReset,
}) => {
  const { style } = useModalStyle();

  return (
    <ModalScaffold
      layer="critical"
      title="Infinite Loop Detected!"
      kicker="Engine safeguard"
      verb="red"
      trigger={null}
      icon={<Flame className="w-5 h-5" />}
      maxWidthClass="max-w-lg"
      testId="infinite-loop-modal"
      footer={
        <>
          <button
            type="button"
            onClick={onDismiss}
            className={`ml-auto px-4 py-2 font-black uppercase text-sm cursor-pointer ${style.btnMove}`}
          >
            Dismiss &amp; Continue
          </button>
          <button
            type="button"
            onClick={onReset}
            className={`px-4 py-2 font-black uppercase text-sm cursor-pointer ${style.btnGo}`}
          >
            Reset Game
          </button>
        </>
      }
    >
      <p className="font-bold text-sm">
        The game engine halted an infinite trigger recursion loop between forced abilities to
        protect the table state:
      </p>
      <div className={`p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap ${style.inset}`}>
        {cycle}
      </div>
    </ModalScaffold>
  );
};
