import React, { useState, useEffect, useRef } from 'react';
import { Bug, Check, Send, ExternalLink, AlertTriangle } from 'lucide-react';
import { useOptionalGameSession } from '../../context/GameStateContext';
import { useOnChange } from '../../hooks/useOnChange';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
import {
  ProblemReportPriority,
  ProblemReportType,
  buildGithubIssueUrl,
  mapReportToLabels,
  submitProblemReport,
} from '../../services/problem-report-service';

interface ReportProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDescription?: string;
}

const REPORT_TYPES: { value: ProblemReportType; label: string }[] = [
  { value: 'bug', label: '🐞 Bug' },
  { value: 'improvement', label: '💡 Improvement' },
  { value: 'feature', label: '✨ Feature Missing/Incomplete' },
];

const PRIORITIES: { value: ProblemReportPriority; label: string }[] = [
  { value: 'P0-critical', label: 'P0 — Critical' },
  { value: 'P1-high', label: 'P1 — High' },
  { value: 'P2-medium', label: 'P2 — Medium' },
  { value: 'P3-low', label: 'P3 — Low' },
];

export const ReportProblemModal: React.FC<ReportProblemModalProps> = ({
  isOpen,
  onClose,
  initialDescription = '',
}) => {
  const { style } = useModalStyle();
  const [type, setType] = useState<ProblemReportType>('bug');
  const [priority, setPriority] = useState<ProblemReportPriority>('P2-medium');
  const [description, setDescription] = useState(initialDescription || '');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [githubUrl, setGithubUrl] = useState<string | null>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Opened from the top bar or a card context menu, the modal reads the live state from the board session
  const activeGameState = useOptionalGameSession()?.state ?? null;

  // A fresh form each time the modal opens or its starting description changes
  useOnChange(isOpen ? `open:${initialDescription}` : 'closed', () => {
    if (!isOpen) return;
    setDescription(initialDescription || '');
    setType('bug');
    setPriority('P2-medium');
    setStatus('idle');
    setGithubUrl(null);
  });

  useEffect(() => {
    if (!isOpen && autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleClose = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setStatus('idle');
    setGithubUrl(null);
    setDescription(initialDescription || '');
    setType('bug');
    setPriority('P2-medium');
    onClose();
  };

  const handleSubmit = async () => {
    if (!description.trim() || status === 'submitting' || status === 'success') return;
    setStatus('submitting');
    const firstLine = description.trim().split('\n')[0] || '';
    const title = `[${type.toUpperCase()}] ${firstLine.slice(0, 80)}`;
    const result = await submitProblemReport({
      type,
      priority,
      title,
      description,
      gameState: activeGameState,
    });
    setGithubUrl(
      buildGithubIssueUrl({ title, description, labels: mapReportToLabels(type, priority) }),
    );
    if (result.success) {
      setStatus('success');
      setDescription('');
      setType('bug');
      setPriority('P2-medium');
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      autoCloseTimerRef.current = setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setStatus('error');
    }
  };

  const choice = (selected: boolean) =>
    `px-2 py-1.5 text-xs cursor-pointer transition-all ${
      selected ? `${style.btnMove} font-bold scale-105` : style.tile
    }`;

  return (
    <ModalScaffold
      layer="critical"
      title="Report a Problem"
      kicker="BULLPEN FIELD DISPATCH"
      verb="red"
      trigger={null}
      icon={<Bug className="w-5 h-5" />}
      onClose={handleClose}
      maxWidthClass="max-w-lg"
      testId="report-problem-modal"
    >
      <div className="space-y-1.5">
        <span className="text-sm uppercase">Report Type</span>
        <div className="grid grid-cols-3 gap-1.5">
          {REPORT_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={type === opt.value}
              onClick={() => setType(opt.value)}
              className={choice(type === opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority Selector */}
      <div className="space-y-1.5">
        <span className="text-sm uppercase">Priority</span>
        <div className="grid grid-cols-4 gap-1.5">
          {PRIORITIES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={priority === opt.value}
              onClick={() => setPriority(opt.value)}
              className={`${choice(priority === opt.value)} text-mini!`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <span className="text-sm uppercase">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Describe what happened, what you expected, or what's missing..."
          className="w-full p-2.5 rounded-lg border-2 border-comic-black bg-white text-slate-900 text-sm font-sans focus:outline-hidden focus:ring-2 focus:ring-comic-blue resize-none"
        />
      </div>

      {/* GameState Attachment Notice */}
      {activeGameState && (
        <div className={`p-2.5 text-xs flex items-center gap-2 ${style.inset} ${style.muted}`}>
          <AlertTriangle className="w-4 h-4 text-comic-red shrink-0" />
          <span>
            The current table GameState (Round {activeGameState.roundNumber},{' '}
            {activeGameState.phase}) will be attached automatically for debugging.
          </span>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!description.trim() || status === 'submitting' || status === 'success'}
        className={`w-full py-2.5 font-black uppercase text-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${style.btnGo}`}
      >
        <Send className="w-4 h-4" />
        <span>
          {status === 'submitting' ? 'Saving...' : status === 'success' ? 'Saved!' : 'Save Report'}
        </span>
      </button>

      {status === 'success' && (
        <div className="p-2.5 rounded-sm bg-emerald-100 border border-emerald-500 text-emerald-900 text-xs font-bold space-y-2">
          <div className="flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>Report saved to logs/reports/. It will be filed as a GitHub Issue later.</span>
          </div>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 underline text-comic-blue font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open prefilled GitHub Issue now instead
            </a>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="p-2.5 rounded-sm bg-rose-100 border border-rose-500 text-rose-900 text-xs font-bold space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>
              Could not save locally (dev server only). Use the link below to file it directly on
              GitHub instead.
            </span>
          </div>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 underline text-comic-blue font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open prefilled GitHub Issue
            </a>
          )}
        </div>
      )}
    </ModalScaffold>
  );
};

export default ReportProblemModal;
