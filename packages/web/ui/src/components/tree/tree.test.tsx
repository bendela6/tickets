import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tree, TreeRow } from './tree';

afterEach(cleanup);

function row(overrides: Partial<Parameters<typeof TreeRow>[0]> = {}) {
  return (
    <TreeRow
      depth={0}
      expanded={false}
      hasChildren
      selected={false}
      focused={false}
      elementId="t-a"
      caretLabel="/home/me"
      onToggle={() => {}}
      onSelect={() => {}}
      {...overrides}
    >
      home
    </TreeRow>
  );
}

describe('Tree', () => {
  it('is a single tab stop that points at the focused row', () => {
    render(
      <Tree activeDescendant="t-a" onKeyDown={() => {}}>
        {row()}
      </Tree>,
    );
    const tree = screen.getByRole('tree');
    expect(tree).toHaveAttribute('tabindex', '0');
    expect(tree).toHaveAttribute('aria-activedescendant', 't-a');
    // Rows must NOT be tab stops — focus roves via activedescendant.
    expect(screen.getByRole('treeitem')).toHaveAttribute('tabindex', '-1');
  });

  it('names the caret so it can be found and operated', () => {
    const onToggle = vi.fn();
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ onToggle })}</Tree>);
    fireEvent.click(screen.getByRole('button', { name: /expand \/home\/me/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('says collapse once expanded', () => {
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ expanded: true })}</Tree>);
    expect(screen.getByRole('button', { name: /collapse \/home\/me/i })).toBeInTheDocument();
    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-expanded', 'true');
  });

  it('takes a caller-supplied accessible name for the treeitem', () => {
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ label: '~ home' })}</Tree>);
    expect(screen.getByRole('treeitem', { name: '~ home' })).toBeInTheDocument();
  });

  it('omits aria-expanded on a leaf and renders no caret button', () => {
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ hasChildren: false })}</Tree>);
    expect(screen.getByRole('treeitem')).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByRole('button', { name: /expand/i })).toBeNull();
  });

  it('renders one guide column per depth level', () => {
    const { container } = render(
      <Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ depth: 3 })}</Tree>,
    );
    expect(container.querySelectorAll('[data-tree-guide]')).toHaveLength(3);
  });

  it('announces depth via aria-level, since this tree is not nested DOM', () => {
    // WAI-ARIA requires aria-level on treeitem whenever the tree isn't
    // represented by real DOM nesting — exactly this shell's flat rows. depth
    // is 0-based; aria-level is 1-based.
    render(<Tree activeDescendant={undefined} onKeyDown={() => {}}>{row({ depth: 2 })}</Tree>);
    expect(screen.getByRole('treeitem')).toHaveAttribute('aria-level', '3');
  });

  it('accepts a caret override, for a loading spinner', () => {
    render(
      <Tree activeDescendant={undefined} onKeyDown={() => {}}>
        {row({ caret: <span data-testid="spinner" /> })}
      </Tree>,
    );
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('puts leading content OUTSIDE the treeitem, so an action there is its own control', () => {
    render(
      <Tree activeDescendant={undefined} onKeyDown={() => {}}>
        {row({ leading: <button type="button">hide</button> })}
      </Tree>,
    );
    const item = screen.getByRole('treeitem');
    expect(item.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'hide' })).toBeInTheDocument();
  });
});
