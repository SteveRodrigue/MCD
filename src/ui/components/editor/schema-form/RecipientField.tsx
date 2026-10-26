import React from 'react';
import type { z } from 'zod';
import type { PlayerRecipientSchema } from '../../../../data/supplemental/schema';

type Recipient = z.infer<typeof PlayerRecipientSchema>;

export interface RecipientFieldProps {
  value: Recipient | undefined;
  onChange: (next: Recipient | undefined) => void;
}

const SELECT_CLASS =
  'w-full bg-white border border-black p-1.5 text-xs rounded-sm focus:ring-1 focus:ring-black';

/** Obligation recipient override (`CardEnrichment.recipient`, Issue #158): a discriminated union. */
export const RecipientField: React.FC<RecipientFieldProps> = ({ value, onChange }) => {
  const type = value?.type ?? '';
  const codes = value?.type === 'IDENTITY' ? value.codes : [];

  const handleTypeChange = (next: string) => {
    if (!next) onChange(undefined);
    else if (next === 'IDENTITY') onChange({ type: 'IDENTITY', codes });
    else onChange({ type: next } as Recipient);
  };

  return (
    <div data-testid="obligation-recipient-field">
      <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
        Obligation Recipient Override
      </label>
      <select
        data-testid="obligation-recipient-select"
        value={type}
        onChange={(e) => handleTypeChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Default (hero-set owner, else revealing player)</option>
        <option value="FIRST_PLAYER">First player</option>
        <option value="REVEALING_PLAYER">Revealing player</option>
        <option value="CARD_SET_OWNER">Card set owner</option>
        <option value="IDENTITY">Specific identity codes</option>
      </select>
      {type === 'IDENTITY' && (
        <input
          type="text"
          data-testid="obligation-recipient-codes"
          value={codes.join(', ')}
          onChange={(e) =>
            onChange({
              type: 'IDENTITY',
              codes: e.target.value
                .split(',')
                .map((c) => c.trim())
                .filter(Boolean),
            })
          }
          placeholder="Hero / alter-ego codes, comma separated (e.g. 01010a, 01010b)"
          className={`mt-1 ${SELECT_CLASS}`}
        />
      )}
    </div>
  );
};
