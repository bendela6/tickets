import { createRegistry, toExample } from '../../registry';
import { MarkdownDoc } from '../../render';
import { pageMarkdown, parsePage } from '../../page';
import { validateDocument } from '../../validate';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { markdownBlocks } from '..';
import { transcriptBlock } from '.';

const registry = createRegistry(markdownBlocks);
const fence = (...lines: string[]) => ['```transcript', ...lines, '```'].join('\n');

describe('transcript', () => {
  it('preserves the session byte for byte and does not parse markdown', () => {
    const { container } = render(
      <MarkdownDoc source={fence('$ curl /jobs', '    **not bold**')} registry={registry} />,
    );
    // textContent, not getByText: the default normalizer collapses whitespace
    // runs, so a matcher would pass even if the indentation were stripped.
    expect(container.querySelector('pre code')?.textContent).toBe('$ curl /jobs\n    **not bold**');
    expect(container.querySelector('strong')).toBeNull();
  });

  it('labels the box as a terminal so it is never mistaken for source', () => {
    const { container } = render(<MarkdownDoc source={fence('$ ls')} registry={registry} />);
    expect(screen.getByText('terminal')).toBeInTheDocument();
    expect(container.querySelector('[data-block="transcript"]')).not.toBeNull();
  });

  it('has no line numbers, no highlighting and no copy control', () => {
    const { container } = render(
      <MarkdownDoc source={fence('$ cat a.json', '{ "a": 1 }')} registry={registry} />,
    );
    expect(container.querySelector('[data-line]')).toBeNull();
    expect(container.querySelectorAll('pre code span')).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("reads as a plain fence in a page's markdown copy", () => {
    const yaml = ['body:', '  - transcript: |', '      $ curl /jobs', '      < 200 OK'].join('\n');
    const page = parsePage(yaml, registry);
    expect(page.issues).toEqual([]);
    expect(pageMarkdown(page, registry)).toBe(
      ['```', '$ curl /jobs', '< 200 OK', '```', ''].join('\n'),
    );
  });

  it('fences a session holding a fence with a longer run of backticks', () => {
    const yaml = ['body:', '  - transcript: |', '      $ cat a.md', '      ```', '      x'].join(
      '\n',
    );
    expect(pageMarkdown(parsePage(yaml, registry), registry)).toBe(
      ['````', '$ cat a.md', '```', 'x', '````', ''].join('\n'),
    );
  });
});

describe('transcript examples', () => {
  const cases = transcriptBlock.examples.map((example, index) => {
    return { name: `transcript #${index + 1}`, source: toExample(example).source };
  });

  it.each(cases)('$name validates', ({ source }) => {
    expect(validateDocument(source, registry)).toEqual({ errors: [], warnings: [] });
  });

  it.each(cases)('$name renders without an error card', ({ source }) => {
    render(<MarkdownDoc source={source} registry={registry} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('terminal')).toBeInTheDocument();
  });
});
