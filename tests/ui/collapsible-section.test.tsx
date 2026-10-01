import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sparkles } from 'lucide-react';
import { CollapsibleSection } from '../../src/ui/components/editor/CollapsibleSection';

describe('CollapsibleSection Component', () => {
  it('renders title and icon', () => {
    render(
      <CollapsibleSection title="Test Section" icon={Sparkles} testId="test-section">
        <div>Content Here</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Test Section')).toBeDefined();
    expect(screen.getByTestId('test-section-icon')).toBeDefined();
    expect(screen.getByTestId('test-section-chevron-right')).toBeDefined();
  });

  it('starts collapsed when defaultOpen is false', () => {
    render(
      <CollapsibleSection title="Test Section" defaultOpen={false} testId="test-section">
        <div>Hidden Content</div>
      </CollapsibleSection>,
    );

    expect(screen.queryByText('Hidden Content')).toBeNull();
    expect(screen.getByTestId('test-section-chevron-right')).toBeDefined();
    expect(screen.queryByTestId('test-section-chevron-down')).toBeNull();
  });

  it('starts expanded when defaultOpen is true', () => {
    render(
      <CollapsibleSection title="Test Section" defaultOpen={true} testId="test-section">
        <div>Visible Content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Visible Content')).toBeDefined();
    expect(screen.getByTestId('test-section-chevron-down')).toBeDefined();
    expect(screen.queryByTestId('test-section-chevron-right')).toBeNull();
  });

  it('toggles on click and keypress', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleSection title="Toggle Section" defaultOpen={false} testId="test-section">
        <div>Collapsible Content</div>
      </CollapsibleSection>,
    );

    const toggleHeader = screen.getByTestId('test-section-toggle');
    expect(screen.queryByText('Collapsible Content')).toBeNull();

    // Click to open
    await user.click(toggleHeader);
    expect(screen.getByText('Collapsible Content')).toBeDefined();
    expect(screen.getByTestId('test-section-chevron-down')).toBeDefined();

    // Click to close
    await user.click(toggleHeader);
    expect(screen.queryByText('Collapsible Content')).toBeNull();
    expect(screen.getByTestId('test-section-chevron-right')).toBeDefined();

    // Keydown Enter to open
    fireEvent.keyDown(toggleHeader, { key: 'Enter' });
    expect(screen.getByText('Collapsible Content')).toBeDefined();

    // Keydown Space to close
    fireEvent.keyDown(toggleHeader, { key: ' ' });
    expect(screen.queryByText('Collapsible Content')).toBeNull();
  });

  it('auto-expands on hasErrors transition to true', () => {
    const { rerender } = render(
      <CollapsibleSection
        title="Error Section"
        defaultOpen={false}
        hasErrors={false}
        testId="test-section"
      >
        <div>Error Content</div>
      </CollapsibleSection>,
    );

    expect(screen.queryByText('Error Content')).toBeNull();

    // Update hasErrors to true
    rerender(
      <CollapsibleSection
        title="Error Section"
        defaultOpen={false}
        hasErrors={true}
        testId="test-section"
      >
        <div>Error Content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Error Content')).toBeDefined();
  });

  it('returns null and completely removes from DOM when visible is false', () => {
    const { container } = render(
      <CollapsibleSection title="Hidden Section" visible={false} testId="test-section">
        <div>Should Not Exist</div>
      </CollapsibleSection>,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('test-section')).toBeNull();
  });

  it('forceOpen={true} overrides visible={false} to keep it in DOM and expanded', () => {
    render(
      <CollapsibleSection
        title="Forced Visible Section"
        visible={false}
        forceOpen={true}
        testId="test-section"
      >
        <div>Forced Visible Content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByTestId('test-section')).toBeDefined();
    expect(screen.getByText('Forced Visible Content')).toBeDefined();
  });

  it('forceOpen={true} overrides collapsed state', () => {
    render(
      <CollapsibleSection
        title="Forced Open Section"
        defaultOpen={false}
        forceOpen={true}
        testId="test-section"
      >
        <div>Always Visible</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Always Visible')).toBeDefined();
    expect(screen.getByTestId('test-section-chevron-down')).toBeDefined();
  });

  it('shows badge when provided with variant styling', () => {
    const { rerender } = render(
      <CollapsibleSection
        title="Badge Section"
        badge="3 items"
        badgeVariant="info"
        testId="test-section"
      >
        <div>Content</div>
      </CollapsibleSection>,
    );

    const badge = screen.getByTestId('test-section-badge');
    expect(badge.textContent).toBe('3 items');
    expect(badge.classList.contains('bg-comic-yellow')).toBe(true);

    rerender(
      <CollapsibleSection
        title="Badge Section"
        badge={2}
        badgeVariant="error"
        testId="test-section"
      >
        <div>Content</div>
      </CollapsibleSection>,
    );

    const errorBadge = screen.getByTestId('test-section-badge');
    expect(errorBadge.textContent).toBe('2');
    expect(errorBadge.classList.contains('bg-red-50')).toBe(true);
    expect(errorBadge.classList.contains('text-comic-red')).toBe(true);
  });

  it('applies error border styling when hasErrors is true', () => {
    const { rerender } = render(
      <CollapsibleSection title="Border Test" hasErrors={false} testId="test-section">
        <div>Content</div>
      </CollapsibleSection>,
    );

    const container = screen.getByTestId('test-section');
    expect(container.classList.contains('border-black')).toBe(true);
    expect(container.classList.contains('border-comic-red')).toBe(false);

    rerender(
      <CollapsibleSection title="Border Test" hasErrors={true} testId="test-section">
        <div>Content</div>
      </CollapsibleSection>,
    );

    expect(container.classList.contains('border-comic-red')).toBe(true);
    expect(
      container.classList.contains('ring-comic-red') ||
        container.classList.contains('ring-red-200'),
    ).toBe(true);
  });

  it('implements full WAI-ARIA collapsible pattern and keyboard navigation', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleSection title="A11y Section" defaultOpen={false} testId="a11y-section">
        <div>Accessible Content</div>
      </CollapsibleSection>,
    );

    const toggleHeader = screen.getByTestId('a11y-section-toggle');
    expect(toggleHeader.getAttribute('role')).toBe('button');
    expect(toggleHeader.getAttribute('tabIndex')).toBe('0');
    expect(toggleHeader.getAttribute('aria-expanded')).toBe('false');

    const controlsId = toggleHeader.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();

    const headerId = toggleHeader.getAttribute('id');
    expect(headerId).toBeTruthy();

    // Verify focus outline classes exist
    expect(toggleHeader.className).toContain('focus:outline-2');
    expect(toggleHeader.className).toContain('focus:outline-black');
    expect(toggleHeader.className).toContain('focus:outline-offset-1');

    // Tab to header and press Space to expand
    toggleHeader.focus();
    expect(document.activeElement).toBe(toggleHeader);

    await user.keyboard(' ');
    expect(toggleHeader.getAttribute('aria-expanded')).toBe('true');

    const region = screen.getByRole('region');
    expect(region).toBeDefined();
    expect(region.getAttribute('id')).toBe(controlsId);
    expect(region.getAttribute('aria-labelledby')).toBe(headerId);
    expect(screen.getByText('Accessible Content')).toBeDefined();

    // Press Enter to collapse
    await user.keyboard('{Enter}');
    expect(toggleHeader.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Accessible Content')).toBeNull();
  });
});
