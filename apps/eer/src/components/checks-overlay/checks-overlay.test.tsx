import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CheckResult } from '../../engine/model/types';
import { ChecksOverlay } from './checks-overlay';

afterEach(cleanup);

const passing: CheckResult = { name: 'Ports paired', pass: true, scope: '7 fields', problems: [] };
const failing: CheckResult = {
  name: 'Endpoints on ports',
  pass: false,
  scope: '3 edges',
  problems: ['u-o: start off port', 'self: end off port'],
};

describe('ChecksOverlay', () => {
  it('renders a ✓ row with "scope ok" text for a passing result', () => {
    const { container } = render(<ChecksOverlay results={[passing]} onClose={() => {}} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
    expect(screen.getByText('Ports paired')).toBeInTheDocument();
    expect(container.textContent).toContain('7 fields ok');
  });

  it('renders a ✗ row listing the problems for a failing result', () => {
    const { container } = render(<ChecksOverlay results={[passing, failing]} onClose={() => {}} />);
    expect(screen.getByText('✗')).toBeInTheDocument();
    expect(screen.getByText('Endpoints on ports')).toBeInTheDocument();
    expect(container.textContent).toContain('2 problem(s): u-o: start off port; self: end off port');
    expect(container.textContent).not.toContain('3 edges ok');
  });

  it('fires onClose from the × button', () => {
    const onClose = vi.fn();
    render(<ChecksOverlay results={[passing]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
