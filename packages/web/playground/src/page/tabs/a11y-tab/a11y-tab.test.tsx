import type { AxeResults } from 'axe-core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { A11yTab } from './a11y-tab';

// A11yTab now takes a `runAudit` callback directly (component-page.tsx is
// the one that owns the axe.ts seam / DOM target), so tab tests inject a
// stub runAudit rather than going through setAxeForTests + a target ref.
function TestContainer({ runAudit }: { runAudit: () => Promise<AxeResults> }) {
  return <A11yTab runAudit={runAudit} />;
}

const cannedViolations: AxeResults = {
  violations: [
    {
      impact: 'serious',
      id: 'button-name',
      description: 'Icon-only buttons must expose an accessible name',
      helpUrl: 'https://example.com/button-name',
      nodes: [
        {
          target: ['button[data-size="icon"]:nth-child(4)'],
          html: '<button data-size="icon"></button>',
          any: [],
          all: [],
          none: [],
          impact: 'serious',
        },
      ],
      tags: [],
    },
    {
      impact: 'moderate',
      id: 'color-contrast',
      description: 'Text must have sufficient color contrast',
      helpUrl: 'https://example.com/color-contrast',
      nodes: [
        {
          target: ['button[data-variant="ghost"] > span'],
          html: '<span>Label</span>',
          any: [],
          all: [],
          none: [],
          impact: 'moderate',
        },
      ],
      tags: [],
    },
  ],
  passes: [
    {
      impact: 'minor',
      id: 'test-pass-1',
      description: 'Test pass 1',
      help: 'Test pass 1 help',
      helpUrl: 'https://example.com/test-pass-1',
      nodes: [{ target: ['div:nth-child(1)'], html: '<div></div>', any: [], all: [], none: [], impact: 'minor' }],
      tags: [],
    },
    {
      impact: 'minor',
      id: 'test-pass-2',
      description: 'Test pass 2',
      help: 'Test pass 2 help',
      helpUrl: 'https://example.com/test-pass-2',
      nodes: [
        { target: ['span:nth-child(1)'], html: '<span></span>', any: [], all: [], none: [], impact: 'minor' },
        { target: ['span:nth-child(2)'], html: '<span></span>', any: [], all: [], none: [], impact: 'minor' },
      ],
      tags: [],
    },
  ],
  inapplicable: [],
  incomplete: [],
  testEngine: {
    name: 'axe-core',
    version: '4.10.0',
  },
  testEnvironment: {
    userAgent: 'test',
    windowHeight: 1024,
    windowWidth: 1024,
  },
  testRunner: {
    name: 'axe-core',
  },
  toolOptions: {},
  timestamp: new Date().toISOString(),
  url: 'http://localhost',
} as unknown as AxeResults;

const cannedNoViolations: AxeResults = {
  violations: [],
  passes: [
    {
      impact: 'minor',
      id: 'test-pass-1',
      description: 'Test pass 1',
      helpUrl: 'https://example.com/test-pass-1',
      nodes: [
        { target: ['div:nth-child(1)'], html: '<div></div>', any: [], all: [], none: [], impact: 'minor' },
        { target: ['div:nth-child(2)'], html: '<div></div>', any: [], all: [], none: [], impact: 'minor' },
      ],
      tags: [],
    },
    {
      impact: 'minor',
      id: 'test-pass-2',
      description: 'Test pass 2',
      helpUrl: 'https://example.com/test-pass-2',
      nodes: [
        { target: ['span:nth-child(1)'], html: '<span></span>', any: [], all: [], none: [], impact: 'minor' },
        { target: ['span:nth-child(2)'], html: '<span></span>', any: [], all: [], none: [], impact: 'minor' },
      ],
      tags: [],
    },
  ],
  inapplicable: [],
  incomplete: [],
  testEngine: {
    name: 'axe-core',
    version: '4.10.0',
  },
  testEnvironment: {
    userAgent: 'test',
    windowHeight: 1024,
    windowWidth: 1024,
  },
  testRunner: {
    name: 'axe-core',
  },
  toolOptions: {},
  timestamp: new Date().toISOString(),
  url: 'http://localhost',
} as unknown as AxeResults;

describe('A11yTab', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders "no audit yet" before running an audit', () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedNoViolations)} />);
    expect(screen.getByText('no audit yet')).toBeTruthy();
  });

  it('displays violations with proper impact colors', async () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedViolations)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    await waitFor(() => {
      expect(screen.getByText('button-name')).toBeTruthy();
      expect(screen.getByText('color-contrast')).toBeTruthy();
    });

    // Verify serious impact chip has danger colors
    const seriousChip = screen.getByText('serious');
    expect(seriousChip.className).toContain('bg-danger-subtle');
    expect(seriousChip.className).toContain('text-danger');

    // Verify moderate impact chip has orange colors
    const moderateChip = screen.getByText('moderate');
    expect(moderateChip.className).toContain('bg-opt-orange-subtle');
    expect(moderateChip.className).toContain('text-opt-orange');
  });

  it('displays rule descriptions and target selectors', async () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedViolations)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    await waitFor(() => {
      expect(
        screen.getByText('Icon-only buttons must expose an accessible name'),
      ).toBeTruthy();
      expect(screen.getByText('button[data-size="icon"]:nth-child(4)')).toBeTruthy();
    });
  });

  it('renders Learn more links with helpUrl', async () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedViolations)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    await waitFor(() => {
      const links = screen.getAllByText('Learn more ↗');
      expect(links).toHaveLength(2);
      expect(links[0]?.getAttribute('href')).toBe('https://example.com/button-name');
      expect(links[1]?.getAttribute('href')).toBe('https://example.com/color-contrast');
    });
  });

  it('displays all-clear banner when zero violations', async () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedNoViolations)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    await waitFor(() => {
      expect(screen.getByText('No violations found')).toBeTruthy();
      expect(screen.getByText('✓')).toBeTruthy();
    });
  });

  it('calculates element count from passes.nodes.length', async () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedNoViolations)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    await waitFor(() => {
      // cannedNoViolations has 2 nodes from pass 1 and 2 nodes from pass 2 = 4 total
      expect(screen.getByText('· 4 elements checked')).toBeTruthy();
    });
  });

  it('disables button while audit is running', async () => {
    let resolveAudit: (value: AxeResults) => void;
    const auditPromise = new Promise<AxeResults>((resolve) => {
      resolveAudit = resolve;
    });

    render(<TestContainer runAudit={() => auditPromise} />);

    const button = screen.getByRole('button', { name: 'Run audit' }) as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('auditing…')).toBeTruthy();
      expect(button.disabled).toBe(true);
    });

    act(() => {
      resolveAudit!(cannedNoViolations);
    });

    await waitFor(() => {
      expect(screen.queryByText('auditing…')).toBeNull();
      expect(button.disabled).toBe(false);
    });
  });

  it('updates meta line with axe-core version after audit', async () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedViolations)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    await waitFor(() => {
      expect(screen.getByText(/axe-core 4\.10\.0/)).toBeTruthy();
    });
  });

  it('shows relative time in meta line', async () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedViolations)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Run audit' }));

    await waitFor(() => {
      // Should show "just now" since the audit just ran
      expect(screen.getByText(/last audit · just now · axe-core/)).toBeTruthy();
    });
  });

  it('allows re-running audits', async () => {
    render(<TestContainer runAudit={() => Promise.resolve(cannedNoViolations)} />);

    const button = screen.getByRole('button', { name: 'Run audit' });

    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText('No violations found')).toBeTruthy();
    });

    // Re-run should still be allowed
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText('No violations found')).toBeTruthy();
    });
  });
});
