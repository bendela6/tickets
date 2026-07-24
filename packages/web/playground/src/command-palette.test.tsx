import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommandPalette } from './command-palette';
import type { CollectedDemo } from '@tickets/ui/gallery';

const demos: Extract<CollectedDemo, { slug: string }>[] = [
  {
    slug: 'button',
    path: 'packages/ui/src/button.tsx',
    meta: { title: 'Button', group: 'Form controls' },
    states: [],
    playground: undefined,
  },
  {
    slug: 'input',
    path: 'packages/ui/src/input.tsx',
    meta: { title: 'Input', group: 'Form controls' },
    states: [],
    playground: undefined,
  },
  {
    slug: 'avatar',
    path: 'packages/ui/src/avatar.tsx',
    meta: { title: 'Avatar', group: 'Display' },
    states: [],
    playground: undefined,
  },
];

describe('CommandPalette', () => {
  it('renders grouped items from demos', () => {
    render(<CommandPalette demos={demos} open={true} onOpenChange={() => {}} />);

    expect(screen.getByText('Button')).toBeTruthy();
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Avatar')).toBeTruthy();
    expect(screen.getAllByText('Form controls').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Display').length).toBeGreaterThan(0);
  });

  it('selecting an item sets location.hash and calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette demos={demos} open={true} onOpenChange={onOpenChange} />);

    const buttonItem = screen.getByText('Button').closest('[cmdk-item]');
    fireEvent.click(buttonItem!);

    expect(window.location.hash).toBe('#button');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closing when open=false does not render', () => {
    const { rerender } = render(<CommandPalette demos={demos} open={true} onOpenChange={() => {}} />);

    expect(screen.getByText('Button')).toBeTruthy();

    rerender(<CommandPalette demos={demos} open={false} onOpenChange={() => {}} />);

    expect(screen.queryByText('Button')).toBeNull();
  });

  it('escape key closes the palette', () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette demos={demos} open={true} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
