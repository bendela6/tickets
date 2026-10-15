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

  it.each([
    ['tsx', 'const a = <Card title="x" />;', 'const'],
    ['ts', 'let n: number = 1;', 'let'],
    ['markdown', '# Title\n\n```sh\nexport A=1\n```', 'export'],
  ])('colours %s', (lang, sample, keyword) => {
    const { container } = render(<CodeEditor value={sample} lang={lang} />);
    const keywords = [...container.querySelectorAll('.cm-content .text-indigo-11')];
    expect(keywords.map((node) => node.textContent)).toContain(keyword);
  });

  it("colours a markdown fence's code in the language the app names for it", () => {
    const sample = '```callout\ntype: tip\n```';
    const { container, rerender } = render(<CodeEditor value={sample} lang="markdown" />);
    // A fence named for no language the editor knows: plain.
    expect(container.querySelector('.cm-content .text-gray-12')).toBeNull();
    rerender(<CodeEditor value={sample} lang="markdown" fenceLanguage={() => 'yaml'} />);
    expect(container.querySelector('.cm-content .text-gray-12')).toHaveTextContent('type');
  });

  it('starts as tall as its minimum, in lines', () => {
    const { container } = render(<CodeEditor value="" minLines={3} />);
    const scroller = container.querySelector<HTMLElement>('.cm-scroller');
    expect(scroller && getComputedStyle(scroller).minHeight).toBe('84px');
  });

  describe('its problem lines', () => {
    const marked = (container: HTMLElement, severity: string) => {
      return [...container.querySelectorAll(`.cm-line.cm-problem-${severity}`)].map((line) => {
        return line.textContent;
      });
    };

    it('marks each line with a problem in its tone, the number and the line', () => {
      const { container } = render(
        <CodeEditor
          value={'a\nb\nc'}
          problems={
            new Map([
              [2, 'error'],
              [3, 'warning'],
            ])
          }
        />,
      );
      expect(marked(container, 'error')).toEqual(['b']);
      expect(marked(container, 'warning')).toEqual(['c']);
      expect(container.querySelector('.cm-gutterElement.cm-problem-error')).toHaveTextContent('2');
    });

    it('takes new problems from the page, and leaves out a line the text lacks', () => {
      const { container, rerender } = render(
        <CodeEditor value={'a\nb'} problems={new Map([[1, 'error']])} />,
      );
      rerender(
        <CodeEditor
          value={'a\nb'}
          problems={
            new Map([
              [2, 'warning'],
              [9, 'error'],
            ])
          }
        />,
      );
      expect(marked(container, 'error')).toEqual([]);
      expect(marked(container, 'warning')).toEqual(['b']);
    });

    it('moves them with the text as it is edited', () => {
      const { container } = render(
        <CodeEditor value={'a\nb'} problems={new Map([[2, 'error']])} />,
      );
      const view = viewOf(container);
      act(() => {
        view.dispatch({ changes: { from: 0, insert: 'new\n' } });
      });
      expect(marked(container, 'error')).toEqual(['b']);
    });
  });

  it('draws the lines alone when bare: no strip, still named and editable', () => {
    const { container } = render(<CodeEditor value={'a\nb'} title="setup" bare />);
    expect(screen.queryByText('2 lines')).not.toBeInTheDocument();
    expect(screen.queryByText('setup')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'setup');
    expect(viewOf(container).state.readOnly).toBe(false);
  });

  it('keeps its text when it turns bare', () => {
    const { container, rerender } = render(<CodeEditor value="a" />);
    const view = viewOf(container);
    rerender(<CodeEditor value="a" bare />);
    expect(viewOf(container)).toBe(view);
    expect(view.dom.isConnected).toBe(true);
  });

  it('runs the extensions the app adds', () => {
    const { container } = render(<CodeEditor value="a" extensions={EditorView.lineWrapping} />);
    expect(container.querySelector('.cm-content')).toHaveClass('cm-lineWrapping');
  });
});
