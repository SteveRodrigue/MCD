import React from 'react';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import type { CardReference } from './CardRef';
import { useModalStyle } from './useModalStyle';

/** Narrator caption box ("MEANWHILE...") that sets the scene above the modal body. */
export const Narration: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { style } = useModalStyle();
  return <div className={`inline-block max-w-full ${style.caption}`}>{children}</div>;
};

/** Speech bubble spoken by a card: its thumbnail sits beside the bubble (Card Anchoring Rule). */
export const SpeechBubble: React.FC<{ speaker: CardReference; children: React.ReactNode }> = ({
  speaker,
  children,
}) => {
  const { style } = useModalStyle();
  return (
    <div className="flex items-start gap-3 pl-1">
      <CardArtThumbnail cardCode={speaker.code} cardName={speaker.name} size="md" />
      <div className={`flex-1 min-w-0 ml-2 ${style.bubble}`}>{children}</div>
    </div>
  );
};
