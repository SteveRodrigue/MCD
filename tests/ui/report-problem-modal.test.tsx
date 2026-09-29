import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ReportProblemModal } from '../../src/ui/components/board/ReportProblemModal';
import * as problemReportService from '../../src/ui/services/problem-report-service';

vi.mock('../../src/ui/services/problem-report-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/ui/services/problem-report-service')>();
  return {
    ...actual,
    submitProblemReport: vi.fn(),
  };
});

describe('ReportProblemModal (Issue #164)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 1: Verifies ReportProblemModal renders into document.body via createPortal with class z-[100000]', () => {
    const onClose = vi.fn();
    const { rerender } = render(<ReportProblemModal isOpen={false} onClose={onClose} />);

    // When closed, nothing should be rendered in document.body
    expect(document.body.querySelector('.z-\\[100000\\]')).toBeNull();

    // When opened, createPortal mounts the modal overlay directly into document.body with z-[100000]
    rerender(<ReportProblemModal isOpen={true} onClose={onClose} />);

    const overlay = document.body.querySelector('.z-\\[100000\\]');
    expect(overlay).not.toBeNull();
    expect(document.body.contains(overlay)).toBe(true);
    expect(overlay?.classList.contains('fixed')).toBe(true);
    expect(overlay?.classList.contains('inset-0')).toBe(true);
    expect(overlay?.classList.contains('z-[100000]')).toBe(true);

    // Verify modal header is rendered inside document.body
    expect(screen.getByText('BULLPEN FIELD DISPATCH')).not.toBeNull();
    expect(screen.getByText('Report a Problem')).not.toBeNull();
  });

  it('Test 2: Verifies that submitting a valid report calls submitProblemReport, resets the form, disables submission, and triggers auto-close (onClose)', async () => {
    vi.useFakeTimers();

    vi.mocked(problemReportService.submitProblemReport).mockResolvedValue({
      success: true,
      file: 'report_test_123.json',
    });

    const onClose = vi.fn();
    render(
      <ReportProblemModal
        isOpen={true}
        onClose={onClose}
        initialDescription="Initial bug report description"
      />,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Initial bug report description');

    // Select '💡 Improvement' and 'P0 — Critical'
    const improvementBtn = screen.getByRole('button', { name: /💡 Improvement/i });
    fireEvent.click(improvementBtn);

    const p0Btn = screen.getByRole('button', { name: /P0 — Critical/i });
    fireEvent.click(p0Btn);

    // Verify submit button is enabled
    const submitBtn = screen.getByRole('button', { name: /save report/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    // Submit report
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 1. Verifies submitProblemReport was called with correct payload
    expect(problemReportService.submitProblemReport).toHaveBeenCalledTimes(1);
    expect(problemReportService.submitProblemReport).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'improvement',
        priority: 'P0-critical',
        description: 'Initial bug report description',
        title: '[IMPROVEMENT] Initial bug report description',
      }),
    );

    // 2. Verifies form fields reset to defaults
    expect(textarea.value).toBe('');

    // 3. Verifies submit button is disabled while status === 'success' to prevent duplicate submissions
    expect(submitBtn.disabled).toBe(true);
    expect(screen.getByText('Saved!')).not.toBeNull();

    // Verify duplicate clicks do not trigger another submission
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(problemReportService.submitProblemReport).toHaveBeenCalledTimes(1);

    // 4. Verifies auto-close timer (1500ms)
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Test 3: Verifies that manual close resets state', async () => {
    vi.useFakeTimers();

    const onClose = vi.fn();
    const TestHost: React.FC = () => {
      const [isOpen, setIsOpen] = useState(true);
      return (
        <ReportProblemModal
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            onClose();
          }}
          initialDescription="Initial issue text"
        />
      );
    };

    const { rerender } = render(<TestHost />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Initial issue text');

    // User modifies description, type, and priority
    fireEvent.change(textarea, { target: { value: 'Modified user description' } });
    expect(textarea.value).toBe('Modified user description');

    const featureBtn = screen.getByRole('button', { name: /✨ Feature Missing\/Incomplete/i });
    fireEvent.click(featureBtn);

    const p1Btn = screen.getByRole('button', { name: /P1 — High/i });
    fireEvent.click(p1Btn);

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /close/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    // Reopen modal to verify internal state was cleanly reset
    rerender(
      <ReportProblemModal
        isOpen={true}
        onClose={onClose}
        initialDescription="Initial issue text"
      />,
    );

    const reopenedTextarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(reopenedTextarea.value).toBe('Initial issue text');

    // Verify bug button has active class and P2-medium has active class
    const bugBtn = screen.getByRole('button', { name: /🐞 Bug/i });
    expect(bugBtn.classList.contains('bg-comic-yellow')).toBe(true);

    const p2Btn = screen.getByRole('button', { name: /P2 — Medium/i });
    expect(p2Btn.classList.contains('bg-comic-red')).toBe(true);
  });

  it('Test 4: Verifies manual close clears any active auto-close timer before expiry', async () => {
    vi.useFakeTimers();

    vi.mocked(problemReportService.submitProblemReport).mockResolvedValue({
      success: true,
      file: 'report_test_auto_close.json',
    });

    const onClose = vi.fn();
    render(
      <ReportProblemModal
        isOpen={true}
        onClose={onClose}
        initialDescription="Auto-close cancellation test"
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /save report/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(problemReportService.submitProblemReport).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    // Manually click close before the 1500ms auto-close timer expires
    const closeBtn = screen.getByRole('button', { name: /close/i });
    act(() => {
      fireEvent.click(closeBtn);
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    // Fast-forward past 1500ms - the cancelled timer must NOT fire onClose a second time
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Test 5: Verifies unmount clears any active auto-close timer', async () => {
    vi.useFakeTimers();

    vi.mocked(problemReportService.submitProblemReport).mockResolvedValue({
      success: true,
      file: 'report_test_unmount.json',
    });

    const onClose = vi.fn();
    const { unmount } = render(
      <ReportProblemModal
        isOpen={true}
        onClose={onClose}
        initialDescription="Unmount timer cleanup test"
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /save report/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(onClose).not.toHaveBeenCalled();

    // Unmount before 1500ms
    unmount();

    // Fast-forward time - onClose must NOT be called on unmounted component
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
