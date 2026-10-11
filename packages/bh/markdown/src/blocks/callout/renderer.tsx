import type { Renderer } from '../../registry';
import { Callout } from './callout';
import { calloutExamples } from './examples';
import { CALLOUT_TYPES, calloutSchema, type CalloutData } from './schema';

/**
 * A callout as plain markdown: a GitHub alert, whose five kinds are the
 * callout's own, with the title in bold above the content.
 */
function calloutMarkdown({ type, title, content }: CalloutData): string {
  const lines = [`[!${type.toUpperCase()}]`, `**${title}**`, '', ...content.trimEnd().split('\n')];
  return lines.map((line) => (line ? `> ${line}` : '>')).join('\n');
}

export const calloutBlock: Renderer<CalloutData> = {
  name: 'callout',
  group: 'Narrative',
  body: 'data',
  description:
    `A callout. \`type\` is one of ${CALLOUT_TYPES.join(', ')}. \`title\` is shown above the body. ` +
    '`content` is markdown: lists, links and nested blocks all work inside it.',
  schema: calloutSchema,
  toMarkdown: (node) => calloutMarkdown(node.data as CalloutData),
  examples: calloutExamples,
  component: ({ data }) => <Callout data={data} />,
};
