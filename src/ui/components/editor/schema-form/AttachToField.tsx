import React from 'react';
import type { AttachTo } from '../../../../data/supplemental/schema';

export interface AttachToFieldProps {
  value: AttachTo | undefined;
  onChange: (next: AttachTo | undefined) => void;
}

type Host = AttachTo['host'];
type NonVillainHost = Extract<Host, { type: 'MINION' | 'ENEMY' }>;

const SELECT_CLASS =
  'w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black';

/** Encounter attachment host (`CardEnrichment.attachTo`, #209): hosts are a discriminated union. */
export const AttachToField: React.FC<AttachToFieldProps> = ({ value, onChange }) => {
  const host = value?.host;
  const otherwise = value?.otherwise ? { otherwise: value.otherwise } : {};
  const searchHost = host && host.type !== 'VILLAIN' ? (host as NonVillainHost) : undefined;

  const handleHostChange = (type: string) => {
    if (!type) {
      onChange(undefined);
    } else if (type === 'VILLAIN') {
      onChange({ host: { type }, ...otherwise });
    } else {
      onChange({
        host: {
          type: type as NonVillainHost['type'],
          ...(searchHost?.superlative ? { superlative: searchHost.superlative } : {}),
          ...(searchHost?.withoutCopyAttached ? { withoutCopyAttached: true } : {}),
        },
        ...otherwise,
      });
    }
  };

  const handleSuperlativeChange = (field: 'stat' | 'extreme', next: string) => {
    if (!value || !searchHost) return;
    const { superlative, ...rest } = searchHost;
    if (field === 'stat' && !next) {
      onChange({ ...value, host: rest });
      return;
    }
    const merged = {
      stat: superlative?.stat ?? '',
      extreme: superlative?.extreme ?? 'HIGHEST',
      [field]: next,
    } as NonNullable<NonVillainHost['superlative']>;
    onChange({ ...value, host: { ...rest, superlative: merged } });
  };

  const handleWithoutCopyChange = (checked: boolean) => {
    if (!value || !searchHost) return;
    const { withoutCopyAttached: _dropped, ...rest } = searchHost;
    onChange({ ...value, host: checked ? { ...rest, withoutCopyAttached: true } : rest });
  };

  const handleOtherwiseChange = (next: string) => {
    if (!value) return;
    const { otherwise: _dropped, ...rest } = value;
    onChange(next ? { ...rest, otherwise: { type: next } as AttachTo['otherwise'] } : rest);
  };

  return (
    <div data-testid="attach-to-field">
      <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
        Encounter Attachment Host
      </label>
      <select
        data-testid="attach-to-host-select"
        value={host?.type ?? ''}
        onChange={(e) => handleHostChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Default (the active villain)</option>
        <option value="VILLAIN">The active villain</option>
        <option value="MINION">A minion</option>
        <option value="ENEMY">An enemy (villain or minion)</option>
      </select>
      {searchHost && (
        <div className="mt-1 grid grid-cols-2 gap-1">
          <select
            data-testid="attach-to-stat-select"
            value={searchHost.superlative?.stat ?? ''}
            onChange={(e) => handleSuperlativeChange('stat', e.target.value)}
            className="bg-white border border-black p-1.5 text-xs rounded"
          >
            <option value="">Any (first player chooses)</option>
            <option value="PRINTED_HIT_POINTS">Printed hit points</option>
            <option value="PRINTED_ATTACK">Printed ATK</option>
          </select>
          <select
            data-testid="attach-to-extreme-select"
            value={searchHost.superlative?.extreme ?? 'HIGHEST'}
            disabled={!searchHost.superlative}
            onChange={(e) => handleSuperlativeChange('extreme', e.target.value)}
            className="bg-white border border-black p-1.5 text-xs rounded"
          >
            <option value="HIGHEST">Highest</option>
            <option value="LOWEST">Lowest</option>
          </select>
          <label className="col-span-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              data-testid="attach-to-without-copy"
              checked={Boolean(searchHost.withoutCopyAttached)}
              onChange={(e) => handleWithoutCopyChange(e.target.checked)}
            />
            Without a copy of this card attached
          </label>
        </div>
      )}
      {value && (
        <select
          data-testid="attach-to-otherwise-select"
          value={value.otherwise?.type ?? ''}
          onChange={(e) => handleOtherwiseChange(e.target.value)}
          className={`mt-1 ${SELECT_CLASS}`}
        >
          <option value="">Otherwise: the villain</option>
          <option value="SURGE">Otherwise: this card gains surge</option>
        </select>
      )}
    </div>
  );
};
