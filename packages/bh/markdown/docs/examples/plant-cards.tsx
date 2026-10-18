import { useState } from 'react';
import * as v from 'valibot';
import {
  BlockErrorCard,
  CodeBlock,
  DocView,
  markdownBlocks,
  type MarkdownElements,
  pageMarkdown,
  parsePage,
  type Renderer,
} from '@bh/markdown';
import { SegmentedControl } from '@bh/ui';

const plantSchema = v.object({
  name: v.pipe(v.string(), v.description('The plant, as its label names it.')),
  light: v.pipe(v.picklist(['sun', 'part shade', 'shade']), v.description('Where it grows best.')),
  water: v.pipe(v.string(), v.description('How often to water it, in words.')),
});

type Plant = v.InferOutput<typeof plantSchema>;

const plantBlock: Renderer<Plant> = {
  name: 'plant',
  body: 'data',
  group: 'Garden',
  description:
    'A plant: its `name`, the `light` it wants (sun, part shade, shade), and how often to `water` it.',
  schema: plantSchema,
  attributes: {
    size: { description: 'How much room its card takes.', values: ['small', 'large'] },
  },
  toMarkdown: (node) => {
    const plant = node.data as Plant;
    return `- **${plant.name}**: ${plant.light}, water ${plant.water}.`;
  },
  examples: [
    ['- plant:', '    name: Fern', '    light: shade', '    water: twice a week'].join('\n'),
  ],
  component: ({ data, attrs }) => {
    const small = attrs.size === 'small';
    return (
      <div className="rounded-8 border-gray-6 bg-gray-1 mt-8 border-1 px-12 py-8">
        <p className={small ? 'text-13 font-600 text-gray-12' : 'text-15 font-600 text-gray-12'}>
          {data.name}
        </p>
        <p className="text-12/18 text-gray-11">
          {data.light} · water {data.water}
        </p>
      </div>
    );
  },
};

const registry = markdownBlocks.register({ plant: plantBlock });

const elements: MarkdownElements = {
  p: (p) => <p {...p} className="text-13/20 text-gray-11" />,
  errorCard: BlockErrorCard,
};

const PAGE = `title: Balcony
summary: What grows where on the balcony.
body:
  - |
    Three pots, from the sunny corner to the shady one.
  - plant:
      name: Rosemary
      light: sun
      water: once a week
  - plant:
      name: Mint
      light: part shade
      water: every other day
    size: small
  - plant:
      name: Fern
      light: shade
      water: twice a week
`;

const VIEWS = [
  { value: 'page', label: 'Page' },
  { value: 'copy', label: 'Markdown copy' },
];

export function PlantCards() {
  const [view, setView] = useState('page');
  const page = parsePage(PAGE, registry);
  return (
    <div className="flex w-full max-w-480 flex-col gap-12">
      <SegmentedControl label="Show" options={VIEWS} value={view} onChange={setView} />
      {view === 'page' ? (
        <DocView doc={page} registry={registry} elements={elements} />
      ) : (
        <CodeBlock lang="markdown" value={pageMarkdown(page, registry, { title: 'Balcony' })} />
      )}
      {page.issues.map((issue) => {
        return (
          <p key={`${issue.line}:${issue.message}`} className="text-12/18 text-red-11 font-mono">
            line {issue.line}: {issue.block}: {issue.message}
          </p>
        );
      })}
    </div>
  );
}
