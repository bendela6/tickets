import { useState } from 'react';
import * as v from 'valibot';
import { CodeBlock, keyboardBlock, noBlocks, type Renderer, toPrompt } from '@bh/markdown';
import { SegmentedControl } from '@bh/ui';

const plantSchema = v.object({
  name: v.string(),
  light: v.picklist(['sun', 'part shade', 'shade']),
});

const plantBlock: Renderer<v.InferOutput<typeof plantSchema>> = {
  name: 'plant',
  body: 'data',
  description: 'A plant: its `name`, and the `light` it wants (sun, part shade, shade).',
  schema: plantSchema,
  attributes: {
    size: { description: 'How much room its card takes.', values: ['small', 'large'] },
  },
  examples: [['- plant:', '    name: Fern', '    light: shade', '  size: small'].join('\n')],
  component: ({ data }) => <p>{data.name}</p>,
};

// keyboard's examples are written as markdown fences; the page form
// writes them again as page items.
const registry = noBlocks.register({ keyboard: keyboardBlock, plant: plantBlock });

const FORMS = [
  { value: 'page', label: 'Page items' },
  { value: 'markdown', label: 'Markdown' },
];

export function BothForms() {
  const [form, setForm] = useState('page');
  const prompt = toPrompt(registry.values(), { form: form === 'page' ? 'page' : 'markdown' });
  return (
    <div className="flex w-full flex-col gap-12">
      <SegmentedControl label="Form" options={FORMS} value={form} onChange={setForm} />
      <CodeBlock lang="markdown" value={prompt} />
    </div>
  );
}
