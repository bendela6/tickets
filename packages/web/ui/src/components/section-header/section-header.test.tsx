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

  // Fix 1 (task-12 review): count/hint must resolve to the 11px caption size
  // even though it sets no font-size of its own — regression pin for the
  // "hint jumped from 11px to 16px" bug (new-session-dialog / agent-editor's
  // Label helpers render their hint via `count`, which is a plain sibling
  // span with no size class).
  it('gives the row the text-label size so an unsized count/hint inherits 11px', () => {
    const { container } = render(
      <SectionHeader title="Command" count={<span>optional — defaults to your shell</span>} />,
    );
    const row = container.firstElementChild!;
    expect(row.className).toContain('text-label');
    const hint = screen.getByText('optional — defaults to your shell');
    // The hint itself sets no size class — it must rely on inheriting the
    // row's text-label rather than falling back to the document default.
    expect(hint.className).not.toMatch(/text-(ui|meta|body|\[)/);
  });

  it('defaults to a non-heading title', () => {
    render(<SectionHeader title="Fields" />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders a real h2 when as="h2" is passed', () => {
    render(<SectionHeader as="h2" title="Recent sessions" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Recent sessions' })).toBeTruthy();
  });

  it('merges titleClassName onto the title element and lets it beat the default', () => {
    render(<SectionHeader title="Links" titleClassName="text-danger" />);
    const el = screen.getByText('Links');
    expect(el.className).toContain('text-danger');
  });
});
