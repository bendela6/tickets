import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RailLabel } from './rail-label';

describe('RailLabel', () => {
  it('renders its children', () => {
    render(<RailLabel>AGENTS</RailLabel>);
    expect(screen.getByText('AGENTS')).toBeTruthy();
  });

  it('carries the mono/uppercase/tracking/muted classes', () => {
    render(<RailLabel>PROJECTS</RailLabel>);
    const el = screen.getByText('PROJECTS');
    for (const cls of ['font-mono', 'text-10', 'uppercase', 'text-gray-9']) {
      expect(el.className).toContain(cls);
    }
  });

  it('merges an extra className', () => {
    render(<RailLabel className="mt-2">SIGNALS</RailLabel>);
    expect(screen.getByText('SIGNALS').className).toContain('mt-2');
  });
});
