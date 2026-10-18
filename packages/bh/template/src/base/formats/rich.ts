import { readRichText } from '../../format/reading';
import { defineFormat } from '../../format/registry';
import { asText } from '../../format/write';

/** A rich text's words, a block to a line. */
export const richFormat = defineFormat({
  name: 'rich',
  kinds: ['richtext'],
  format: (value) => {
    return [{ text: readRichText(asText(value)) }];
  },
});
