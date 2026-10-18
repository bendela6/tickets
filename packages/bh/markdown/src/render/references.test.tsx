import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { noBlocks } from '../registry/registry';
import type { Doc } from '../registry/types';
import { DocView, MarkdownDoc } from './doc-view';

const registry = noBlocks;

describe('image and reference nodes', () => {
  it('renders an image with its alt text, instead of dropping it', () => {
    render(<MarkdownDoc source={'![Architecture](/arch.png)'} registry={registry} />);
    expect(screen.getByRole('img', { name: 'Architecture' })).toHaveAttribute('src', '/arch.png');
  });

  it('resolves a full reference link through its definition, keeping the anchor text', () => {
    render(<MarkdownDoc source={'See [the runbook][rb].\n\n[rb]: /x.md'} registry={registry} />);
    expect(screen.getByRole('link', { name: 'the runbook' })).toHaveAttribute('href', '/x.md');
  });

  it('resolves an image reference through its definition', () => {
    render(<MarkdownDoc source={'![diagram][d]\n\n[d]: /d.png'} registry={registry} />);
    expect(screen.getByRole('img', { name: 'diagram' })).toHaveAttribute('src', '/d.png');
  });

  it('links a footnote reference to its definition and renders the definition body', () => {
    render(<MarkdownDoc source={'Sentence[^a].\n\n[^a]: body'} registry={registry} />);
    const reference = screen.getByRole('link', { name: 'a' });
    expect(reference).toHaveAttribute('href', '#fn-a');
    expect(reference).toHaveAttribute('id', 'fnref-a');
    expect(screen.getByText('body').closest('#fn-a')).not.toBeNull();
  });

  it('leaves an unresolved reference as literal text instead of dropping it', () => {
    // mdast emits a linkReference only when a matching definition exists, so a
    // missing one never arrives from a markdown string. The tree is built by
    // hand to reach the walker's own fallback.
    const doc: Doc = {
      frontmatter: {},
      headings: [],
      blocks: [],
      nodes: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'See ' },
            {
              type: 'linkReference',
              identifier: 'missing',
              label: 'missing',
              referenceType: 'full',
              children: [{ type: 'text', value: 'the runbook' }],
            },
            { type: 'text', value: '.' },
          ],
        },
      ],
    };
    render(<DocView doc={doc} registry={registry} />);
    expect(screen.getByText(/\[the runbook\]\[missing\]/)).toBeInTheDocument();
  });
});
