import { createRegistry, toExample } from '../registry';
import { MarkdownDoc } from '../render';
import { validateDocument } from '../validate';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlockErrorCard } from '../error-card';
import { markdownBlocks } from '.';

// Every block teaches by its examples (toPrompt shows them to an authoring
// model), so every example must be a page that validates and renders.

const registry = createRegistry(markdownBlocks);

const cases = markdownBlocks.flatMap((block) => {
  return block.examples.map((example, index) => {
    return { name: `${block.name} #${index + 1}`, source: toExample(example).source };
  });
});

describe('every block’s examples', () => {
  it.each(cases)('$name validates', ({ source }) => {
    expect(validateDocument(source, registry)).toEqual({ errors: [], warnings: [] });
  });

  it.each(cases)('$name renders without an error card', ({ source }) => {
    render(<MarkdownDoc source={source} registry={registry} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('BlockErrorCard', () => {
  it('says nothing rendered, names what, and lists one reason a line', () => {
    render(
      <MarkdownDoc
        source={'```callout\ntype: nope\ncontent: x\n```'}
        registry={registry}
        elements={{ errorCard: BlockErrorCard }}
      />,
    );
    const card = screen.getByRole('alert');
    expect(card).toHaveTextContent('Block not rendered');
    expect(card).toHaveTextContent('Block "callout" failed validation');
    const reasons = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toMatch(/^type: /);
    expect(reasons[1]).toMatch(/^title: /);
  });
});
