import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionHeader } from './section-header';

describe('SectionHeader', () => {
  it('renders the title', () => {
    render(<SectionHeader title="Subtasks" />);
    expect(screen.getByText('Subtasks')).toBeTruthy();
  });

  it('renders count as a direct sibling of the title, not nested inside it', () => {
    const { container } = render(<SectionHeader title="Subtasks" count={<span>3/5 done</span>} />);
    const row = container.firstElementChild!;
    expect(row.children.length).toBe(2);
    expect(screen.getByText('3/5 done')).toBeTruthy();
  });

  it('renders action right-aligned after a flex-1 spacer', () => {
    const { container } = render(<SectionHeader title="Links" action={<button type="button">＋ Add link</button>} />);
    const row = container.firstElementChild!;
    // title span, spacer, action button
    expect(row.children.length).toBe(3);
    expect(screen.getByRole('button', { name: '＋ Add link' })).toBeTruthy();
  });

  it('renders no count/action wrapper when unset', () => {
    const { container } = render(<SectionHeader title="Fields" />);
    expect(container.firstElementChild!.children.length).toBe(1);
  });

  it('title carries the uppercase mono-label styling', () => {
    render(<SectionHeader title="Links" />);
    const el = screen.getByText('Links');
    for (const cls of ['text-label', 'uppercase', 'text-ink-2']) {
      expect(el.className).toContain(cls);
    }
  });

  it('merges an extra className onto the outer row', () => {
    const { container } = render(<SectionHeader title="Links" className="mb-2" />);
    expect(container.firstElementChild!.className).toContain('mb-2');
  });
});
