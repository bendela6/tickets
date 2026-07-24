import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CommandPalette, highlightMatch } from './command-palette';
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
    expect(screen.getAllByText('Form controls')).toHaveLength(1);
    expect(screen.getAllByText('Display')).toHaveLength(1);
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

  it('filters items as the user types', () => {
    render(<CommandPalette demos={demos} open={true} onOpenChange={() => {}} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'butt' } });

    // Button should still be visible (matches 'butt' in slug 'button')
    const items = screen.getAllByRole('option');
    expect(items.some((item) => item.textContent?.includes('Button'))).toBe(true);
    // Input should be filtered out
    expect(screen.queryByText(/^Input$/)).toBeNull();
  });

  it('resets query when dialog closes', () => {
    const { rerender } = render(<CommandPalette demos={demos} open={true} onOpenChange={() => {}} />);

    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'button' } });
    expect(input.value).toBe('button');

    rerender(<CommandPalette demos={demos} open={false} onOpenChange={() => {}} />);
    rerender(<CommandPalette demos={demos} open={true} onOpenChange={() => {}} />);

    const newInput = screen.getByRole('combobox') as HTMLInputElement;
    expect(newInput.value).toBe('');
  });
});

describe('highlightMatch', () => {
  it('highlights exact-case match with text-accent', () => {
    const result = highlightMatch('Button', 'But');
    expect(result).toBeTruthy();
    // Verify it renders a strong tag with the matched part
    const { container } = render(<div>{result}</div>);
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('But');
    expect(strong?.className).toContain('text-accent');
  });

  it('highlights case-insensitive match', () => {
    const result = highlightMatch('Button', 'but');
    const { container } = render(<div>{result}</div>);
    const strong = container.querySelector('strong');
    expect(strong).toBeTruthy();
    expect(strong?.textContent).toBe('But');
  });

  it('returns plain title when query is empty', () => {
    const result = highlightMatch('Button', '');
    expect(result).toBe('Button');
  });

  it('returns plain title when no match found', () => {
    const result = highlightMatch('Button', 'xyz');
    expect(result).toBe('Button');
  });
});
