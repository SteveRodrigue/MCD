import React from 'react';
import { KeywordSchema } from '../../../data/supplemental/schema';
import { UniversalCardFilterBuilder } from './UniversalCardFilterBuilder';
import { FormattedCardText } from '../cards/FormattedCardText';
import { CollapsibleSection } from './CollapsibleSection';
import {
  Sliders,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff,
  ClipboardCheck,
  Cog,
  Swords,
  Layout,
  Shield,
} from 'lucide-react';
import {
  getSectionVisibility,
  countAuditFields,
  countMechanicsFields,
  countCombatFields,
  countLayoutFields,
  countPlayReqFields,
} from './card-attributes-utils';

export interface CardAttributesSectionProps {
  supplemental: any;
  onChange: (updatedSupplemental: any) => void;
  onNoSupplementalNeededChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasErrors?: boolean;
  errors?: string[];
  cardCode?: string;
  typeCode?: string;
  showAllFields?: boolean;
}

export const CardAttributesSection: React.FC<CardAttributesSectionProps> = ({
  supplemental,
  onChange,
  onNoSupplementalNeededChange,
  hasErrors = false,
  errors = [],
  cardCode,
  typeCode,
  showAllFields: showAllFieldsProp,
}) => {
  const [internalShowAllFields, setInternalShowAllFields] = React.useState(
    showAllFieldsProp ?? false,
  );
  const [isControlFilterExpanded, setIsControlFilterExpanded] = React.useState(false);

  // Sync internalShowAllFields when prop changes
  React.useEffect(() => {
    if (showAllFieldsProp !== undefined) {
      setInternalShowAllFields(showAllFieldsProp);
    }
  }, [showAllFieldsProp]);

  // Reset showAllFields when switching cards (ephemeral state)
  React.useEffect(() => {
    setInternalShowAllFields(showAllFieldsProp ?? false);
  }, [cardCode, showAllFieldsProp]);

  const showAllFields = showAllFieldsProp !== undefined ? showAllFieldsProp : internalShowAllFields;

  const audit = supplemental.audit || {};

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...supplemental,
      audit: {
        ...supplemental.audit,
        comment: e.target.value || undefined,
      },
    });
  };

  const handleMaxPerPlayerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onChange({
      ...supplemental,
      maxPerPlayer: isNaN(val as number) ? undefined : val,
    });
  };

  const recipientType: string = supplemental.recipient?.type ?? '';
  const handleRecipientTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value;
    if (!type) {
      onChange({ ...supplemental, recipient: undefined });
    } else if (type === 'IDENTITY') {
      onChange({
        ...supplemental,
        recipient: { type, codes: supplemental.recipient?.codes ?? [] },
      });
    } else {
      onChange({ ...supplemental, recipient: { type } });
    }
  };
  const handleRecipientCodesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const codes = e.target.value
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    onChange({ ...supplemental, recipient: { type: 'IDENTITY', codes } });
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange({
      ...supplemental,
      audit: {
        ...audit,
        confidence: isNaN(val) ? 100 : val,
      },
    });
  };

  const handleReviewedByChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...supplemental,
      audit: {
        ...audit,
        reviewedBy: e.target.value || 'developer',
      },
    });
  };

  const handleFallbackNoSupplementalNeededChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const abilities = Array.isArray(supplemental.abilities) ? supplemental.abilities : [];
    if (checked) {
      if (abilities.length > 0) {
        const confirmed = window.confirm(
          'Marking this card as vanilla (noSupplementalNeeded) will remove its existing declarative abilities. Proceed?',
        );
        if (!confirmed) return;
      }
      const updated = {
        ...supplemental,
        noSupplementalNeeded: true,
      };
      delete updated.abilities;
      onChange(updated);
    } else {
      const updated = { ...supplemental };
      delete updated.noSupplementalNeeded;
      if (!updated.abilities) {
        updated.abilities = [];
      }
      onChange(updated);
    }
  };

  // Section data existence checks for auto-expansion & visibility overrides
  const hasAuditData = Boolean(
    audit.comment ||
    audit.ambiguityFile ||
    audit.confidence !== undefined ||
    audit.reviewedBy ||
    audit.originalText ||
    supplemental.errata,
  );

  const hasMechanicsData = Boolean(
    (supplemental.keywords && supplemental.keywords.length > 0) ||
    (supplemental.traits && supplemental.traits.length > 0) ||
    supplemental.uses ||
    supplemental.maxPerPlayer != null ||
    supplemental.recipient ||
    supplemental.restrictedSlots != null,
  );

  const hasCombatData = Boolean(
    supplemental.attackCost != null ||
    supplemental.thwartCost != null ||
    supplemental.additionalBoostCards != null,
  );

  const hasLayoutData = Boolean(supplemental.isLandscape || supplemental.victoryPoints != null);

  const hasPlayReqData = Boolean(
    supplemental.playRequirements?.identityForm ||
    supplemental.playRequirements?.formTrait ||
    (supplemental.playRequirements?.identityTraits &&
      supplemental.playRequirements.identityTraits.length > 0) ||
    (supplemental.playRequirements?.identityNames &&
      supplemental.playRequirements.identityNames.length > 0) ||
    (supplemental.playRequirements?.controlZones &&
      supplemental.playRequirements.controlZones.length > 0) ||
    supplemental.playRequirements?.controlFilter ||
    supplemental.playUnderAnyPlayerControl,
  );

  // Visibility computed from typeCode & showAllFields
  const vis = getSectionVisibility(typeCode, showAllFields);

  // Field counts for section badges
  const auditCount = countAuditFields(audit, supplemental);
  const mechanicsCount = countMechanicsFields(supplemental);
  const combatCount = countCombatFields(supplemental);
  const layoutCount = countLayoutFields(supplemental);
  const playReqCount = countPlayReqFields(supplemental);

  const auditBadge = auditCount > 0 ? auditCount : undefined;
  const mechanicsBadge = mechanicsCount > 0 ? mechanicsCount : undefined;
  const combatBadge = combatCount > 0 ? combatCount : undefined;
  const layoutBadge = layoutCount > 0 ? layoutCount : undefined;
  const playReqBadge = playReqCount > 0 ? playReqCount : undefined;

  // Error routing to sections
  const auditHasErrors = errors.some((e) =>
    /audit|comment|confidence|reviewedBy|rulesVersion|originalText|errata|ambiguityFile/i.test(e),
  );
  const mechanicsHasErrors = errors.some((e) =>
    /keyword|trait|uses|maxPerPlayer|restrictedSlots/i.test(e),
  );
  const combatHasErrors = errors.some((e) => /attackCost|thwartCost|additionalBoostCards/i.test(e));
  const layoutHasErrors = errors.some((e) => /isLandscape|victoryPoints/i.test(e));
  const playReqHasErrors = errors.some((e) =>
    /playRequirement|identityForm|formTrait|identityTraits|identityNames|controlZones|controlFilter|playUnderAnyPlayerControl/i.test(
      e,
    ),
  );

  return (
    <div
      data-testid="card-attributes-section"
      className={`bg-white border-2 ${
        hasErrors ? 'border-comic-red ring-2 ring-red-200' : 'border-black'
      } p-3 rounded shadow-comic-xs transition-colors space-y-3`}
    >
      {/* Header with Title, rulesVersion, Show All Toggle, and Errors Alert */}
      <div className="flex items-center justify-between border-b pb-1 text-black">
        <div className="flex items-center gap-1.5 font-bangers text-sm">
          <Sliders className="w-4 h-4 text-comic-accent" />
          <span>CARD-LEVEL ATTRIBUTES & AUDIT</span>
          {audit.rulesVersion && (
            <span
              data-testid="card-audit-rules-version"
              className="text-[10px] font-sans font-bold bg-blue-100 text-blue-900 border border-blue-400 px-1.5 py-0.2 rounded ml-1"
            >
              Rules: {audit.rulesVersion}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="toggle-show-all-fields-btn"
            onClick={() => setInternalShowAllFields((prev) => !prev)}
            className={`flex items-center gap-1 px-2 py-0.5 text-xs font-bold border border-black rounded shadow-comic-xs cursor-pointer active:scale-95 transition-transform ${
              showAllFields
                ? 'bg-comic-accent text-white'
                : 'bg-white hover:bg-yellow-50 text-black'
            }`}
            title={showAllFields ? 'Switch to Smart View' : 'Show All Fields'}
          >
            {showAllFields ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Smart View</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Show All</span>
              </>
            )}
          </button>

          {hasErrors && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-comic-red bg-red-50 border border-comic-red px-1.5 py-0.5 rounded">
              <AlertCircle className="w-3.5 h-3.5 text-comic-red" />
              <span>Attributes Issue</span>
            </div>
          )}
        </div>
      </div>

      {/* Top-level errors block */}
      {errors.length > 0 && (
        <div
          data-testid="card-attributes-errors"
          className="p-2 bg-red-50 border border-comic-red rounded text-[11px] text-red-800 space-y-0.5"
        >
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="font-bold">•</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* 🎯 Vanilla Card Checkbox (always visible, top of section) */}
      <div className="bg-yellow-50/50 p-2.5 border-2 border-black rounded shadow-comic-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            data-testid="no-supplemental-needed-checkbox"
            checked={Boolean(supplemental.noSupplementalNeeded)}
            onChange={onNoSupplementalNeededChange || handleFallbackNoSupplementalNeededChange}
            className="w-4 h-4 rounded border-black text-comic-accent focus:ring-black cursor-pointer"
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

      {/* 1. 📋 Audit & Metadata */}
      <CollapsibleSection
        key={`${cardCode || 'card'}-audit`}
        title="Audit & Metadata"
        icon={ClipboardCheck}
        defaultOpen={hasAuditData}
        forceOpen={showAllFields}
        hasErrors={auditHasErrors}
        badge={auditBadge}
        testId="section-audit-metadata"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Internal Developer Comment
            </label>
            <input
              type="text"
              value={supplemental.audit?.comment || ''}
              onChange={handleCommentChange}
              placeholder="e.g. Hero attack: deals 3 damage..."
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Max Per Player Board Limit
            </label>
            <input
              type="number"
              min="1"
              max="4"
              value={supplemental.maxPerPlayer || ''}
              onChange={handleMaxPerPlayerChange}
              placeholder="Leave empty if unrestricted"
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>

          {(typeCode === 'obligation' || supplemental.recipient) && (
            <div data-testid="obligation-recipient-field">
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                Obligation Recipient Override
              </label>
              <select
                data-testid="obligation-recipient-select"
                value={recipientType}
                onChange={handleRecipientTypeChange}
                className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
              >
                <option value="">Default (hero-set owner, else revealing player)</option>
                <option value="FIRST_PLAYER">First player</option>
                <option value="REVEALING_PLAYER">Revealing player</option>
                <option value="CARD_SET_OWNER">Card set owner</option>
                <option value="IDENTITY">Specific identity codes</option>
              </select>
              {recipientType === 'IDENTITY' && (
                <input
                  type="text"
                  data-testid="obligation-recipient-codes"
                  value={(supplemental.recipient?.codes ?? []).join(', ')}
                  onChange={handleRecipientCodesChange}
                  placeholder="Hero / alter-ego codes, comma separated (e.g. 01010a, 01010b)"
                  className="mt-1 w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
                />
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Confidence Level ({audit.confidence ?? 100}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={audit.confidence ?? 100}
              onChange={handleConfidenceChange}
              className="w-full cursor-pointer accent-comic-red"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Reviewed By Attribution
            </label>
            <input
              type="text"
              value={audit.reviewedBy || 'developer'}
              onChange={handleReviewedByChange}
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Ambiguity File (docs/ambiguities/...)
            </label>
            <input
              type="text"
              data-testid="audit-ambiguity-file"
              value={audit.ambiguityFile || ''}
              placeholder="e.g. docs/ambiguities/spider-sense-timing.md"
              onChange={(e) => {
                const val = e.target.value.trim();
                const nextAudit = { ...audit };
                if (!val) {
                  delete nextAudit.ambiguityFile;
                } else {
                  nextAudit.ambiguityFile = val;
                }
                onChange({
                  ...supplemental,
                  audit: nextAudit,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Card-Level Errata (Official FFG Ruling)
            </label>
            <input
              type="text"
              data-testid="card-errata-input"
              value={supplemental.errata || ''}
              placeholder="Leave empty if no official errata applies"
              onChange={(e) => {
                onChange({
                  ...supplemental,
                  errata: e.target.value.trim() ? e.target.value : undefined,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>

          {/* Audit Timestamps (read-only) */}
          {(audit.createdAt || audit.updatedAt || audit.reviewedAt) && (
            <div className="sm:col-span-2 flex flex-wrap gap-2 mt-1">
              {audit.createdAt && (
                <span
                  data-testid="audit-created-at"
                  title={audit.createdAt}
                  className="text-[10px] font-sans bg-gray-100 text-gray-700 border border-gray-300 px-1.5 py-0.5 rounded"
                >
                  Created: {new Date(audit.createdAt).toLocaleDateString()}
                </span>
              )}
              {audit.updatedAt && (
                <span
                  data-testid="audit-updated-at"
                  title={audit.updatedAt}
                  className="text-[10px] font-sans bg-gray-100 text-gray-700 border border-gray-300 px-1.5 py-0.5 rounded"
                >
                  Updated: {new Date(audit.updatedAt).toLocaleDateString()}
                </span>
              )}
              {audit.reviewedAt && (
                <span
                  data-testid="audit-reviewed-at"
                  title={audit.reviewedAt}
                  className="text-[10px] font-sans bg-green-100 text-green-800 border border-green-300 px-1.5 py-0.5 rounded"
                >
                  Reviewed: {new Date(audit.reviewedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {audit.originalText && (
            <div
              data-testid="card-audit-original-text-container"
              className="sm:col-span-2 bg-gray-50 border border-gray-300 p-2 rounded text-xs"
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

      {/* 2. 🔧 Card Mechanics */}
      <CollapsibleSection
        key={`${cardCode || 'card'}-mechanics`}
        title="Card Mechanics"
        icon={Cog}
        visible={vis.mechanics || hasMechanicsData}
        defaultOpen={hasMechanicsData}
        forceOpen={showAllFields}
        hasErrors={mechanicsHasErrors}
        badge={mechanicsBadge}
        testId="section-card-mechanics"
      >
        <div className="space-y-3">
          {/* Traits input & restricted slots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                Card Traits (comma-separated)
              </label>
              <input
                type="text"
                data-testid="card-traits-input"
                value={(supplemental.traits || []).join(', ')}
                placeholder="e.g. Avenger, Tech, Gamma"
                onChange={(e) => {
                  const tr = e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                  onChange({
                    ...supplemental,
                    traits: tr.length > 0 ? tr : undefined,
                  });
                }}
                className="w-full bg-white border border-black p-1.5 text-xs rounded"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                Restricted Slots (RR v1.8 p. 28)
              </label>
              <input
                type="number"
                min="1"
                data-testid="card-restricted-slots-input"
                value={supplemental.restrictedSlots || ''}
                placeholder="e.g. 1 or 2"
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  onChange({
                    ...supplemental,
                    restrictedSlots: isNaN(val) ? undefined : val,
                  });
                }}
                className="w-full bg-white border border-black p-1.5 text-xs rounded"
              />
            </div>
          </div>

          {/* Structured Keywords Matrix (ADR-0054) */}
          <div className="pt-2 border-t border-gray-200">
            <label className="text-[10px] font-bold uppercase text-gray-700 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-comic-yellow fill-comic-yellow" />
              <span>Structured Keywords Matrix (ADR-0054)</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {KeywordSchema.options.map((kw) => {
                const list = Array.isArray(supplemental.keywords) ? supplemental.keywords : [];
                const entry = list.find((k: any) =>
                  typeof k === 'string'
                    ? k.toLowerCase() === kw.toLowerCase()
                    : k.keyword?.toLowerCase() === kw.toLowerCase(),
                );
                const isActive = Boolean(entry);
                const retaliateAmount =
                  kw === 'Retaliate' && typeof entry === 'object' && entry !== null
                    ? entry.amount || 1
                    : 1;

                const toggleKeyword = () => {
                  const updated = [...list];
                  const idx = updated.findIndex((k: any) =>
                    typeof k === 'string'
                      ? k.toLowerCase() === kw.toLowerCase()
                      : k.keyword?.toLowerCase() === kw.toLowerCase(),
                  );
                  if (idx >= 0) {
                    updated.splice(idx, 1);
                  } else {
                    if (kw === 'Retaliate') {
                      updated.push({ keyword: 'Retaliate', amount: 1 });
                    } else {
                      updated.push(kw);
                    }
                  }
                  onChange({
                    ...supplemental,
                    keywords: updated.length > 0 ? updated : undefined,
                  });
                };

                return (
                  <div key={kw} className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid={`keyword-${kw.toLowerCase()}`}
                      onClick={toggleKeyword}
                      className={`rounded border border-black px-2 py-0.5 text-[11px] font-bold transition-transform active:scale-95 ${
                        isActive
                          ? 'bg-comic-accent text-white shadow-comic-xs font-bold'
                          : 'bg-white text-gray-700 hover:bg-yellow-50'
                      }`}
                    >
                      {kw}
                    </button>
                    {kw === 'Retaliate' && isActive && (
                      <input
                        type="number"
                        min="1"
                        max="10"
                        data-testid="keyword-retaliate-amount"
                        value={retaliateAmount}
                        onChange={(e) => {
                          const amt = parseInt(e.target.value, 10);
                          const updated = [...list];
                          const idx = updated.findIndex((k: any) =>
                            typeof k === 'string'
                              ? k.toLowerCase() === 'retaliate'
                              : k.keyword?.toLowerCase() === 'retaliate',
                          );
                          const val = isNaN(amt) ? 1 : Math.max(1, amt);
                          if (idx >= 0) {
                            updated[idx] = { keyword: 'Retaliate', amount: val };
                          } else {
                            updated.push({ keyword: 'Retaliate', amount: val });
                          }
                          onChange({
                            ...supplemental,
                            keywords: updated,
                          });
                        }}
                        className="w-10 bg-white border border-black px-1 py-0.5 text-xs text-center font-bold rounded"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Uses Lifecycle (RR v1.8 p. 30, ADR-0057) */}
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-comic-accent" />
                <span>Uses Counters Lifecycle (RR v1.8 p. 30)</span>
              </span>
              <button
                type="button"
                data-testid="toggle-uses-btn"
                onClick={() => {
                  if (supplemental.uses) {
                    const { uses: _, ...rest } = supplemental;
                    onChange(rest);
                  } else {
                    onChange({
                      ...supplemental,
                      uses: { count: 3, counterType: 'charge', discardOnEmpty: true },
                    });
                  }
                }}
                className="text-[10px] font-bold text-comic-accent hover:underline cursor-pointer"
              >
                {supplemental.uses ? 'Remove Uses' : '+ Configure Uses'}
              </button>
            </div>

            {supplemental.uses && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-yellow-50/50 p-2.5 border border-black rounded shadow-comic-xs">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                    Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    data-testid="uses-count-input"
                    value={supplemental.uses.count ?? 0}
                    onChange={(e) => {
                      const count = parseInt(e.target.value, 10);
                      onChange({
                        ...supplemental,
                        uses: { ...supplemental.uses, count: isNaN(count) ? 0 : count },
                      });
                    }}
                    className="w-full bg-white border border-black p-1 text-xs rounded font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                    Counter Type
                  </label>
                  <input
                    type="text"
                    data-testid="uses-type-input"
                    value={supplemental.uses.counterType || ''}
                    placeholder="e.g. charge, all-purpose"
                    onChange={(e) => {
                      onChange({
                        ...supplemental,
                        uses: { ...supplemental.uses, counterType: e.target.value || undefined },
                      });
                    }}
                    className="w-full bg-white border border-black p-1 text-xs rounded"
                  />
                </div>
                <div className="flex items-center pt-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-black">
                    <input
                      type="checkbox"
                      data-testid="uses-discard-on-empty-checkbox"
                      checked={Boolean(supplemental.uses.discardOnEmpty)}
                      onChange={(e) => {
                        onChange({
                          ...supplemental,
                          uses: {
                            ...supplemental.uses,
                            discardOnEmpty: e.target.checked || undefined,
                          },
                        });
                      }}
                      className="accent-black"
                    />
                    <span>Discard When Empty</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. ⚔️ Combat Properties */}
      <CollapsibleSection
        key={`${cardCode || 'card'}-combat`}
        title="Combat Properties"
        icon={Swords}
        visible={vis.combat || hasCombatData}
        defaultOpen={hasCombatData}
        forceOpen={showAllFields}
        hasErrors={combatHasErrors}
        badge={combatBadge}
        testId="section-combat-properties"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Consequential Attack DMG (attackCost)
            </label>
            <input
              type="number"
              min="0"
              data-testid="card-attack-cost-input"
              value={supplemental.attackCost !== undefined ? supplemental.attackCost : ''}
              placeholder="Default: 1 (0 for Black Cat)"
              onChange={(e) => {
                const val = e.target.value !== '' ? parseInt(e.target.value, 10) : undefined;
                onChange({
                  ...supplemental,
                  attackCost: isNaN(val as number) || val === undefined ? undefined : val,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Consequential Thwart DMG (thwartCost)
            </label>
            <input
              type="number"
              min="0"
              data-testid="card-thwart-cost-input"
              value={supplemental.thwartCost !== undefined ? supplemental.thwartCost : ''}
              placeholder="Default: 1"
              onChange={(e) => {
                const val = e.target.value !== '' ? parseInt(e.target.value, 10) : undefined;
                onChange({
                  ...supplemental,
                  thwartCost: isNaN(val as number) || val === undefined ? undefined : val,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Additional Boost Cards
            </label>
            <input
              type="number"
              min="1"
              data-testid="card-additional-boost-cards-input"
              value={supplemental.additionalBoostCards || ''}
              placeholder="e.g. 1"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onChange({
                  ...supplemental,
                  additionalBoostCards: isNaN(val) ? undefined : val,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 4. 📐 Layout & Display */}
      <CollapsibleSection
        key={`${cardCode || 'card'}-layout`}
        title="Layout & Display"
        icon={Layout}
        visible={vis.layout || hasLayoutData}
        defaultOpen={hasLayoutData}
        forceOpen={showAllFields}
        hasErrors={layoutHasErrors}
        badge={layoutBadge}
        testId="section-layout-display"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Orientation
            </label>
            <label className="flex items-center gap-1.5 pt-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                data-testid="card-is-landscape-checkbox"
                checked={Boolean(supplemental.isLandscape)}
                onChange={(e) => {
                  onChange({
                    ...supplemental,
                    isLandscape: e.target.checked || undefined,
                  });
                }}
                className="accent-black"
              />
              <span>Landscape Orientation (e.g. Side Schemes)</span>
            </label>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Victory Points (RR v1.8 p. 30)
            </label>
            <input
              type="number"
              data-testid="card-victory-points-input"
              value={supplemental.victoryPoints || ''}
              placeholder="e.g. 1"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onChange({
                  ...supplemental,
                  victoryPoints: isNaN(val) ? undefined : val,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 5. 🎯 Play Requirements */}
      <CollapsibleSection
        key={`${cardCode || 'card'}-playRequirements`}
        title="Play Requirements"
        icon={Shield}
        visible={vis.playReqs || hasPlayReqData}
        defaultOpen={hasPlayReqData}
        forceOpen={showAllFields}
        hasErrors={playReqHasErrors}
        badge={playReqBadge}
        testId="section-play-requirements"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Required Identity Form
            </label>
            <select
              data-testid="play-req-identity-form-select"
              value={supplemental.playRequirements?.identityForm || ''}
              onChange={(e) => {
                const val = e.target.value;
                const current = supplemental.playRequirements || {};
                if (!val) {
                  const { identityForm: _, ...rest } = current;
                  onChange({
                    ...supplemental,
                    playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                  });
                } else {
                  onChange({
                    ...supplemental,
                    playRequirements: {
                      ...current,
                      identityForm: val,
                    },
                  });
                }
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            >
              <option value="">Any / Unrestricted</option>
              <option value="HERO">Hero Form Only (e.g. Webbed Up)</option>
              <option value="ALTER_EGO">Alter-Ego Form Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Cross-Player Control (ADR-0066)
            </label>
            <label className="flex items-center gap-1.5 pt-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                data-testid="card-play-under-any-player-control-checkbox"
                checked={Boolean(supplemental.playUnderAnyPlayerControl)}
                onChange={(e) => {
                  onChange({
                    ...supplemental,
                    playUnderAnyPlayerControl: e.target.checked || undefined,
                  });
                }}
                className="accent-black"
              />
              <span>Play Under Any Player Control</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Form Trait Requirement
            </label>
            <input
              type="text"
              data-testid="play-req-form-trait-input"
              value={supplemental.playRequirements?.formTrait || ''}
              onChange={(e) => {
                const val = e.target.value.trim();
                const current = supplemental.playRequirements || {};
                if (!val) {
                  const { formTrait: _, ...rest } = current;
                  onChange({
                    ...supplemental,
                    playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                  });
                } else {
                  onChange({
                    ...supplemental,
                    playRequirements: {
                      ...current,
                      formTrait: val,
                    },
                  });
                }
              }}
              placeholder="e.g. Giant, Tiny"
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Required Identity Traits (comma separated)
            </label>
            <input
              type="text"
              data-testid="play-req-identity-traits-input"
              value={(supplemental.playRequirements?.identityTraits || []).join(', ')}
              onChange={(e) => {
                const traits = e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean);
                const current = supplemental.playRequirements || {};
                if (traits.length === 0) {
                  const { identityTraits: _, ...rest } = current;
                  onChange({
                    ...supplemental,
                    playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                  });
                } else {
                  onChange({
                    ...supplemental,
                    playRequirements: {
                      ...current,
                      identityTraits: traits,
                    },
                  });
                }
              }}
              placeholder="e.g. Avenger, Mystic, X-Men"
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Required Identity Names (comma-separated)
            </label>
            <input
              type="text"
              data-testid="play-req-identity-names-input"
              value={(supplemental.playRequirements?.identityNames || []).join(', ')}
              onChange={(e) => {
                const names = e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean);
                const current = supplemental.playRequirements || {};
                if (names.length === 0) {
                  const { identityNames: _, ...rest } = current;
                  onChange({
                    ...supplemental,
                    playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                  });
                } else {
                  onChange({
                    ...supplemental,
                    playRequirements: {
                      ...current,
                      identityNames: names,
                    },
                  });
                }
              }}
              placeholder="e.g. Peter Parker, Tony Stark"
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Required Control Zones (controlZones)
            </label>
            <div className="flex items-center gap-2">
              {(['tableau', 'allies', 'identity'] as const).map((zone) => {
                const currentZones: string[] = supplemental.playRequirements?.controlZones || [];
                const isSelected = currentZones.includes(zone);
                return (
                  <button
                    key={zone}
                    type="button"
                    data-testid={`play-req-zone-${zone}`}
                    onClick={() => {
                      const updatedZones = isSelected
                        ? currentZones.filter((z) => z !== zone)
                        : [...currentZones, zone];
                      const current = supplemental.playRequirements || {};
                      if (updatedZones.length === 0) {
                        const { controlZones: _, ...rest } = current;
                        onChange({
                          ...supplemental,
                          playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                        });
                      } else {
                        onChange({
                          ...supplemental,
                          playRequirements: {
                            ...current,
                            controlZones: updatedZones,
                          },
                        });
                      }
                    }}
                    className={`px-2.5 py-1 text-xs font-bold rounded border-2 border-black transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-comic-accent text-white shadow-comic-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {zone}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controlled Card Requirement: UniversalCardFilterBuilder Integration */}
          <div className="sm:col-span-2">
            <div
              data-testid="play-req-control-filter-accordion"
              className="rounded border border-black bg-white p-2 space-y-2"
            >
              <div
                onClick={() => setIsControlFilterExpanded(!isControlFilterExpanded)}
                data-testid="toggle-play-req-control-filter-btn"
                className="flex items-center justify-between cursor-pointer select-none hover:bg-yellow-50 p-1 rounded"
              >
                <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
                  {isControlFilterExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                  )}
                  <span>Required Controlled Card Criteria (controlFilter)</span>
                </span>
                <span className="bg-comic-yellow border border-black px-1.5 py-0.2 rounded text-[9px] font-bold text-black">
                  {supplemental.playRequirements?.controlFilter ? 'Configured' : 'None configured'}
                </span>
              </div>

              {isControlFilterExpanded && (
                <div className="pt-2 border-t border-gray-200">
                  <UniversalCardFilterBuilder
                    filter={supplemental.playRequirements?.controlFilter}
                    onChange={(newFilter) => {
                      const current = supplemental.playRequirements || {};
                      if (!newFilter) {
                        const { controlFilter: _, ...rest } = current;
                        onChange({
                          ...supplemental,
                          playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                        });
                      } else {
                        onChange({
                          ...supplemental,
                          playRequirements: {
                            ...current,
                            controlFilter: newFilter,
                          },
                        });
                      }
                    }}
                    isSubBranch={true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};
