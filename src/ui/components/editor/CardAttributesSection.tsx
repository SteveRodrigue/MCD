import React from 'react';
import { Sliders, AlertCircle, ClipboardCheck, X } from 'lucide-react';
import {
  CardAuditRecordSchema,
  CardUsesSchema,
  PlayRequirementsSchema,
} from '../../../data/supplemental/schema';
import {
  hasDashPower,
  type CharacterPower,
  type NormalizedCard,
} from '../../../engine/models/card';
import { FormattedCardText } from '../cards/FormattedCardText';
import { CollapsibleSection } from './CollapsibleSection';
import { AttachToField } from './schema-form/AttachToField';
import { ChipBar } from './schema-form/ChipBar';
import { RecipientField } from './schema-form/RecipientField';
import { ZodSchemaForm } from './schema-form/ZodSchemaForm';
import { kebabCase } from './schema-form/test-id';

export interface CardAttributesSectionProps {
  supplemental: any;
  onChange: (updatedSupplemental: any) => void;
  onNoSupplementalNeededChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasErrors?: boolean;
  errors?: string[];
  cardCode?: string;
  /** The loaded upstream card; its derived attributes are shown as read-only badges. */
  upstreamCard?: NormalizedCard;
}

type ChipKey =
  'playRequirements' | 'uses' | 'attachTo' | 'recipient' | 'playUnderAnyPlayerControl' | 'errata';

/** Card-level `CardEnrichment` keys offered as chips, with the value a freshly added chip starts at. */
const CARD_CHIPS: ReadonlyArray<{ key: ChipKey; label: string; initial: unknown }> = [
  { key: 'playRequirements', label: 'Play Requirements', initial: {} },
  {
    key: 'uses',
    label: 'Uses / Counters',
    initial: { count: 3, counterType: 'charge', discardOnEmpty: true },
  },
  { key: 'attachTo', label: 'Attachment Host', initial: { host: { type: 'VILLAIN' } } },
  { key: 'recipient', label: 'Obligation Recipient', initial: { type: 'REVEALING_PLAYER' } },
  { key: 'playUnderAnyPlayerControl', label: 'Cross-Player Control', initial: true },
  { key: 'errata', label: 'Errata', initial: '' },
];

const POWER_LABELS: ReadonlyArray<[CharacterPower, string]> = [
  ['attack', 'ATK'],
  ['thwart', 'THW'],
  ['defense', 'DEF'],
  ['recover', 'REC'],
  ['scheme', 'SCH'],
];

/** Read-only attributes the loader derives from the upstream card (never authored). */
function upstreamBadges(card: NormalizedCard): Array<{ id: string; text: string }> {
  const badges: Array<{ id: string; text: string }> = [];
  for (const trait of card.traits) badges.push({ id: `trait-${trait}`, text: trait });
  for (const keyword of card.keywords) badges.push({ id: `keyword-${keyword}`, text: keyword });
  if (card.maxPerPlayer !== undefined) {
    badges.push({ id: 'max-per-player', text: `Max ${card.maxPerPlayer} per player` });
  }
  const ally = card as NormalizedCard & { attackCost?: number; thwartCost?: number };
  if (card.type === 'ally') {
    if (ally.attackCost) {
      badges.push({ id: 'attack-cost', text: `Consequential ATK ${ally.attackCost}` });
    }
    if (ally.thwartCost) {
      badges.push({ id: 'thwart-cost', text: `Consequential THW ${ally.thwartCost}` });
    }
  }
  if (card.restrictedSlots !== undefined) {
    badges.push({ id: 'restricted-slots', text: `Restricted slots ${card.restrictedSlots}` });
  }
  for (const [power, label] of POWER_LABELS) {
    if (hasDashPower(card, power)) badges.push({ id: `dash-${power}`, text: `${label} –` });
  }
  return badges;
}

const SectionFrame: React.FC<{
  chip: ChipKey;
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}> = ({ chip, title, onRemove, children }) => (
  <div
    data-testid={`card-section-${chip}`}
    className="bg-yellow-50/50 p-2.5 border-2 border-black rounded-sm shadow-comic-xs space-y-2"
  >
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase text-gray-700">{title}</span>
      <button
        type="button"
        data-testid={`card-chip-remove-${chip}`}
        title={`Remove ${title}`}
        onClick={onRemove}
        className="p-0.5 text-gray-400 hover:text-comic-red cursor-pointer rounded-sm hover:bg-red-50 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
    {children}
  </div>
);

const prefixedTestId =
  (prefix: string) =>
  (path: string[], extra?: string): string =>
    `${prefix}-${path.map(kebabCase).join('-')}${extra ? `-${extra}` : ''}`;

const TIMESTAMPS = [
  ['created', 'Created', 'bg-gray-100 text-gray-700 border-gray-300'],
  ['updated', 'Updated', 'bg-gray-100 text-gray-700 border-gray-300'],
  ['reviewed', 'Reviewed', 'bg-green-100 text-green-800 border-green-300'],
] as const;

export const CardAttributesSection: React.FC<CardAttributesSectionProps> = ({
  supplemental,
  onChange,
  onNoSupplementalNeededChange,
  hasErrors = false,
  errors = [],
  cardCode,
  upstreamCard,
}) => {
  const audit = supplemental.audit || {};

  const setKey = (key: string, value: unknown) => onChange({ ...supplemental, [key]: value });
  const removeKey = (key: string) => {
    const { [key]: _removed, ...rest } = supplemental;
    onChange(rest);
  };

  const handleFallbackNoSupplementalNeededChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const abilities = Array.isArray(supplemental.abilities) ? supplemental.abilities : [];
    if (e.target.checked) {
      if (abilities.length > 0) {
        const confirmed = window.confirm(
          'Marking this card as vanilla (noSupplementalNeeded) will remove its existing declarative abilities. Proceed?',
        );
        if (!confirmed) return;
      }
      const { abilities: _dropped, ...rest } = supplemental;
      onChange({ ...rest, noSupplementalNeeded: true });
    } else {
      const { noSupplementalNeeded: _dropped, ...rest } = supplemental;
      onChange({ ...rest, abilities: rest.abilities ?? [] });
    }
  };

  const present = (key: ChipKey) => supplemental[key] !== undefined;
  const hasAuditData = Boolean(
    audit.comment ||
    audit.ambiguityFile ||
    audit.confidence !== undefined ||
    audit.reviewedBy ||
    audit.originalText,
  );
  const auditHasErrors = errors.some((e) =>
    /audit|comment|confidence|reviewedBy|rulesVersion|originalText|ambiguityFile/i.test(e),
  );
  const badges = upstreamCard ? upstreamBadges(upstreamCard) : [];

  const renderSection = (key: ChipKey, title: string, body: React.ReactNode) =>
    present(key) && (
      <SectionFrame chip={key} title={title} onRemove={() => removeKey(key)}>
        {body}
      </SectionFrame>
    );

  return (
    <div
      data-testid="card-attributes-section"
      className={`bg-white border-2 ${
        hasErrors ? 'border-comic-red ring-2 ring-red-200' : 'border-black'
      } p-3 rounded shadow-comic-xs transition-colors space-y-3`}
    >
      <div className="flex items-center justify-between border-b pb-1 text-black">
        <div className="flex items-center gap-1.5 font-bangers text-sm">
          <Sliders className="w-4 h-4 text-comic-accent" />
          <span>CARD-LEVEL ATTRIBUTES & AUDIT</span>
          {audit.rulesVersion && (
            <span
              data-testid="card-audit-rules-version"
              className="text-[10px] font-sans font-bold bg-blue-100 text-blue-900 border border-blue-400 px-1.5 py-0.5 rounded-sm ml-1"
            >
              Rules: {audit.rulesVersion}
            </span>
          )}
        </div>
        {hasErrors && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-comic-red bg-red-50 border border-comic-red px-1.5 py-0.5 rounded-sm">
            <AlertCircle className="w-3.5 h-3.5 text-comic-red" />
            <span>Attributes Issue</span>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div
          data-testid="card-attributes-errors"
          className="p-2 bg-red-50 border border-comic-red rounded-sm text-[11px] text-red-800 space-y-0.5"
        >
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="font-bold">•</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-yellow-50/50 p-2.5 border-2 border-black rounded-sm shadow-comic-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="no-supplemental-needed-checkbox"
            checked={Boolean(supplemental.noSupplementalNeeded)}
            onChange={onNoSupplementalNeededChange || handleFallbackNoSupplementalNeededChange}
            className="w-4 h-4 rounded-sm border-black text-comic-accent focus:ring-black cursor-pointer"
          />
          <span className="font-bold text-xs text-black">
            🛡️ No Supplemental Rules Needed (Vanilla Card)
          </span>
        </label>
        <p className="text-[11px] text-gray-500 ml-6 mt-0.5 font-comic">
          Flag this card as having no printed abilities, actions, or triggers to declare (e.g. Rhino
          I, vanilla cards). Disables ability creation.
        </p>
      </div>

      {badges.length > 0 && (
        <div data-testid="upstream-badges" className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] uppercase font-bold text-gray-500">From upstream:</span>
          {badges.map((badge) => (
            <span
              key={badge.id}
              data-testid={`upstream-badge-${kebabCase(badge.id)}`}
              className="text-[10px] font-bold bg-gray-100 text-black border border-black px-1.5 py-0.5 rounded-sm shadow-comic-xs"
            >
              {badge.text}
            </span>
          ))}
        </div>
      )}

      <ChipBar
        testId="card-chip-bar"
        items={CARD_CHIPS.filter((chip) => !present(chip.key)).map((chip) => ({
          key: chip.key,
          label: chip.label,
          testId: `card-chip-add-${chip.key}`,
        }))}
        onAdd={(key) => setKey(key, CARD_CHIPS.find((chip) => chip.key === key)?.initial)}
      />

      {renderSection(
        'playRequirements',
        'Play Requirements',
        <ZodSchemaForm
          schema={PlayRequirementsSchema}
          value={supplemental.playRequirements}
          onChange={(next) => setKey('playRequirements', next ?? {})}
          disclosure="all"
          emptyLabel="Any / Unrestricted"
          testId={prefixedTestId('play-req')}
        />,
      )}
      {renderSection(
        'uses',
        'Uses / Counters (RR v1.8 p. 30)',
        <ZodSchemaForm
          schema={CardUsesSchema}
          value={supplemental.uses}
          onChange={(next) => setKey('uses', next ?? {})}
          disclosure="all"
          testId={prefixedTestId('uses')}
        />,
      )}
      {renderSection(
        'attachTo',
        'Attachment Host',
        <AttachToField
          value={supplemental.attachTo}
          onChange={(next) => setKey('attachTo', next)}
        />,
      )}
      {renderSection(
        'recipient',
        'Obligation Recipient',
        <RecipientField
          value={supplemental.recipient}
          onChange={(next) => setKey('recipient', next)}
        />,
      )}
      {renderSection(
        'playUnderAnyPlayerControl',
        'Cross-Player Control (ADR-0066)',
        <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
          <input
            type="checkbox"
            data-testid="card-play-under-any-player-control-checkbox"
            checked={Boolean(supplemental.playUnderAnyPlayerControl)}
            onChange={(e) => setKey('playUnderAnyPlayerControl', e.target.checked)}
            className="accent-black"
          />
          <span>Play Under Any Player Control</span>
        </label>,
      )}
      {renderSection(
        'errata',
        'Card-Level Errata (Official FFG Ruling)',
        <input
          type="text"
          data-testid="card-errata-input"
          value={supplemental.errata ?? ''}
          placeholder="Leave empty if no official errata applies"
          onChange={(e) => setKey('errata', e.target.value)}
          className="w-full bg-white border border-black p-1.5 text-xs rounded-sm"
        />,
      )}

      <CollapsibleSection
        key={`${cardCode || 'card'}-audit`}
        title="Audit & Metadata"
        icon={ClipboardCheck}
        defaultOpen={hasAuditData}
        hasErrors={auditHasErrors}
        testId="section-audit-metadata"
      >
        <div className="space-y-3">
          <ZodSchemaForm
            schema={CardAuditRecordSchema}
            value={supplemental.audit}
            onChange={(next) => (next ? setKey('audit', next) : removeKey('audit'))}
            disclosure="all"
            hiddenKeys={['createdAt', 'updatedAt', 'reviewedAt', 'rulesVersion', 'originalText']}
            testId={prefixedTestId('audit')}
          />

          {(audit.createdAt || audit.updatedAt || audit.reviewedAt) && (
            <div className="flex flex-wrap gap-2">
              {TIMESTAMPS.map(([id, label, tone]) => {
                const stamp: string | undefined = audit[`${id}At`];
                return (
                  stamp && (
                    <span
                      key={id}
                      data-testid={`audit-${id}-at`}
                      title={stamp}
                      className={`text-[10px] font-sans border px-1.5 py-0.5 rounded-sm ${tone}`}
                    >
                      {label}: {new Date(stamp).toLocaleDateString()}
                    </span>
                  )
                );
              })}
            </div>
          )}

          {audit.originalText && (
            <div
              data-testid="card-audit-original-text-container"
              className="bg-gray-50 border border-gray-300 p-2 rounded-sm text-xs"
            >
              <span className="font-bold text-[10px] uppercase text-gray-500 block mb-1">
                Original Printed Rules Text (Audit Reference)
              </span>
              <div
                data-testid="card-audit-original-text"
                className="font-comic text-gray-700 italic"
              >
                <FormattedCardText text={audit.originalText} />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
};
