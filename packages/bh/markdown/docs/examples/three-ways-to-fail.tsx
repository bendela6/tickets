import {
  BlockErrorCard,
  createRegistry,
  markdownBlocks,
  MarkdownDoc,
  type MarkdownElements,
  type Renderer,
} from '@bh/markdown';

const EUROS = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });

// A block of the app's own, which throws on a price it can't read.
const priceBlock: Renderer<string> = {
  name: 'price',
  body: 'text',
  description: 'A price in euros: the amount as a number, drawn with its currency.',
  examples: [':::price\n12.50\n:::'],
  component: ({ data }) => {
    const amount = Number(data.trim());
    if (data.trim() === '' || Number.isNaN(amount)) {
      throw new Error(`"${data.trim()}" is not an amount`);
    }
    return <p className="text-15 font-600 text-gray-12 mt-8">{EUROS.format(amount)}</p>;
  },
};

const registry = createRegistry([...markdownBlocks, priceBlock]);

const elements: MarkdownElements = {
  h2: (p) => <h2 {...p} className="text-15 font-600 text-gray-12" />,
  p: (p) => <p {...p} className="text-13/20 text-gray-11 mt-8" />,
  errorCard: BlockErrorCard,
};

const DOC = `## Order 1042

It ships in two parts, each with its own price.

:::callout
type: tip
title: Tracking
content: Each part has its own tracking link.
:::

:::price
12.50
:::

:::price
twelve
:::

:::callout
type: tip
content: This one has no title.
:::

:::aside
No block is named aside.
:::
`;

export function ThreeWaysToFail() {
  return (
    <article className="w-full max-w-560">
      <MarkdownDoc source={DOC} registry={registry} elements={elements} />
    </article>
  );
}
