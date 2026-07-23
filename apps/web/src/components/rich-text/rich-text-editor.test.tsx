import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './rich-text-editor';
import { RichTextView } from './rich-text-view';

const storedDoc = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'from doc' }] }],
});

describe('RichTextEditor', () => {
  it('renders legacy markdown content', () => {
    render(<RichTextEditor value={'# Legacy\n\nbody'} onSave={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Legacy');
  });

  it('renders stored doc JSON and saves doc JSON on blur when changed', () => {
    const onSave = vi.fn();
    render(<RichTextEditor value={storedDoc} onSave={onSave} />);
    expect(screen.getByText('from doc')).toBeInTheDocument();
    const surface = document.querySelector('[contenteditable="true"]')!;
    fireEvent.blur(surface);
    expect(onSave).not.toHaveBeenCalled(); // unchanged → no save
  });

  it('compact features hide heading control; full shows it', () => {
    const { rerender } = render(<RichTextEditor value="" onSave={vi.fn()} features="full" />);
    expect(screen.getByRole('button', { name: /heading/i })).toBeInTheDocument();
    rerender(<RichTextEditor value="" onSave={vi.fn()} features="compact" />);
    expect(screen.queryByRole('button', { name: /heading/i })).not.toBeInTheDocument();
  });

  it('disabled editor is not editable', () => {
    render(<RichTextEditor value="" onSave={vi.fn()} disabled />);
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  });
});

describe('RichTextView', () => {
  it('renders a doc with a callout even though views never edit', () => {
    const doc = JSON.stringify({
      type: 'doc',
      content: [{ type: 'callout', attrs: { kind: 'warning' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'careful' }] }] }],
    });
    render(<RichTextView value={doc} />);
    expect(screen.getByText('careful')).toBeInTheDocument();
    expect(document.querySelector('[data-callout="warning"]')).not.toBeNull();
  });
});
