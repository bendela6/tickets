import { readMarkdown } from '../../format/reading';
import { noFormats } from '../../format/registry';
import { asText } from '../../format/write';

/** Markdown without its marks. */
export const markdownFormat = noFormats.define({
  name: 'markdown',
  kinds: ['markdown', 'text'],
  format: (value) => {
    return [{ text: readMarkdown(asText(value)) }];
  },
});
