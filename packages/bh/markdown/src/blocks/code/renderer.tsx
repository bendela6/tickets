import { CodeBlock, LANGUAGES } from '@bh/code';
import { fenced } from '../../page';
import type { Renderer } from '../../registry';
import { codeExamples } from './examples';
import { parseRanges } from './ranges';

export const codeBlock: Renderer<string> = {
  name: 'code',
  body: 'text',
  group: 'Reference',
  description:
    'A code fragment, shown verbatim with line numbers and coloured by language. The body is the code itself. ' +
    `\`lang\` picks the grammar (${LANGUAGES.join(', ')}; any other shows plain), ` +
    '`file` names the fragment, `lines` marks the lines the passage is about ("3", "3-7", "3,9-11"), ' +
    'and `numbers` set to false drops the gutter (a single line has none unless `numbers` asks). ' +
    'In markdown the attributes go on the fence line: ```code{lang=ts file=src/app.ts lines=3-7}.',
  attributes: {
    lang: { description: `The grammar: ${LANGUAGES.join(', ')}. Any other shows plain.` },
    file: { description: 'The file the fragment comes from, named on its strip.' },
    lines: { description: 'The lines the passage is about: "3", "3-7", "3,9-11".' },
    numbers: {
      description:
        'Whether the gutter numbers the lines; by default it does when there are two or more.',
      type: 'boolean',
    },
  },
  toMarkdown: (node) => {
    return fenced(typeof node.attrs.lang === 'string' ? node.attrs.lang : '', node.text ?? '');
  },
  examples: codeExamples,
  component: ({ data, attrs }) => {
    // An attribute is a string, or `true` when written bare; only a string counts.
    const text = (name: string) => {
      const value = attrs[name];
      return typeof value === 'string' ? value : undefined;
    };
    return (
      <CodeBlock
        value={data}
        lang={text('lang')}
        file={text('file')}
        marked={parseRanges(text('lines'))}
        // A gutter numbering one line says nothing, so one line goes without unless asked.
        numbers={
          attrs.numbers === 'false'
            ? false
            : attrs.numbers !== undefined || data.trim().includes('\n')
        }
      />
    );
  },
};
