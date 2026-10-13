import { EditorView } from '@codemirror/view';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeEditor } from '.';

const viewOf = (container: HTMLElement): EditorView => {
  const dom = container.querySelector<HTMLElement>('.cm-editor');
  const view = dom ? EditorView.findFromDOM(dom) : null;
  if (!view) {
    throw new Error('no editor');
  }
  return view;
};

const type = (view: EditorView, text: string) => {
  act(() => {
    view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
  });
};

describe('CodeEditor', () => {
  it('holds its value, and counts its lines in the strip', () => {
    const { container } = render(<CodeEditor value={'a\nb\nc'} title="setup" />);
    expect(viewOf(container).state.doc.toString()).toBe('a\nb\nc');
    expect(screen.getByText('setup')).toBeInTheDocument();
    expect(screen.getByText('3 lines')).toBeInTheDocument();
  });

  it('reports each edit as the whole text', () => {
    const onChange = vi.fn();
    const { container } = render(<CodeEditor value="echo" onChange={onChange} />);
    type(viewOf(container), ' hi\nexit');
    expect(onChange).toHaveBeenLastCalledWith('echo hi\nexit');
    expect(screen.getByText('2 lines')).toBeInTheDocument();
  });

  it('takes a new value from the page without reporting it as an edit', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<CodeEditor value="a" onChange={onChange} />);
    rerender(<CodeEditor value="b" onChange={onChange} />);
    expect(viewOf(container).state.doc.toString()).toBe('b');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is named by its title, its label, or the element it points at', () => {
    const { rerender } = render(<CodeEditor value="" title="setup" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'setup');
    rerender(<CodeEditor value="" title="setup" label="Setup script" id="setup" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Setup script');
    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'setup');
    rerender(<CodeEditor value="" title="setup" labelledBy="setup-label" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-labelledby', 'setup-label');
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-label');
  });

  it('shows without taking edits when read-only', () => {
    const { container } = render(<CodeEditor value="a" readOnly />);
    const view = viewOf(container);
    expect(view.state.readOnly).toBe(true);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true');
    expect(screen.queryByText(/^Ln /)).not.toBeInTheDocument();
  });

  it('marks a problem with the text', () => {
    render(<CodeEditor value="a" invalid />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('colours its language with the code block’s classes', () => {
    const { container } = render(
      <CodeEditor value={'FROM node:22\nRUN pnpm i'} lang="dockerfile" />,
    );
    expect(container.querySelector('.cm-content .text-indigo-11')).toHaveTextContent('FROM');
  });

  it('starts as tall as its minimum, in lines', () => {
    const { container } = render(<CodeEditor value="" minLines={3} />);
    const scroller = container.querySelector<HTMLElement>('.cm-scroller');
    expect(scroller && getComputedStyle(scroller).minHeight).toBe('80px');
  });
});
