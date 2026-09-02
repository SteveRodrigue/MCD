import { GameState } from '../../engine/models';

export type ProblemReportType = 'bug' | 'improvement' | 'feature';
export type ProblemReportPriority = 'P0-critical' | 'P1-high' | 'P2-medium' | 'P3-low';

export interface ProblemReportPayload {
  type: ProblemReportType;
  priority: ProblemReportPriority;
  title: string;
  description: string;
  labels: string[];
  gameState: GameState;
  timestamp: number;
}

export interface SubmitProblemReportInput {
  type: ProblemReportType;
  priority: ProblemReportPriority;
  title: string;
  description: string;
  gameState: GameState;
}

const GITHUB_REPO_URL = 'https://github.com/SteveRodrigue/MCD';

/** Maps a report type to its base GitHub issue-tracker labels (mirrors .github/ISSUE_TEMPLATE). */
export function mapReportTypeToLabels(type: ProblemReportType): string[] {
  switch (type) {
    case 'bug':
      return ['bug', 'triage'];
    case 'improvement':
      return ['enhancement'];
    case 'feature':
      return ['enhancement', 'feature'];
  }
}

/** Combines the report-type labels with the selected priority label. */
export function mapReportToLabels(
  type: ProblemReportType,
  priority: ProblemReportPriority,
): string[] {
  return [...mapReportTypeToLabels(type), `priority:${priority}`];
}

/** Builds a prefilled "New Issue" GitHub URL (no API call, no token required). */
export function buildGithubIssueUrl(
  payload: Pick<ProblemReportPayload, 'title' | 'description' | 'labels'>,
): string {
  const params = new URLSearchParams({
    title: payload.title,
    body: payload.description,
    labels: payload.labels.join(','),
  });
  return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`;
}

/**
 * Saves a Problem Report snapshot to the local logs/reports/ directory via the Vite dev server
 * endpoint. Dev/preview server only — no-op (network error is swallowed) in production builds.
 */
export async function submitProblemReport(
  input: SubmitProblemReportInput,
): Promise<{ success: boolean; file?: string }> {
  const payload: ProblemReportPayload = {
    type: input.type,
    priority: input.priority,
    title: input.title,
    description: input.description,
    labels: mapReportToLabels(input.type, input.priority),
    gameState: input.gameState,
    timestamp: Date.now(),
  };

  try {
    sessionStorage.setItem('mcd_latest_problem_report', JSON.stringify(payload));
  } catch (e) {
    // Ignore storage quota limits in browser
  }

  try {
    const response = await fetch('/api/logs/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return { success: false };
    const result = await response.json();
    return { success: true, file: result.file };
  } catch (err) {
    // Gracefully ignore network errors when running standalone (production/Tauri build)
    return { success: false };
  }
}
