import type { ProseNodeProps } from '@bh/markdown';
import { Prose } from '@bh/markdown';
import { Pill } from '@bh/ui';

// An app's own node, as it adds it to its editor: a chip naming one of its
// records. Prose draws it with the app's renderer, by the node's type.
function RecipeChip({ node }: ProseNodeProps) {
  const label = String(node.attrs?.['label'] ?? '');
  return (
    <a href={`#recipe-${label.toLowerCase()}`}>
      <Pill label={label} />
    </a>
  );
}

// Made once, outside the component, so Prose keeps its renderers.
const NODES = { recipeRef: RecipeChip };

const STORED = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Serve it with ' },
        { type: 'recipeRef', attrs: { id: 31, label: 'Salsa' } },
        { type: 'text', text: ' and ' },
        { type: 'recipeRef', attrs: { id: 7, label: 'Flatbread' } },
        { type: 'text', text: '.' },
      ],
    },
  ],
};

export function ChipsOfYourOwn() {
  return (
    <div className="flex flex-col gap-12">
      <Prose nodes={NODES}>{STORED}</Prose>
      {/* With no renderer for it, a node keeps its words. */}
      <Prose>{STORED}</Prose>
    </div>
  );
}
