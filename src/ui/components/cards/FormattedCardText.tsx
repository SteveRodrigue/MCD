import React from 'react';
import { formatCardTextHtml } from './formatted-card-text-utils';

interface FormattedCardTextProps {
  text?: string;
  className?: string;
}

const FormattedCardTextImpl: React.FC<FormattedCardTextProps> = ({ text, className = '' }) => {
  if (!text) {
    return <span className={`italic text-slate-400 ${className}`}>No special text.</span>;
  }

  const html = formatCardTextHtml(text);

  return (
    <span className={`leading-relaxed ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
  );
};

/** Skips re-rendering when a state update leaves its props identical (ADR-0089). */
export const FormattedCardText = React.memo(FormattedCardTextImpl);
