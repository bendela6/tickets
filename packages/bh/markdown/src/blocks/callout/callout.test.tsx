import { createRegistry } from '../../registry';
import { MarkdownDoc } from '../../render';
import { pageMarkdown, parsePage } from '../../page';
import { validateDocument } from '../../validate';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { markdownBlocks } from '..';
import { CALLOUT_TYPES } from './schema';

const registry = createRegistry(markdownBlocks);

const source = [
  '```callout',
  'type: warning',
  'title: Before you sync',
  'content: |',
  '  Commit `packages/bh` first:',
  '',
  '  - one',
  '  - two',
  '```',
].join('\n');

const at = (type: string) => `\`\`\`callout\ntype: ${type}\ntitle: T\ncontent: Body.\n\`\`\``;

describe('callout', () => {
  it('shows the title under a kicker naming its level', () => {
    render(<MarkdownDoc source={source} registry={registry} />);
    const note = screen.getByRole('note');
    expect(note).toHaveAttribute('data-type', 'warning');
    expect(note.firstElementChild).toHaveTextContent('Warning');
    expect(screen.getByText('Before you sync')).toBeInTheDocument();
  });

  it('renders content as markdown, not as literal text', () => {
    render(<MarkdownDoc source={source} registry={registry} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('packages/bh').tagName).toBe('CODE');
  });

  it('draws its content with the host’s elements', () => {
    render(
      <MarkdownDoc
        source={at('note')}
        registry={registry}
        elements={{ p: (props) => <p data-testid="host-p" {...props} /> }}
      />,
    );
    expect(screen.getByTestId('host-p')).toHaveTextContent('Body.');
  });

  it('renders every level', () => {
    for (const type of CALLOUT_TYPES) {
      const { unmount } = render(<MarkdownDoc source={at(type)} registry={registry} />);
      expect(screen.getByRole('note')).toHaveAttribute('data-type', type);
      unmount();
    }
  });

  it('rejects an unknown type', () => {
    const { errors } = validateDocument(at('warnign'), registry);
    expect(errors[0]).toMatchObject({ block: 'callout', path: 'type' });
  });

  it('rejects a callout with no title', () => {
    const { errors } = validateDocument('```callout\ntype: note\ncontent: Body.\n```', registry);
    expect(errors[0]).toMatchObject({ block: 'callout', path: 'title' });
  });

  it("reads as a GitHub alert in a page's markdown copy", () => {
    const yaml = [
      'body:',
      '  - callout:',
      '      type: warning',
      '      title: Before you sync',
      '      content: |',
      '        Commit first.',
      '',
      '        Then sync.',
    ].join('\n');
    const alert = ['> [!WARNING]', '> **Before you sync**', '>', '> Commit first.', '>'];
    expect(pageMarkdown(parsePage(yaml, registry), registry)).toBe(
      [...alert, '> Then sync.', ''].join('\n'),
    );
  });
});
