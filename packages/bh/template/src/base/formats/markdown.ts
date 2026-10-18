import { readMarkdown } from '../../format/reading';
import { defineFormat } from '../../format/registry';
import { asText } from '../../format/write';

/** Markdown without its marks. */
export const markdownFormat = defineFormat({
  name: 'markdown',
  kinds: ['markdown', 'text'],
  format: (value) => {
    return [{ text: readMarkdown(asText(value)) }];
  },
});
