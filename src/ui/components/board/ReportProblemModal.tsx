import React, { useState } from 'react';
import { Bug, X, Check, Send, ExternalLink, AlertTriangle } from 'lucide-react';
import { GameState } from '../../../engine/models';
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
  gameState: GameState;
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
  gameState,
}) => {
  const [type, setType] = useState<ProblemReportType>('bug');
  const [priority, setPriority] = useState<ProblemReportPriority>('P2-medium');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [githubUrl, setGithubUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setStatus('idle');
    setDescription('');
    setGithubUrl(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setStatus('submitting');
    const title = `[${type.toUpperCase()}] ${description.slice(0, 60)}`;
    const result = await submitProblemReport({
      type,
      priority,
      title,
      description,
      gameState,
    });
    setGithubUrl(
      buildGithubIssueUrl({ title, description, labels: mapReportToLabels(type, priority) }),
    );
    setStatus(result.success ? 'success' : 'error');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-comic-black rounded-2xl shadow-comic-lg max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
          <div className="flex items-center gap-2">
            <Bug className="w-6 h-6 text-comic-red" />
            <h3 className="font-comic text-xl text-comic-black uppercase">Report a Problem</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg border-2 border-comic-black bg-rose-100 hover:bg-rose-200 text-comic-red transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Selector */}
        <div className="space-y-1.5">
          <span className="font-comic text-sm text-comic-black uppercase">Report Type</span>
          <div className="grid grid-cols-3 gap-1.5">
            {REPORT_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`px-2 py-1.5 font-comic text-xs rounded border-2 border-comic-black shadow-comic-sm cursor-pointer transition-all ${
                  type === opt.value
                    ? 'bg-comic-yellow text-comic-black font-bold scale-105'
                    : 'bg-white text-slate-700 hover:bg-amber-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority Selector */}
        <div className="space-y-1.5">
          <span className="font-comic text-sm text-comic-black uppercase">Priority</span>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITIES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={`px-1.5 py-1.5 font-comic text-[11px] rounded border-2 border-comic-black shadow-comic-sm cursor-pointer transition-all ${
                  priority === opt.value
                    ? 'bg-comic-red text-white font-bold scale-105'
                    : 'bg-white text-slate-700 hover:bg-rose-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <span className="font-comic text-sm text-comic-black uppercase">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Describe what happened, what you expected, or what's missing..."
            className="w-full p-2.5 rounded-lg border-2 border-comic-black text-sm font-sans focus:outline-none focus:ring-2 focus:ring-comic-blue resize-none"
          />
        </div>

        {/* GameState Attachment Notice */}
        <div className="bg-amber-50 p-2.5 rounded-xl border-2 border-comic-black shadow-comic-sm text-xs text-slate-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-comic-red shrink-0" />
          <span>
            The current table GameState (Round {gameState.roundNumber}, {gameState.phase}) will be
            attached automatically for debugging.
          </span>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!description.trim() || status === 'submitting'}
          className="comic-button-primary w-full px-6 py-2 text-sm font-comic cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          <span>{status === 'submitting' ? 'Saving...' : 'Save Report'}</span>
        </button>

        {status === 'success' && (
          <div className="p-2.5 rounded bg-emerald-100 border border-emerald-500 text-emerald-900 text-xs font-bold space-y-2">
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
          <div className="p-2.5 rounded bg-rose-100 border border-rose-500 text-rose-900 text-xs font-bold space-y-2">
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
      </div>
    </div>
  );
};

export default ReportProblemModal;
