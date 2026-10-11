import { fenced } from '../../page';
import type { Renderer } from '../../registry';
import { transcriptExamples } from './examples';
import { Transcript } from './transcript';

export const transcriptBlock: Renderer<string> = {
  name: 'transcript',
  group: 'Narrative',
  body: 'text',
  description:
    'A terminal transcript. The body is verbatim text: write the session exactly as it appears, ' +
    'with no YAML wrapper and no indentation requirements.',
  // A plain fence: no language, since a session is not source in any one of them.
  toMarkdown: (node) => fenced('', node.text ?? ''),
  examples: transcriptExamples,
  component: ({ data }) => <Transcript value={data} />,
};
