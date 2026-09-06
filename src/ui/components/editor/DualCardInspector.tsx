import React, { useState, useEffect, useCallback } from 'react';
import { CardDetailsResponse } from '../../../tools/editor/api-middleware';
import { CardView } from '../cards/CardView';
import { FormattedCardText } from '../cards/FormattedCardText';
import { normalizeRawCard } from '../../../data/importer/card-loader';
import { CardEnrichmentSchema } from '../../../data/supplemental/schema';
import { AbilityFormBuilder } from './AbilityFormBuilder';
import { RawJsonEditor } from './RawJsonEditor';
import {
  AlertTriangle,
  FileCode,
  Layers,
  Copy,
  Check,
  Zap,
  Clock,
  Shield,
  Tag,
  Save,
  Sliders,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface DualCardInspectorProps {
  cardDetails: CardDetailsResponse | null;
  loading: boolean;
  onSaveSupplemental?: (
    code: string,
    payload: { packFile: string; supplemental: any },
  ) => Promise<boolean>;
}

export const DualCardInspector: React.FC<DualCardInspectorProps> = ({
  cardDetails,
  loading,
  onSaveSupplemental,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'form' | 'raw'>('form');
  const [copiedRaw, setCopiedRaw] = useState(false);

  // Editable Supplemental Data State
  const [editedSupplemental, setEditedSupplemental] = useState<any>({});
  const [rawJsonString, setRawJsonString] = useState<string>('{}');
  const [jsonSyntaxError, setJsonSyntaxError] = useState<string | null>(null);

  // Live Zod Validation State
  const [liveValidation, setLiveValidation] = useState<{
    valid: boolean;
    errors: Array<{ path: string; message: string }>;
  }>({ valid: true, errors: [] });

  // Save feedback state
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Synchronize local editable state when selected card changes
  useEffect(() => {
    if (cardDetails) {
      const initial = cardDetails.supplemental
        ? JSON.parse(JSON.stringify(cardDetails.supplemental))
        : {
            comment: `Supplemental definition for ${cardDetails.upstream.name || cardDetails.code}`,
            abilities: [],
            audit: {
              reviewedBy: 'developer',
              confidence: 100,
              rulesVersion: 'v1.8',
            },
          };
      setEditedSupplemental(initial);
      setRawJsonString(JSON.stringify(initial, null, 2));
      setJsonSyntaxError(null);
    } else {
      setEditedSupplemental({});
      setRawJsonString('{}');
      setJsonSyntaxError(null);
    }
  }, [cardDetails]);

  // Run live validation whenever editedSupplemental changes
  useEffect(() => {
    if (!editedSupplemental || Object.keys(editedSupplemental).length === 0) {
      setLiveValidation({ valid: true, errors: [] });
      return;
    }

    const res = CardEnrichmentSchema.safeParse(editedSupplemental);
    if (res.success) {
      setLiveValidation({ valid: true, errors: [] });
    } else {
      const issues = res.error.issues || (res.error as any).errors || [];
      const formattedErrors = issues.map((iss: any) => ({
        path: iss.path.length > 0 ? iss.path.join('.') : 'root',
        message: iss.message,
      }));
      setLiveValidation({ valid: false, errors: formattedErrors });
    }
  }, [editedSupplemental]);

  // Handle Form Builder Updates
  const handleFormChange = (updated: any) => {
    setEditedSupplemental(updated);
    setRawJsonString(JSON.stringify(updated, null, 2));
    setJsonSyntaxError(null);
  };

  // Handle Raw JSON Editor Updates
  const handleRawJsonChange = (newVal: string) => {
    setRawJsonString(newVal);
    try {
      const parsed = JSON.parse(newVal);
      setJsonSyntaxError(null);
      setEditedSupplemental(parsed);
    } catch (err: any) {
      setJsonSyntaxError(err.message);
    }
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(rawJsonString);
      setRawJsonString(JSON.stringify(parsed, null, 2));
      setJsonSyntaxError(null);
    } catch {
      // ignore
    }
  };

  // Save Action
  const handleSave = useCallback(async () => {
    if (!cardDetails || !liveValidation.valid || jsonSyntaxError) return;

    setIsSaving(true);
    try {
      if (onSaveSupplemental) {
        const success = await onSaveSupplemental(cardDetails.code, {
          packFile: cardDetails.packFile,
          supplemental: editedSupplemental,
        });
        if (success) {
          setSaveToast({
            type: 'success',
            message: `Saved ${cardDetails.code} to ${cardDetails.packFile}! Active game sessions may reload or reset.`,
          });
        } else {
          setSaveToast({
            type: 'error',
            message: `Failed to save ${cardDetails.code}. Check server logs.`,
          });
        }
      }
    } catch (err: any) {
      setSaveToast({
        type: 'error',
        message: `Error: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveToast(null), 6000);
    }
  }, [cardDetails, liveValidation.valid, jsonSyntaxError, onSaveSupplemental, editedSupplemental]);

  // Hotkey listener (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-comic-paper">
        <div className="flex flex-col items-center gap-3 font-comic text-comic-dark">
          <div className="w-10 h-10 border-4 border-black border-t-comic-red rounded-full animate-spin" />
          <span className="font-bold text-base">Loading card details...</span>
        </div>
      </div>
    );
  }

  if (!cardDetails) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-comic-paper">
        <div className="flex flex-col items-center gap-3 font-comic text-comic-dark text-center max-w-sm">
          <Layers className="w-12 h-12 text-gray-400" />
          <span className="font-bangers text-2xl tracking-wide">NO CARD SELECTED</span>
          <span className="text-xs text-gray-600">
            Select a card from the left gallery to inspect its printed artwork, upstream properties,
            and edit its supplemental rules.
          </span>
        </div>
      </div>
    );
  }

  const { code, packFile, upstream } = cardDetails;

  // Normalize card on the fly for CardView rendering
  const normalizedCard = normalizeRawCard(
    upstream,
    editedSupplemental ? { [code]: editedSupplemental } : {},
  );

  const handleCopyRaw = () => {
    const rawCombined = {
      upstream,
      supplemental: editedSupplemental,
    };
    navigator.clipboard.writeText(JSON.stringify(rawCombined, null, 2));
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-comic-paper">
      {/* LEFT / CENTER COLUMN: Card Visual Preview & Printed Text */}
      <div className="w-full md:w-1/2 p-4 md:p-6 overflow-y-auto border-r-4 border-black flex flex-col items-center gap-4 bg-[#fbf9f4]">
        {/* Card View Visual Preview (ADR-0012 Unconstrained Z-Axis Elevation) */}
        <div className="flex flex-col items-center relative z-30 overflow-visible">
          <div className="shadow-comic-lg border-2 border-black rounded-lg bg-black p-1 overflow-visible">
            <CardView card={normalizedCard} size="lg" enableHoverZoom={true} zoomOrigin="center" />
          </div>
          <span className="text-[11px] font-comic font-bold text-gray-500 mt-2">
            Hover over card to magnify
          </span>
        </div>

        {/* Printed Card Text Box */}
        <div className="w-full bg-white border-3 border-black p-3.5 shadow-comic-sm">
          <div className="flex items-center gap-2 border-b-2 border-black pb-1.5 mb-2 font-bangers text-sm tracking-wide text-comic-red">
            <Zap className="w-4 h-4 text-comic-red" />
            <span>PRINTED CARD TEXT</span>
          </div>
          <div className="font-comic text-xs text-black leading-relaxed">
            {upstream.text ? (
              <FormattedCardText text={upstream.text} />
            ) : (
              <span className="italic text-gray-400">No printed rules text on card face.</span>
            )}
          </div>
          {upstream.flavor && (
            <div className="mt-3 pt-2 border-t border-dashed border-gray-300 italic text-[11px] text-gray-600 font-comic">
              {upstream.flavor}
            </div>
          )}
        </div>

        {/* Upstream Properties Table */}
        <div className="w-full bg-white border-3 border-black p-3.5 shadow-comic-sm">
          <div className="flex items-center gap-2 border-b-2 border-black pb-1.5 mb-2.5 font-bangers text-sm tracking-wide text-comic-dark">
            <Tag className="w-4 h-4 text-black" />
            <span>UPSTREAM ZZORBA PROPERTIES</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-sans">
            <div className="bg-comic-paper p-1.5 border border-black rounded">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Type</span>
              <span className="font-bold capitalize">{upstream.type_code || 'N/A'}</span>
            </div>
            <div className="bg-comic-paper p-1.5 border border-black rounded">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Faction</span>
              <span className="font-bold capitalize">{upstream.faction_code || 'N/A'}</span>
            </div>
            <div className="bg-comic-paper p-1.5 border border-black rounded">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Set</span>
              <span className="font-bold truncate block">{upstream.set_code || 'None'}</span>
            </div>
            <div className="bg-comic-paper p-1.5 border border-black rounded">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Cost</span>
              <span className="font-bold">{upstream.cost !== undefined ? upstream.cost : '—'}</span>
            </div>
            <div className="bg-comic-paper p-1.5 border border-black rounded">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Health</span>
              <span className="font-bold">
                {upstream.health !== undefined ? upstream.health : '—'}
                {upstream.health_per_hero ? ' / hero' : ''}
              </span>
            </div>
            <div className="bg-comic-paper p-1.5 border border-black rounded">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Hand Size</span>
              <span className="font-bold">
                {upstream.hand_size !== undefined ? upstream.hand_size : '—'}
              </span>
            </div>
            <div className="bg-comic-paper p-1.5 border border-black rounded">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Attack</span>
              <span className="font-bold">
                {upstream.attack !== undefined ? upstream.attack : '—'}
              </span>
            </div>
            <div
              className="bg-comic-paper p-1.5 border border-black rounded"
              title={
                upstream.scheme !== undefined
                  ? `Scheme (SCH): ${upstream.scheme}`
                  : upstream.thwart !== undefined
                    ? `Thwart (THW): ${upstream.thwart}`
                    : 'No THW or SCH stat'
              }
            >
              <span className="text-[10px] uppercase font-bold text-gray-500 block">THW / SCH</span>
              <span className="font-bold">
                {upstream.scheme !== undefined
                  ? `${upstream.scheme} (SCH)`
                  : upstream.thwart !== undefined
                    ? `${upstream.thwart} (THW)`
                    : '—'}
              </span>
            </div>
            <div
              className="bg-comic-paper p-1.5 border border-black rounded"
              title={
                upstream.recover !== undefined
                  ? `Recovery (REC): ${upstream.recover}`
                  : upstream.defense !== undefined
                    ? `Defense (DEF): ${upstream.defense}`
                    : 'No DEF or REC stat'
              }
            >
              <span className="text-[10px] uppercase font-bold text-gray-500 block">DEF / REC</span>
              <span className="font-bold">
                {upstream.recover !== undefined
                  ? `${upstream.recover} (REC)`
                  : upstream.defense !== undefined
                    ? `${upstream.defense} (DEF)`
                    : '—'}
              </span>
            </div>
          </div>

          {upstream.traits && (
            <div className="mt-2.5 pt-2 border-t border-gray-200 text-xs">
              <span className="font-bold text-gray-600">Traits: </span>
              <span className="italic font-comic">{upstream.traits}</span>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Declarative Supplemental Reviewer & Editor */}
      <div className="w-full md:w-1/2 p-4 md:p-6 overflow-y-auto flex flex-col gap-4 bg-comic-paper">
        {/* Header Strip with Code, Save Button & Tab Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-comic-panel border-3 border-black p-3 shadow-comic-sm">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold bg-black text-white px-2 py-0.5 rounded">
                {code}
              </span>
              <span className="font-bangers text-xl tracking-wide text-black truncate">
                {upstream.name}
              </span>
              {editedSupplemental?.noSupplementalNeeded && (
                <span
                  data-testid="inspector-vanilla-badge"
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 bg-blue-100 px-2 py-0.5 border border-black rounded shadow-comic-xs"
                  title="Vanilla Card: No supplemental rules needed"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                  <span>Vanilla</span>
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-gray-600 mt-0.5 block">
              Pack: {packFile}
            </span>
          </div>

          {/* Action & Save Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Save Card Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !liveValidation.valid || Boolean(jsonSyntaxError)}
              className={`flex items-center gap-1.5 font-bangers text-sm tracking-wide px-3.5 py-1.5 border-2 border-black rounded shadow-comic-sm transition-transform active:scale-95 cursor-pointer ${
                liveValidation.valid && !jsonSyntaxError
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed border-gray-400'
              }`}
              title={
                !liveValidation.valid
                  ? 'Cannot save: Fix schema validation errors'
                  : 'Save changes to disk (Ctrl+S)'
              }
            >
              <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'Saving...' : 'SAVE CARD'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="flex items-center border-b-2 border-black gap-1">
          <button
            onClick={() => setActiveTab('form')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-comic text-xs font-bold border-t-2 border-x-2 border-black rounded-t transition-colors cursor-pointer ${
              activeTab === 'form'
                ? 'bg-comic-yellow text-black -mb-[2px] pb-2 shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-black" />
            <span>Form Builder</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-comic text-xs font-bold border-t-2 border-x-2 border-black rounded-t transition-colors cursor-pointer ${
              activeTab === 'summary'
                ? 'bg-comic-yellow text-black -mb-[2px] pb-2 shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-black" />
            <span>Visual Review</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-comic text-xs font-bold border-t-2 border-x-2 border-black rounded-t transition-colors cursor-pointer ${
              activeTab === 'raw'
                ? 'bg-comic-yellow text-black -mb-[2px] pb-2 shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-black" />
            <span>Raw JSON</span>
          </button>
        </div>

        {/* Save Toast Feedback */}
        {saveToast && (
          <div
            className={`p-3 border-3 border-black shadow-comic-sm rounded text-xs font-bold flex items-start gap-2 animate-in fade-in ${
              saveToast.type === 'success'
                ? 'bg-green-100 text-green-900 border-green-800'
                : 'bg-red-100 text-red-900 border-comic-red'
            }`}
          >
            {saveToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-comic-red shrink-0 mt-0.5" />
            )}
            <div>
              <p>{saveToast.message}</p>
              {saveToast.type === 'success' && (
                <p className="font-normal text-[11px] text-gray-600 mt-0.5">
                  Saved with auto-stamped audit timestamps and 2-space indentation.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Live Validation Error Box */}
        {!liveValidation.valid && (
          <div className="bg-red-50 border-3 border-comic-red p-3 shadow-comic-sm">
            <div className="flex items-center gap-2 text-comic-red font-bangers text-base tracking-wide">
              <AlertTriangle className="w-5 h-5" />
              <span>SCHEMA VALIDATION ERRORS ({liveValidation.errors.length})</span>
            </div>
            <ul className="mt-2 space-y-1 text-xs font-mono text-red-900 list-disc list-inside">
              {liveValidation.errors.map((err, idx) => (
                <li key={idx}>
                  <span className="font-bold">{err.path}: </span>
                  <span>{err.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* TAB 1: Visual Form Builder */}
        {activeTab === 'form' && (
          <div className="bg-comic-panel border-3 border-black p-4 shadow-comic-sm">
            <AbilityFormBuilder supplemental={editedSupplemental} onChange={handleFormChange} />
          </div>
        )}

        {/* TAB 2: Visual Review Summary */}
        {activeTab === 'summary' && (
          <div className="flex flex-col gap-4">
            {editedSupplemental ? (
              <>
                {/* Audit Metadata Card */}
                <div className="bg-white border-3 border-black p-3 shadow-comic-sm">
                  <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-2 font-bangers text-sm tracking-wide text-comic-dark">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-black" />
                      <span>AUDIT & RECONSTRUCTION METADATA</span>
                    </div>
                    {editedSupplemental.audit?.confidence !== undefined && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 border border-black rounded ${
                          editedSupplemental.audit.confidence >= 95
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        Confidence: {editedSupplemental.audit.confidence}%
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans">
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">Reviewed By</span>
                      <span className="font-bold">
                        {editedSupplemental.audit?.reviewedBy || 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">
                        Rules Version
                      </span>
                      <span className="font-bold">
                        {editedSupplemental.audit?.rulesVersion || 'v1.8'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">
                        Last Updated
                      </span>
                      <span className="font-mono text-[11px] truncate block">
                        {editedSupplemental.audit?.updatedAt || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">Created</span>
                      <span className="font-mono text-[11px] truncate block">
                        {editedSupplemental.audit?.createdAt || '—'}
                      </span>
                    </div>
                  </div>

                  {editedSupplemental.comment && (
                    <div className="mt-2.5 pt-2 border-t border-gray-200 text-xs font-comic text-gray-700">
                      <span className="font-bold text-black">Comment: </span>
                      {editedSupplemental.comment}
                    </div>
                  )}
                </div>

                {/* Abilities List */}
                <div className="bg-white border-3 border-black p-3 shadow-comic-sm">
                  <div className="flex items-center justify-between border-b-2 border-black pb-1.5 mb-3 font-bangers text-base tracking-wide text-comic-dark">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 fill-comic-yellow text-black" />
                      <span>
                        DECLARATIVE ABILITIES ({editedSupplemental.abilities?.length || 0})
                      </span>
                    </div>
                  </div>

                  {editedSupplemental.abilities && editedSupplemental.abilities.length > 0 ? (
                    <div className="space-y-3">
                      {editedSupplemental.abilities.map((ab: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-comic-paper border-2 border-black p-3 shadow-comic-xs rounded"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[11px] font-bold bg-comic-accent text-white px-1.5 py-0.5 rounded border border-black">
                                #{idx + 1} {ab.id || 'ability'}
                              </span>
                              <span className="font-bold text-xs bg-comic-yellow text-black px-2 py-0.5 border border-black rounded">
                                {ab.timing}
                              </span>
                              {ab.trigger && (
                                <span className="font-mono text-[11px] bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded border border-gray-400">
                                  {ab.trigger}
                                </span>
                              )}
                              {ab.limit && (
                                <span className="font-bold text-[11px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-400">
                                  ⏳ {ab.limit}
                                </span>
                              )}
                              {ab.zone && (
                                <span className="font-mono text-[11px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded border border-blue-400">
                                  📍 {ab.zone}
                                </span>
                              )}
                            </div>
                            {ab.cost && (
                              <div className="flex items-center gap-1 text-[11px] font-bold text-comic-red">
                                <Shield className="w-3.5 h-3.5" />
                                <span>
                                  Cost:{' '}
                                  {ab.cost.exhaustSelf || (ab.cost as any).exhaust
                                    ? 'Exhaust '
                                    : ''}
                                  {ab.cost.discardSelf ? 'Discard ' : ''}
                                  {ab.cost.damageSelf ? `Take ${ab.cost.damageSelf} DMG ` : ''}
                                  {ab.cost.resources ? JSON.stringify(ab.cost.resources) : ''}
                                </span>
                              </div>
                            )}
                          </div>

                          {ab.description && (
                            <p className="text-xs text-gray-700 italic mb-2 font-comic">
                              "{ab.description}"
                            </p>
                          )}

                          {/* Steps List */}
                          {ab.steps && ab.steps.length > 0 && (
                            <div className="mt-2 pl-2 border-l-2 border-black space-y-1.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                                Resolution Steps ({ab.steps.length})
                              </span>
                              {ab.steps.map((st: any, sIdx: number) => (
                                <div
                                  key={sIdx}
                                  className="text-xs font-mono bg-white p-1.5 border border-black rounded flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <span className="font-bold text-comic-accent mr-2">
                                      [{st.effect}]
                                    </span>
                                    {st.params && (
                                      <span className="text-gray-700 text-[11px]">
                                        {JSON.stringify(st.params)}
                                      </span>
                                    )}
                                  </div>
                                  {st.gate && (
                                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1 py-0.5 rounded border">
                                      Gate: {st.gate}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : editedSupplemental.noSupplementalNeeded ? (
                    <div
                      data-testid="summary-vanilla-notice"
                      className="p-4 bg-blue-50 border-2 border-blue-600 rounded flex items-center justify-center gap-2 text-xs text-blue-900 font-bold"
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>
                        Vanilla Card: No supplemental rules needed (no printed abilities).
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-gray-500 italic">
                      No declarative abilities defined on this supplemental record.
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* TAB 3: Raw JSON Editor */}
        {activeTab === 'raw' && (
          <div className="bg-white border-3 border-black p-3 shadow-comic-sm flex flex-col gap-3">
            <div className="flex items-center justify-between border-b-2 border-black pb-1.5 font-bangers text-sm tracking-wide text-black">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-black" />
                <span>RAW JSON EDITOR</span>
              </div>
              <button
                onClick={handleCopyRaw}
                className="flex items-center gap-1 text-xs font-bold bg-comic-yellow text-black px-2.5 py-1 border-2 border-black shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
              >
                {copiedRaw ? (
                  <Check className="w-3.5 h-3.5 text-green-700" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedRaw ? 'Copied!' : 'Copy JSON'}</span>
              </button>
            </div>

            <RawJsonEditor
              value={rawJsonString}
              onChange={handleRawJsonChange}
              jsonSyntaxError={jsonSyntaxError}
              onFormat={handleFormatJson}
            />
          </div>
        )}
      </div>
    </div>
  );
};
