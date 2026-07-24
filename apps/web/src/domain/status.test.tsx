import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pill } from '@tickets/ui/pill';
import { statusPill, typePill } from './status';

describe('statusPill', () => {
  it('maps each kind to tone + shape-named icon', () => {
    expect(statusPill('todo')).toEqual({ tone: 'gray', icon: 'circle' });
    expect(statusPill('active')).toEqual({ tone: 'blue', icon: 'circle-half' });
    expect(statusPill('blocked')).toEqual({ tone: 'orange', icon: 'diamond' });
    expect(statusPill('done')).toEqual({ tone: 'green', icon: 'circle-check' });
    expect(statusPill('dropped')).toEqual({ tone: 'gray', icon: 'circle-dashed', strikethrough: true });
  });
});

describe('typePill', () => {
  it('resolves to the retired TypeBadge look: control-gray border wins over the outline emphasis border', () => {
    render(<Pill {...typePill} label="Feature" />);
    const pill = screen.getByText('Feature').closest('span')!;
    expect(pill.className).toContain('border-control');
    expect(pill.className).not.toContain('border-ink-2');
  });
});
